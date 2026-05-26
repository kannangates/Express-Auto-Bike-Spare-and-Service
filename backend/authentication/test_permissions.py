"""
Tests for role-based permission system.

Tests Requirements 1.4, 1.5, 1.6, 7.1, 7.3 for role-based permissions
and Django admin access restriction.
"""

import pytest
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import Mock, patch

from .models import CustomUser, UserProfile
from .permissions import (
    OwnerOnlyPermission,
    OperationsPermission,
    CashierPermission,
    DeliveryPermission,
    CustomerPermission,
    ApprovedUserPermission,
    RoleBasedPermission,
    role_required
)
from .decorators import (
    require_roles,
    require_owner,
    require_operations,
    require_cashier,
    require_delivery,
    require_approved_user,
    admin_required,
    RoleBasedViewMixin
)
from .utils import (
    RoleManager,
    check_user_permissions,
    can_access_django_admin,
    validate_role_transition
)
from .admin import RestrictedAdminSite

User = get_user_model()


class RoleBasedPermissionTestCase(TestCase):
    """Test role-based permission classes."""
    
    def setUp(self):
        """Set up test data."""
        self.factory = RequestFactory()
        
        # Create users with different roles
        self.owner = User.objects.create(
            email='owner@test.com',
            role='OWNER',
            is_approved=True,
            google_id='owner123'
        )
        
        self.operations = User.objects.create(
            email='operations@test.com',
            role='OPERATIONS',
            is_approved=True,
            google_id='ops123'
        )
        
        self.cashier = User.objects.create(
            email='cashier@test.com',
            role='CASHIER',
            is_approved=True,
            google_id='cashier123'
        )
        
        self.delivery = User.objects.create(
            email='delivery@test.com',
            role='DELIVERY',
            is_approved=True,
            google_id='delivery123'
        )
        
        self.customer = User.objects.create(
            email='customer@test.com',
            role='CUSTOMER',
            is_approved=True,
            google_id='customer123'
        )
        
        self.unapproved = User.objects.create(
            email='unapproved@test.com',
            role='CUSTOMER',
            is_approved=False,
            google_id='unapproved123'
        )
    
    def test_owner_only_permission(self):
        """Test OwnerOnlyPermission class."""
        permission = OwnerOnlyPermission()
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with non-owner user
        request.user = self.operations
        self.assertFalse(permission.has_permission(request, None))
        
        # Test with unapproved user
        request.user = self.unapproved
        self.assertFalse(permission.has_permission(request, None))
    
    def test_operations_permission(self):
        """Test OperationsPermission class."""
        permission = OperationsPermission()
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with operations user
        request.user = self.operations
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with cashier user
        request.user = self.cashier
        self.assertFalse(permission.has_permission(request, None))
    
    def test_cashier_permission(self):
        """Test CashierPermission class."""
        permission = CashierPermission()
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with operations user
        request.user = self.operations
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with cashier user
        request.user = self.cashier
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with delivery user
        request.user = self.delivery
        self.assertFalse(permission.has_permission(request, None))
        
        # Test with customer user
        request.user = self.customer
        self.assertFalse(permission.has_permission(request, None))
    
    def test_delivery_permission(self):
        """Test DeliveryPermission class."""
        permission = DeliveryPermission()
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with operations user
        request.user = self.operations
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with delivery user
        request.user = self.delivery
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with cashier user
        request.user = self.cashier
        self.assertFalse(permission.has_permission(request, None))
    
    def test_customer_permission(self):
        """Test CustomerPermission class."""
        permission = CustomerPermission()
        
        # Test with all approved users
        for user in [self.owner, self.operations, self.cashier, self.delivery, self.customer]:
            request = self.factory.get('/')
            request.user = user
            self.assertTrue(permission.has_permission(request, None))
        
        # Test with unapproved user
        request.user = self.unapproved
        self.assertFalse(permission.has_permission(request, None))
    
    def test_approved_user_permission(self):
        """Test ApprovedUserPermission class."""
        permission = ApprovedUserPermission()
        
        # Test with approved user
        request = self.factory.get('/')
        request.user = self.customer
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with unapproved user
        request.user = self.unapproved
        self.assertFalse(permission.has_permission(request, None))
    
    def test_role_based_permission(self):
        """Test RoleBasedPermission class."""
        permission = RoleBasedPermission()
        
        # Mock view with required roles
        view = Mock()
        view.required_roles = ['OWNER', 'OPERATIONS']
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        self.assertTrue(permission.has_permission(request, view))
        
        # Test with operations user
        request.user = self.operations
        self.assertTrue(permission.has_permission(request, view))
        
        # Test with cashier user
        request.user = self.cashier
        self.assertFalse(permission.has_permission(request, view))
        
        # Test view without required roles
        view.required_roles = []
        request.user = self.customer
        self.assertTrue(permission.has_permission(request, view))
    
    def test_role_required_decorator_function(self):
        """Test role_required decorator function."""
        permission_class = role_required(['OWNER', 'OPERATIONS'])
        permission = permission_class()
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with operations user
        request.user = self.operations
        self.assertTrue(permission.has_permission(request, None))
        
        # Test with cashier user
        request.user = self.cashier
        self.assertFalse(permission.has_permission(request, None))


class RoleBasedDecoratorTestCase(TestCase):
    """Test role-based decorators."""
    
    def setUp(self):
        """Set up test data."""
        self.factory = RequestFactory()
        
        self.owner = User.objects.create(
            email='owner@test.com',
            role='OWNER',
            is_approved=True,
            google_id='owner123'
        )
        
        self.operations = User.objects.create(
            email='operations@test.com',
            role='OPERATIONS',
            is_approved=True,
            google_id='ops123'
        )
        
        self.cashier = User.objects.create(
            email='cashier@test.com',
            role='CASHIER',
            is_approved=True,
            google_id='cashier123'
        )
        
        self.unapproved = User.objects.create(
            email='unapproved@test.com',
            role='CUSTOMER',
            is_approved=False,
            google_id='unapproved123'
        )
    
    def test_require_roles_decorator(self):
        """Test require_roles decorator."""
        @require_roles(['OWNER', 'OPERATIONS'])
        def test_view(request):
            return JsonResponse({'success': True})
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with operations user
        request.user = self.operations
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with cashier user
        request.user = self.cashier
        response = test_view(request)
        self.assertEqual(response.status_code, 403)
        
        # Test with unapproved user
        request.user = self.unapproved
        response = test_view(request)
        self.assertEqual(response.status_code, 403)
    
    def test_require_owner_decorator(self):
        """Test require_owner decorator."""
        @require_owner
        def test_view(request):
            return JsonResponse({'success': True})
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with operations user
        request.user = self.operations
        response = test_view(request)
        self.assertEqual(response.status_code, 403)
    
    def test_require_operations_decorator(self):
        """Test require_operations decorator."""
        @require_operations
        def test_view(request):
            return JsonResponse({'success': True})
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with operations user
        request.user = self.operations
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with cashier user
        request.user = self.cashier
        response = test_view(request)
        self.assertEqual(response.status_code, 403)
    
    def test_admin_required_decorator(self):
        """Test admin_required decorator."""
        @admin_required
        def test_view(request):
            return JsonResponse({'success': True})
        
        # Test with owner user
        request = self.factory.get('/')
        request.user = self.owner
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with operations user
        request.user = self.operations
        response = test_view(request)
        self.assertEqual(response.status_code, 403)
        
        # Test with unapproved user
        request.user = self.unapproved
        response = test_view(request)
        self.assertEqual(response.status_code, 403)
    
    def test_require_approved_user_decorator(self):
        """Test require_approved_user decorator."""
        @require_approved_user
        def test_view(request):
            return JsonResponse({'success': True})
        
        # Test with approved user
        request = self.factory.get('/')
        request.user = self.cashier
        response = test_view(request)
        self.assertEqual(response.status_code, 200)
        
        # Test with unapproved user
        request.user = self.unapproved
        response = test_view(request)
        self.assertEqual(response.status_code, 403)


class RoleManagerTestCase(TestCase):
    """Test RoleManager utility class."""
    
    def test_is_valid_role(self):
        """Test role validation."""
        self.assertTrue(RoleManager.is_valid_role('OWNER'))
        self.assertTrue(RoleManager.is_valid_role('OPERATIONS'))
        self.assertTrue(RoleManager.is_valid_role('CASHIER'))
        self.assertTrue(RoleManager.is_valid_role('DELIVERY'))
        self.assertTrue(RoleManager.is_valid_role('CUSTOMER'))
        self.assertFalse(RoleManager.is_valid_role('INVALID'))
    
    def test_get_role_level(self):
        """Test role level retrieval."""
        self.assertEqual(RoleManager.get_role_level('OWNER'), 5)
        self.assertEqual(RoleManager.get_role_level('OPERATIONS'), 4)
        self.assertEqual(RoleManager.get_role_level('CASHIER'), 3)
        self.assertEqual(RoleManager.get_role_level('DELIVERY'), 3)
        self.assertEqual(RoleManager.get_role_level('CUSTOMER'), 1)
        self.assertEqual(RoleManager.get_role_level('INVALID'), 0)
    
    def test_has_permission(self):
        """Test permission checking."""
        self.assertTrue(RoleManager.has_permission('OWNER', 'admin_access'))
        self.assertTrue(RoleManager.has_permission('OPERATIONS', 'inventory_management'))
        self.assertTrue(RoleManager.has_permission('CASHIER', 'order_management'))
        self.assertTrue(RoleManager.has_permission('DELIVERY', 'delivery_management'))
        self.assertTrue(RoleManager.has_permission('CUSTOMER', 'order_placement'))
        
        self.assertFalse(RoleManager.has_permission('CUSTOMER', 'admin_access'))
        self.assertFalse(RoleManager.has_permission('CASHIER', 'admin_access'))
    
    def test_can_access_role(self):
        """Test role access checking."""
        self.assertTrue(RoleManager.can_access_role('OWNER', ['OWNER', 'OPERATIONS']))
        self.assertTrue(RoleManager.can_access_role('OPERATIONS', ['OWNER', 'OPERATIONS']))
        self.assertFalse(RoleManager.can_access_role('CASHIER', ['OWNER', 'OPERATIONS']))
    
    def test_get_accessible_roles(self):
        """Test accessible roles retrieval."""
        owner_roles = RoleManager.get_accessible_roles('OWNER')
        self.assertIn('OWNER', owner_roles)
        self.assertIn('OPERATIONS', owner_roles)
        self.assertIn('CASHIER', owner_roles)
        self.assertIn('DELIVERY', owner_roles)
        self.assertIn('CUSTOMER', owner_roles)
        
        customer_roles = RoleManager.get_accessible_roles('CUSTOMER')
        self.assertIn('CUSTOMER', customer_roles)
        self.assertNotIn('OWNER', customer_roles)


