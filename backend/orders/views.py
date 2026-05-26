"""
API views for order processing and management.

Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 for order processing,
multi-item support, payment management, and barcode integration.
"""

import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import CustomerOrder, OrderItem

logger = logging.getLogger(__name__)
from .serializers import (
    CustomerOrderSerializer, OrderItemSerializer, OrderCreateSerializer,
    OrderUpdateSerializer, BarcodeOrderValidationSerializer, OrderReceiptSerializer,
    OrderSummarySerializer, PaymentProcessingSerializer
)
from inventory.models import InventoryItem
from authentication.permissions import CashierPermission, OperationsPermission


class CustomerOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for customer order management.

    Implements Requirements 5.1, 5.3, 5.4, 5.5, 5.6 for order processing.
    """
    queryset = (
        CustomerOrder.objects
        .select_related('customer', 'created_by')
        .prefetch_related('items', 'items__item')
    )
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'payment_status', 'customer']
    search_fields = ['order_number', 'customer__email', 'customer__profile__first_name', 'customer__profile__last_name']
    ordering_fields = ['created_at', 'total_amount', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return OrderSummarySerializer
        elif self.action == 'create':
            return OrderCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return OrderUpdateSerializer
        return CustomerOrderSerializer
    
    def get_queryset(self):
        """Filter orders based on user permissions and query parameters."""
        queryset = super().get_queryset()
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        
        # Filter by customer if specified
        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set created_by field when creating order."""
        serializer.save(created_by=self.request.user)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create order with items."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Extract validated data
        customer_id = serializer.validated_data.get('customer_id')
        items_data = serializer.validated_data['items']
        tax_rate = serializer.validated_data.get('tax_rate', Decimal('0.0000'))
        discount_amount = serializer.validated_data.get('discount_amount', Decimal('0.00'))
        payment_method = serializer.validated_data.get('payment_method', '')
        payment_status = serializer.validated_data.get('payment_status')
        payment_tx_id = serializer.validated_data.get('payment_tx_id', '')
        notes = serializer.validated_data.get('notes', '')
        
        # Auto-set payment status based on payment method if not provided
        if not payment_status:
            if payment_method in ['CARD', 'UPI']:
                payment_status = 'PAID'
            else:
                payment_status = 'PENDING'
        
        # Create order
        order = CustomerOrder.objects.create(
            customer_id=customer_id,
            tax_rate=tax_rate,
            discount_amount=discount_amount,
            payment_method=payment_method,
            payment_status=payment_status,
            payment_tx_id=payment_tx_id,
            notes=notes,
            created_by=request.user,
            subtotal=Decimal('0.00'),  # Will be calculated
            total_amount=Decimal('0.00')  # Will be calculated
        )
        
        # Create order items
        for item_data in items_data:
            inventory_item = item_data['inventory_item']
            quantity = item_data['quantity']
            
            OrderItem.objects.create(
                order=order,
                item=inventory_item,
                quantity=quantity,
                unit_price=inventory_item.unit_price
            )
        
        # Recalculate totals
        order.calculate_totals()
        order.save()
        
        # Auto-confirm and process order to deduct inventory stock
        try:
            order.status = 'CONFIRMED'
            order.save(update_fields=['status'])
            order.process_order(user=request.user)
        except ValueError as e:
            # If stock check fails, keep as CONFIRMED but don't process
            logger.warning(f"Could not auto-process order {order.order_number}: {str(e)}")
        
        # Return created order
        response_serializer = CustomerOrderSerializer(order)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        """Generate order receipt."""
        order = self.get_object()
        serializer = OrderReceiptSerializer(order)
        return Response(serializer.data)


class OrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for order items (read-only).
    
    Implements Requirements 5.1 for order item management.
    """
    queryset = OrderItem.objects.select_related('order', 'item')
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['order', 'item']
    ordering_fields = ['created_at']
    ordering = ['-created_at']


class ProcessOrderView(APIView):
    """
    API view for processing orders (updating inventory).
    
    Implements Requirements 5.4 for order processing workflow.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    @transaction.atomic
    def post(self, request, pk):
        """Process order by updating inventory and status."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        
        if order.status != 'CONFIRMED':
            return Response(
                {'error': 'Only confirmed orders can be processed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            order.process_order(user=request.user)
            # The notification will be triggered by the model's save method
            
            serializer = CustomerOrderSerializer(order)
            return Response({
                'message': 'Order processed successfully',
                'order': serializer.data
            })
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ShipOrderView(APIView):
    """
    API view for shipping orders.
    
    Implements Requirements 5.4 for order status management.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request, pk):
        """Mark order as shipped."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        
        if order.mark_as_shipped(user=request.user):
            # The notification will be triggered by the model's save method
            serializer = CustomerOrderSerializer(order)
            return Response({
                'message': 'Order marked as shipped',
                'order': serializer.data
            })
        else:
            return Response(
                {'error': 'Order cannot be shipped in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )


class DeliverOrderView(APIView):
    """
    API view for marking orders as delivered.
    
    Implements Requirements 5.4 for order status management.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request, pk):
        """Mark order as delivered."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        
        if order.mark_as_delivered(user=request.user):
            # The notification will be triggered by the model's save method
            serializer = CustomerOrderSerializer(order)
            return Response({
                'message': 'Order marked as delivered',
                'order': serializer.data
            })
        else:
            return Response(
                {'error': 'Order cannot be delivered in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )


class CancelOrderView(APIView):
    """
    API view for cancelling orders.
    
    Implements Requirements 5.4 for order cancellation.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    @transaction.atomic
    def post(self, request, pk):
        """Cancel order and restore inventory if needed."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        
        if not order.can_be_cancelled():
            return Response(
                {'error': 'Order cannot be cancelled in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If order was processed, restore inventory
        if order.status == 'CONFIRMED':
            for order_item in order.items.all():
                order_item.item.update_stock(
                    quantity_change=order_item.quantity,
                    transaction_type='IN',
                    reference_type='ORDER',
                    reference_id=order.id,
                    notes=f"Order {order.order_number} cancelled - inventory restored",
                    user=request.user
                )
        
        order.status = 'CANCELLED'
        order.save()
        
        serializer = CustomerOrderSerializer(order)
        return Response({
            'message': 'Order cancelled successfully',
            'order': serializer.data
        })


class OrderReceiptView(APIView):
    """
    API view for generating order receipts.
    
    Implements Requirements 5.5 for order receipt generation.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def get(self, request, pk):
        """Generate and return order receipt."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        serializer = OrderReceiptSerializer(order)
        
        return Response({
            'receipt': serializer.data,
            'generated_at': timezone.now(),
            'generated_by': request.user.get_full_name()
        })


class PaymentProcessingView(APIView):
    """
    API view for processing payments with automatic credit application.
    
    Implements Requirements 5.6, 6.4 for payment method support and credit application.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    @transaction.atomic
    def post(self, request, pk):
        """Process payment for order with automatic credit application."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        serializer = PaymentProcessingSerializer(data=request.data)
        
        if serializer.is_valid():
            payment_method = serializer.validated_data['payment_method']
            payment_reference = serializer.validated_data.get('payment_reference', '')
            amount_paid = serializer.validated_data['amount_paid']
            credit_used = serializer.validated_data.get('credit_used', Decimal('0.00'))
            auto_apply_credit = serializer.validated_data.get('auto_apply_credit', True)
            
            # Automatically apply available credit if requested and customer exists
            if auto_apply_credit and order.customer:
                try:
                    credit_account = order.customer.credit_account
                    available_credit = credit_account.balance
                    
                    # Calculate how much credit to use
                    remaining_amount = order.total_amount - amount_paid
                    if remaining_amount > 0 and available_credit > 0:
                        credit_to_use = min(remaining_amount, available_credit)
                        credit_used = credit_to_use
                        
                except Exception:
                    # Customer has no credit account or other error
                    available_credit = Decimal('0.00')
            
            total_payment = amount_paid + credit_used
            
            # Validate payment amount
            if total_payment < order.total_amount:
                return Response(
                    {
                        'error': f'Insufficient payment. Required: {order.total_amount}, Provided: {total_payment}',
                        'required_amount': order.total_amount,
                        'amount_paid': amount_paid,
                        'credit_used': credit_used,
                        'total_payment': total_payment,
                        'remaining_balance': order.total_amount - total_payment
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Process store credit if used
            if credit_used > 0 and order.customer:
                try:
                    credit_account = order.customer.credit_account
                    credit_account.use_credit(
                        amount=credit_used,
                        reference_type='ORDER',
                        reference_id=order.id,
                        description=f'Payment for order {order.order_number}',
                        user=request.user
                    )
                except Exception as e:
                    return Response(
                        {'error': f'Credit processing failed: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Update order payment information
            order.payment_method = payment_method
            order.payment_reference = payment_reference
            order.payment_status = 'PAID'
            
            # Auto-confirm order if it was pending
            if order.status == 'PENDING':
                order.status = 'CONFIRMED'
            
            order.save()
            
            # Calculate change if any
            change_amount = total_payment - order.total_amount
            
            serializer = CustomerOrderSerializer(order)
            return Response({
                'message': 'Payment processed successfully',
                'order': serializer.data,
                'payment_details': {
                    'amount_paid': amount_paid,
                    'credit_used': credit_used,
                    'total_payment': total_payment,
                    'change_amount': change_amount,
                    'auto_credit_applied': auto_apply_credit and credit_used > 0
                }
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PaymentStatusView(APIView):
    """
    API view for checking payment status.
    
    Implements Requirements 5.6 for payment status tracking.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def get(self, request, pk):
        """Get payment status for order."""
        order = get_object_or_404(CustomerOrder, pk=pk)
        
        return Response({
            'order_number': order.order_number,
            'payment_status': order.payment_status,
            'payment_method': order.payment_method,
            'payment_reference': order.payment_reference,
            'total_amount': order.total_amount,
            'status': order.status
        })


