from django.db import models, transaction
from django.core.validators import MinValueValidator
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver


class CustomerReturn(models.Model):
    """
    Customer returns processing with approval workflow and credit calculation.
    
    Implements Requirements 6.1, 6.2, 6.5, 6.6 for returns management.
    """
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('PROCESSED', 'Processed'),
        ('REJECTED', 'Rejected'),
    ]
    
    RESOLUTION_METHOD_CHOICES = [
        ('REFUND', 'Refund'),
        ('CREDIT', 'Store Credit'),
        ('EXCHANGE', 'Exchange'),
    ]
    
    return_number = models.CharField(
        max_length=50,
        unique=True,
        help_text='Unique return number (auto-generated)'
    )
    order = models.ForeignKey(
        'orders.CustomerOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='returns',
        help_text='Original order being returned'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='returns',
        help_text='Customer making the return'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        help_text='Current return status'
    )
    resolution_method = models.CharField(
        max_length=20,
        choices=RESOLUTION_METHOD_CHOICES,
        default='REFUND',
        help_text='How the return will be resolved'
    )
    return_reason = models.CharField(
        max_length=100,
        blank=True,
        help_text='Reason for return'
    )
    return_reason_details = models.TextField(
        blank=True,
        help_text='Detailed explanation of return reason'
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Total amount of items being returned'
    )
    credit_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Amount to be credited to customer account'
    )
    refund_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Amount to be refunded to customer'
    )
    restocking_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Restocking fee charged'
    )
    notes = models.TextField(
        blank=True,
        help_text='Additional return notes'
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_returns',
        help_text='User who processed this return'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_returns',
        help_text='User who approved this return'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time when return was approved'
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time when return was processed'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'customer_return'
        verbose_name = 'Customer Return'
        verbose_name_plural = 'Customer Returns'
        indexes = [
            models.Index(fields=['return_number']),
            models.Index(fields=['order']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['processed_by']),
        ]
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(credit_amount__gte=0) & models.Q(refund_amount__gte=0) & 
                      models.Q(credit_amount__lte=models.F('total_amount') + models.F('restocking_fee')) &
                      models.Q(refund_amount__lte=models.F('total_amount') + models.F('restocking_fee')),
                name='valid_return_amounts'
            )
        ]
    
    def __str__(self):
        return f"Return {self.return_number}"
    
    def save(self, *args, **kwargs):
        """Override save to generate return number."""
        # Track status changes for notifications
        old_status = None
        if self.pk:
            try:
                old_instance = CustomerReturn.objects.get(pk=self.pk)
                old_status = old_instance.status
            except CustomerReturn.DoesNotExist:
                pass
        
        if not self.return_number:
            self.return_number = self.generate_return_number()
        
        is_new = not self.pk
        super().save(*args, **kwargs)
        
        # Trigger notifications based on status changes
        if is_new:
            self._trigger_return_created_notification()
        elif old_status and old_status != self.status:
            self._trigger_return_status_notification(old_status, self.status)
    
    def _trigger_return_created_notification(self):
        """Trigger return created notification."""
        try:
            from notifications.models import Notification
            Notification.create_return_notification(self, 'RETURN_CREATED')
        except Exception as e:
            # Log error but don't fail the save
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create return created notification for {self.return_number}: {str(e)}")
    
    def _trigger_return_status_notification(self, old_status, new_status):
        """Trigger return status change notification."""
        try:
            from notifications.models import Notification
            if new_status == 'APPROVED':
                Notification.create_return_notification(self, 'RETURN_APPROVED')
            elif new_status == 'PROCESSED':
                Notification.create_return_notification(self, 'RETURN_PROCESSED')
        except Exception as e:
            # Log error but don't fail the save
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create return status notification for {self.return_number}: {str(e)}")
    
    def generate_return_number(self):
        """Generate unique return number in format RET-YYYYMMDD-NNNN."""
        try:
            from django.db import connection
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT generate_return_number()")
                result = cursor.fetchone()
                return result[0]
        except Exception:
            # Fallback for testing or when database function is not available
            import datetime
            import random
            
            today = datetime.date.today()
            date_str = today.strftime('%Y%m%d')
            random_num = random.randint(1000, 9999)
            return f"RET-{date_str}-{random_num}"
    
    def calculate_totals(self):
        """Calculate return totals from return items."""
        from django.db.models import Sum
        result = self.items.aggregate(total=Sum('total_price'))
        self.total_amount = result['total'] or Decimal('0.00')
    
    def can_be_approved(self):
        """Check if return can be approved."""
        return self.status == 'PENDING'
    
    def can_be_processed(self):
        """Check if return can be processed."""
        return self.status == 'APPROVED'
    
    def approve_return(self, user=None):
        """Approve the return."""
        if self.can_be_approved():
            self.status = 'APPROVED'
            self.approved_by = user
            self.approved_at = timezone.now()
            self.save()
            return True
        return False
    
    def process_return(self, user=None):
        """
        Process the return by updating inventory and customer credit.
        
        This method should be called when a return is approved and ready to be processed.
        It will increase inventory quantities for restockable items and update customer credit.
        """
        if not self.can_be_processed():
            raise ValueError("Only approved returns can be processed")
        
        # Update inventory for restockable items
        for return_item in self.items.filter(restockable=True):
            return_item.order_item.item.update_stock(
                quantity_change=return_item.quantity,
                transaction_type='IN',
                reference_type='RETURN',
                reference_id=self.id,
                notes=f"Return {self.return_number} processing",
                user=user
            )
        
        # Update customer credit if credit amount > 0
        if self.credit_amount > 0 and self.customer:
            with transaction.atomic():
                # Lock the credit account row to prevent concurrent balance corruption
                credit_account, created = CustomerCredit.objects.select_for_update().get_or_create(
                    customer=self.customer,
                    defaults={'balance': Decimal('0.00')}
                )

                new_balance = credit_account.balance + self.credit_amount

                # Create credit transaction
                CreditTransaction.objects.create(
                    customer=self.customer,
                    transaction_type='CREDIT',
                    amount=self.credit_amount,
                    balance_before=credit_account.balance,
                    balance_after=new_balance,
                    reference_type='RETURN',
                    reference_id=self.id,
                    description=f'Credit for return {self.return_number}',
                    created_by=user
                )

                # Update credit account balance atomically
                credit_account.balance = new_balance
                credit_account.total_earned += self.credit_amount
                credit_account.save(update_fields=['balance', 'total_earned'])
        
        # Update return status
        self.status = 'PROCESSED'
        self.processed_by = user
        self.processed_at = timezone.now()
        self.save()


