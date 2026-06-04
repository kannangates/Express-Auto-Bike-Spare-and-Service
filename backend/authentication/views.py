"""
Authentication views for Google OAuth integration and user management.

Implements Requirements 1.1, 1.2, 1.3, 1.4 for Google OAuth, user registration,
approval workflow, and role-based access control.
"""

import logging
from datetime import timedelta
from typing import Dict, Any

from django.utils import timezone

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views import View

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle

import jwt
from google.auth.transport import requests
from google.oauth2 import id_token
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client

from .models import CustomUser, UserProfile
from .permissions import OwnerOnlyPermission
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserApprovalSerializer,
    TokenSerializer
)

logger = logging.getLogger(__name__)


class GoogleOAuthLoginView(APIView):
    """
    Initiate Google OAuth login flow.
    
    Implements Requirement 1.1: Google OAuth integration for single sign-on.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Return Google OAuth authorization URL."""
        try:
            # Get Google OAuth client configuration
            google_oauth_url = (
                f"https://accounts.google.com/o/oauth2/auth?"
                f"client_id={settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']}&"
                f"redirect_uri={request.build_absolute_uri('/api/v1/auth/google/callback/')}&"
                f"scope=openid email profile&"
                f"response_type=code&"
                f"access_type=online"
            )
            
            return Response({
                'authorization_url': google_oauth_url,
                'message': 'Redirect to this URL to start Google OAuth flow'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Google OAuth login error: {str(e)}")
            return Response({
                'error': 'OAUTH_CONFIG_ERROR',
                'message': 'Google OAuth configuration error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GoogleOAuthCallbackView(APIView):
    """
    Handle Google OAuth callback and user registration/login.

    Implements Requirements 1.1, 1.2: Google OAuth integration and user registration
    with default unapproved status.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    
    def get(self, request):
        """Handle Google OAuth callback with authorization code (GET request from Google)."""
        try:
            # Get authorization code from query parameters
            code = request.GET.get('code')
            if not code:
                return Response({
                    'error': 'MISSING_CODE',
                    'message': 'Authorization code is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Exchange authorization code for tokens
            import requests as http_requests
            token_url = 'https://oauth2.googleapis.com/token'
            
            google_client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
            google_client_secret = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['secret']
            redirect_uri = request.build_absolute_uri('/api/v1/auth/google/callback/')
            
            token_data = {
                'code': code,
                'client_id': google_client_id,
                'client_secret': google_client_secret,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code'
            }
            
            token_response = http_requests.post(token_url, data=token_data)
            
            if not token_response.ok:
                logger.error(f"Token exchange failed: {token_response.text}")
                return Response({
                    'error': 'TOKEN_EXCHANGE_FAILED',
                    'message': 'Failed to exchange authorization code for tokens'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            tokens = token_response.json()
            id_token_str = tokens.get('id_token')
            
            if not id_token_str:
                return Response({
                    'error': 'MISSING_ID_TOKEN',
                    'message': 'ID token not received from Google'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify and process the ID token
            return self._process_id_token(id_token_str, request)
            
        except Exception as e:
            logger.error(f"Google OAuth callback error: {str(e)}")
            return Response({
                'error': 'OAUTH_CALLBACK_ERROR',
                'message': 'Error processing Google OAuth callback'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """Process Google OAuth callback with ID token (POST request from frontend)."""
        try:
            # Get ID token from request
            id_token_str = request.data.get('id_token')
            if not id_token_str:
                return Response({
                    'error': 'MISSING_TOKEN',
                    'message': 'ID token is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return self._process_id_token(id_token_str, request)
            
        except Exception as e:
            logger.error(f"Google OAuth callback error: {str(e)}")
            return Response({
                'error': 'OAUTH_CALLBACK_ERROR',
                'message': 'Error processing Google OAuth callback'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_id_token(self, id_token_str: str, request) -> Response:
        """Process Google ID token and create/login user."""
        try:
            # Verify Google ID token
            try:
                google_client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
                idinfo = id_token.verify_oauth2_token(
                    id_token_str, 
                    requests.Request(), 
                    google_client_id
                )
                
                if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                    raise ValueError('Wrong issuer.')
                    
            except ValueError as e:
                logger.error(f"Invalid Google ID token: {str(e)}")
                return Response({
                    'error': 'INVALID_TOKEN',
                    'message': 'Invalid Google ID token'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Extract user information from Google token
            google_id = idinfo['sub']
            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            avatar_url = idinfo.get('picture', '')
            google_locale = idinfo.get('locale', '')
            google_hd = idinfo.get('hd', '')
            google_verified_email = idinfo.get('email_verified', None)
            # Store the full idinfo dict so nothing is ever lost
            google_raw_metadata = {k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                                   for k, v in idinfo.items()}

            # Lookup order:
            # 1. By google_id  — returning user who has signed in before
            # 2. By email      — account pre-created by create_owner (no google_id yet)
            # 3. Neither       — brand new user, create with unapproved status
            user = None
            created = False

            try:
                user = CustomUser.objects.get(google_id=google_id)
            except CustomUser.DoesNotExist:
                try:
                    # Account exists but google_id not linked yet (e.g. owner seeded
                    # via create_owner command) — link it now on first Google sign-in.
                    user = CustomUser.objects.get(email=email)
                    user.google_id = google_id
                    user.save(update_fields=['google_id'])
                    logger.info(f"Linked Google account to existing user: {email}")
                except CustomUser.DoesNotExist:
                    user = None

            if user is not None:
                created = False
                user.refresh_from_db()
            else:
                # Brand new user — create with default unapproved CUSTOMER status
                user = CustomUser.objects.create(
                    email=email,
                    google_id=google_id,
                    is_approved=False,
                    role='CUSTOMER'
                )
                created = True

            # Sync Google metadata into profile (non-fatal if it fails)
            try:
                profile, _ = UserProfile.objects.get_or_create(user=user)
                if created:
                    profile.first_name = profile.first_name or first_name
                    profile.last_name = profile.last_name or last_name
                profile.avatar_url = avatar_url or profile.avatar_url
                profile.google_locale = google_locale
                profile.google_hd = google_hd
                profile.google_verified_email = google_verified_email
                profile.google_raw_metadata = google_raw_metadata
                update_fields = [
                    'avatar_url', 'google_locale', 'google_hd',
                    'google_verified_email', 'google_raw_metadata'
                ]
                if created:
                    update_fields += ['first_name', 'last_name']
                profile.save(update_fields=update_fields)
            except Exception as profile_err:
                logger.warning(f"Could not sync Google metadata for {email}: {profile_err}")

            # Notify admins when a brand new user registers and needs approval
            if created:
                try:
                    from notifications.models import Notification
                    Notification.create_user_approval_notification(user)
                except Exception:
                    pass
                logger.info(f"New user registered: {email} (approval required)")

            # Check if user is approved (Requirement 1.3)
            if not user.is_approved:
                # Redirect to frontend with pending approval message
                frontend_url = settings.FRONTEND_URL
                redirect_url = f'{frontend_url}/approval-pending?email={email}'
                
                # For GET requests (from Google), redirect to frontend
                if request.method == 'GET':
                    from django.shortcuts import redirect
                    return redirect(redirect_url)
                
                # For POST requests, return JSON
                return Response({
                    'error': 'ACCOUNT_NOT_APPROVED',
                    'message': 'Your account is pending approval by an administrator',
                    'user_id': user.id,
                    'email': user.email,
                    'created': created,
                    'redirect_url': redirect_url
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Generate JWT tokens for approved user
            access_token = self._generate_access_token(user)
            refresh_token = self._generate_refresh_token(user)
            
            # Update last login
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            
            # Tokens in fragment (#) instead of query params — fragments are not sent to servers
            # and don't appear in access logs, Referer headers, or browser history server-side
            frontend_url = settings.FRONTEND_URL
            redirect_url = f'{frontend_url}/auth/callback#access_token={access_token}&refresh_token={refresh_token}'
            
            # For GET requests (from Google), redirect to frontend
            if request.method == 'GET':
                from django.shortcuts import redirect
                return redirect(redirect_url)
            
            # For POST requests (from frontend), return JSON
            return Response({
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'is_approved': user.is_approved,
                    'profile': {
                        'first_name': user.profile.first_name,
                        'last_name': user.profile.last_name,
                        'avatar_url': user.profile.avatar_url,
                        'phone': user.profile.phone
                    }
                },
                'tokens': {
                    'access': access_token,
                    'refresh': refresh_token
                },
                'created': created
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"ID token processing error: {str(e)}", exc_info=True)
            return Response({
                'error': 'TOKEN_PROCESSING_ERROR',
                'message': 'Error processing ID token',
                # Include detail in DEBUG mode so errors are visible during development
                **(({'detail': str(e)}) if settings.DEBUG else {})
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _generate_access_token(self, user: CustomUser) -> str:
        """Generate JWT access token for user."""
        # Include profile fields so the frontend getUserFromToken() can populate
        # the user object without an extra API round-trip.
        profile = getattr(user, 'profile', None)
        payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.role,
            'is_approved': user.is_approved,
            'first_name': profile.first_name if profile else '',
            'last_name': profile.last_name if profile else '',
            'phone': profile.phone if profile else '',
            'avatar_url': profile.avatar_url if profile else '',
            'exp': timezone.now() + timedelta(hours=1),  # 1 hour expiry
            'iat': timezone.now(),
            'type': 'access'
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')
    
    def _generate_refresh_token(self, user: CustomUser) -> str:
        """Generate JWT refresh token for user."""
        payload = {
            'user_id': user.id,
            'exp': timezone.now() + timedelta(days=7),  # 7 days expiry
            'iat': timezone.now(),
            'type': 'refresh'
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')


class UserRegistrationView(APIView):
    """
    Handle user registration (primarily for testing/admin purposes).

    Implements Requirement 1.2: User registration with default unapproved status.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    
    def post(self, request):
        """Register a new user."""
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            return Response({
                'message': 'User registered successfully. Approval required.',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'is_approved': user.is_approved
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'error': 'VALIDATION_ERROR',
            'message': 'Invalid registration data',
            'field_errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    """
    Get and update user profile information.
    
    Implements Requirements 8.2, 8.3: User profile data completeness.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current user profile."""
        try:
            user = request.user
            profile = user.profile
            
            return Response({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'google_id': user.google_id,
                    'role': user.role,
                    'is_approved': user.is_approved,
                    'date_joined': user.date_joined,
                    'last_login': user.last_login
                },
                'profile': {
                    'first_name': profile.first_name,
                    'last_name': profile.last_name,
                    'phone': profile.phone,
                    'avatar_url': profile.avatar_url,
                    'notification_preferences': profile.notification_preferences
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Profile retrieval error: {str(e)}")
            return Response({
                'error': 'PROFILE_ERROR',
                'message': 'Error retrieving user profile'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request):
        """Update user profile."""
        try:
            profile = request.user.profile
            serializer = UserProfileSerializer(profile, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response({
                    'message': 'Profile updated successfully',
                    'profile': serializer.data
                }, status=status.HTTP_200_OK)
            
            return Response({
                'error': 'VALIDATION_ERROR',
                'message': 'Invalid profile data',
                'field_errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Profile update error: {str(e)}")
            return Response({
                'error': 'PROFILE_UPDATE_ERROR',
                'message': 'Error updating user profile'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserListView(APIView):
    """
    List all users (OWNER only).
    
    Implements Requirement 1.4: Owner exclusive approval authority.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def get(self, request):
        """Get list of all users with optional filtering."""
        try:
            # Get query parameters for filtering
            is_approved = request.query_params.get('is_approved')
            role = request.query_params.get('role')
            search = request.query_params.get('search')

            # Start with all users
            users = CustomUser.objects.select_related('profile')
            
            # Apply filters
            if is_approved is not None:
                users = users.filter(is_approved=is_approved.lower() == 'true')
            
            if role:
                users = users.filter(role=role.upper())
            
            if search:
                users = users.filter(
                    Q(email__icontains=search) |
                    Q(profile__first_name__icontains=search) |
                    Q(profile__last_name__icontains=search)
                )
            
            # Serialize users
            users_data = []
            for user in users:
                users_data.append({
                    'id': user.id,
                    'email': user.email,
                    'google_id': user.google_id,
                    'role': user.role,
                    'is_approved': user.is_approved,
                    'is_active': user.is_active,
                    'date_joined': user.date_joined,
                    'last_login': user.last_login,
                    'profile': {
                        'first_name': user.profile.first_name if hasattr(user, 'profile') else '',
                        'last_name': user.profile.last_name if hasattr(user, 'profile') else '',
                        'phone': user.profile.phone if hasattr(user, 'profile') else '',
                        'avatar_url': user.profile.avatar_url if hasattr(user, 'profile') else ''
                    }
                })
            
            return Response(users_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"User list retrieval error: {str(e)}")
            return Response({
                'error': 'USER_LIST_ERROR',
                'message': 'Error retrieving users'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PendingUsersView(APIView):
    """
    List users pending approval (OWNER only).
    
    Implements Requirement 1.4: Owner exclusive approval authority.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def get(self, request):
        """Get list of users pending approval."""
        try:
            pending_users = CustomUser.objects.select_related('profile').filter(is_approved=False)
            
            users_data = []
            for user in pending_users:
                users_data.append({
                    'id': user.id,
                    'email': user.email,
                    'google_id': user.google_id,
                    'role': user.role,
                    'date_joined': user.date_joined,
                    'profile': {
                        'first_name': user.profile.first_name,
                        'last_name': user.profile.last_name,
                        'phone': user.profile.phone,
                        'avatar_url': user.profile.avatar_url
                    }
                })
            
            return Response({
                'pending_users': users_data,
                'count': len(users_data)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Pending users retrieval error: {str(e)}")
            return Response({
                'error': 'PENDING_USERS_ERROR',
                'message': 'Error retrieving pending users'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ApproveUserView(APIView):
    """
    Approve a user registration (OWNER only).
    
    Implements Requirements 1.4, 12.3: Owner exclusive approval authority and email notifications.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def post(self, request, user_id):
        """Approve a user."""
        try:
            user = get_object_or_404(CustomUser, id=user_id)
            
            # Get role from request data
            role = request.data.get('role', user.role)
            if role not in dict(CustomUser.ROLE_CHOICES):
                return Response({
                    'error': 'INVALID_ROLE',
                    'message': f'Invalid role: {role}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Approve user and set role
            user.is_approved = True
            user.role = role
            user.save(update_fields=['is_approved', 'role'])
            
            # Send approval notification email
            self._send_approval_notification(user, request.user)
            
            # Log audit activity (non-fatal)
            try:
                from notifications.models import AuditLog
                AuditLog.log_action(
                    user=request.user,
                    action='USER_APPROVED',
                    table_name='auth_user',
                    record_id=user.id,
                    new_values={'is_approved': True, 'role': role},
                    request=request
                )
            except Exception:
                pass
            
            logger.info(f"User approved: {user.email} with role {role} by {request.user.email}")
            
            return Response({
                'message': 'User approved successfully',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'isApproved': user.is_approved
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"User approval error: {str(e)}")
            return Response({
                'error': 'APPROVAL_ERROR',
                'message': 'Error approving user'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _send_approval_notification(self, user: CustomUser, approver: CustomUser):
        """Send approval notification to user."""
        try:
            from notifications.models import Notification
            
            # Create notification for approved user
            Notification.create_notification(
                recipient=user,
                notification_type='USER_APPROVED',
                title='Account Approved',
                message=f'Your account has been approved by {approver.get_full_name() or approver.email}. '
                       f'You now have {user.role} access to the Express Auto Bike Management System.',
                data={
                    'approver_id': approver.id,
                    'approver_email': approver.email,
                    'assigned_role': user.role
                },
                priority='HIGH'
            )
            
            logger.info(f"Approval notification sent to {user.email}")
            
        except Exception as e:
            logger.error(f"Failed to send approval notification to {user.email}: {str(e)}")


class RejectUserView(APIView):
    """
    Reject a user registration (OWNER only).
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def post(self, request, user_id):
        """Reject and delete a user."""
        try:
            user = get_object_or_404(CustomUser, id=user_id, is_approved=False)
            user_email = user.email
            user_role = user.role
            
            self._send_rejection_notification(user, request.user)
            
            try:
                from notifications.models import AuditLog
                AuditLog.log_action(
                    user=request.user,
                    action='USER_REJECTED',
                    table_name='auth_user',
                    record_id=user.id,
                    old_values={'email': user_email, 'role': user_role},
                    request=request
                )
            except Exception:
                pass
            
            user.delete()
            logger.info(f"User rejected and deleted: {user_email} by {request.user.email}")
            
            return Response({'message': 'User rejected and removed successfully'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"User rejection error: {str(e)}")
            return Response({'error': 'REJECTION_ERROR', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, user_id):
        return self.post(request, user_id)
    
    def _send_rejection_notification(self, user: CustomUser, rejector: CustomUser):
        """Send rejection notification to user."""
        try:
            from notifications.models import Notification
            
            # Create notification for rejected user
            Notification.create_notification(
                recipient=user,
                notification_type='USER_REJECTED',
                title='Account Registration Rejected',
                message=f'Your account registration has been rejected by {rejector.get_full_name() or rejector.email}. '
                       f'Please contact support if you believe this was an error.',
                data={
                    'rejector_id': rejector.id,
                    'rejector_email': rejector.email,
                    'requested_role': user.role
                },
                priority='HIGH'
            )
            
            logger.info(f"Rejection notification sent to {user.email}")
            
        except Exception as e:
            logger.error(f"Failed to send rejection notification to {user.email}: {str(e)}")


class RefreshTokenView(APIView):
    """
    Refresh JWT access token using refresh token.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    
    def post(self, request):
        """Refresh access token."""
        try:
            refresh_token = request.data.get('refresh_token')
            if not refresh_token:
                return Response({
                    'error': 'MISSING_TOKEN',
                    'message': 'Refresh token is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Decode and verify refresh token
            try:
                payload = jwt.decode(refresh_token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
                if payload.get('type') != 'refresh':
                    raise jwt.InvalidTokenError('Invalid token type')
                    
                user_id = payload.get('user_id')
                user = get_object_or_404(CustomUser, id=user_id)
                
                # Check if user is still approved
                if not user.is_approved:
                    return Response({
                        'error': 'ACCOUNT_NOT_APPROVED',
                        'message': 'Account approval has been revoked'
                    }, status=status.HTTP_403_FORBIDDEN)
                
                # Generate new access token
                access_token = self._generate_access_token(user)
                
                return Response({
                    'access_token': access_token
                }, status=status.HTTP_200_OK)
                
            except jwt.ExpiredSignatureError:
                return Response({
                    'error': 'TOKEN_EXPIRED',
                    'message': 'Refresh token has expired'
                }, status=status.HTTP_401_UNAUTHORIZED)
            except jwt.InvalidTokenError:
                return Response({
                    'error': 'INVALID_TOKEN',
                    'message': 'Invalid refresh token'
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            return Response({
                'error': 'TOKEN_REFRESH_ERROR',
                'message': 'Error refreshing token'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _generate_access_token(self, user: CustomUser) -> str:
        """Generate JWT access token for user."""
        profile = getattr(user, 'profile', None)
        payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.role,
            'is_approved': user.is_approved,
            'first_name': profile.first_name if profile else '',
            'last_name': profile.last_name if profile else '',
            'phone': profile.phone if profile else '',
            'avatar_url': profile.avatar_url if profile else '',
            'exp': timezone.now() + timedelta(hours=1),
            'iat': timezone.now(),
            'type': 'access'
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')


class VerifyTokenView(APIView):
    """
    Verify JWT token validity.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Verify token validity from Authorization header (GET method)."""
        try:
            # Get token from Authorization header
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return Response({
                    'error': 'MISSING_TOKEN',
                    'message': 'Authorization header with Bearer token is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            token = auth_header.split(' ')[1]
            
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
                user_id = payload.get('user_id')
                user = get_object_or_404(CustomUser, id=user_id)
                
                return Response({
                    'valid': True,
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'role': user.role,
                        'isApproved': user.is_approved  # Use camelCase for frontend
                    },
                    'expires_at': payload.get('exp')
                }, status=status.HTTP_200_OK)
                
            except jwt.ExpiredSignatureError:
                return Response({
                    'valid': False,
                    'error': 'TOKEN_EXPIRED',
                    'message': 'Token has expired'
                }, status=status.HTTP_401_UNAUTHORIZED)
            except jwt.InvalidTokenError:
                return Response({
                    'valid': False,
                    'error': 'INVALID_TOKEN',
                    'message': 'Invalid token'
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return Response({
                'valid': False,
                'error': 'VERIFICATION_ERROR',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """Verify token validity from request body (POST method)."""
        try:
            token = request.data.get('token')
            if not token:
                return Response({
                    'error': 'MISSING_TOKEN',
                    'message': 'Token is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
                user_id = payload.get('user_id')
                user = get_object_or_404(CustomUser, id=user_id)
                
                return Response({
                    'valid': True,
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'role': user.role,
                        'isApproved': user.is_approved  # Use camelCase for frontend
                    },
                    'expires_at': payload.get('exp')
                }, status=status.HTTP_200_OK)
                
            except jwt.ExpiredSignatureError:
                return Response({
                    'valid': False,
                    'error': 'TOKEN_EXPIRED',
                    'message': 'Token has expired'
                }, status=status.HTTP_401_UNAUTHORIZED)
            except jwt.InvalidTokenError:
                return Response({
                    'valid': False,
                    'error': 'INVALID_TOKEN',
                    'message': 'Invalid token'
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return Response({
                'error': 'TOKEN_VERIFICATION_ERROR',
                'message': 'Error verifying token'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PendingUserPhoneView(APIView):
    """
    Allow unapproved (pending) users to save their phone number before approval.

    No authentication required — only operates on accounts that are explicitly
    unapproved, so the attack surface is limited.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            email = request.data.get('email', '').strip()
            phone = request.data.get('phone', '').strip()

            if not email or not phone:
                return Response({
                    'error': 'MISSING_FIELDS',
                    'message': 'Both email and phone are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            if len(email) > 254 or len(phone) > 20:
                return Response({'error': 'Invalid input'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                user = CustomUser.objects.get(email=email, is_approved=False)
            except CustomUser.DoesNotExist:
                # Return success to avoid leaking whether an email exists
                return Response({'message': 'Phone number saved'}, status=status.HTTP_200_OK)

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.phone = phone
            profile.save(update_fields=['phone'])
            logger.info(f"Pending user {email} saved phone number")

            return Response({'message': 'Phone number saved successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error saving phone for pending user: {str(e)}", exc_info=True)
            return Response({
                'error': 'PHONE_SAVE_ERROR',
                'message': 'Failed to save phone number'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogoutView(APIView):
    """
    Handle user logout and token invalidation.
    
    Implements Requirement 8.4: Session termination on logout.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Logout user and invalidate tokens."""
        try:
            # In a production system, you would maintain a blacklist of invalidated tokens
            # For now, we'll just return success as JWT tokens are stateless
            
            logger.info(f"User logged out: {request.user.email}")
            
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return Response({
                'error': 'LOGOUT_ERROR',
                'message': 'Error during logout'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
