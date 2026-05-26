"""
Inventory service layer for business logic.
"""

from django.db import transaction
from django.db.models import F, Sum, ExpressionWrapper, DecimalField
from django.utils import timezone
from decimal import Decimal

from .models import InventoryItem, StockTransaction

class InventoryService:
    """Service class for inventory management operations."""
    
    def check_low_stock_alert(self, item):
        """
        Check if an inventory item requires a low stock alert.
        
        Args:
            item (InventoryItem): Inventory item to check
            
        Returns:
            bool: True if alert should be generated
        """
        return item.stock_quantity <= item.min_stock_level
    
    def get_low_stock_alert_data(self, item):
        """
        Get alert data for low stock item.
        
        Args:
            item (InventoryItem): Low stock inventory item
            
        Returns:
            dict: Alert data
        """
        return {
            'item_id': item.id,
            'barcode': item.barcode,
            'name': item.name,
            'current_stock': item.stock_quantity,
            'min_stock_level': item.min_stock_level,
            'shortage': item.min_stock_level - item.stock_quantity,
            'alert_level': 'critical' if item.stock_quantity == 0 else 'warning'
        }
    
    def update_stock_level(self, item, new_quantity, transaction_type='ADJUSTMENT', reference_type=None, reference_id=None, notes=None, user=None):
        """
        Update inventory stock level with transaction tracking.
        Must be called inside an existing transaction.atomic() block that has already
        acquired a select_for_update() lock on the item row.

        Args:
            item (InventoryItem): Item to update (should be a locked DB instance)
            new_quantity (int): New stock quantity
            transaction_type (str): Type of transaction
            reference_type (str): Reference type (ORDER, RETURN, etc.)
            reference_id (int): Reference ID
            notes (str): Transaction notes
            user (User): User performing the transaction

        Returns:
            StockTransaction: Created transaction record
        """
        old_quantity = item.stock_quantity
        quantity_change = new_quantity - old_quantity

        # Update item stock
        item.stock_quantity = new_quantity
        item.updated_at = timezone.now()
        item.save(update_fields=['stock_quantity', 'updated_at'])

        # Create transaction record
        stock_transaction = StockTransaction.objects.create(
            item=item,
            transaction_type=transaction_type,
            quantity=abs(quantity_change),
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            created_by=user
        )

        return stock_transaction

    def process_stock_movement(self, item, quantity, movement_type, reference_type=None, reference_id=None, user=None):
        """
        Process stock movement (IN/OUT).
        Re-fetches the item with a row-level lock to prevent race conditions
        where two concurrent requests read the same stale stock_quantity.

        Args:
            item (InventoryItem): Item to update
            quantity (int): Quantity to move
            movement_type (str): 'IN' or 'OUT'
            reference_type (str): Reference type
            reference_id (int): Reference ID
            user (User): User performing the operation

        Returns:
            StockTransaction: Created transaction record
        """
        with transaction.atomic():
            # Re-fetch with row lock so concurrent calls serialize here
            locked_item = InventoryItem.objects.select_for_update().get(pk=item.pk)

            if movement_type == 'IN':
                new_quantity = locked_item.stock_quantity + quantity
            elif movement_type == 'OUT':
                new_quantity = max(0, locked_item.stock_quantity - quantity)
            else:
                raise ValueError(f"Invalid movement type: {movement_type}")

            return self.update_stock_level(
                item=locked_item,
                new_quantity=new_quantity,
                transaction_type=movement_type,
                reference_type=reference_type,
                reference_id=reference_id,
                user=user
            )
    
    def get_low_stock_items(self, category=None):
        """
        Get all items with low stock levels.
        
        Args:
            category (Category): Optional category filter
            
        Returns:
            QuerySet: Low stock items
        """
        queryset = InventoryItem.objects.filter(
            stock_quantity__lte=F('min_stock_level'),
            is_active=True
        )
        
        if category:
            queryset = queryset.filter(category=category)
        
        return queryset.order_by('stock_quantity')
    
    def calculate_inventory_value(self, category=None):
        """
        Calculate total inventory value.
        
        Args:
            category (Category): Optional category filter
            
        Returns:
            Decimal: Total inventory value
        """
        queryset = InventoryItem.objects.filter(is_active=True)

        if category:
            queryset = queryset.filter(category=category)

        # Use a single DB aggregate instead of looping in Python
        result = queryset.aggregate(
            total=Sum(
                ExpressionWrapper(
                    F('unit_price') * F('stock_quantity'),
                    output_field=DecimalField(max_digits=20, decimal_places=2)
                )
            )
        )
        return result['total'] or Decimal('0.00')
    
    def get_stock_movement_history(self, item, days=30):
        """
        Get stock movement history for an item.
        
        Args:
            item (InventoryItem): Item to get history for
            days (int): Number of days to look back
            
        Returns:
            QuerySet: Stock transactions
        """
        from datetime import timedelta
        
        cutoff_date = timezone.now() - timedelta(days=days)
        
        return StockTransaction.objects.filter(
            item=item,
            created_at__gte=cutoff_date
        ).order_by('-created_at')