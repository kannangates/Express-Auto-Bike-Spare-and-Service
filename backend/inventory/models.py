from django.db import models, transaction
from django.core.validators import MinValueValidator, RegexValidator
from django.conf import settings
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver


class InventoryCategory(models.Model):
    """
    Product categories for inventory organization with hierarchical support.
    
    Implements Requirements 4.1 for inventory management structure.
    """
    
    name = models.CharField(
        max_length=100,
        help_text='Category name'
    )
    description = models.TextField(
        blank=True,
        help_text='Category description'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        help_text='Parent category for hierarchical organization'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this category is active'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'inventory_category'
        verbose_name = 'Inventory Category'
        verbose_name_plural = 'Inventory Categories'
        indexes = [
            models.Index(fields=['parent']),
            models.Index(fields=['name']),
        ]
    
    def __str__(self):
        return self.name
    
    def get_full_path(self):
        """Return the full category path (e.g., 'Parent > Child')."""
        if self.parent:
            return f"{self.parent.get_full_path()} > {self.name}"
        return self.name


class InventoryItem(models.Model):
    """
    Main inventory items with barcode integration and stock tracking.
    
    Implements Requirements 3.2, 4.1, 4.2, 4.3 for barcode scanning and inventory management.
    """
    
    barcode = models.CharField(
        max_length=100,
        unique=True,
        validators=[
            RegexValidator(
                regex=r'^[0-9A-Za-z\-]+$',
                message='Barcode must contain only alphanumeric characters and hyphens'
            )
        ],
        help_text='Unique barcode identifier (required for all operations)'
    )
    name = models.CharField(
        max_length=200,
        help_text='Item name'
    )
    description = models.TextField(
        blank=True,
        help_text='Detailed item description'
    )
    category = models.ForeignKey(
        InventoryCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items',
        help_text='Item category'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Unit price in currency'
    )
    stock_quantity = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text='Current stock quantity'
    )
    min_stock_level = models.IntegerField(
        default=10,
        validators=[MinValueValidator(0)],
        help_text='Minimum stock level for low stock alerts'
    )
    max_stock_level = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text='Maximum stock level (optional)'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this item is active'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_inventory_items',
        help_text='User who created this item'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'inventory_item'
        verbose_name = 'Inventory Item'
        verbose_name_plural = 'Inventory Items'
        indexes = [
            models.Index(fields=['barcode']),
            models.Index(fields=['name']),
            models.Index(fields=['category']),
            models.Index(fields=['stock_quantity']),
            models.Index(fields=['min_stock_level']),
            models.Index(fields=['is_active']),
            models.Index(fields=['created_by']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(max_stock_level__isnull=True) | models.Q(max_stock_level__gte=models.F('min_stock_level')),
                name='max_stock_gte_min_stock'
            )
        ]
    
    def __str__(self):
        return f"{self.name} ({self.barcode})"
    
    def is_low_stock(self):
        """Check if item is at or below minimum stock level."""
        return self.stock_quantity <= self.min_stock_level
    
    def is_out_of_stock(self):
        """Check if item is out of stock."""
        return self.stock_quantity == 0
    
    def get_stock_status(self):
        """Return stock status as string."""
        if self.is_out_of_stock():
            return 'OUT_OF_STOCK'
        elif self.is_low_stock():
            return 'LOW_STOCK'
        else:
            return 'IN_STOCK'
    
    def can_fulfill_quantity(self, quantity):
        """Check if there's enough stock to fulfill the requested quantity."""
        return self.stock_quantity >= quantity
    
    def update_stock(self, quantity_change, transaction_type, reference_type=None, reference_id=None, notes=None, user=None):
        """
        Update stock quantity and create transaction record.
        
        Args:
            quantity_change (int): Positive for stock increase, negative for decrease
            transaction_type (str): 'IN', 'OUT', or 'ADJUSTMENT'
            reference_type (str): Optional reference type ('ORDER', 'RETURN', 'ADJUSTMENT')
            reference_id (int): Optional reference ID
            notes (str): Optional notes
            user: User making the change
        """
        with transaction.atomic():
            # Lock the row to prevent concurrent stock updates (race condition fix)
            locked = InventoryItem.objects.select_for_update().get(pk=self.pk)
            previous_stock = locked.stock_quantity
            new_stock = previous_stock + quantity_change

            if new_stock < 0:
                raise ValueError(f"Insufficient stock. Available: {previous_stock}, Requested: {abs(quantity_change)}")

            locked.stock_quantity = new_stock
            locked.save(update_fields=['stock_quantity', 'updated_at'])

            # Sync instance state with the committed value
            self.stock_quantity = new_stock

            # Create stock transaction record
            StockTransaction.objects.create(
                item=self,
                transaction_type=transaction_type,
                quantity=abs(quantity_change),
                previous_stock=previous_stock,
                new_stock=new_stock,
                reference_type=reference_type,
                reference_id=reference_id,
                notes=notes,
                created_by=user
            )

        # Invalidate the low stock cache so the next request reflects updated stock levels
        from django.core.cache import cache
        cache.delete('inventory:low_stock_alert')

        # Check for low stock and trigger notification (outside atomic block)
        if self.is_low_stock() and transaction_type == 'OUT':
            self._trigger_low_stock_notification()

        return new_stock
    
    def _trigger_low_stock_notification(self):
        """Trigger low stock notification for this item."""
        try:
            from notifications.models import Notification
            Notification.create_low_stock_alert(self)
        except Exception as e:
            # Log error but don't fail the stock update
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create low stock notification for {self.barcode}: {str(e)}")


