"""
Tests for authentication system including Google OAuth integration,
user registration workflow, and role-based access control.

Implements testing for Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7.
"""

import jwt
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase, Client
from django.urls import reverse
from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import CustomUser, UserProfile
from .authentication import JWTAuthentication
from .permissions import OwnerOnlyPermission, OperationsPermission

User = get_user_model()


class CustomUserModelTest(TestCase):
    """Test CustomUser model functionality."""
    
    def setUp(self):
        self.user_data = {
            'email': 'test@example.com',
            'google_id': '123456789',
            'role': 'CUSTOMER'
        }
    
    def test_user_creation_default_unapproved(self):
        """Test that new users are created with is_approved=False by default."""
        user = CustomUser.objects.create(**self.user_data)
        
        self.assertFalse(user.is_approved)  # Requirement 1.2
        self.assertEqual(user.role, 'CUSTOMER')
        self.assertTrue(user.is_active)
    
    def test_owner_role_sets_staff(self):
        """Test that OWNER role automatically sets is_staff=True."""
        user = CustomUser.objects.create(
            email='owner@example.com',
            role='OWNER',
            is_approved=True
        )
        
        self.assertTrue(user.is_staff)
        self.assertTrue(user.can_access_admin())
    
    def test_role_permission_methods(self):
        """Test role checking methods."""
        user = CustomUser.objects.create(
            email='ops@example.com',
            role='OPERATIONS',
            is_approved=True
        )
        
        self.assertTrue(user.is_operations())
        self.assertFalse(user.is_owner())
        self.assertTrue(user.has_role_permission(['OPERATIONS', 'OWNER']))
        self.assertFalse(user.has_role_permission(['CASHIER']))


class GoogleOAuthViewTest(APITestCase):
    """Test Google OAuth integration views."""
    
    def setUp(self):
        self.client = APIClient()
        self.google_login_url = reverse('authentication:google_login')
        self.google_callback_url = reverse('authentication:google_callback')
    
    def test_google_login_view(self):
        """Test Google OAuth login URL generation."""
        response = self.client.get(self.google_login_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('authorization_url', response.data)
        self.assertIn('accounts.google.com', response.data['authorization_url'])
    
    @patch('authentication.views.id_token.verify_oauth2_token')
    def test_google_callback_new_user(self, mock_verify):
        """Test Google OAuth callback with new user registration."""
        # Mock Google ID token verification
        mock_verify.return_value = {
            'iss': 'accounts.google.com',
            'sub': '123456789',
            'email': 'newuser@example.com',
            'given_name': 'John',
            'family_name': 'Doe',
            'picture': 'https://example.com/avatar.jpg'
        }
        
        response = self.client.post(self.google_callback_url, {
            'id_token': 'mock_id_token'
        })
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['error'], 'ACCOUNT_NOT_APPROVED')
        
        # Verify user was created but not approved
        user = CustomUser.objects.get(email='newuser@example.com')
        self.assertFalse(user.is_approved)  # Requirement 1.2
        self.assertEqual(user.role, 'CUSTOMER')
    
    @patch('authentication.views.id_token.verify_oauth2_token')
    def test_google_callback_approved_user(self, mock_verify):
        """Test Google OAuth callback with approved user."""
        # Create approved user
        user = CustomUser.objects.create(
            email='approved@example.com',
            google_id='987654321',
            role='OPERATIONS',
            is_approved=True
        )
        UserProfile.objects.create(user=user)
        
        # Mock Google ID token verification
        mock_verify.return_value = {
            'iss': 'accounts.google.com',
            'sub': '987654321',
            'email': 'approved@example.com',
            'given_name': 'Jane',
            'family_name': 'Smith'
        }
        
        response = self.client.post(self.google_callback_url, {
            'id_token': 'mock_id_token'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])


class JWTAuthenticationTest(TestCase):
    """Test JWT authentication functionality."""
    
    def setUp(self):
        self.user = CustomUser.objects.create(
            email='test@example.com',
            role='OPERATIONS',
            is_approved=True
        )
        self.auth = JWTAuthentication()
    
    def generate_token(self, user, token_type='access', expired=False):
        """Helper to generate JWT tokens."""
        exp_time = datetime.utcnow() - timedelta(hours=1) if expired else datetime.utcnow() + timedelta(hours=1)
        payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.role,
            'is_approved': user.is_approved,
            'exp': exp_time,
            'iat': datetime.utcnow(),
            'type': token_type
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')
    
    def test_valid_token_authentication(self):
        """Test authentication with valid JWT token."""
        token = self.generate_token(self.user)
        
        # Mock request with Authorization header
        request = MagicMock()
        request.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        result = self.auth.authenticate(request)
        
        self.assertIsNotNone(result)
        authenticated_user, auth_token = result
        self.assertEqual(authenticated_user.id, self.user.id)
    
    def test_expired_token_authentication(self):
        """Test authentication with expired JWT token."""
        token = self.generate_token(self.user, expired=True)
        
        request = MagicMock()
        request.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        from rest_framework.exceptions import AuthenticationFailed
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)
    
    def test_unapproved_user_authentication(self):
        """Test authentication fails for unapproved users."""
        self.user.is_approved = False
        self.user.save()
        
        token = self.generate_token(self.user)
        request = MagicMock()
        request.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        from rest_framework.exceptions import AuthenticationFailed
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)


