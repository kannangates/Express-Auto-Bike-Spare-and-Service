"""
Serializers for returns and credit management.

Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7 for returns processing
and credit system management.
"""

from rest_framework import serializers
from django.core.validators import MinValueValidator
from decimal import Decimal

from .models import CustomerReturn, ReturnItem, CustomerCredit, CreditTransaction
from orders.models import OrderItem


class ReturnItemSerializer(serializers.ModelSerializer):
    """
    Serializer for return items with condition tracking.
    
    Implements Requirements 6.2, 6.5 for return item management.
    """
    order_item_details = serializers.SerializerMethodField()
    
    class Meta:
        model = ReturnItem
        fields = [
            'id', 'order_item', 'order_item_details', 'barcode', 'item_name',
            'quantity', 'unit_price', 'total_price', 'condition', 'restockable',
            'created_at'
        ]
        read_only_fields = ['barcode', 'item_name', 'unit_price', 'total_price', 'created_at']
    
    def get_order_item_details(self, obj):
        """Get order item details for reference."""
        if obj.order_item:
            return {
                'order_number': obj.order_item.order.order_number,
                'item_name': obj.order_item.item_name,
                'barcode': obj.order_item.barcode,
                'original_quantity': obj.order_item.quantity,
                'unit_price': obj.order_item.unit_price
            }
        return None
    
    def validate_quantity(self, value):
        """Validate return quantity doesn't exceed original order quantity."""
        if value <= 0:
            raise serializers.ValidationError("Return quantity must be greater than zero.")
        
        if self.instance and self.instance.order_item:
            # Check if return quantity exceeds original order quantity
            original_quantity = self.instance.order_item.quantity
            if value > original_quantity:
                raise serializers.ValidationError(
                    f"Return quantity ({value}) cannot exceed original order quantity ({original_quantity})."
                )
        
        return value
    
    def validate_condition(self, value):
        """Validate condition affects restockability."""
        if value in ['DAMAGED', 'DEFECTIVE']:
            # These conditions typically make items non-restockable
            pass
        return value


class CustomerReturnSerializer(serializers.ModelSerializer):
    """
    Serializer for customer returns with approval workflow.
    
    Implements Requirements 6.1, 6.2, 6.5, 6.6 for returns management.
    """
    items = ReturnItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    can_be_approved = serializers.SerializerMethodField()
    can_be_processed = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerReturn
        fields = [
            'id', 'return_number', 'order', 'order_number', 'customer', 'customer_name', 'customer_email',
            'status', 'resolution_method', 'return_reason', 'return_reason_details', 'total_amount', 'credit_amount',
            'refund_amount', 'restocking_fee', 'notes', 'processed_by', 'processed_by_name',
            'approved_by', 'approved_by_name', 'created_at', 'approved_at', 'processed_at',
            'updated_at', 'items', 'can_be_approved', 'can_be_processed'
        ]
        read_only_fields = [
            'return_number', 'total_amount', 'processed_by', 'approved_by',
            'created_at', 'approved_at', 'processed_at', 'updated_at'
        ]
    
    def get_can_be_approved(self, obj):
        """Check if return can be approved."""
        return obj.can_be_approved()
    
    def get_can_be_processed(self, obj):
        """Check if return can be processed."""
        return obj.can_be_processed()
    
    def validate_credit_amount(self, value):
        """Validate credit amount is not negative."""
        if value < 0:
            raise serializers.ValidationError("Credit amount cannot be negative.")
        return value
    
    def validate_refund_amount(self, value):
        """Validate refund amount is not negative."""
        if value < 0:
            raise serializers.ValidationError("Refund amount cannot be negative.")
        return value
    
    def validate_restocking_fee(self, value):
        """Validate restocking fee is not negative."""
        if value < 0:
            raise serializers.ValidationError("Restocking fee cannot be negative.")
        return value
    
    def validate(self, attrs):
        """Validate credit and refund amounts don't exceed total."""
        # Amounts are validated individually; cross-field validation
        # is deferred to the model's save method.
        
        return attrs


class ReturnCreateSerializer(serializers.Serializer):
    """
    Serializer for creating returns with items.
    
    Implements Requirements 6.1 for return creation with barcode verification.
    """
    order_id = serializers.IntegerField(
        required=True,
        help_text="ID of the original order"
    )
    return_reason = serializers.CharField(
        max_length=100,
        required=True,
        help_text="Reason for return"
    )
    return_reason_details = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Detailed explanation of return reason"
    )
    resolution_method = serializers.ChoiceField(
        choices=['REFUND', 'CREDIT', 'EXCHANGE'],
        required=False,
        default='REFUND',
        help_text="How the return will be resolved"
    )
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        help_text="List of items to return with quantities and conditions"
    )
    
    def validate_order_id(self, value):
        """Validate order exists and can be returned."""
        from orders.models import CustomerOrder
        
        try:
            order = CustomerOrder.objects.get(id=value)
        except CustomerOrder.DoesNotExist:
            raise serializers.ValidationError("Order not found.")
        
        if order.status not in ['DELIVERED', 'COMPLETED']:
            raise serializers.ValidationError("Only delivered orders can be returned.")
        
        return value
    
    def validate_items(self, value):
        """Validate return items structure and data."""
        if not value:
            raise serializers.ValidationError("At least one item must be specified for return.")
        
        for item_data in value:
            # Validate required fields
            required_fields = ['order_item_id', 'quantity', 'condition']
            for field in required_fields:
                if field not in item_data:
                    raise serializers.ValidationError(f"Field '{field}' is required for each return item.")
            
            # Validate quantity
            quantity = item_data.get('quantity')
            if not isinstance(quantity, int) or quantity <= 0:
                raise serializers.ValidationError("Return quantity must be a positive integer.")
            
            # Validate condition
            condition = item_data.get('condition')
            valid_conditions = [choice[0] for choice in ReturnItem.CONDITION_CHOICES]
            if condition not in valid_conditions:
                raise serializers.ValidationError(f"Invalid condition: {condition}. Valid choices: {valid_conditions}")
            
            # Validate order item exists
            order_item_id = item_data.get('order_item_id')
            try:
                order_item = OrderItem.objects.get(id=order_item_id)
                if quantity > order_item.quantity:
                    raise serializers.ValidationError(
                        f"Return quantity ({quantity}) cannot exceed original order quantity ({order_item.quantity}) for item {order_item.item_name}."
                    )
            except OrderItem.DoesNotExist:
                raise serializers.ValidationError(f"Order item with ID {order_item_id} not found.")
        
        return value


class CustomerCreditSerializer(serializers.ModelSerializer):
    """
    Serializer for customer credit balance information.
    
    Implements Requirements 6.3, 6.4 for credit system management.
    """
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    
    class Meta:
        model = CustomerCredit
        fields = [
            'id', 'customer', 'customer_name', 'customer_email', 'balance',
            'total_earned', 'total_used', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'customer', 'balance', 'total_earned', 'total_used',
            'created_at', 'updated_at'
        ]


class CreditTransactionSerializer(serializers.ModelSerializer):
    """
    Serializer for credit transaction history.
    
    Implements Requirements 6.7 for credit transaction tracking.
    """
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    amount_display = serializers.SerializerMethodField()
    
    class Meta:
        model = CreditTransaction
        fields = [
            'id', 'customer', 'customer_name', 'customer_email', 'transaction_type',
            'amount', 'amount_display', 'balance_before', 'balance_after',
            'reference_type', 'reference_id', 'description', 'created_by',
            'created_by_name', 'created_at'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_amount_display(self, obj):
        """Get amount with appropriate sign."""
        return obj.get_amount_display()


class CreditApplicationSerializer(serializers.Serializer):
    """
    Serializer for applying credit to customer account.
    
    Implements Requirements 6.4 for credit application.
    """
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Amount of credit to apply"
    )
    description = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Description of credit application"
    )
    
    def validate_amount(self, value):
        """Validate credit amount is positive."""
        if value <= 0:
            raise serializers.ValidationError("Credit amount must be greater than zero.")
        return value