class BarcodeOrderValidationView(APIView):
    """
    API view for barcode validation in order processing.
    
    Implements Requirements 5.2 for barcode scanning in orders.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request):
        """Validate barcode for order processing."""
        serializer = BarcodeOrderValidationSerializer(data=request.data)
        
        if serializer.is_valid():
            barcode = serializer.validated_data['barcode']
            
            try:
                item = InventoryItem.objects.get(barcode=barcode, is_active=True)
                
                return Response({
                    'valid': True,
                    'item': {
                        'id': item.id,
                        'barcode': item.barcode,
                        'name': item.name,
                        'unit_price': item.unit_price,
                        'stock_quantity': item.stock_quantity,
                        'stock_status': item.get_stock_status()
                    },
                    'can_order': item.stock_quantity > 0
                })
                
            except InventoryItem.DoesNotExist:
                return Response({
                    'valid': False,
                    'error': 'Item with this barcode not found'
                }, status=status.HTTP_404_NOT_FOUND)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BarcodeScanAddItemView(APIView):
    """
    API view for adding items to order via barcode scanning.
    
    Implements Requirements 5.2 for barcode integration in order processing.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request):
        """Add item to order by scanning barcode."""
        barcode = request.data.get('barcode')
        quantity = request.data.get('quantity', 1)
        order_id = request.data.get('order_id')
        
        if not barcode:
            return Response(
                {'error': 'Barcode is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            item = InventoryItem.objects.get(barcode=barcode, is_active=True)
            
            # Check stock availability
            if not item.can_fulfill_quantity(quantity):
                return Response({
                    'error': f'Insufficient stock. Available: {item.stock_quantity}, Requested: {quantity}',
                    'available_stock': item.stock_quantity
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # If order_id provided, add to existing order
            if order_id:
                order = get_object_or_404(CustomerOrder, pk=order_id)
                
                # Check if item already exists in order
                existing_item = order.items.filter(item=item).first()
                if existing_item:
                    existing_item.quantity += quantity
                    existing_item.save()
                else:
                    OrderItem.objects.create(
                        order=order,
                        item=item,
                        quantity=quantity,
                        unit_price=item.unit_price
                    )
                
                # Recalculate order totals
                order.calculate_totals()
                order.save()
                
                return Response({
                    'success': True,
                    'message': 'Item added to order',
                    'item': {
                        'barcode': item.barcode,
                        'name': item.name,
                        'quantity': quantity,
                        'unit_price': item.unit_price,
                        'line_total': quantity * item.unit_price
                    },
                    'order_total': order.total_amount
                })
            else:
                # Return item information for new order creation
                return Response({
                    'success': True,
                    'item': {
                        'id': item.id,
                        'barcode': item.barcode,
                        'name': item.name,
                        'unit_price': item.unit_price,
                        'stock_quantity': item.stock_quantity,
                        'suggested_quantity': min(quantity, item.stock_quantity)
                    }
                })
                
        except InventoryItem.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Item with this barcode not found'
            }, status=status.HTTP_404_NOT_FOUND)


class CustomerCreditCheckView(APIView):
    """
    API view for checking customer credit availability for orders.

    Implements Requirements 6.4 for automatic credit application.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]

    def get(self, request, pk):
        """Check available credit for order payment."""
        order = get_object_or_404(CustomerOrder, pk=pk)

        if not order.customer:
            return Response({
                'order_number': order.order_number,
                'total_amount': order.total_amount,
                'customer': None,
                'available_credit': '0.00',
                'can_use_credit': False,
                'suggested_credit_usage': '0.00',
                'remaining_after_credit': order.total_amount
            })

        try:
            credit_account = order.customer.credit_account
            available_credit = credit_account.balance

            # Calculate suggested credit usage
            suggested_credit_usage = min(order.total_amount, available_credit)
            remaining_after_credit = order.total_amount - suggested_credit_usage

            return Response({
                'order_number': order.order_number,
                'total_amount': order.total_amount,
                'customer': {
                    'id': order.customer.id,
                    'name': order.customer.get_full_name(),
                    'email': order.customer.email
                },
                'available_credit': available_credit,
                'can_use_credit': available_credit > 0,
                'suggested_credit_usage': suggested_credit_usage,
                'remaining_after_credit': remaining_after_credit,
                'credit_covers_full_amount': available_credit >= order.total_amount
            })

        except Exception:
            # Customer has no credit account
            return Response({
                'order_number': order.order_number,
                'total_amount': order.total_amount,
                'customer': {
                    'id': order.customer.id,
                    'name': order.customer.get_full_name(),
                    'email': order.customer.email
                },
                'available_credit': '0.00',
                'can_use_credit': False,
                'suggested_credit_usage': '0.00',
                'remaining_after_credit': order.total_amount,
                'credit_covers_full_amount': False
            })


class QuickOrderCreateView(APIView):
    """
    API view for quick order creation with minimal data.
    
    Implements Requirements 5.1, 5.2 for streamlined order processing.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    @transaction.atomic
    def post(self, request):
        """Create order quickly with barcode scanning."""
        items_data = request.data.get('items', [])
        customer_id = request.data.get('customer_id')
        payment_method = request.data.get('payment_method', 'CASH')
        
        if not items_data:
            return Response(
                {'error': 'At least one item is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Create order
            order = CustomerOrder.objects.create(
                customer_id=customer_id,
                payment_method=payment_method,
                created_by=request.user,
                subtotal=Decimal('0.00'),
                total_amount=Decimal('0.00')
            )
            
            # Add items
            for item_data in items_data:
                barcode = item_data.get('barcode')
                quantity = item_data.get('quantity', 1)
                
                item = InventoryItem.objects.get(barcode=barcode, is_active=True)
                
                if not item.can_fulfill_quantity(quantity):
                    raise ValueError(f'Insufficient stock for {item.name}')
                
                OrderItem.objects.create(
                    order=order,
                    item=item,
                    quantity=quantity,
                    unit_price=item.unit_price
                )
            
            # Calculate totals and confirm order
            order.calculate_totals()
            order.status = 'CONFIRMED'
            order.save()
            
            serializer = CustomerOrderSerializer(order)
            return Response({
                'message': 'Quick order created successfully',
                'order': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except InventoryItem.DoesNotExist:
            return Response(
                {'error': 'One or more items not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )