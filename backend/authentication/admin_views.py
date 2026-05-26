"""
Admin interface views for user approval management.

Implements Requirements 1.4, 8.2, 8.3, 12.3 for user approval workflow,
profile management, and email notifications.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from django.contrib.auth.decorators import login_required
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import CustomUser, UserProfile
from .permissions import OwnerOnlyPermission
from .serializers import UserSerializer, PendingUserSerializer
from notifications.models import Notification, AuditLog

logger = logging.getLogger(__name__)


class AdminUserApprovalView(APIView):
    """
    Admin interface for user approval management.
    
    Implements Requirements 1.4, 12.3: Owner exclusive approval authority
    and email notifications for approval requests.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def get(self, request):
        """Get pending users with pagination and filtering."""
        try:
            # Get query parameters
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', 10))
            search = request.GET.get('search', '').strip()
            role_filter = request.GET.get('role', '').strip()
            sort_by = request.GET.get('sort_by', '-date_joined')
            
            # Build queryset
            queryset = CustomUser.objects.filter(is_approved=False).select_related('profile')
            
            # Apply search filter
            if search:
                queryset = queryset.filter(
                    Q(email__icontains=search) |
                    Q(profile__first_name__icontains=search) |
                    Q(profile__last_name__icontains=search) |
                    Q(google_id__icontains=search)
                )
            
            # Apply role filter
            if role_filter and role_filter in dict(CustomUser.ROLE_CHOICES):
                queryset = queryset.filter(role=role_filter)
            
            # Apply sorting
            valid_sort_fields = ['date_joined', '-date_joined', 'email', '-email', 'role', '-role']
            if sort_by in valid_sort_fields:
                queryset = queryset.order_by(sort_by)
            
            # Paginate results
            paginator = Paginator(queryset, page_size)
            page_obj = paginator.get_page(page)
            
            # Serialize users
            serializer = PendingUserSerializer(page_obj.object_list, many=True)
            
            return Response({
                'users': serializer.data,
                'pagination': {
                    'current_page': page_obj.number,
                    'total_pages': paginator.num_pages,
                    'total_count': paginator.count,
                    'has_next': page_obj.has_next(),
                    'has_previous': page_obj.has_previous(),
                    'page_size': page_size
                },
                'filters': {
                    'search': search,
                    'role': role_filter,
                    'sort_by': sort_by
                },
                'role_choices': dict(CustomUser.ROLE_CHOICES)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Admin user approval view error: {str(e)}")
            return Response({
                'error': 'ADMIN_VIEW_ERROR',
                'message': 'Error retrieving pending users'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminBulkApprovalView(APIView):
    """
    Bulk user approval operations for admin interface.
    
    Implements Requirements 1.4, 12.3: Bulk approval with notifications.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def post(self, request):
        """Bulk approve multiple users."""
        try:
            user_ids = request.data.get('user_ids', [])
            default_role = request.data.get('default_role', 'CUSTOMER')
            
            if not user_ids or not isinstance(user_ids, list):
                return Response({
                    'error': 'INVALID_INPUT',
                    'message': 'user_ids must be a non-empty list'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate default role
            if default_role not in dict(CustomUser.ROLE_CHOICES):
                return Response({
                    'error': 'INVALID_ROLE',
                    'message': f'Invalid role: {default_role}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get pending users
            users = CustomUser.objects.filter(
                id__in=user_ids,
                is_approved=False
            ).select_related('profile')
            
            if not users.exists():
                return Response({
                    'error': 'NO_USERS_FOUND',
                    'message': 'No pending users found with provided IDs'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Approve users
            approved_users = []
            for user in users:
                user.is_approved = True
                user.role = default_role
                user.save(update_fields=['is_approved', 'role'])
                
                # Send approval notification
                self._send_approval_notification(user, request.user)
                
                # Log audit activity
                AuditLog.log_action(
                    user=request.user,
                    action='USER_BULK_APPROVED',
                    table_name='auth_user',
                    record_id=user.id,
                    new_values={'is_approved': True, 'role': default_role},
                    request=request
                )
                
                approved_users.append({
                    'id': user.id,
                    'email': user.email,
                    'role': user.role
                })
            
            logger.info(f"Bulk approved {len(approved_users)} users by {request.user.email}")
            
            return Response({
                'message': f'Successfully approved {len(approved_users)} users',
                'approved_users': approved_users
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Bulk approval error: {str(e)}")
            return Response({
                'error': 'BULK_APPROVAL_ERROR',
                'message': 'Error during bulk approval'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _send_approval_notification(self, user: CustomUser, approver: CustomUser):
        """Send approval notification to user."""
        try:
            Notification.create_notification(
                recipient=user,
                notification_type='USER_APPROVED',
                title='Account Approved',
                message=f'Your account has been approved by {approver.get_full_name() or approver.email}. '
                       f'You now have {user.role} access to the Express Auto Bike Management System.',
                data={
                    'approver_id': approver.id,
                    'approver_email': approver.email,
                    'assigned_role': user.role,
                    'approval_date': timezone.now().isoformat()
                },
                priority='HIGH'
            )
        except Exception as e:
            logger.error(f"Failed to send approval notification to {user.email}: {str(e)}")


class AdminDashboardStatsView(APIView):
    """
    Admin dashboard statistics for user management.
    
    Provides overview statistics for the admin interface.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def get(self, request):
        """Get admin dashboard statistics."""
        try:
            # Get date range for statistics
            days = int(request.GET.get('days', 30))
            start_date = timezone.now() - timedelta(days=days)
            
            # User statistics
            total_users = CustomUser.objects.count()
            pending_users = CustomUser.objects.filter(is_approved=False).count()
            approved_users = CustomUser.objects.filter(is_approved=True).count()
            new_users_period = CustomUser.objects.filter(date_joined__gte=start_date).count()
            
            # Role distribution
            role_stats = CustomUser.objects.values('role').annotate(count=Count('role'))
            role_distribution = {item['role']: item['count'] for item in role_stats}
            
            # Recent activity
            recent_approvals = CustomUser.objects.filter(
                is_approved=True,
                updated_at__gte=start_date
            ).count()
            
            # Notification statistics
            pending_notifications = Notification.objects.filter(
                notification_type='USER_APPROVAL',
                is_read=False
            ).count()
            
            return Response({
                'user_stats': {
                    'total_users': total_users,
                    'pending_users': pending_users,
                    'approved_users': approved_users,
                    'new_users_last_30_days': new_users_period,
                    'approval_rate': round((approved_users / total_users * 100) if total_users > 0 else 0, 2)
                },
                'role_distribution': role_distribution,
                'recent_activity': {
                    'recent_approvals': recent_approvals,
                    'pending_notifications': pending_notifications
                },
                'period_days': days
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Admin dashboard stats error: {str(e)}")
            return Response({
                'error': 'DASHBOARD_STATS_ERROR',
                'message': 'Error retrieving dashboard statistics'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserProfileManagementView(APIView):
    """
    Admin interface for user profile management.
    
    Implements Requirements 8.2, 8.3 for user profile data management.
    """
    permission_classes = [IsAuthenticated, OwnerOnlyPermission]
    
    def get(self, request, user_id=None):
        """Get user profiles or specific user profile."""
        try:
            if user_id:
                # Get specific user profile
                user = get_object_or_404(CustomUser, id=user_id)
                serializer = UserSerializer(user)
                return Response({
                    'user': serializer.data
                }, status=status.HTTP_200_OK)
            else:
                # Get all user profiles with pagination
                page = int(request.GET.get('page', 1))
                page_size = int(request.GET.get('page_size', 20))
                search = request.GET.get('search', '').strip()
                
                queryset = CustomUser.objects.select_related('profile')
                
                if search:
                    queryset = queryset.filter(
                        Q(email__icontains=search) |
                        Q(profile__first_name__icontains=search) |
                        Q(profile__last_name__icontains=search)
                    )
                
                paginator = Paginator(queryset, page_size)
                page_obj = paginator.get_page(page)
                
                serializer = UserSerializer(page_obj.object_list, many=True)
                
                return Response({
                    'users': serializer.data,
                    'pagination': {
                        'current_page': page_obj.number,
                        'total_pages': paginator.num_pages,
                        'total_count': paginator.count,
                        'has_next': page_obj.has_next(),
                        'has_previous': page_obj.has_previous(),
                        'page_size': page_size
                    }
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Admin user profile management error: {str(e)}")
            return Response({
                'error': 'PROFILE_MANAGEMENT_ERROR',
                'message': 'Error retrieving user profiles'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request, user_id):
        """Update user profile."""
        try:
            user = get_object_or_404(CustomUser, id=user_id)
            
            # Update user fields
            user_data = request.data.get('user', {})
            if 'role' in user_data and user_data['role'] in dict(CustomUser.ROLE_CHOICES):
                user.role = user_data['role']
            if 'is_approved' in user_data:
                user.is_approved = user_data['is_approved']
            if 'is_active' in user_data:
                user.is_active = user_data['is_active']
            
            user.save()
            
            # Update profile fields
            profile_data = request.data.get('profile', {})
            if profile_data and hasattr(user, 'profile'):
                profile = user.profile
                for field in ['first_name', 'last_name', 'phone', 'avatar_url']:
                    if field in profile_data:
                        setattr(profile, field, profile_data[field])
                profile.save()
            
            serializer = UserSerializer(user)
            return Response({
                'message': 'User profile updated successfully',
                'user': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Admin user profile update error: {str(e)}")
            return Response({
                'error': 'PROFILE_UPDATE_ERROR',
                'message': 'Error updating user profile'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated, OwnerOnlyPermission])
def sync_google_profile_data(request, user_id):
    """
    Sync user profile data from Google OAuth.
    
    Implements Requirement 8.3: Google data integration for profile management.
    """
    try:
        user = get_object_or_404(CustomUser, id=user_id)
        
        if not user.google_id:
            return Response({
                'error': 'NO_GOOGLE_ID',
                'message': 'User does not have Google OAuth integration'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # In a real implementation, you would fetch fresh data from Google API
        # For now, we'll simulate updating profile with Google data
        profile = user.profile
        
        # Simulate Google data sync (in production, fetch from Google API)
        google_data = request.data.get('google_data', {})
        
        updated_fields = []
        if 'given_name' in google_data and google_data['given_name'] != profile.first_name:
            profile.first_name = google_data['given_name']
            updated_fields.append('first_name')
        
        if 'family_name' in google_data and google_data['family_name'] != profile.last_name:
            profile.last_name = google_data['family_name']
            updated_fields.append('last_name')
        
        if 'picture' in google_data and google_data['picture'] != profile.avatar_url:
            profile.avatar_url = google_data['picture']
            updated_fields.append('avatar_url')
        
        if updated_fields:
            profile.save(update_fields=updated_fields)
            
            # Log audit activity
            AuditLog.log_action(
                user=request.user,
                action='GOOGLE_PROFILE_SYNC',
                table_name='user_profile',
                record_id=profile.id,
                new_values={field: getattr(profile, field) for field in updated_fields},
                request=request
            )
            
            logger.info(f"Synced Google profile data for {user.email}: {updated_fields}")
        
        serializer = UserSerializer(user)
        return Response({
            'message': f'Profile sync completed. Updated fields: {", ".join(updated_fields) if updated_fields else "No changes"}',
            'user': serializer.data,
            'updated_fields': updated_fields
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Google profile sync error: {str(e)}")
        return Response({
            'error': 'PROFILE_SYNC_ERROR',
            'message': 'Error syncing Google profile data'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)