class PermissionTest(TestCase):
    """Test role-based permission classes."""
    
    def setUp(self):
        self.owner = CustomUser.objects.create(
            email='owner@example.com',
            role='OWNER',
            is_approved=True
        )
        self.operations = CustomUser.objects.create(
            email='ops@example.com',
            role='OPERATIONS',
            is_approved=True
        )
        self.cashier = CustomUser.objects.create(
            email='cashier@example.com',
            role='CASHIER',
            is_approved=True
        )
        self.unapproved = CustomUser.objects.create(
            email='unapproved@example.com',
            role='CUSTOMER',
            is_approved=False
        )
    
    def test_owner_only_permission(self):
        """Test OwnerOnlyPermission class."""
        permission = OwnerOnlyPermission()
        
        # Mock requests
        owner_request = MagicMock()
        owner_request.user = self.owner
        
        ops_request = MagicMock()
        ops_request.user = self.operations
        
        self.assertTrue(permission.has_permission(owner_request, None))
        self.assertFalse(permission.has_permission(ops_request, None))  # Requirement 1.4
    
    def test_operations_permission(self):
        """Test OperationsPermission class."""
        permission = OperationsPermission()
        
        owner_request = MagicMock()
        owner_request.user = self.owner
        
        ops_request = MagicMock()
        ops_request.user = self.operations
        
        cashier_request = MagicMock()
        cashier_request.user = self.cashier
        
        self.assertTrue(permission.has_permission(owner_request, None))
        self.assertTrue(permission.has_permission(ops_request, None))
        self.assertFalse(permission.has_permission(cashier_request, None))  # Requirement 1.6
    
    def test_unapproved_user_denied(self):
        """Test that unapproved users are denied access."""
        permission = OperationsPermission()
        
        unapproved_request = MagicMock()
        unapproved_request.user = self.unapproved
        
        self.assertFalse(permission.has_permission(unapproved_request, None))  # Requirement 1.3


class UserApprovalViewTest(APITestCase):
    """Test user approval workflow views."""
    
    def setUp(self):
        self.owner = CustomUser.objects.create(
            email='owner@example.com',
            role='OWNER',
            is_approved=True
        )
        self.pending_user = CustomUser.objects.create(
            email='pending@example.com',
            role='CUSTOMER',
            is_approved=False
        )
        UserProfile.objects.create(user=self.pending_user)
        
        self.client = APIClient()
        
        # Generate JWT token for owner
        payload = {
            'user_id': self.owner.id,
            'email': self.owner.email,
            'role': self.owner.role,
            'is_approved': self.owner.is_approved,
            'exp': datetime.utcnow() + timedelta(hours=1),
            'iat': datetime.utcnow(),
            'type': 'access'
        }
        self.owner_token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')
    
    def test_pending_users_list_owner_only(self):
        """Test that only OWNER can view pending users."""
        url = reverse('authentication:pending_users')
        
        # Test with owner token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.owner_token}')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('pending_users', response.data)
        self.assertEqual(len(response.data['pending_users']), 1)
    
    def test_approve_user_owner_only(self):
        """Test that only OWNER can approve users."""
        url = reverse('authentication:approve_user', kwargs={'user_id': self.pending_user.id})
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.owner_token}')
        response = self.client.post(url, {'role': 'OPERATIONS'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user was approved
        self.pending_user.refresh_from_db()
        self.assertTrue(self.pending_user.is_approved)  # Requirement 1.4
        self.assertEqual(self.pending_user.role, 'OPERATIONS')


class AdminAccessTest(TestCase):
    """Test Django admin access restrictions."""
    
    def setUp(self):
        self.owner = CustomUser.objects.create(
            email='owner@example.com',
            role='OWNER',
            is_approved=True,
            is_staff=True
        )
        self.operations = CustomUser.objects.create(
            email='ops@example.com',
            role='OPERATIONS',
            is_approved=True
        )
        self.client = Client()
    
    def test_owner_admin_access(self):
        """Test that OWNER can access Django admin."""
        self.client.force_login(self.owner)
        response = self.client.get('/admin/')
        
        self.assertEqual(response.status_code, 200)  # Requirement 7.1
    
    def test_non_owner_admin_denied(self):
        """Test that non-OWNER users cannot access Django admin."""
        self.client.force_login(self.operations)
        response = self.client.get('/admin/')
        
        self.assertEqual(response.status_code, 403)  # Requirement 7.3
