"""
Custom JWT authentication for Django REST Framework.

Implements JWT token validation and user authentication for API requests.
"""

import jwt
import logging
from datetime import datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

from rest_framework import authentication, exceptions
from rest_framework.authentication import BaseAuthentication

User = get_user_model()
logger = logging.getLogger(__name__)


class JWTAuthentication(BaseAuthentication):
    """
    Custom JWT authentication class for DRF.
    
    Validates JWT tokens and authenticates users for API requests.
    Implements Requirements 1.6, 1.7 for API authentication and error responses.
    """
    
    authentication_header_prefix = 'Bearer'
    
    def authenticate(self, request):
        """
        Authenticate user using JWT token from Authorization header.
        
        Returns:
            tuple: (user, token) if authentication successful, None otherwise
        """
        auth_header = authentication.get_authorization_header(request).split()
        
        if not auth_header or auth_header[0].lower() != self.authentication_header_prefix.lower().encode():
            return None
        
        if len(auth_header) == 1:
            msg = _('Invalid token header. No credentials provided.')
            raise exceptions.AuthenticationFailed(msg)
        elif len(auth_header) > 2:
            msg = _('Invalid token header. Token string should not contain spaces.')
            raise exceptions.AuthenticationFailed(msg)
        
        try:
            token = auth_header[1].decode('utf-8')
        except UnicodeError:
            msg = _('Invalid token header. Token string should not contain invalid characters.')
            raise exceptions.AuthenticationFailed(msg)
        
        return self.authenticate_credentials(token)
    
    def authenticate_credentials(self, token):
        """
        Validate JWT token and return user.
        
        Args:
            token (str): JWT token string
            
        Returns:
            tuple: (user, token) if valid
            
        Raises:
            AuthenticationFailed: If token is invalid or user not found
        """
        try:
            # Decode JWT token
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
            
            # Validate token type
            if payload.get('type') != 'access':
                raise exceptions.AuthenticationFailed(_('Invalid token type.'))
            
            # Get user from token
            user_id = payload.get('user_id')
            if not user_id:
                raise exceptions.AuthenticationFailed(_('Token contains no user identification.'))
            
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise exceptions.AuthenticationFailed(_('User not found.'))
            
            # Check if user is active
            if not user.is_active:
                raise exceptions.AuthenticationFailed(_('User account is disabled.'))
            
            # Check if user is approved (Requirement 1.3)
            if not user.is_approved:
                raise exceptions.AuthenticationFailed(_('User account is not approved.'))
            
            # Validate token expiry
            exp = payload.get('exp')
            if exp:
                import time
                if time.time() > exp:
                    raise exceptions.AuthenticationFailed(_('Token has expired.'))
            
            return (user, token)
            
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed(_('Token has expired.'))
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed(_('Invalid token.'))
        except Exception as e:
            logger.error(f"JWT authentication error: {str(e)}")
            raise exceptions.AuthenticationFailed(_('Token authentication failed.'))
    
    def authenticate_header(self, request):
        """
        Return authentication header for 401 responses.
        """
        return self.authentication_header_prefix


class OptionalJWTAuthentication(JWTAuthentication):
    """
    Optional JWT authentication that doesn't raise exceptions for missing tokens.
    
    Useful for endpoints that support both authenticated and anonymous access.
    """
    
    def authenticate(self, request):
        """
        Authenticate user if token is present, otherwise return None.
        """
        try:
            return super().authenticate(request)
        except exceptions.AuthenticationFailed:
            return None