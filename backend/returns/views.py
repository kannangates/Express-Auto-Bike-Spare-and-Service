"""
API views for returns and credit management.

Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7 for returns processing
and credit system management.
"""

import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, Sum
from django.db import models

logger = logging.getLogger(__name__)
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import CustomerReturn, ReturnItem, CustomerCredit, CreditTransaction
from .serializers import (
    CustomerReturnSerializer, ReturnItemSerializer, CustomerCreditSerializer,
    CreditTransactionSerializer, ReturnCreateSerializer, CreditApplicationSerializer,
    CreditUsageSerializer, BarcodeReturnValidationSerializer
)
from orders.models import CustomerOrder, OrderItem
from authentication.permissions import CashierPermission, OperationsPermission


class CustomerReturnViewSet(viewsets.ModelViewSet):
    """
    ViewSet for customer return management.

    Implements Requirements 6.1, 6.2, 6.5, 6.6 for returns management.
    """
    queryset = (
        CustomerReturn.objects
        .select_related('order', 'customer', 'processed_by', 'approved_by')
        .prefetch_related('items', 'items__order_item__item')
    )
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'customer', 'order']
    search_fields = ['return_number', 'customer__email', 'order__order_number']
    ordering_fields = ['created_at', 'total_amount', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return ReturnCreateSerializer
        return CustomerReturnSerializer
    
    def get_queryset(self):
        """Filter returns based on user permissions and query parameters."""
        queryset = super().get_queryset()
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        
        return queryset
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create return with items."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Extract validated data
        order_id = serializer.validated_data['order_id']
        return_reason = serializer.validated_data['return_reason']
        return_reason_details = serializer.validated_data.get('return_reason_details', '')
        resolution_method = serializer.validated_data.get('resolution_method', 'REFUND')
        items_data = serializer.validated_data['items']
        
        # Get order
        order = CustomerOrder.objects.get(id=order_id)
        
        # Create return
        return_obj = CustomerReturn.objects.create(
            order=order,
            customer=order.customer,
            return_reason=return_reason,
            return_reason_details=return_reason_details,
            resolution_method=resolution_method,
            total_amount=Decimal('0.00')  # Will be calculated
        )
        
        # Create return items
        for item_data in items_data:
            try:
                order_item = OrderItem.objects.get(id=item_data['order_item_id'])
            except OrderItem.DoesNotExist:
                return Response(
                    {'error': f"Order item {item_data['order_item_id']} not found."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            ReturnItem.objects.create(
                return_obj=return_obj,
                order_item=order_item,
                quantity=item_data['quantity'],
                condition=item_data['condition'],
                restockable=item_data['condition'] not in ['DAMAGED', 'DEFECTIVE']
            )
        
        # Calculate totals
        return_obj.calculate_totals()
        return_obj.save()

        # Return created return
        response_serializer = CustomerReturnSerializer(return_obj)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class ReturnItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for return items (read-only).
    
    Implements Requirements 6.2, 6.5 for return item management.
    """
    queryset = ReturnItem.objects.select_related('return_obj', 'order_item', 'order_item__item')
    serializer_class = ReturnItemSerializer
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['return_obj', 'condition', 'restockable']
    ordering_fields = ['created_at']
    ordering = ['-created_at']


class CustomerCreditViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for customer credit accounts (read-only).
    
    Implements Requirements 6.3, 6.4 for credit system management.
    """
    queryset = CustomerCredit.objects.all()
    serializer_class = CustomerCreditSerializer
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['customer__email', 'customer__profile__first_name', 'customer__profile__last_name']
    ordering_fields = ['balance', 'updated_at']
    ordering = ['-balance']
    
    def get_queryset(self):
        """Filter credit accounts based on query parameters."""
        queryset = super().get_queryset()
        
        # Filter by minimum balance
        min_balance = self.request.query_params.get('min_balance')
        if min_balance:
            queryset = queryset.filter(balance__gte=min_balance)
        
        return queryset


class CreditTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for credit transaction history (read-only).
    
    Implements Requirements 6.7 for credit transaction tracking.
    """
    queryset = CreditTransaction.objects.all()
    serializer_class = CreditTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['customer', 'transaction_type', 'reference_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter transactions with additional parameters."""
        queryset = super().get_queryset()
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        
        return queryset


class ApproveReturnView(APIView):
    """
    API view for approving returns.
    
    Implements Requirements 6.2 for return approval workflow.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request, pk):
        """Approve return."""
        return_obj = get_object_or_404(CustomerReturn, pk=pk)
        
        if return_obj.approve_return(user=request.user):
            # The notification will be triggered by the model's save method
            serializer = CustomerReturnSerializer(return_obj)
            return Response({
                'message': 'Return approved successfully',
                'return': serializer.data
            })
        else:
            return Response(
                {'error': 'Return cannot be approved in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProcessReturnView(APIView):
    """
    API view for processing returns.
    
    Implements Requirements 6.2, 6.3 for return processing and credit management.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    @transaction.atomic
    def post(self, request, pk):
        """Process return by updating inventory and customer credit."""
        return_obj = get_object_or_404(CustomerReturn, pk=pk)
        
        try:
            return_obj.process_return(user=request.user)
            # The notification will be triggered by the model's save method
            
            serializer = CustomerReturnSerializer(return_obj)
            return Response({
                'message': 'Return processed successfully',
                'return': serializer.data
            })
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class RejectReturnView(APIView):
    """
    API view for rejecting returns.
    
    Implements Requirements 6.2 for return rejection workflow.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request, pk):
        """Reject return."""
        return_obj = get_object_or_404(CustomerReturn, pk=pk)
        
        if return_obj.status != 'PENDING':
            return Response(
                {'error': 'Only pending returns can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return_obj.status = 'REJECTED'
        return_obj.processed_by = request.user
        return_obj.processed_at = timezone.now()
        return_obj.save()
        
        serializer = CustomerReturnSerializer(return_obj)
        return Response({
            'message': 'Return rejected',
            'return': serializer.data
        })


class ApplyCreditView(APIView):
    """
    API view for applying credit to customer account.
    
    Implements Requirements 6.4 for credit application.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request, customer_id):
        """Apply credit to customer account."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        customer = get_object_or_404(User, pk=customer_id)
        serializer = CreditApplicationSerializer(data=request.data)
        
        if serializer.is_valid():
            amount = serializer.validated_data['amount']
            description = serializer.validated_data.get('description', 'Credit applied')  # noqa: F841
            
            try:
                # Get or create credit account
                credit_account, created = CustomerCredit.objects.get_or_create(
                    customer=customer,
                    defaults={'balance': Decimal('0.00')}
                )
                
                credit_account.apply_credit(amount, user=request.user)
                
                return Response({
                    'message': 'Credit applied successfully',
                    'customer': customer.email,
                    'amount_applied': amount,
                    'new_balance': credit_account.balance
                })
                
            except Exception as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UseCreditView(APIView):
    """
    API view for using credit from customer account.
    
    Implements Requirements 6.4 for credit usage.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request, customer_id):
        """Use credit from customer account."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        customer = get_object_or_404(User, pk=customer_id)
        serializer = CreditUsageSerializer(data=request.data)
        
        if serializer.is_valid():
            amount = serializer.validated_data['amount']
            reference_type = serializer.validated_data.get('reference_type')
            reference_id = serializer.validated_data.get('reference_id')
            description = serializer.validated_data.get('description', 'Credit used')
            
            try:
                credit_account = customer.credit_account
                credit_account.use_credit(
                    amount=amount,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    description=description,
                    user=request.user
                )
                
                return Response({
                    'message': 'Credit used successfully',
                    'customer': customer.email,
                    'amount_used': amount,
                    'remaining_balance': credit_account.balance
                })
                
            except CustomerCredit.DoesNotExist:
                return Response(
                    {'error': 'Customer does not have a credit account'},
                    status=status.HTTP_404_NOT_FOUND
                )
            except Exception as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CreditBalanceView(APIView):
    """
    API view for checking customer credit balance.
    
    Implements Requirements 6.3 for credit balance inquiry.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def get(self, request, customer_id):
        """Get customer credit balance."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        customer = get_object_or_404(User, pk=customer_id)
        
        try:
            credit_account = customer.credit_account
            serializer = CustomerCreditSerializer(credit_account)
            
            return Response({
                'customer': customer.email,
                'credit_account': serializer.data
            })
            
        except CustomerCredit.DoesNotExist:
            return Response({
                'customer': customer.email,
                'credit_account': {
                    'balance': '0.00',
                    'total_earned': '0.00',
                    'total_used': '0.00',
                    'message': 'No credit account found'
                }
            })


class BarcodeReturnValidationView(APIView):
    """
    API view for barcode validation in returns processing.
    
    Implements Requirements 6.1 for barcode verification in returns.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request):
        """Validate barcode for returns processing."""
        barcode = request.data.get('barcode')
        order_id = request.data.get('order_id')
        
        if not barcode:
            return Response(
                {'error': 'Barcode is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from inventory.models import InventoryItem
        
        try:
            item = InventoryItem.objects.get(barcode=barcode)
            
            response_data = {
                'valid': True,
                'item': {
                    'barcode': item.barcode,
                    'name': item.name,
                    'description': item.description
                }
            }
            
            # If order_id provided, check if item exists in that order
            if order_id:
                order_items = OrderItem.objects.filter(
                    order_id=order_id,
                    item__barcode=barcode
                )
                
                if order_items.exists():
                    response_data['order_items'] = [
                        {
                            'id': oi.id,
                            'quantity': oi.quantity,
                            'unit_price': oi.unit_price,
                            'total_price': oi.total_price
                        }
                        for oi in order_items
                    ]
                else:
                    response_data['valid'] = False
                    response_data['error'] = 'Item not found in specified order'
            
            return Response(response_data)
            
        except InventoryItem.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'Item with this barcode not found'
            }, status=status.HTTP_404_NOT_FOUND)


