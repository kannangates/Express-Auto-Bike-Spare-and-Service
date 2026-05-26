"""
Serializers for order processing and management.

Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 for order processing,
multi-item support, and payment management.
"""

from rest_framework import serializers
from django.core.validators import MinValueValidator
from decimal import Decimal

from .models import CustomerOrder, OrderItem
from inventory.models import InventoryItem


class OrderItemSerializer(serializers.ModelSerializer):
    """
    Serializer for order items with inventory validation.
    
    Implements Requirements 5.1, 5.3 for multi-item order support.
    """
    item_details = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'item', 'item_details', 'barcode', 'item_name',
            'quantity', 'unit_price', 'total_price', 'line_total', 'created_at'
        ]
        read_only_fields = ['barcode', 'item_name', 'unit_price', 'total_price', 'created_at']
    
    def get_item_details(self, obj):
        """Get inventory item details."""
        if obj.item:
            return {
                'name': obj.item.name,
                'description': obj.item.description,
                'barcode': obj.item.barcode,
                'current_stock': obj.item.stock_quantity,
                'unit_price': obj.item.unit_price
            }
        return None
    
    def get_line_total(self, obj):
        """Get line total for this item."""
        return obj.get_line_total()
    
    def validate_quantity(self, value):
        """Validate order quantity is positive."""
        if value <= 0:
            raise serializers.ValidationError("Order quantity must be greater than zero.")
        return value
    
    def validate(self, attrs):
        """Validate stock availability for the item."""
        item = attrs.get('item')
        quantity = attrs.get('quantity')
        
        if item and quantity:
            if not item.can_fulfill_quantity(quantity):
                raise serializers.ValidationError({
                    'quantity': f'Insufficient stock. Available: {item.stock_quantity}, Requested: {quantity}'
                })
        
        return attrs


class CustomerOrderSerializer(serializers.ModelSerializer):
    """
    Serializer for customer orders with comprehensive tracking.
    
    Implements Requirements 5.1, 5.3, 5.4, 5.5, 5.6 for order processing.
    """
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    item_count = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()
    can_be_cancelled = serializers.SerializerMethodField()
    can_be_shipped = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_email',
            'status', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount',
            'total_amount', 'payment_method', 'payment_status', 'payment_reference',
            'payment_tx_id', 'notes', 'shipped_at', 'delivered_at', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'items', 'item_count', 'total_quantity',
            'can_be_cancelled', 'can_be_shipped'
        ]
        read_only_fields = [
            'order_number', 'subtotal', 'tax_amount', 'total_amount',
            'shipped_at', 'delivered_at', 'created_by', 'created_at', 'updated_at'
        ]
    
    def get_item_count(self, obj):
        """Get number of different items in order."""
        return obj.get_item_count()
    
    def get_total_quantity(self, obj):
        """Get total quantity of all items."""
        return obj.get_total_quantity()
    
    def get_can_be_cancelled(self, obj):
        """Check if order can be cancelled."""
        return obj.can_be_cancelled()
    
    def get_can_be_shipped(self, obj):
        """Check if order can be shipped."""
        return obj.can_be_shipped()
    
    def validate_tax_rate(self, value):
        """Validate tax rate is not negative."""
        if value < 0:
            raise serializers.ValidationError("Tax rate cannot be negative.")
        if value > 1:
            raise serializers.ValidationError("Tax rate cannot exceed 100%.")
        return value
    
    def validate_discount_amount(self, value):
        """Validate discount amount is not negative."""
        if value < 0:
            raise serializers.ValidationError("Discount amount cannot be negative.")
        return value
    
    def validate_payment_method(self, value):
        """Validate payment method if provided."""
        if value:
            valid_methods = ['CASH', 'CARD', 'CREDIT', 'BANK_TRANSFER', 'OTHER']
            if value not in valid_methods:
                raise serializers.ValidationError(f"Invalid payment method. Valid choices: {valid_methods}")
        return value