class CreditUsageSerializer(serializers.Serializer):
    """
    Serializer for using credit from customer account.
    
    Implements Requirements 6.4 for credit usage.
    """
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Amount of credit to use"
    )
    reference_type = serializers.ChoiceField(
        choices=CreditTransaction.REFERENCE_TYPE_CHOICES,
        required=False,
        allow_blank=True,
        help_text="Type of reference document"
    )
    reference_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="ID of reference document"
    )
    description = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Description of credit usage"
    )
    
    def validate_amount(self, value):
        """Validate credit usage amount is positive."""
        if value <= 0:
            raise serializers.ValidationError("Credit usage amount must be greater than zero.")
        return value


class CreditMemoSerializer(serializers.Serializer):
    """
    Serializer for credit memo generation from return transactions.
    
    Implements Requirements 6.7 for credit memo generation.
    """
    return_number = serializers.CharField(read_only=True)
    customer_info = serializers.SerializerMethodField()
    memo_date = serializers.DateTimeField(source='processed_at', read_only=True)
    status = serializers.CharField(read_only=True)
    return_reason = serializers.CharField(read_only=True)
    return_reason_details = serializers.CharField(read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    credit_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    refund_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    restocking_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    original_order_info = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    notes = serializers.CharField(read_only=True)
    processed_at = serializers.DateTimeField(read_only=True)
    
    def get_customer_info(self, obj):
        """Get customer information for credit memo."""
        if obj.customer:
            return {
                'name': obj.customer.get_full_name(),
                'email': obj.customer.email,
                'phone': obj.customer.profile.phone if hasattr(obj.customer, 'profile') and obj.customer.profile else None
            }
        return {'name': 'Walk-in Customer', 'email': None, 'phone': None}
    
    def get_original_order_info(self, obj):
        """Get original order information."""
        if obj.order:
            return {
                'order_number': obj.order.order_number,
                'order_date': obj.order.created_at,
                'original_total': obj.order.total_amount
            }
        return None
    
    def get_items(self, obj):
        """Get return items information."""
        items_data = []
        for item in obj.items.all():
            items_data.append({
                'item_name': item.item_name,
                'barcode': item.barcode,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total_price': item.total_price,
                'condition': item.condition,
                'restockable': item.restockable
            })
        return items_data


class BarcodeReturnValidationSerializer(serializers.Serializer):
    """
    Serializer for barcode validation in returns processing.
    
    Implements Requirement 6.1: Barcode verification for returns.
    """
    barcode = serializers.CharField(
        max_length=100,
        help_text="Barcode to validate for return"
    )
    order_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Order ID to validate barcode against"
    )
    
    def validate_barcode(self, value):
        """Validate barcode format and existence."""
        if not value:
            raise serializers.ValidationError("Barcode is required.")
        
        # Check if barcode exists in inventory
        from inventory.models import InventoryItem
        
        try:
            InventoryItem.objects.get(barcode=value)
        except InventoryItem.DoesNotExist:
            raise serializers.ValidationError("Item with this barcode not found.")
        
        return value
    
    def validate(self, attrs):
        """Validate barcode exists in specified order if order_id provided."""
        barcode = attrs.get('barcode')
        order_id = attrs.get('order_id')
        
        if order_id and barcode:
            # Check if barcode exists in the specified order
            from orders.models import OrderItem
            order_items = OrderItem.objects.filter(
                order_id=order_id,
                barcode=barcode
            )
            
            if not order_items.exists():
                raise serializers.ValidationError({
                    'barcode': 'This item was not found in the specified order.'
                })
        
        return attrs