class ReturnItem(models.Model):
    """
    Individual items being returned with condition tracking.
    
    Implements Requirements 6.2, 6.5 for return item management.
    """
    
    CONDITION_CHOICES = [
        ('NEW', 'New'),
        ('USED', 'Used'),
        ('DAMAGED', 'Damaged'),
        ('DEFECTIVE', 'Defective'),
        ('UNKNOWN', 'Unknown'),
    ]
    
    return_obj = models.ForeignKey(
        CustomerReturn,
        on_delete=models.CASCADE,
        related_name='items',
        help_text='Return this item belongs to'
    )
    order_item = models.ForeignKey(
        'orders.OrderItem',
        on_delete=models.RESTRICT,
        related_name='return_items',
        help_text='Original order item being returned'
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
        help_text='Quantity being returned'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Unit price from original order'
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Total price for this return item'
    )
    condition = models.CharField(
        max_length=50,
        choices=CONDITION_CHOICES,
        default='UNKNOWN',
        help_text='Condition of returned item'
    )
    restockable = models.BooleanField(
        default=True,
        help_text='Whether this item can be restocked'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'return_item'
        verbose_name = 'Return Item'
        verbose_name_plural = 'Return Items'
        indexes = [
            models.Index(fields=['return_obj']),
            models.Index(fields=['order_item']),
            models.Index(fields=['barcode']),
        ]
    
    def __str__(self):
        return f"{self.item_name} × {self.quantity} ({self.condition})"
    
    def save(self, *args, **kwargs):
        """Override save to populate audit fields and calculate total."""
        if self.order_item:
            self.barcode = self.order_item.barcode
            self.item_name = self.order_item.item_name
            self.unit_price = self.order_item.unit_price
        
        # Calculate total price
        self.total_price = self.quantity * self.unit_price
        
        super().save(*args, **kwargs)
        
        # Update return totals
        if self.return_obj:
            self.return_obj.calculate_totals()
            self.return_obj.save()


class CustomerCredit(models.Model):
    """
    Customer credit balance tracking with transaction totals.
    
    Implements Requirements 6.3, 6.4 for credit system management.
    """
    
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_account',
        help_text='Customer this credit account belongs to'
    )
    balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Current credit balance'
    )
    total_earned = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Total credits earned'
    )
    total_used = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
        help_text='Total credits used'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'customer_credit'
        verbose_name = 'Customer Credit'
        verbose_name_plural = 'Customer Credits'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['balance']),
        ]
        constraints = []
    
    def __str__(self):
        return f"{self.customer.email} - ${self.balance}"
    
    def has_sufficient_credit(self, amount):
        """Check if customer has sufficient credit for the given amount."""
        return self.balance >= amount
    
    def apply_credit(self, amount, user=None):
        """Apply credit to customer account (increase balance)."""
        if amount <= 0:
            raise ValueError("Credit amount must be positive")
        
        # Always use fallback for testing to avoid database function issues
        CreditTransaction.objects.create(
            customer=self.customer,
            transaction_type='CREDIT',
            amount=amount,
            balance_before=self.balance,
            balance_after=self.balance + amount,
            description='Credit applied',
            created_by=user
        )
        
        self.balance += amount
        self.total_earned += amount
        self.save()
        
        self.refresh_from_db()
    
    def use_credit(self, amount, reference_type=None, reference_id=None, description=None, user=None):
        """Use credit from customer account (decrease balance)."""
        if amount <= 0:
            raise ValueError("Credit usage amount must be positive")
        
        if not self.has_sufficient_credit(amount):
            raise ValueError(f"Insufficient credit balance. Available: {self.balance}, Requested: {amount}")
        
        # Always use fallback for testing to avoid database function issues
        CreditTransaction.objects.create(
            customer=self.customer,
            transaction_type='DEBIT',
            amount=amount,
            balance_before=self.balance,
            balance_after=self.balance - amount,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description or 'Credit used',
            created_by=user
        )
        
        self.balance -= amount
        self.total_used += amount
        self.save()
        
        self.refresh_from_db()