class OrderCreateSerializer(serializers.Serializer):
    """
    Serializer for creating orders with items.
    
    Implements Requirements 5.1, 5.2 for order creation with barcode scanning.
    """
    customer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Customer ID (optional for walk-in customers)"
    )
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        help_text="List of items to order with barcodes and quantities"
    )
    tax_rate = serializers.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal('0.0000'),
        validators=[MinValueValidator(0)],
        help_text="Tax rate to apply (e.g., 0.0825 for 8.25%)"
    )
    discount_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text="Discount amount to apply"
    )
    payment_method = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        help_text="Payment method"
    )
    payment_status = serializers.ChoiceField(
        choices=['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL'],
        required=False,
        help_text="Payment status (auto-set based on payment method if not provided)"
    )
    payment_tx_id = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Payment transaction ID"
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Order notes"
    )
    
    def validate_customer_id(self, value):
        """Validate customer exists if provided."""
        if value:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            try:
                customer = User.objects.get(id=value)
                if customer.role not in ['CUSTOMER', 'OWNER']:
                    raise serializers.ValidationError("Selected user is not a customer.")
            except User.DoesNotExist:
                raise serializers.ValidationError("Customer not found.")
        
        return value
    
    def validate_items(self, value):
        """Validate order items structure and stock availability."""
        if not value:
            raise serializers.ValidationError("At least one item must be specified for the order.")
        
        validated_items = []
        
        for item_data in value:
            # Validate required fields
            required_fields = ['barcode', 'quantity']
            for field in required_fields:
                if field not in item_data:
                    raise serializers.ValidationError(f"Field '{field}' is required for each order item.")
            
            barcode = item_data.get('barcode')
            quantity = item_data.get('quantity')
            
            # Validate quantity
            if not isinstance(quantity, int) or quantity <= 0:
                raise serializers.ValidationError("Order quantity must be a positive integer.")
            
            # Validate barcode and get inventory item
            try:
                inventory_item = InventoryItem.objects.get(barcode=barcode, is_active=True)
            except InventoryItem.DoesNotExist:
                raise serializers.ValidationError(f"Active inventory item with barcode '{barcode}' not found.")
            
            # Check stock availability
            if not inventory_item.can_fulfill_quantity(quantity):
                raise serializers.ValidationError(
                    f"Insufficient stock for {inventory_item.name}. Available: {inventory_item.stock_quantity}, Requested: {quantity}"
                )
            
            validated_items.append({
                'barcode': barcode,
                'quantity': quantity,
                'inventory_item': inventory_item
            })
        
        return validated_items
    
    def validate_tax_rate(self, value):
        """Validate tax rate is reasonable."""
        if value < 0:
            raise serializers.ValidationError("Tax rate cannot be negative.")
        if value > 1:
            raise serializers.ValidationError("Tax rate cannot exceed 100%.")
        return value
    
    def validate_discount_amount(self, value):
        """Validate discount amount is not negative."""
        if value < 0:
            raise serializers.ValidationError("Discount amount cannot be negative.")
        return value


class OrderUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating order status and payment information.
    
    Implements Requirements 5.4, 5.6 for order status and payment tracking.
    """
    
    class Meta:
        model = CustomerOrder
        fields = [
            'status', 'payment_method', 'payment_status', 'payment_reference', 'payment_tx_id', 'notes'
        ]
    
    def validate_status(self, value):
        """Validate status transition is allowed."""
        if self.instance:
            current_status = self.instance.status
            
            # Define allowed status transitions
            allowed_transitions = {
                'PENDING': ['CONFIRMED', 'CANCELLED'],
                'CONFIRMED': ['PROCESSING', 'CANCELLED'],
                'PROCESSING': ['SHIPPED', 'CANCELLED'],
                'SHIPPED': ['DELIVERED'],
                'DELIVERED': [],  # Final state
                'CANCELLED': []   # Final state
            }
            
            if value not in allowed_transitions.get(current_status, []):
                raise serializers.ValidationError(
                    f"Cannot change status from '{current_status}' to '{value}'. "
                    f"Allowed transitions: {allowed_transitions.get(current_status, [])}"
                )
        
        return value
    
    def validate_payment_status(self, value):
        """Validate payment status is appropriate for order status."""
        if self.instance and value:
            order_status = self.validated_data.get('status', self.instance.status)
            
            # Orders being shipped should have payment confirmed
            if order_status == 'SHIPPED' and value not in ['PAID']:
                raise serializers.ValidationError("Orders cannot be shipped without confirmed payment.")
        
        return value


class BarcodeOrderValidationSerializer(serializers.Serializer):
    """
    Serializer for barcode validation in order processing.
    
    Implements Requirement 5.2: Barcode scanning for order processing.
    """
    barcode = serializers.CharField(
        max_length=100,
        help_text="Barcode to validate for order"
    )
    
    def validate_barcode(self, value):
        """Validate barcode format and existence in inventory."""
        if not value:
            raise serializers.ValidationError("Barcode is required.")
        
        # Check if barcode exists in active inventory
        try:
            item = InventoryItem.objects.get(barcode=value, is_active=True)
            if item.is_out_of_stock():
                raise serializers.ValidationError("Item is out of stock.")
        except InventoryItem.DoesNotExist:
            raise serializers.ValidationError("Active inventory item with this barcode not found.")
        
        return value


class OrderReceiptSerializer(serializers.ModelSerializer):
    """
    Serializer for order receipt generation.
    
    Implements Requirement 5.5: Order receipt generation.
    """
    items = OrderItemSerializer(many=True, read_only=True)
    customer_info = serializers.SerializerMethodField()
    receipt_date = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = CustomerOrder
        fields = [
            'order_number', 'customer_info', 'receipt_date', 'status',
            'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total_amount',
            'payment_method', 'payment_status', 'items'
        ]
    
    def get_customer_info(self, obj):
        """Get customer information for receipt."""
        if obj.customer:
            return {
                'name': obj.customer.get_full_name(),
                'email': obj.customer.email,
                'phone': obj.customer.profile.phone if hasattr(obj.customer, 'profile') else None
            }
        return {'name': 'Walk-in Customer', 'email': None, 'phone': None}


class OrderSummarySerializer(serializers.ModelSerializer):
    """
    Serializer for order summary information (list views).
    """
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    item_count = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerOrder
        fields = [
            'id', 'order_number', 'customer_name', 'status', 'total_amount',
            'payment_status', 'item_count', 'total_quantity', 'created_at'
        ]
    
    def get_item_count(self, obj):
        """Get number of different items in order."""
        return obj.get_item_count()
    
    def get_total_quantity(self, obj):
        """Get total quantity of all items."""
        return obj.get_total_quantity()


class PaymentProcessingSerializer(serializers.Serializer):
    """
    Serializer for payment processing operations with automatic credit application.
    
    Implements Requirements 5.6, 6.4 for payment method support and credit application.
    """
    payment_method = serializers.ChoiceField(
        choices=[
            ('CASH', 'Cash'),
            ('CARD', 'Credit/Debit Card'),
            ('CREDIT', 'Store Credit'),
            ('BANK_TRANSFER', 'Bank Transfer'),
            ('OTHER', 'Other')
        ],
        help_text="Payment method used"
    )
    payment_reference = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Payment reference or transaction ID"
    )
    amount_paid = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Amount paid by customer (excluding credit)"
    )
    credit_used = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        required=False,
        help_text="Amount of store credit used (auto-calculated if not provided)"
    )
    auto_apply_credit = serializers.BooleanField(
        default=True,
        help_text="Automatically apply available customer credit"
    )
    
    def validate(self, attrs):
        """Validate payment amounts."""
        amount_paid = attrs.get('amount_paid', Decimal('0.00'))
        credit_used = attrs.get('credit_used', Decimal('0.00'))
        auto_apply_credit = attrs.get('auto_apply_credit', True)
        
        # If auto_apply_credit is True, credit_used will be calculated automatically
        if not auto_apply_credit and amount_paid <= 0 and credit_used <= 0:
            raise serializers.ValidationError("Either payment amount or credit usage must be greater than zero.")
        
        return attrs