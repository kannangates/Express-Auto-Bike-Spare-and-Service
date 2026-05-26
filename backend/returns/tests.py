"""
Test cases for returns processing APIs.

This module tests the implementation of Task 6.1: Returns processing APIs
including barcode verification, return approval workflow, and inventory updates.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal

from authentication.models import CustomUser
from inventory.models import InventoryItem, InventoryCategory
from orders.models import CustomerOrder, OrderItem
from returns.models import CustomerReturn, ReturnItem, CustomerCredit, CreditTransaction


class ReturnsAPITestCase(TestCase):
    """Test case for returns processing APIs."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test users
        User = get_user_model()
        
        self.owner_user = User.objects.create_user(
            email='owner@test.local',
            role='OWNER',
            is_approved=True
        )
        
        self.cashier_user = User.objects.create_user(
            email='cashier@test.local',
            role='CASHIER',
            is_approved=True
        )
        
        self.customer_user = User.objects.create_user(
            email='customer@test.local',
            role='CUSTOMER',
            is_approved=True
        )
        
        # Create test inventory category
        self.category = InventoryCategory.objects.create(
            name='Test Category',
            description='Test category for returns testing'
        )
        
        # Create test inventory items
        self.item1 = InventoryItem.objects.create(
            barcode='1234567890123',
            name='Test Brake Pad',
            description='Test brake pad for returns testing',
            category=self.category,
            unit_price=Decimal('25.99'),
            stock_quantity=100,
            min_stock_level=10,
            created_by=self.owner_user
        )
        
        self.item2 = InventoryItem.objects.create(
            barcode='9876543210987',
            name='Test Chain',
            description='Test chain for returns testing',
            category=self.category,
            unit_price=Decimal('15.50'),
            stock_quantity=50,
            min_stock_level=5,
            created_by=self.owner_user
        )
        
        # Create test order
        self.order = CustomerOrder.objects.create(
            customer=self.customer_user,
            status='DELIVERED',
            subtotal=Decimal('67.48'),
            tax_rate=Decimal('0.0875'),
            tax_amount=Decimal('5.91'),
            total_amount=Decimal('73.39'),
            payment_status='PAID',
            created_by=self.cashier_user
        )
        
        # Create order items
        self.order_item1 = OrderItem.objects.create(
            order=self.order,
            item=self.item1,
            quantity=2,
            unit_price=self.item1.unit_price
        )
        
        self.order_item2 = OrderItem.objects.create(
            order=self.order,
            item=self.item2,
            quantity=1,
            unit_price=self.item2.unit_price
        )
    
    def test_returns_endpoints_accessible(self):
        """Test that returns management endpoints are accessible."""
        # Authenticate as cashier
        self.client.force_authenticate(user=self.cashier_user)
        
        # Test returns list endpoint
        response = self.client.get('/api/v1/returns/returns/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test credit accounts endpoint
        response = self.client.get('/api/v1/returns/credit-accounts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test credit transactions endpoint
        response = self.client.get('/api/v1/returns/credit-transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test barcode validation endpoint
        response = self.client.post('/api/v1/returns/barcode/validate/', {
            'barcode': '1234567890123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
    
    def test_barcode_verification_for_returns(self):
        """Test barcode verification functionality for returns."""
        self.client.force_authenticate(user=self.cashier_user)
        
        # Test valid barcode validation
        response = self.client.post('/api/v1/returns/barcode/validate/', {
            'barcode': '1234567890123',
            'order_id': self.order.id
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertIn('item', response.data)
        self.assertIn('order_items', response.data)
        
        # Test invalid barcode
        response = self.client.post('/api/v1/returns/barcode/validate/', {
            'barcode': 'INVALID_BARCODE'
        })
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(response.data['valid'])
    
    def test_return_creation_with_barcode_verification(self):
        """Test return creation with barcode verification."""
        self.client.force_authenticate(user=self.cashier_user)
        
        # Create return with valid items
        return_data = {
            'order_id': self.order.id,
            'return_reason': 'DEFECTIVE',
            'return_reason_details': 'Item arrived damaged',
            'items': [
                {
                    'order_item_id': self.order_item1.id,
                    'quantity': 1,
                    'condition': 'DAMAGED'
                },
                {
                    'order_item_id': self.order_item2.id,
                    'quantity': 1,
                    'condition': 'DEFECTIVE'
                }
            ]
        }
        
        response = self.client.post('/api/v1/returns/returns/', return_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('return_number', response.data)
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertEqual(len(response.data['items']), 2)
        
        # Verify return was created in database
        return_obj = CustomerReturn.objects.get(return_number=response.data['return_number'])
        self.assertEqual(return_obj.items.count(), 2)
        self.assertEqual(return_obj.status, 'PENDING')
    
    def test_return_approval_workflow(self):
        """Test return approval workflow."""
        # Create a return first
        self.client.force_authenticate(user=self.cashier_user)
        
        return_data = {
            'order_id': self.order.id,
            'return_reason': 'DEFECTIVE',
            'items': [
                {
                    'order_item_id': self.order_item1.id,
                    'quantity': 1,
                    'condition': 'DAMAGED'
                }
            ]
        }
        
        response = self.client.post('/api/v1/returns/returns/', return_data, format='json')
        return_id = response.data['id']
        
        # Test approval (requires OPERATIONS permission)
        self.client.force_authenticate(user=self.owner_user)  # OWNER has OPERATIONS permissions
        
        response = self.client.post(f'/api/v1/returns/returns/{return_id}/approve/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['return']['status'], 'APPROVED')
        
        # Test rejection
        # Create another return to test rejection
        self.client.force_authenticate(user=self.cashier_user)
        response = self.client.post('/api/v1/returns/returns/', return_data, format='json')
        return_id_2 = response.data['id']
        
        self.client.force_authenticate(user=self.owner_user)
        response = self.client.post(f'/api/v1/returns/returns/{return_id_2}/reject/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['return']['status'], 'REJECTED')
    
    def test_return_processing_and_inventory_updates(self):
        """Test return processing with inventory updates."""
        # Record initial stock levels
        initial_stock_item1 = self.item1.stock_quantity
        initial_stock_item2 = self.item2.stock_quantity
        
        # Create and approve a return
        self.client.force_authenticate(user=self.cashier_user)
        
        return_data = {
            'order_id': self.order.id,
            'return_reason': 'CUSTOMER_CHANGE_MIND',
            'items': [
                {
                    'order_item_id': self.order_item1.id,
                    'quantity': 1,
                    'condition': 'NEW'  # Restockable condition
                },
                {
                    'order_item_id': self.order_item2.id,
                    'quantity': 1,
                    'condition': 'USED'  # Also restockable
                }
            ]
        }
        
        response = self.client.post('/api/v1/returns/returns/', return_data, format='json')
        return_id = response.data['id']
        
        # Approve the return
        self.client.force_authenticate(user=self.owner_user)
        response = self.client.post(f'/api/v1/returns/returns/{return_id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Process the return
        self.client.force_authenticate(user=self.cashier_user)
        response = self.client.post(f'/api/v1/returns/returns/{return_id}/process/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['return']['status'], 'PROCESSED')
        
        # Verify inventory was updated
        self.item1.refresh_from_db()
        self.item2.refresh_from_db()
        
        self.assertEqual(self.item1.stock_quantity, initial_stock_item1 + 1)
        self.assertEqual(self.item2.stock_quantity, initial_stock_item2 + 1)
    
    def test_credit_system_integration(self):
        """Test credit system integration with returns."""
        self.client.force_authenticate(user=self.cashier_user)
        
        # Create return with credit amount
        return_obj = CustomerReturn.objects.create(
            order=self.order,
            customer=self.customer_user,
            return_reason='DEFECTIVE',
            total_amount=Decimal('25.99'),
            credit_amount=Decimal('25.99'),
            status='APPROVED'
        )
        
        ReturnItem.objects.create(
            return_obj=return_obj,
            order_item=self.order_item1,
            quantity=1,
            condition='DAMAGED',
            restockable=False
        )
        
        # Process the return to apply credit
        response = self.client.post(f'/api/v1/returns/returns/{return_obj.id}/process/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check customer credit balance
        response = self.client.get(f'/api/v1/returns/credit/{self.customer_user.id}/balance/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['credit_account']['balance']), Decimal('25.99'))
        
        # Test credit usage
        response = self.client.post(f'/api/v1/returns/credit/{self.customer_user.id}/use/', {
            'amount': '10.00',
            'description': 'Applied to new order'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data['remaining_balance']), Decimal('15.99'))
    
    def test_return_reason_tracking_and_documentation(self):
        """Test return reason tracking and documentation."""
        self.client.force_authenticate(user=self.cashier_user)
        
        # Create return with detailed reason
        return_data = {
            'order_id': self.order.id,
            'return_reason': 'QUALITY_ISSUE',
            'return_reason_details': 'Product did not meet quality expectations. Customer reported unusual wear after minimal use.',
            'items': [
                {
                    'order_item_id': self.order_item1.id,
                    'quantity': 1,
                    'condition': 'DEFECTIVE'
                }
            ]
        }
        
        response = self.client.post('/api/v1/returns/returns/', return_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['return_reason'], 'QUALITY_ISSUE')
        self.assertIn('quality expectations', response.data['return_reason_details'])
        
        # Verify return documentation is complete
        return_obj = CustomerReturn.objects.get(id=response.data['id'])
        self.assertIsNotNone(return_obj.return_reason)
        self.assertIsNotNone(return_obj.return_reason_details)
        self.assertIsNotNone(return_obj.created_at)
    
    def test_return_audit_trail_and_history(self):
        """Test return audit trail and history tracking."""
        # Create, approve, and process a return to generate audit trail
        self.client.force_authenticate(user=self.cashier_user)
        
        return_data = {
            'order_id': self.order.id,
            'return_reason': 'DEFECTIVE',
            'items': [
                {
                    'order_item_id': self.order_item1.id,
                    'quantity': 1,
                    'condition': 'DAMAGED'
                }
            ]
        }
        
        response = self.client.post('/api/v1/returns/returns/', return_data, format='json')
        return_id = response.data['id']
        
        # Approve
        self.client.force_authenticate(user=self.owner_user)
        self.client.post(f'/api/v1/returns/returns/{return_id}/approve/')
        
        # Process
        self.client.force_authenticate(user=self.cashier_user)
        self.client.post(f'/api/v1/returns/returns/{return_id}/process/')
        
        # Verify audit trail
        return_obj = CustomerReturn.objects.get(id=return_id)
        
        self.assertIsNotNone(return_obj.created_at)
        self.assertIsNotNone(return_obj.approved_at)
        self.assertIsNotNone(return_obj.processed_at)
        self.assertEqual(return_obj.approved_by, self.owner_user)
        self.assertEqual(return_obj.processed_by, self.cashier_user)
        
        # Check credit transaction history if credit was applied
        if return_obj.credit_amount > 0:
            credit_transactions = CreditTransaction.objects.filter(
                customer=return_obj.customer,
                reference_type='RETURN',
                reference_id=return_obj.id
            )
            self.assertTrue(credit_transactions.exists())