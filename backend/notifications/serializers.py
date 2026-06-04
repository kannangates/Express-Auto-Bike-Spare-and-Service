"""
Serializers for notification system.

Implements Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7 for notification management.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Notification

User = get_user_model()


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for notifications.
    
    Implements Requirements 12.4, 12.5 for notification display and delivery.
    """
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    time_since = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_name',
            'notification_type', 'title', 'message', 'data', 'is_read',
            'is_email_sent', 'email_sent_at', 'created_at', 'time_since'
        ]
        read_only_fields = [
            'is_email_sent', 'email_sent_at', 'created_at'
        ]
    
    def get_time_since(self, obj):
        """Get human-readable time since notification was created."""
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return timesince(obj.created_at, timezone.now())


class NotificationCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating notifications.
    
    Implements Requirements 12.1, 12.2, 12.3 for notification creation.
    """
    recipients = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        help_text="List of recipient user IDs"
    )
    
    class Meta:
        model = Notification
        fields = [
            'recipients', 'notification_type', 'title', 'message', 'data'
        ]
    
    def validate_recipients(self, value):
        """Validate recipient user IDs exist."""
        if not value:
            raise serializers.ValidationError("At least one recipient is required.")
        
        # Check if all user IDs exist
        existing_users = User.objects.filter(id__in=value).values_list('id', flat=True)
        missing_users = set(value) - set(existing_users)
        
        if missing_users:
            raise serializers.ValidationError(f"Users with IDs {list(missing_users)} not found.")
        
        return value
    
    def validate_notification_type(self, value):
        """Validate notification type is in allowed choices."""
        valid_types = [choice[0] for choice in Notification.NOTIFICATION_TYPE_CHOICES]
        if value not in valid_types:
            raise serializers.ValidationError(f"Invalid notification type. Valid choices: {valid_types}")
        return value
    
    def validate_data(self, value):
        """Validate notification data is valid JSON."""
        if value and not isinstance(value, dict):
            raise serializers.ValidationError("Notification data must be a JSON object.")
        return value


class NotificationPreferencesSerializer(serializers.Serializer):
    """
    Serializer for notification preferences.
    
    Implements Requirements 12.6 for notification preference management.
    """
    email_notifications = serializers.BooleanField(
        default=True,
        help_text="Enable email notifications"
    )
    low_stock_alerts = serializers.BooleanField(
        default=True,
        help_text="Receive low stock alert notifications"
    )
    order_updates = serializers.BooleanField(
        default=True,
        help_text="Receive order status update notifications"
    )
    return_updates = serializers.BooleanField(
        default=True,
        help_text="Receive return status update notifications"
    )
    user_approval_requests = serializers.BooleanField(
        default=True,
        help_text="Receive user approval request notifications (OWNER only)"
    )
    system_alerts = serializers.BooleanField(
        default=True,
        help_text="Receive system alert notifications"
    )
    
    def validate(self, attrs):
        """Validate notification preferences based on user role."""
        request = self.context.get('request')
        if request and request.user:
            user_role = request.user.role
            
            # Only OWNER users can receive approval requests
            if attrs.get('user_approval_requests') and user_role != 'OWNER':
                attrs['user_approval_requests'] = False
        
        return attrs


class BulkNotificationSerializer(serializers.Serializer):
    """
    Serializer for sending bulk notifications.
    
    Implements Requirements 12.1 for bulk notification sending.
    """
    recipient_roles = serializers.MultipleChoiceField(
        choices=User.ROLE_CHOICES,
        required=False,
        help_text="Send to users with specific roles"
    )
    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Send to specific user IDs"
    )
    notification_type = serializers.ChoiceField(
        choices=Notification.NOTIFICATION_TYPE_CHOICES,
        help_text="Type of notification"
    )
    title = serializers.CharField(
        max_length=200,
        help_text="Notification title"
    )
    message = serializers.CharField(
        help_text="Notification message"
    )
    data = serializers.JSONField(
        required=False,
        help_text="Additional notification data"
    )
    send_email = serializers.BooleanField(
        default=False,
        help_text="Send email notifications"
    )
    
    def validate(self, attrs):
        """Validate that either recipient_roles or recipient_ids is provided."""
        recipient_roles = attrs.get('recipient_roles')
        recipient_ids = attrs.get('recipient_ids')
        
        if not recipient_roles and not recipient_ids:
            raise serializers.ValidationError(
                "Either recipient_roles or recipient_ids must be provided."
            )
        
        # Validate recipient IDs if provided
        if recipient_ids:
            existing_users = User.objects.filter(id__in=recipient_ids).values_list('id', flat=True)
            missing_users = set(recipient_ids) - set(existing_users)
            
            if missing_users:
                raise serializers.ValidationError(f"Users with IDs {list(missing_users)} not found.")
        
        return attrs


class NotificationSummarySerializer(serializers.Serializer):
    """
    Serializer for notification summary information.
    
    Implements Requirements 12.4 for notification display.
    """
    total_notifications = serializers.IntegerField(read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    recent_notifications = NotificationSerializer(many=True, read_only=True)
    notification_types = serializers.DictField(read_only=True)