# Signal handlers for inventory notifications
@receiver(post_save, sender=InventoryItem)
def check_low_stock_on_save(sender, instance, created, **kwargs):
    """Check for low stock when inventory item is saved."""
    if not created and instance.is_low_stock():
        # Only trigger notification if stock quantity changed
        if hasattr(instance, '_stock_changed') and instance._stock_changed:
            instance._trigger_low_stock_notification()


class StockTransaction(models.Model):
    """
    Stock transaction history for complete audit trail.
    
    Implements Requirements 4.6, 4.7 for inventory transaction tracking.
    """
    
    TRANSACTION_TYPE_CHOICES = [
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
        ('ADJUSTMENT', 'Stock Adjustment'),
    ]
    
    REFERENCE_TYPE_CHOICES = [
        ('ORDER', 'Order'),
        ('RETURN', 'Return'),
        ('ADJUSTMENT', 'Manual Adjustment'),
        ('INITIAL', 'Initial Stock'),
    ]
    
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name='stock_transactions',
        help_text='Inventory item'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        help_text='Type of stock transaction'
    )
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text='Quantity involved in transaction'
    )
    previous_stock = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text='Stock quantity before transaction'
    )
    new_stock = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text='Stock quantity after transaction'
    )
    reference_type = models.CharField(
        max_length=20,
        choices=REFERENCE_TYPE_CHOICES,
        null=True,
        blank=True,
        help_text='Type of reference document'
    )
    reference_id = models.IntegerField(
        null=True,
        blank=True,
        help_text='ID of reference document'
    )
    notes = models.TextField(
        blank=True,
        help_text='Additional notes about the transaction'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_transactions',
        help_text='User who created this transaction'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'stock_transaction'
        verbose_name = 'Stock Transaction'
        verbose_name_plural = 'Stock Transactions'
        indexes = [
            models.Index(fields=['item']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['reference_type', 'reference_id']),
            models.Index(fields=['created_at']),
            models.Index(fields=['created_by']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.item.name} - {self.transaction_type} ({self.quantity})"
    
    def get_quantity_display(self):
        """Return quantity with appropriate sign."""
        if self.transaction_type == 'OUT':
            return f"-{self.quantity}"
        else:
            return f"+{self.quantity}"
