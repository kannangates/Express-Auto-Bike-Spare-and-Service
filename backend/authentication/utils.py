"""
Utility functions for role-based access control and authentication.

Implements Requirements 1.4, 1.5, 1.6, 7.1, 7.3 for role-based permissions
and Django admin access restriction.
"""

from typing import List, Dict, Any, Optional
import logging
from django.contrib.auth import get_user_model
from django.http import HttpRequest

from .models import CustomUser

logger = logging.getLogger(__name__)

User = get_user_model()


class RoleManager:
    """
    Centralized role management and validation.
    
    Implements Requirements 1.5, 1.6: Valid role assignment and role-based access control.
    """
    
    # Role hierarchy levels (higher number = more permissions)
    ROLE_HIERARCHY = {
        'OWNER': 5,
        'OPERATIONS': 4,
        'CASHIER': 3,
        'DELIVERY': 3,
        'CUSTOMER': 1
    }
    
    # Role permissions mapping
    ROLE_PERMISSIONS = {
        'OWNER': [
            'admin_access',
            'user_approval',
            'inventory_management',
            'order_management',
            'returns_management',
            'reports_access',
            'system_configuration'
        ],
        'OPERATIONS': [
            'inventory_management',
            'order_management',
            'returns_management',
            'reports_access'
        ],
        'CASHIER': [
            'order_management',
            'returns_management',
            'payment_processing'
        ],
        'DELIVERY': [
            'order_fulfillment',
            'delivery_management'
        ],
        'CUSTOMER': [
            'order_placement',
            'order_viewing',
            'profile_management'
        ]
    }
    
    @classmethod
    def is_valid_role(cls, role: str) -> bool:
        """Check if role is valid."""
        return role in cls.ROLE_HIERARCHY
    
    @classmethod
    def get_role_level(cls, role: str) -> int:
        """Get numeric level for role."""
        return cls.ROLE_HIERARCHY.get(role, 0)
    
    @classmethod
    def has_permission(cls, user_role: str, permission: str) -> bool:
        """Check if role has specific permission."""
        return permission in cls.ROLE_PERMISSIONS.get(user_role, [])
    
    @classmethod
    def can_access_role(cls, user_role: str, required_roles: List[str]) -> bool:
        """Check if user role can access resource requiring specific roles."""
        return user_role in required_roles
    
    @classmethod
    def get_accessible_roles(cls, user_role: str) -> List[str]:
        """Get list of roles that user can manage (same level or lower)."""
        user_level = cls.get_role_level(user_role)
        return [role for role, level in cls.ROLE_HIERARCHY.items() if level <= user_level]
    
    @classmethod
    def get_role_description(cls, role: str) -> str:
        """Get human-readable description of role."""
        descriptions = {
            'OWNER': 'System Owner - Full access including Django admin',
            'OPERATIONS': 'Operations Manager - Inventory and order management',
            'CASHIER': 'Cashier - Order processing and returns',
            'DELIVERY': 'Delivery Personnel - Order fulfillment',
            'CUSTOMER': 'Customer - Order placement and viewing'
        }
        return descriptions.get(role, 'Unknown role')


def check_user_permissions(user: CustomUser, required_roles: List[str]) -> Dict[str, Any]:
    """
    Comprehensive user permission check.
    
    Args:
        user: User instance to check
        required_roles: List of roles that can access the resource
        
    Returns:
        Dict with permission check results
        
    Implements Requirements 1.3, 1.6: Access control and role-based permissions.
    """
    result = {
        'allowed': False,
        'reason': None,
        'user_role': None,
        'required_roles': required_roles
    }
    
    # Check if user exists and is authenticated
    if not user or not user.is_authenticated:
        result['reason'] = 'User not authenticated'
        return result
    
    result['user_role'] = user.role
    
    # Check if user is approved
    if not user.is_approved:
        result['reason'] = 'User account not approved'
        return result
    
    # Check if user has valid role
    if not RoleManager.is_valid_role(user.role):
        result['reason'] = f'Invalid user role: {user.role}'
        return result
    
    # Check if user role is in required roles
    if not RoleManager.can_access_role(user.role, required_roles):
        result['reason'] = f'User role {user.role} not in required roles {required_roles}'
        return result
    
    result['allowed'] = True
    return result