class UtilityFunctionTestCase(TestCase):
    """Test utility functions."""
    
    def setUp(self):
        """Set up test data."""
        self.owner = User.objects.create(
            email='owner@test.com',
            role='OWNER',
            is_approved=True,
            google_id='owner123'
        )
        
        self.unapproved = User.objects.create(
            email='unapproved@test.com',
            role='CUSTOMER',
            is_approved=False,
            google_id='unapproved123'
        )
    
    def test_check_user_permissions(self):
        """Test user permission checking."""
        # Test with approved owner
        result = check_user_permissions(self.owner, ['OWNER'])
        self.assertTrue(result['allowed'])
        self.assertEqual(result['user_role'], 'OWNER')
        
        # Test with unapproved user
        result = check_user_permissions(self.unapproved, ['CUSTOMER'])
        self.assertFalse(result['allowed'])
        self.assertEqual(result['reason'], 'User account not approved')
        
        # Test with wrong role
        result = check_user_permissions(self.owner, ['CUSTOMER'])
        self.assertFalse(result['allowed'])
        self.assertIn('not in required roles', result['reason'])
    
    def test_can_access_django_admin(self):
        """Test Django admin access checking."""
        # Test with owner
        self.assertTrue(can_access_django_admin(self.owner))
        
        # Test with unapproved user
        self.assertFalse(can_access_django_admin(self.unapproved))
        
        # Test with non-owner
        operations = User.objects.create(
            email='ops@test.com',
            role='OPERATIONS',
            is_approved=True,
            google_id='ops123'
        )
        self.assertFalse(can_access_django_admin(operations))
    
    def test_validate_role_transition(self):
        """Test role transition validation."""
        # Test valid transition by owner
        result = validate_role_transition('CUSTOMER', 'OPERATIONS', self.owner)
        self.assertTrue(result['allowed'])
        
        # Test invalid transition by non-owner
        operations = User.objects.create(
            email='ops@test.com',
            role='OPERATIONS',
            is_approved=True,
            google_id='ops123'
        )
        result = validate_role_transition('CUSTOMER', 'OPERATIONS', operations)
        self.assertFalse(result['allowed'])
        self.assertEqual(result['reason'], 'Only OWNER can change user roles')
        
        # Test invalid target role
        result = validate_role_transition('CUSTOMER', 'INVALID', self.owner)
        self.assertFalse(result['allowed'])
        self.assertIn('Invalid target role', result['reason'])


class RestrictedAdminSiteTestCase(TestCase):
    """Test restricted admin site."""
    
    def setUp(self):
        """Set up test data."""
        self.factory = RequestFactory()
        self.admin_site = RestrictedAdminSite()
        
        self.owner = User.objects.create(
            email='owner@test.com',
            role='OWNER',
            is_approved=True,
            google_id='owner123'
        )
        
        self.operations = User.objects.create(
            email='operations@test.com',
            role='OPERATIONS',
            is_approved=True,
            google_id='ops123'
        )
    
    def test_admin_site_permissions(self):
        """Test admin site permission checking."""
        # Test with owner user
        request = self.factory.get('/admin/')
        request.user = self.owner
        self.assertTrue(self.admin_site.has_permission(request))
        
        # Test with operations user
        request.user = self.operations
        self.assertFalse(self.admin_site.has_permission(request))
        
        # Test with unauthenticated user
        request.user = Mock()
        request.user.is_active = False
        request.user.is_authenticated = False
        self.assertFalse(self.admin_site.has_permission(request))


if __name__ == '__main__':
    pytest.main([__file__])