"""
API decorators for role-based access control.

Implements Requirements 1.4, 1.5, 1.6, 7.1, 7.3 for role-based access control
and Django admin access restriction.
"""

from functools import wraps
from typing import List, Union, Callable, Any
import logging

from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from rest_framework import status
from rest_framework.response import Response

from .models import CustomUser

logger = logging.getLogger(__name__)


def require_roles(roles: Union[str, List[str]]):
    """
    Decorator that requires user to have one of the specified roles.
    
    Args:
        roles: Single role string or list of role strings
        
    Usage:
        @require_roles('OWNER')
        @require_roles(['OWNER', 'OPERATIONS'])
        
    Implements Requirement 1.6: Role-based API access control.
    """
    if isinstance(roles, str):
        roles = [roles]
    
    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Check if user is authenticated
            if not request.user or not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'AUTH_REQUIRED',
                    'message': 'Authentication required to access this resource'
                }, status=401)
            
            # Check if user is approved
            if not request.user.is_approved:
                return JsonResponse({
                    'error': 'ACCOUNT_NOT_APPROVED',
                    'message': 'Account approval required to access this resource'
                }, status=403)
            
            # Check if user has required role
            if request.user.role not in roles:
                logger.warning(
                    f"Access denied: User {request.user.email} with role '{request.user.role}' "
                    f"attempted to access resource requiring roles {roles}"
                )
                return JsonResponse({
                    'error': 'INSUFFICIENT_PERMISSIONS',
                    'message': f"User role '{request.user.role}' does not have permission for this operation",
                    'required_roles': roles,
                    'user_role': request.user.role
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def require_owner(view_func: Callable) -> Callable:
    """
    Decorator that requires OWNER role.
    
    Implements Requirements 1.4, 7.1: Owner exclusive authority.
    """
    return require_roles('OWNER')(view_func)


def require_operations(view_func: Callable) -> Callable:
    """
    Decorator that requires OWNER or OPERATIONS role.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    return require_roles(['OWNER', 'OPERATIONS'])(view_func)


def require_cashier(view_func: Callable) -> Callable:
    """
    Decorator that requires OWNER, OPERATIONS, or CASHIER role.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    return require_roles(['OWNER', 'OPERATIONS', 'CASHIER'])(view_func)


def require_delivery(view_func: Callable) -> Callable:
    """
    Decorator that requires OWNER, OPERATIONS, or DELIVERY role.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    return require_roles(['OWNER', 'OPERATIONS', 'DELIVERY'])(view_func)


def require_approved_user(view_func: Callable) -> Callable:
    """
    Decorator that requires user to be authenticated and approved.
    
    Implements Requirement 1.3: Access control for unapproved users.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return JsonResponse({
                'error': 'AUTH_REQUIRED',
                'message': 'Authentication required to access this resource'
            }, status=401)
        
        # Check if user is approved
        if not request.user.is_approved:
            return JsonResponse({
                'error': 'ACCOUNT_NOT_APPROVED',
                'message': 'Account approval required to access this resource'
            }, status=403)
        
        return view_func(request, *args, **kwargs)
    return wrapper


def admin_required(view_func: Callable) -> Callable:
    """
    Decorator that restricts access to Django admin functionality to OWNER role only.
    
    Implements Requirements 7.1, 7.3: Django admin access restriction.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            logger.warning(f"Unauthenticated admin access attempt from {request.META.get('REMOTE_ADDR', 'unknown')}")
            return JsonResponse({
                'error': 'AUTH_REQUIRED',
                'message': 'Authentication required for admin access'
            }, status=401)
        
        # Check if user is approved
        if not request.user.is_approved:
            logger.warning(f"Unapproved user {request.user.email} attempted admin access")
            return JsonResponse({
                'error': 'ACCOUNT_NOT_APPROVED',
                'message': 'Account approval required for admin access'
            }, status=403)
        
        # Check if user has OWNER role
        if request.user.role != 'OWNER':
            logger.warning(
                f"Unauthorized admin access attempt by {request.user.email} "
                f"with role '{request.user.role}'"
            )
            return JsonResponse({
                'error': 'ADMIN_ACCESS_DENIED',
                'message': 'Django admin access restricted to OWNER role only',
                'user_role': request.user.role
            }, status=403)
        
        return view_func(request, *args, **kwargs)
    return wrapper


class RoleBasedViewMixin:
    """
    Mixin for class-based views to add role-based access control.
    
    Usage:
        class MyView(RoleBasedViewMixin, APIView):
            required_roles = ['OWNER', 'OPERATIONS']
            
    Implements Requirement 1.6: Role-based API access control.
    """
    required_roles = None
    
    def dispatch(self, request, *args, **kwargs):
        """Override dispatch to check role permissions."""
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return Response({
                'error': 'AUTH_REQUIRED',
                'message': 'Authentication required to access this resource'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if user is approved
        if not request.user.is_approved:
            return Response({
                'error': 'ACCOUNT_NOT_APPROVED',
                'message': 'Account approval required to access this resource'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check role requirements if specified
        if self.required_roles:
            if isinstance(self.required_roles, str):
                required_roles = [self.required_roles]
            else:
                required_roles = self.required_roles
            
            if request.user.role not in required_roles:
                logger.warning(
                    f"Access denied: User {request.user.email} with role '{request.user.role}' "
                    f"attempted to access {self.__class__.__name__} requiring roles {required_roles}"
                )
                return Response({
                    'error': 'INSUFFICIENT_PERMISSIONS',
                    'message': f"User role '{request.user.role}' does not have permission for this operation",
                    'required_roles': required_roles,
                    'user_role': request.user.role
                }, status=status.HTTP_403_FORBIDDEN)
        
        return super().dispatch(request, *args, **kwargs)


def validate_role_hierarchy(user_role: str, required_roles: List[str]) -> bool:
    """
    Validate if user role meets the hierarchy requirements.
    
    Role hierarchy (highest to lowest):
    OWNER > OPERATIONS > CASHIER/DELIVERY > CUSTOMER
    
    Args:
        user_role: User's current role
        required_roles: List of roles that can access the resource
        
    Returns:
        bool: True if user role is authorized
        
    Implements Requirement 1.5: Valid role assignment.
    """
    role_hierarchy = {
        'OWNER': 5,
        'OPERATIONS': 4,
        'CASHIER': 3,
        'DELIVERY': 3,
        'CUSTOMER': 1
    }
    
    user_level = role_hierarchy.get(user_role, 0)
    required_levels = [role_hierarchy.get(role, 0) for role in required_roles]
    
    return user_level >= min(required_levels) if required_levels else False


def log_access_attempt(user, resource: str, success: bool, reason: str = None):
    """
    Log access attempts for audit purposes.
    
    Implements Requirement 7.5: Admin activity audit logging.
    """
    status_msg = "SUCCESS" if success else "DENIED"
    user_info = f"{user.email} (role: {user.role})" if user.is_authenticated else "anonymous"
    
    log_message = f"Access {status_msg}: {user_info} -> {resource}"
    if reason:
        log_message += f" - {reason}"
    
    if success:
        logger.info(log_message)
    else:
        logger.warning(log_message)


# Convenience decorators for common role combinations
require_admin_or_operations = require_roles(['OWNER', 'OPERATIONS'])
require_staff = require_roles(['OWNER', 'OPERATIONS', 'CASHIER', 'DELIVERY'])
require_any_role = require_approved_user  # Any approved user