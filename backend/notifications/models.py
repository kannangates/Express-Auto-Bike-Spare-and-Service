import logging

from django.db import models
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class Notification(models.Model):
    """
    System notifications with email delivery tracking.
    
    Implements Requirements 12.1-12.7 for comprehensive notification system.
    """
    
    NOTIFICATION_TYPE_CHOICES = [
        ('LOW_STOCK', 'Low Stock Alert'),
        ('ORDER_STATUS', 'Order Status Update'),
        ('USER_APPROVAL', 'User Approval Request'),
        ('USER_APPROVED', 'User Account Approved'),
        ('USER_REJECTED', 'User Account Rejected'),
        ('RETURN_CREATED', 'Return Created'),
        ('RETURN_APPROVED', 'Return Approved'),
        ('RETURN_PROCESSED', 'Return Processed'),
        ('SYSTEM_ALERT', 'System Alert'),
        ('GENERAL', 'General Notification'),
    ]
    
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    ]
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='User who will receive this notification'
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPE_CHOICES,
        help_text='Type of notification'
    )
    title = models.CharField(
        max_length=200,
        help_text='Notification title'
    )
    message = models.TextField(
        help_text='Notification message content'
    )
    data = models.JSONField(
        default=dict,
        help_text='Additional notification data in JSON format'
    )
    is_read = models.BooleanField(
        default=False,
        help_text='Whether the notification has been read'
    )
    is_email_sent = models.BooleanField(
        default=False,
        help_text='Whether email notification has been sent'
    )
    email_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time when email was sent'
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='NORMAL',
        help_text='Notification priority level'
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time when notification expires'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notification'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        indexes = [
            models.Index(fields=['recipient']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['is_read']),
            models.Index(fields=['priority']),
            models.Index(fields=['created_at']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.recipient.email}"
    
    def mark_as_read(self):
        """Mark notification as read."""
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=['is_read'])
    
    def mark_email_sent(self):
        """Mark email as sent."""
        if not self.is_email_sent:
            self.is_email_sent = True
            self.email_sent_at = timezone.now()
            self.save(update_fields=['is_email_sent', 'email_sent_at'])
    
    def is_expired(self):
        """Check if notification has expired."""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False
    
    def should_send_email(self):
        """Check if email should be sent for this notification."""
        if self.is_email_sent or self.is_expired():
            return False
        
        # Check user notification preferences
        if hasattr(self.recipient, 'profile') and self.recipient.profile.notification_preferences:
            prefs = self.recipient.profile.notification_preferences
            email_enabled = prefs.get('email_notifications', True)
            type_enabled = prefs.get(f'email_{self.notification_type.lower()}', True)
            return email_enabled and type_enabled
        
        return True
    
    @classmethod
    def create_notification(cls, recipient, notification_type, title, message, data=None, priority='NORMAL', expires_at=None):
        """
        Create a new notification.
        
        Args:
            recipient: User to receive the notification
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            data: Additional data (dict)
            priority: Notification priority
            expires_at: Expiration datetime
        
        Returns:
            Notification: Created notification instance
        """
        notification = cls.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            data=data or {},
            priority=priority,
            expires_at=expires_at
        )
        
        # Trigger email sending if needed
        if notification.should_send_email():
            from .tasks import send_notification_email
            task = send_notification_email.delay(notification.id)
            logger.info(f"Notification email queued: notification_id={notification.id} task_id={task.id}")
        
        return notification
    
    @classmethod
    def create_low_stock_alert(cls, item, recipient_roles=None):
        """
        Create low stock alert notification.
        
        Args:
            item: InventoryItem that is low on stock
            recipient_roles: List of roles to notify (default: ['OWNER', 'OPERATIONS'])
        """
        if recipient_roles is None:
            recipient_roles = ['OWNER', 'OPERATIONS']
        
        from authentication.models import CustomUser
        
        recipients = CustomUser.objects.filter(
            role__in=recipient_roles,
            is_approved=True,
            is_active=True
        )
        
        for recipient in recipients:
            cls.create_notification(
                recipient=recipient,
                notification_type='LOW_STOCK',
                title=f'Low Stock Alert: {item.name}',
                message=f'Item "{item.name}" (Barcode: {item.barcode}) is running low on stock. '
                       f'Current stock: {item.stock_quantity}, Minimum level: {item.min_stock_level}',
                data={
                    'item_id': item.id,
                    'barcode': item.barcode,
                    'current_stock': item.stock_quantity,
                    'min_stock_level': item.min_stock_level
                },
                priority='HIGH'
            )
    
    @classmethod
    def create_order_status_notification(cls, order, old_status, new_status):
        """
        Create order status change notification.
        
        Args:
            order: CustomerOrder instance
            old_status: Previous order status
            new_status: New order status
        """
        if order.customer:
            cls.create_notification(
                recipient=order.customer,
                notification_type='ORDER_STATUS',
                title=f'Order {order.order_number} Status Update',
                message=f'Your order {order.order_number} status has been updated from {old_status} to {new_status}.',
                data={
                    'order_id': order.id,
                    'order_number': order.order_number,
                    'old_status': old_status,
                    'new_status': new_status
                },
                priority='NORMAL'
            )
    
    @classmethod
    def create_user_approval_notification(cls, user):
        """
        Create user approval request notification for administrators.
        
        Args:
            user: CustomUser instance pending approval
        """
        from authentication.models import CustomUser
        
        owners = CustomUser.objects.filter(
            role='OWNER',
            is_approved=True,
            is_active=True
        )
        
        # Get user profile info for notification
        user_name = None
        if hasattr(user, 'profile') and user.profile:
            user_name = user.profile.get_full_name()
        
        for owner in owners:
            cls.create_notification(
                recipient=owner,
                notification_type='USER_APPROVAL',
                title='New User Approval Required',
                message=f'User {user.email} with role {user.role} is pending approval. '
                       f'Please review and approve or reject this registration.',
                data={
                    'user_id': user.id,
                    'user_email': user.email,
                    'user_role': user.role,
                    'user_name': user_name,
                    'google_id': user.google_id,
                    'registration_date': user.date_joined.isoformat()
                },
                priority='HIGH'
            )
    
    @classmethod
    def create_return_notification(cls, return_obj, notification_type='RETURN_CREATED'):
        """
        Create return-related notification.
        
        Args:
            return_obj: CustomerReturn instance
            notification_type: Type of return notification
        """
        if return_obj.customer:
            if notification_type == 'RETURN_CREATED':
                title = f'Return {return_obj.return_number} Created'
                message = f'Your return request {return_obj.return_number} has been created and is pending approval.'
            elif notification_type == 'RETURN_APPROVED':
                title = f'Return {return_obj.return_number} Approved'
                message = f'Your return request {return_obj.return_number} has been approved and will be processed soon.'
            elif notification_type == 'RETURN_PROCESSED':
                title = f'Return {return_obj.return_number} Processed'
                message = f'Your return {return_obj.return_number} has been processed. Credit amount: ${return_obj.credit_amount}'
            else:
                title = f'Return {return_obj.return_number} Update'
                message = f'Your return {return_obj.return_number} status has been updated.'
            
            cls.create_notification(
                recipient=return_obj.customer,
                notification_type=notification_type,
                title=title,
                message=message,
                data={
                    'return_id': return_obj.id,
                    'return_number': return_obj.return_number,
                    'status': return_obj.status,
                    'credit_amount': str(return_obj.credit_amount)
                },
                priority='NORMAL'
            )