def get_user_menu_items(user: CustomUser) -> List[Dict[str, Any]]:
    """
    Get menu items based on user role.
    
    Implements Requirements 8.1, 8.5: Role-based UI adaptation.
    """
    if not user or not user.is_authenticated or not user.is_approved:
        return []
    
    base_items = [
        {'name': 'Dashboard', 'path': '/dashboard', 'icon': 'dashboard'},
        {'name': 'Profile', 'path': '/profile', 'icon': 'user'}
    ]
    
    role_items = {
        'OWNER': [
            {'name': 'User Management', 'path': '/admin/users', 'icon': 'users'},
            {'name': 'Django Admin', 'path': '/admin/', 'icon': 'settings'},
            {'name': 'System Reports', 'path': '/reports', 'icon': 'chart'},
            {'name': 'Inventory', 'path': '/inventory', 'icon': 'package'},
            {'name': 'Orders', 'path': '/orders', 'icon': 'shopping-cart'},
            {'name': 'Returns', 'path': '/returns', 'icon': 'rotate-ccw'}
        ],
        'OPERATIONS': [
            {'name': 'Inventory', 'path': '/inventory', 'icon': 'package'},
            {'name': 'Orders', 'path': '/orders', 'icon': 'shopping-cart'},
            {'name': 'Returns', 'path': '/returns', 'icon': 'rotate-ccw'},
            {'name': 'Reports', 'path': '/reports', 'icon': 'chart'}
        ],
        'CASHIER': [
            {'name': 'Orders', 'path': '/orders', 'icon': 'shopping-cart'},
            {'name': 'Returns', 'path': '/returns', 'icon': 'rotate-ccw'},
            {'name': 'Payments', 'path': '/payments', 'icon': 'credit-card'}
        ],
        'DELIVERY': [
            {'name': 'Deliveries', 'path': '/deliveries', 'icon': 'truck'},
            {'name': 'Orders', 'path': '/orders', 'icon': 'shopping-cart'}
        ],
        'CUSTOMER': [
            {'name': 'My Orders', 'path': '/my-orders', 'icon': 'shopping-bag'},
            {'name': 'Place Order', 'path': '/order/new', 'icon': 'plus-circle'}
        ]
    }
    
    return base_items + role_items.get(user.role, [])


def can_access_django_admin(user: CustomUser) -> bool:
    """
    Check if user can access Django admin.
    
    Implements Requirements 7.1, 7.3: Django admin access restriction.
    """
    return (
        user and
        user.is_authenticated and
        user.is_approved and
        user.role == 'OWNER'
    )


def log_permission_check(user: CustomUser, resource: str, allowed: bool, reason: str = None):
    """
    Log permission checks for audit purposes.
    
    Implements Requirement 7.5: Admin activity audit logging.
    """
    user_info = f"{user.email} (role: {user.role})" if user and user.is_authenticated else "anonymous"
    status = "ALLOWED" if allowed else "DENIED"
    
    log_message = f"Permission {status}: {user_info} -> {resource}"
    if reason:
        log_message += f" - {reason}"
    
    if allowed:
        logger.info(log_message)
    else:
        logger.warning(log_message)


def get_role_based_queryset_filter(user: CustomUser, model_name: str) -> Dict[str, Any]:
    """
    Get queryset filters based on user role for data access control.
    
    Args:
        user: User instance
        model_name: Name of the model being queried
        
    Returns:
        Dict of filter parameters
        
    Implements Requirement 1.6: Role-based API access control.
    """
    if not user or not user.is_authenticated or not user.is_approved:
        return {'pk__in': []}  # No access
    
    # OWNER and OPERATIONS can see all data
    if user.role in ['OWNER', 'OPERATIONS']:
        return {}
    
    # Role-specific filters
    filters = {
        'CASHIER': {
            'Order': {},  # Can see all orders
            'Return': {},  # Can see all returns
            'Customer': {}  # Can see all customers
        },
        'DELIVERY': {
            'Order': {'status__in': ['CONFIRMED', 'PROCESSING', 'SHIPPED']},  # Only orders for delivery
            'Customer': {}  # Can see customers for delivery
        },
        'CUSTOMER': {
            'Order': {'customer': user},  # Only own orders
            'Return': {'customer': user}  # Only own returns
        }
    }
    
    return filters.get(user.role, {}).get(model_name, {'pk__in': []})


def validate_role_transition(from_role: str, to_role: str, requesting_user: CustomUser) -> Dict[str, Any]:
    """
    Validate if role transition is allowed.
    
    Args:
        from_role: Current role
        to_role: Target role
        requesting_user: User making the change
        
    Returns:
        Dict with validation results
        
    Implements Requirements 1.4, 1.5: Owner exclusive approval authority and valid role assignment.
    """
    result = {
        'allowed': False,
        'reason': None
    }
    
    # Only OWNER can change roles
    if requesting_user.role != 'OWNER':
        result['reason'] = 'Only OWNER can change user roles'
        return result
    
    # Validate target role
    if not RoleManager.is_valid_role(to_role):
        result['reason'] = f'Invalid target role: {to_role}'
        return result
    
    # Prevent creating multiple OWNER accounts (business rule)
    if to_role == 'OWNER' and from_role != 'OWNER':
        owner_count = User.objects.filter(role='OWNER', is_approved=True).count()
        if owner_count >= 1:
            result['reason'] = 'Only one OWNER account is allowed'
            return result
    
    result['allowed'] = True
    return result


def get_api_error_response(error_code: str, message: str, **kwargs) -> Dict[str, Any]:
    """
    Generate standardized API error response.
    
    Implements Requirements 1.7, 11.7: Unauthorized access error responses.
    """
    response = {
        'error': error_code,
        'message': message,
        'timestamp': None  # Will be set by serializer
    }
    response.update(kwargs)
    return response