class BarcodeScanReturnItemView(APIView):
    """
    API view for scanning barcodes to add items to returns.
    
    Implements Requirements 6.1 for barcode integration in returns.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request):
        """Scan barcode and return item information for returns."""
        barcode = request.data.get('barcode')
        order_id = request.data.get('order_id')
        
        if not barcode:
            return Response(
                {'error': 'Barcode is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not order_id:
            return Response(
                {'error': 'Order ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Find order items with this barcode
            order_items = OrderItem.objects.filter(
                order_id=order_id,
                item__barcode=barcode
            )
            
            if not order_items.exists():
                return Response({
                    'success': False,
                    'error': 'Item with this barcode not found in the specified order'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Return order item information
            items_data = []
            for order_item in order_items:
                items_data.append({
                    'order_item_id': order_item.id,
                    'barcode': order_item.item.barcode if hasattr(order_item, 'item') else '',
                    'item_name': order_item.item.name if hasattr(order_item, 'item') else '',
                    'quantity': order_item.quantity,
                    'unit_price': order_item.unit_price,
                    'total_price': order_item.quantity * order_item.unit_price if hasattr(order_item, 'quantity') and hasattr(order_item, 'unit_price') else 0
                })
            
            return Response({
                'success': True,
                'items': items_data
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class CreateReturnFromOrderView(APIView):
    """
    API view for creating returns from existing orders.
    
    Implements Requirements 6.1 for return creation workflow.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def get(self, request, order_id):
        """Get order information for return creation."""
        order = get_object_or_404(CustomerOrder, pk=order_id)
        
        if order.status not in ['DELIVERED', 'COMPLETED']:
            return Response(
                {'error': 'Only delivered orders can be returned'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get order items that can be returned
        returnable_items = []
        for item in order.items.all():
            # Check if item has already been returned
            returned_quantity = sum(
                ri.quantity for ri in ReturnItem.objects.filter(
                    order_item=item,
                    return_obj__status__in=['APPROVED', 'PROCESSED']
                )
            )
            
            remaining_quantity = item.quantity - returned_quantity
            
            if remaining_quantity > 0:
                returnable_items.append({
                    'order_item_id': item.id,
                    'barcode': item.barcode,
                    'item_name': item.item_name,
                    'original_quantity': item.quantity,
                    'returned_quantity': returned_quantity,
                    'remaining_quantity': remaining_quantity,
                    'unit_price': item.unit_price
                })
        
        return Response({
            'order': {
                'id': order.id,
                'order_number': order.order_number,
                'customer': order.customer.email if order.customer else None,
                'status': order.status,
                'total_amount': order.total_amount,
                'created_at': order.created_at
            },
            'returnable_items': returnable_items
        })

class CreditMemoView(APIView):
    """
    API view for generating credit memos for return transactions.
    
    Implements Requirements 6.7 for credit memo generation.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def get(self, request, pk):
        """Generate and return credit memo for processed return."""
        return_obj = get_object_or_404(CustomerReturn, pk=pk)
        
        if return_obj.status != 'PROCESSED':
            return Response(
                {'error': 'Credit memo can only be generated for processed returns'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if return_obj.credit_amount <= 0:
            return Response(
                {'error': 'No credit amount to generate memo for'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .serializers import CreditMemoSerializer
        serializer = CreditMemoSerializer(return_obj)
        
        return Response({
            'credit_memo': serializer.data,
            'generated_at': timezone.now(),
            'generated_by': request.user.get_full_name(),
            'memo_type': 'STORE_CREDIT',
            'credit_balance_after': return_obj.customer.credit_account.balance if return_obj.customer else None
        })


class CreditSummaryView(APIView):
    """
    API view for customer credit summary and transaction history.
    
    Implements Requirements 6.3, 6.7 for credit tracking and history.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def get(self, request, customer_id):
        """Get comprehensive credit summary for customer."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        customer = get_object_or_404(User, pk=customer_id)
        
        try:
            credit_account = customer.credit_account
            
            # Get recent transactions
            recent_transactions = CreditTransaction.objects.filter(
                customer=customer
            ).order_by('-created_at')[:10]
            
            # Get credit from returns
            credit_from_returns = CreditTransaction.objects.filter(
                customer=customer,
                transaction_type='CREDIT',
                reference_type='RETURN'
            ).aggregate(
                total=models.Sum('amount')
            )['total'] or Decimal('0.00')
            
            # Get credit used in orders
            credit_used_orders = CreditTransaction.objects.filter(
                customer=customer,
                transaction_type='DEBIT',
                reference_type='ORDER'
            ).aggregate(
                total=models.Sum('amount')
            )['total'] or Decimal('0.00')
            
            return Response({
                'customer': {
                    'id': customer.id,
                    'name': customer.get_full_name(),
                    'email': customer.email
                },
                'credit_account': CustomerCreditSerializer(credit_account).data,
                'summary': {
                    'total_earned_from_returns': credit_from_returns,
                    'total_used_in_orders': credit_used_orders,
                    'current_balance': credit_account.balance,
                    'account_created': credit_account.created_at
                },
                'recent_transactions': CreditTransactionSerializer(recent_transactions, many=True).data
            })
            
        except CustomerCredit.DoesNotExist:
            return Response({
                'customer': {
                    'id': customer.id,
                    'name': customer.get_full_name(),
                    'email': customer.email
                },
                'credit_account': None,
                'summary': {
                    'total_earned_from_returns': '0.00',
                    'total_used_in_orders': '0.00',
                    'current_balance': '0.00',
                    'account_created': None
                },
                'recent_transactions': [],
                'message': 'Customer has no credit account'
            })


class BulkCreditApplicationView(APIView):
    """
    API view for bulk credit application (e.g., promotional credits).
    
    Implements Requirements 6.4 for credit application management.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    @transaction.atomic
    def post(self, request):
        """Apply credit to multiple customers."""
        customers_data = request.data.get('customers', [])
        amount = request.data.get('amount')
        description = request.data.get('description', 'Bulk credit application')
        
        if not customers_data:
            return Response(
                {'error': 'At least one customer must be specified'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not amount or amount <= 0:
            return Response(
                {'error': 'Valid credit amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        results = []
        errors = []
        
        for customer_data in customers_data:
            customer_id = customer_data.get('customer_id')
            custom_amount = customer_data.get('amount', amount)
            _custom_description = customer_data.get('description', description)  # noqa: F841
            
            try:
                customer = User.objects.get(id=customer_id)
                
                # Get or create credit account
                credit_account, created = CustomerCredit.objects.get_or_create(
                    customer=customer,
                    defaults={'balance': Decimal('0.00')}
                )
                
                credit_account.apply_credit(custom_amount, user=request.user)
                
                results.append({
                    'customer_id': customer_id,
                    'customer_name': customer.get_full_name(),
                    'amount_applied': custom_amount,
                    'new_balance': credit_account.balance,
                    'success': True
                })
                
            except User.DoesNotExist:
                errors.append({
                    'customer_id': customer_id,
                    'error': 'Customer not found'
                })
            except Exception as e:
                errors.append({
                    'customer_id': customer_id,
                    'error': str(e)
                })
        
        return Response({
            'message': f'Bulk credit application completed. {len(results)} successful, {len(errors)} failed.',
            'successful_applications': results,
            'failed_applications': errors,
            'total_amount_applied': sum(r['amount_applied'] for r in results)
        })