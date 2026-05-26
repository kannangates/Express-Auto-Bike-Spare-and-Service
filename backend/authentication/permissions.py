"""
Custom permission classes for role-based access control.

Implements Requirements 1.4, 1.6, 7.1, 7.3 for role-based permissions and
Django admin access restriction.
"""

from rest_framework import permissions
from rest_framework.permissions import BasePermission


class OwnerOnlyPermission(BasePermission):
    """
    Permission class that allows access only to users with OWNER role.
    
    Implements Requirements 1.4, 7.1: Owner exclusive authority for user approval
    and Django admin access.
    """
    
    def has_permission(self, request, view):
        """Check if user has OWNER role and is approved."""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'OWNER' and
            request.user.is_approved
        )


class OperationsPermission(BasePermission):
    """
    Permission class for operations-level access (OWNER, OPERATIONS).
    
    Implements Requirement 1.6: Role-based API access control.
    """
    
    def has_permission(self, request, view):
        """Check if user has operations-level permissions."""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ['OWNER', 'OPERATIONS'] and
            request.user.is_approved
        )


class CashierPermission(BasePermission):
    """
    Permission class for cashier-level access (OWNER, OPERATIONS, CASHIER).
    
    Implements Requirement 1.6: Role-based API access control.
    """
    
    def has_permission(self, request, view):
        """Check if user has cashier-level permissions."""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ['OWNER', 'OPERATIONS', 'CASHIER'] and
            request.user.is_approved
        )


class DeliveryPermission(BasePermission):
    """
    Permission class for delivery-level access (OWNER, OPERATIONS, DELIVERY).
    
    Implements Requirement 1.6: Role-based API access control.
    """
    
    def has_permission(self, request, view):
        """Check if user has delivery-level permissions."""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ['OWNER', 'OPERATIONS', 'DELIVERY'] and
            request.user.is_approved
        )


class CustomerPermission(BasePermission):
    """
    Permission class for customer-level access (all roles).
    
    Implements Requirement 1.6: Role-based API access control.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and approved."""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.is_approved
        )


class ApprovedUserPermission(BasePermission):
    """
    Permission class that requires user to be approved.
    
    Implements Requirement 1.3: Access control for unapproved users.
    """
    
    def has_permission(self, request, view):
        """Check if user is authenticated and approved."""
        return (
            request.user and
            request.user.is_authenticated and
            request.user.is_approved
        )


class RoleBasedPermission(BasePermission):
    """
    Flexible permission class that accepts required roles.
    
    Usage: Add required_roles attribute to view class.
    Example: required_roles = ['OWNER', 'OPERATIONS']
    """
    
    def has_permission(self, request, view):
        """Check if user's role is in the required roles."""
        if not (request.user and request.user.is_authenticated and request.user.is_approved):
            return False
        
        required_roles = getattr(view, 'required_roles', [])
        if not required_roles:
            return True  # No specific role requirement
        
        return request.user.role in required_roles


def role_required(roles):
    """
    Decorator function to create role-based permission classes.
    
    Args:
        roles (list): List of role strings that are allowed
        
    Returns:
        BasePermission: Permission class for the specified roles
    """
    class RoleRequiredPermission(BasePermission):
        def has_permission(self, request, view):
            return (
                request.user and
                request.user.is_authenticated and
                request.user.role in roles and
                request.user.is_approved
            )
    
    return RoleRequiredPermission