class CreditTransaction(models.Model):
    """
    Credit transaction history for complete audit trail.
    
    Implements Requirements 6.7 for credit transaction tracking.
    """
    
    TRANSACTION_TYPE_CHOICES = [
        ('CREDIT', 'Credit'),
        ('DEBIT', 'Debit'),
    ]
    
    REFERENCE_TYPE_CHOICES = [
        ('RETURN', 'Return'),
        ('ORDER', 'Order'),
        ('ADJUSTMENT', 'Manual Adjustment'),
        ('REFUND', 'Refund'),
    ]
    
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_transactions',
        help_text='Customer this transaction belongs to'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        help_text='Type of credit transaction'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text='Transaction amount'
    )
    balance_before = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Credit balance before transaction'
    )
    balance_after = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text='Credit balance after transaction'
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
    description = models.TextField(
        blank=True,
        help_text='Transaction description'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_credit_transactions',
        help_text='User who created this transaction'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'credit_transaction'
        verbose_name = 'Credit Transaction'
        verbose_name_plural = 'Credit Transactions'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['reference_type', 'reference_id']),
            models.Index(fields=['created_at']),
            # Run: npm run makemigrations && npm run migrate
            models.Index(
                fields=['customer', 'transaction_type', 'reference_type', 'created_at'],
                name='credit_txn_customer_type_ref_idx',
            ),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.customer.email} - {self.transaction_type} ${self.amount}"
    
    def get_amount_display(self):
        """Return amount with appropriate sign."""
        if self.transaction_type == 'DEBIT':
            return f"-${self.amount}"
        else:
            return f"+${self.amount}"
