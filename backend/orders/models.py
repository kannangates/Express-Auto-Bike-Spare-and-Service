from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver


class CustomerOrder(models.Model):
    """
    Customer orders with comprehensive tracking and payment management.
    
    Implements Requirements 5.1, 5.3, 5.4, 5.5, 5.6 for order processing.
    """
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
        ('PARTIAL', 'Partial'),
    ]
    
    order_number = models.CharField(
        max_length=50,
        unique=True,
        help_text='Unique order number (auto-generated)'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        help_text='Customer who placed the order'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        help_text='Current order status'
    )
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Order subtotal before tax and discounts'
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal('0.0000'),
        validators=[MinValueValidator(0)],
        help_text='Tax rate applied to the order'
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Tax amount calculated from subtotal and tax rate'
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Discount amount applied to the order'
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Final order total (subtotal + tax - discount)'
    )
    payment_method = models.CharField(
        max_length=20,
        blank=True,
        help_text='Payment method used'
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='PENDING',
        help_text='Payment status'
    )
    payment_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text='Payment reference or transaction ID'
    )
    payment_tx_id = models.CharField(
        max_length=100,
        blank=True,
        help_text='Payment transaction ID (Card, UPI, or Cash reference)'
    )
    notes = models.TextField(
        blank=True,
        help_text='Additional order notes'
    )
    shipped_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time when order was shipped'
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time when order was delivered'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_orders',
        help_text='User who created this order'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'customer_order'
        verbose_name = 'Customer Order'
        verbose_name_plural = 'Customer Orders'
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['created_by']),
            models.Index(fields=['created_at', 'status']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Order {self.order_number}"
    
    def save(self, *args, **kwargs):
        """Override save to generate order number and calculate totals."""
        # Track status changes for notifications
        old_status = None
        if self.pk:
            try:
                old_instance = CustomerOrder.objects.get(pk=self.pk)
                old_status = old_instance.status
            except CustomerOrder.DoesNotExist:
                pass
        
        if not self.order_number:
            self.order_number = self.generate_order_number()
        
        # Calculate totals
        self.calculate_totals()
        
        super().save(*args, **kwargs)
        
        # Trigger status change notification if status changed
        if old_status and old_status != self.status:
            self._trigger_status_change_notification(old_status, self.status)
    
    def _trigger_status_change_notification(self, old_status, new_status):
        """Trigger order status change notification."""
        try:
            from notifications.models import Notification
            Notification.create_order_status_notification(self, old_status, new_status)
        except Exception as e:
            # Log error but don't fail the save
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create order status notification for {self.order_number}: {str(e)}")
    
    def generate_order_number(self):
        """Generate unique order number in format ORD-YYYYMMDD-NNNN."""
        try:
            from django.db import connection
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT generate_order_number()")
                result = cursor.fetchone()
                return result[0]
        except Exception:
            # Fallback for testing or when database function is not available
            import datetime
            import random
            
            today = datetime.date.today()
            date_str = today.strftime('%Y%m%d')
            random_num = random.randint(1000, 9999)
            return f"ORD-{date_str}-{random_num}"
    
    def calculate_totals(self):
        """Calculate order totals from items, tax, and discounts."""
        # Only calculate from items if the order has been saved and has items
        if self.pk and self.items.exists():
            self.subtotal = sum(item.total_price for item in self.items.all())
        # Otherwise, keep the provided subtotal or default to 0
        elif not hasattr(self, 'subtotal') or self.subtotal is None:
            self.subtotal = Decimal('0.00')
        
        # Calculate tax amount
        self.tax_amount = self.subtotal * self.tax_rate
        
        # Calculate total amount — clamp to zero so discounts never produce a negative bill
        self.total_amount = max(Decimal('0.00'), self.subtotal + self.tax_amount - self.discount_amount)
    
    def get_item_count(self):
        """Return total number of items in the order."""
        return self.items.count()
    
    def get_total_quantity(self):
        """Return total quantity of all items in the order."""
        return sum(item.quantity for item in self.items.all())
    
    def can_be_cancelled(self):
        """Check if order can be cancelled."""
        return self.status in ['PENDING', 'CONFIRMED']
    
    def can_be_shipped(self):
        """Check if order can be shipped."""
        return self.status == 'CONFIRMED' and self.payment_status == 'PAID'
    
    def mark_as_shipped(self, user=None):
        """Mark order as shipped."""
        if self.can_be_shipped():
            self.status = 'SHIPPED'
            self.shipped_at = timezone.now()
            self.save()
            return True
        return False
    
    def mark_as_delivered(self, user=None):
        """Mark order as delivered."""
        if self.status == 'SHIPPED':
            self.status = 'DELIVERED'
            self.delivered_at = timezone.now()
            self.save()
            return True
        return False
    
    def process_order(self, user=None):
        """
        Process the order by updating inventory.

        This method should be called when an order is confirmed and ready to be processed.
        It will reduce inventory quantities for all order items.
        """
        if self.status != 'CONFIRMED':
            raise ValueError("Only confirmed orders can be processed")

        # Get all inventory items for this order with row-level locking to prevent race conditions
        order_items = self.items.select_related('item').all()
        item_ids = [order_item.item.id for order_item in order_items]

        # Lock items for update to prevent concurrent stock modifications
        from inventory.models import InventoryItem  # local import avoids circular dependency
        locked_items = {
            item.id: item
            for item in InventoryItem.objects.filter(id__in=item_ids).select_for_update()
        }

        # Check stock availability for all items
        for order_item in order_items:
            item = locked_items.get(order_item.item.id)
            if item and not item.can_fulfill_quantity(order_item.quantity):
                raise ValueError(f"Insufficient stock for {item.name}. Available: {item.stock_quantity}, Required: {order_item.quantity}")

        # Update inventory for all items
        for order_item in order_items:
            item = locked_items.get(order_item.item.id)
            if item:
                item.update_stock(
                    quantity_change=-order_item.quantity,
                    transaction_type='OUT',
                    reference_type='ORDER',
                    reference_id=self.id,
                    notes=f"Order {self.order_number} confirmed",
                    user=user
                )


class OrderItem(models.Model):
    """
    Individual items within orders with pricing and quantity details.
    
    Implements Requirements 5.1, 5.3 for multi-item order support.
    """
    
    order = models.ForeignKey(
        CustomerOrder,
        on_delete=models.CASCADE,
        related_name='items',
        help_text='Order this item belongs to'
    )
    item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.RESTRICT,
        related_name='order_items',
        help_text='Inventory item being ordered'
    )
    barcode = models.CharField(
        max_length=100,
        help_text='Barcode of the item (stored for audit trail)'
    )
    item_name = models.CharField(
        max_length=200,
        help_text='Name of the item (stored for audit trail)'
    )
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text='Quantity ordered'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Unit price at time of order'
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Total price for this line item (quantity × unit_price)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'order_item'
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['item']),
            models.Index(fields=['barcode']),
        ]
    
    def __str__(self):
        return f"{self.item_name} × {self.quantity}"
    
    def save(self, *args, **kwargs):
        """Override save to populate audit fields and calculate total."""
        if self.item:
            self.barcode = self.item.barcode
            self.item_name = self.item.name
            if not self.unit_price:
                self.unit_price = self.item.unit_price
        
        # Calculate total price
        self.total_price = self.quantity * self.unit_price
        
        super().save(*args, **kwargs)
        
        # Update order totals
        if self.order:
            self.order.calculate_totals()
            self.order.save()
    
    def get_line_total(self):
        """Return the total price for this line item."""
        return self.quantity * self.unit_price
