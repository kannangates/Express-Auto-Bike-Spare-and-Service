"""
Serializers for inventory management.

Implements Requirements 4.1, 4.2, 4.3 for inventory item management,
barcode validation, and stock tracking.
"""

from rest_framework import serializers
from django.core.validators import RegexValidator
from decimal import Decimal

from .models import InventoryCategory, InventoryItem, StockTransaction


class InventoryCategorySerializer(serializers.ModelSerializer):
    """
    Serializer for inventory categories with hierarchical support.
    """
    full_path = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryCategory
        fields = [
            'id', 'name', 'description', 'parent', 'is_active',
            'full_path', 'children_count', 'items_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_full_path(self, obj):
        """Get the full category path."""
        return obj.get_full_path()
    
    def get_children_count(self, obj):
        """Get count of child categories."""
        return obj.children.filter(is_active=True).count()
    
    def get_items_count(self, obj):
        """Get count of items in this category."""
        return obj.items.filter(is_active=True).count()
    
    def validate_parent(self, value):
        """Validate parent category to prevent circular references."""
        if value and self.instance:
            # Check if setting parent would create circular reference
            current = value
            while current:
                if current == self.instance:
                    raise serializers.ValidationError(
                        "Cannot set parent category that would create circular reference."
                    )
                current = current.parent
        return value


class InventoryItemSerializer(serializers.ModelSerializer):
    """
    Serializer for inventory items with barcode validation and stock tracking.
    
    Implements Requirements 4.1, 4.2, 4.3 for inventory management.
    """
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_path = serializers.CharField(source='category.get_full_path', read_only=True)
    stock_status = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'barcode', 'name', 'description', 'category', 'category_name', 'category_path',
            'unit_price', 'stock_quantity', 'min_stock_level', 'max_stock_level',
            'stock_status', 'is_active', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
    def get_stock_status(self, obj):
        """Get stock status string."""
        return obj.get_stock_status()
    
    def validate_barcode(self, value):
        """
        Validate barcode format and uniqueness.
        
        Implements Requirement 4.2: Barcode validation for inventory items.
        """
        if not value:
            raise serializers.ValidationError("Barcode is required.")
        
        # Validate barcode format (alphanumeric and hyphens only)
        barcode_validator = RegexValidator(
            regex=r'^[0-9A-Za-z\-]+$',
            message='Barcode must contain only alphanumeric characters and hyphens'
        )
        barcode_validator(value)
        
        # Check uniqueness (excluding current instance if updating)
        queryset = InventoryItem.objects.filter(barcode=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("Item with this barcode already exists.")
        
        return value
    
    def validate_unit_price(self, value):
        """Validate unit price is positive."""
        if value <= 0:
            raise serializers.ValidationError("Unit price must be greater than zero.")
        return value
    
    def validate_stock_quantity(self, value):
        """Validate stock quantity is non-negative."""
        if value < 0:
            raise serializers.ValidationError("Stock quantity cannot be negative.")
        return value
    
    def validate_min_stock_level(self, value):
        """Validate minimum stock level is non-negative."""
        if value < 0:
            raise serializers.ValidationError("Minimum stock level cannot be negative.")
        return value
    
    def validate(self, attrs):
        """Validate max stock level is greater than min stock level."""
        min_stock = attrs.get('min_stock_level', self.instance.min_stock_level if self.instance else 0)
        max_stock = attrs.get('max_stock_level')
        
        if max_stock is not None and max_stock < min_stock:
            raise serializers.ValidationError({
                'max_stock_level': 'Maximum stock level must be greater than or equal to minimum stock level.'
            })
        
        return attrs


class StockTransactionSerializer(serializers.ModelSerializer):
    """
    Serializer for stock transaction history.
    
    Implements Requirements 4.6, 4.7 for inventory transaction tracking.
    """
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_barcode = serializers.CharField(source='item.barcode', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    quantity_display = serializers.SerializerMethodField()
    
    class Meta:
        model = StockTransaction
        fields = [
            'id', 'item', 'item_name', 'item_barcode', 'transaction_type',
            'quantity', 'quantity_display', 'previous_stock', 'new_stock',
            'reference_type', 'reference_id', 'notes',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_quantity_display(self, obj):
        """Get quantity with appropriate sign."""
        return obj.get_quantity_display()


class StockAdjustmentSerializer(serializers.Serializer):
    """
    Serializer for manual stock adjustments.
    
    Implements Requirement 4.7: Manual inventory adjustments.
    """
    adjustment_type = serializers.ChoiceField(
        choices=[('SET', 'Set to'), ('ADD', 'Add'), ('SUBTRACT', 'Subtract')],
        help_text="Type of stock adjustment"
    )
    quantity = serializers.IntegerField(
        min_value=0,
        help_text="Quantity for adjustment"
    )
    notes = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Notes about the adjustment"
    )
    
    def validate_quantity(self, value):
        """Validate adjustment quantity."""
        if value < 0:
            raise serializers.ValidationError("Adjustment quantity cannot be negative.")
        return value


class BarcodeValidationSerializer(serializers.Serializer):
    """
    Serializer for barcode validation requests.
    
    Implements Requirement 3.4: Barcode format validation.
    """
    barcode = serializers.CharField(
        max_length=100,
        help_text="Barcode to validate"
    )
    
    def validate_barcode(self, value):
        """Validate barcode format."""
        if not value:
            raise serializers.ValidationError("Barcode is required.")
        
        # Validate barcode format
        barcode_validator = RegexValidator(
            regex=r'^[0-9A-Za-z\-]+$',
            message='Barcode must contain only alphanumeric characters and hyphens'
        )
        barcode_validator(value)
        
        return value


class LowStockAlertSerializer(serializers.Serializer):
    """
    Serializer for low stock alert information.
    
    Implements Requirement 4.4: Low stock alerts.
    """
    item = InventoryItemSerializer(read_only=True)
    alert_level = serializers.SerializerMethodField()
    recommended_order_quantity = serializers.SerializerMethodField()
    
    def get_alert_level(self, obj):
        """Get alert severity level."""
        # Handle both dict and model object formats
        if isinstance(obj, dict):
            item = obj.get('item')
            if hasattr(item, 'is_out_of_stock'):
                if item.is_out_of_stock():
                    return 'CRITICAL'
                elif item.stock_quantity <= item.min_stock_level * 0.5:
                    return 'HIGH'
                else:
                    return 'MEDIUM'
            else:
                # Fallback for dict-based item data
                stock_quantity = item.get('stock_quantity', 0) if isinstance(item, dict) else getattr(item, 'stock_quantity', 0)
                min_stock_level = item.get('min_stock_level', 0) if isinstance(item, dict) else getattr(item, 'min_stock_level', 0)
                
                if stock_quantity == 0:
                    return 'CRITICAL'
                elif stock_quantity <= min_stock_level * 0.5:
                    return 'HIGH'
                else:
                    return 'MEDIUM'
        else:
            # Direct model object
            if obj.is_out_of_stock():
                return 'CRITICAL'
            elif obj.stock_quantity <= obj.min_stock_level * 0.5:
                return 'HIGH'
            else:
                return 'MEDIUM'
    
    def get_recommended_order_quantity(self, obj):
        """Calculate recommended order quantity."""
        # Handle both dict and model object formats
        if isinstance(obj, dict):
            item = obj.get('item')
            if hasattr(item, 'max_stock_level'):
                max_stock = item.max_stock_level
                stock_quantity = item.stock_quantity
                min_stock = item.min_stock_level
            else:
                # Fallback for dict-based item data
                max_stock = item.get('max_stock_level') if isinstance(item, dict) else getattr(item, 'max_stock_level', None)
                stock_quantity = item.get('stock_quantity', 0) if isinstance(item, dict) else getattr(item, 'stock_quantity', 0)
                min_stock = item.get('min_stock_level', 0) if isinstance(item, dict) else getattr(item, 'min_stock_level', 0)
        else:
            # Direct model object
            max_stock = obj.max_stock_level
            stock_quantity = obj.stock_quantity
            min_stock = obj.min_stock_level
        
        if max_stock:
            return max_stock - stock_quantity
        else:
            return min_stock * 2  # Default to 2x minimum stock