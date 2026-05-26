"""
Custom exception handling for authentication and API errors.

Implements Requirements 1.7, 11.7 for appropriate error responses with
descriptive messages and proper HTTP status codes.
"""

import logging
from django.http import Http404
from django.core.exceptions import PermissionDenied
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied as DRFPermissionDenied,
    ValidationError,
    NotFound
)

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns consistent error responses.
    
    Implements Requirements 1.7, 11.7: Unauthorized access error responses
    with appropriate HTTP status codes and descriptive messages.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # If no response was generated, handle the exception ourselves
    if response is None:
        return handle_generic_error(exc, context)
    
    # Customize the response format
    custom_response_data = {
        'error': get_error_code(exc),
        'message': get_error_message(exc),
        'timestamp': get_current_timestamp(),
    }
    
    # Add additional context for specific error types
    if isinstance(exc, ValidationError):
        custom_response_data['field_errors'] = response.data
    elif isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        custom_response_data['details'] = 'Please provide valid authentication credentials'
    elif isinstance(exc, (DRFPermissionDenied, PermissionDenied)):
        custom_response_data['details'] = 'You do not have permission to perform this action'
        # Add role information if available
        request = context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            custom_response_data['user_role'] = request.user.role
            custom_response_data['required_permission'] = get_required_permission(context)
    
    response.data = custom_response_data
    
    # Log the error for monitoring
    log_error(exc, context, response.status_code)
    
    return response


def handle_generic_error(exc, context):
    """Handle exceptions not caught by DRF's default handler."""
    if isinstance(exc, Http404):
        return Response({
            'error': 'NOT_FOUND',
            'message': 'The requested resource was not found',
            'timestamp': get_current_timestamp(),
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Log unexpected errors
    logger.error(f"Unhandled exception: {type(exc).__name__}: {str(exc)}", exc_info=True)
    
    return Response({
        'error': 'INTERNAL_SERVER_ERROR',
        'message': 'An unexpected error occurred',
        'timestamp': get_current_timestamp(),
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def get_error_code(exc):
    """Get standardized error code for exception."""
    error_code_mapping = {
        AuthenticationFailed: 'AUTHENTICATION_FAILED',
        NotAuthenticated: 'AUTH_REQUIRED',
        DRFPermissionDenied: 'INSUFFICIENT_PERMISSIONS',
        PermissionDenied: 'INSUFFICIENT_PERMISSIONS',
        ValidationError: 'VALIDATION_ERROR',
        NotFound: 'NOT_FOUND',
    }
    
    return error_code_mapping.get(type(exc), 'UNKNOWN_ERROR')


def get_error_message(exc):
    """Get user-friendly error message."""
    if isinstance(exc, AuthenticationFailed):
        return str(exc) or 'Authentication failed'
    elif isinstance(exc, NotAuthenticated):
        return 'Authentication required to access this resource'
    elif isinstance(exc, (DRFPermissionDenied, PermissionDenied)):
        return str(exc) or 'You do not have permission to perform this action'
    elif isinstance(exc, ValidationError):
        return 'Invalid input data provided'
    elif isinstance(exc, NotFound):
        return str(exc) or 'The requested resource was not found'
    else:
        return str(exc) or 'An error occurred'


def get_required_permission(context):
    """Extract required permission from view context."""
    view = context.get('view')
    if not view:
        return None
    
    # Check for required_roles attribute
    if hasattr(view, 'required_roles'):
        return f"Role must be one of: {', '.join(view.required_roles)}"
    
    # Check permission classes
    permission_classes = getattr(view, 'permission_classes', [])
    for permission_class in permission_classes:
        if hasattr(permission_class, '__name__'):
            if 'Owner' in permission_class.__name__:
                return 'OWNER role required'
            elif 'Operations' in permission_class.__name__:
                return 'OPERATIONS role or higher required'
            elif 'Cashier' in permission_class.__name__:
                return 'CASHIER role or higher required'
            elif 'Delivery' in permission_class.__name__:
                return 'DELIVERY role or higher required'
    
    return None


def get_current_timestamp():
    """Get current timestamp in ISO format."""
    from django.utils import timezone
    return timezone.now().isoformat()


def log_error(exc, context, status_code):
    """Log error details for monitoring."""
    request = context.get('request')
    view = context.get('view')
    
    log_data = {
        'exception_type': type(exc).__name__,
        'exception_message': str(exc),
        'status_code': status_code,
        'view': view.__class__.__name__ if view else None,
        'method': request.method if request else None,
        'path': request.path if request else None,
        'user': request.user.email if request and hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous',
    }
    
    if status_code >= 500:
        logger.error(f"Server error: {log_data}", exc_info=True)
    elif status_code >= 400:
        logger.warning(f"Client error: {log_data}")
    else:
        logger.info(f"Request processed: {log_data}")


class AuthenticationError(Exception):
    """Custom authentication error."""
    pass


class AuthorizationError(Exception):
    """Custom authorization error."""
    pass


class UserNotApprovedException(AuthenticationFailed):
    """Exception for unapproved user access attempts."""
    default_detail = 'User account is pending approval by an administrator'
    default_code = 'account_not_approved'


class InvalidRoleException(Exception):
    """Exception for invalid role assignments."""
    pass