class AuditLog(models.Model):
    """
    System-wide audit logging for security and compliance.
    
    Implements Requirements 7.5 for admin activity audit logging.
    """
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text='User who performed the action'
    )
    action = models.CharField(
        max_length=100,
        help_text='Action performed (e.g., CREATE, UPDATE, DELETE)'
    )
    table_name = models.CharField(
        max_length=100,
        blank=True,
        help_text='Database table affected'
    )
    record_id = models.IntegerField(
        null=True,
        blank=True,
        help_text='ID of the affected record'
    )
    old_values = models.JSONField(
        null=True,
        blank=True,
        help_text='Previous values before change'
    )
    new_values = models.JSONField(
        null=True,
        blank=True,
        help_text='New values after change'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address of the user'
    )
    user_agent = models.TextField(
        blank=True,
        help_text='User agent string'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audit_log'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['action']),
            models.Index(fields=['table_name', 'record_id']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} by {self.user} at {self.created_at}"
    
    @classmethod
    def log_action(cls, user, action, table_name=None, record_id=None, old_values=None, new_values=None, request=None):
        """
        Log an audit action.
        
        Args:
            user: User performing the action
            action: Action being performed
            table_name: Database table affected
            record_id: ID of affected record
            old_values: Previous values
            new_values: New values
            request: HTTP request object (for IP and user agent)
        """
        ip_address = None
        user_agent = None
        
        if request:
            # Get IP address
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0]
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            
            # Get user agent
            user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        cls.objects.create(
            user=user,
            action=action,
            table_name=table_name,
            record_id=record_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent
        )
