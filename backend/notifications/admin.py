from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import Notification, AuditLog


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin interface for Notification model."""
    
    list_display = ('title', 'recipient_link', 'notification_type', 'priority', 'is_read', 'is_email_sent', 'created_at')
    list_filter = ('notification_type', 'priority', 'is_read', 'is_email_sent', 'created_at')
    search_fields = ('title', 'message', 'recipient__email')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'email_sent_at')
    
    fieldsets = (
        ('Notification Details', {
            'fields': ('recipient', 'notification_type', 'title', 'message', 'priority')
        }),
        ('Status', {
            'fields': ('is_read', 'is_email_sent', 'email_sent_at', 'expires_at')
        }),
        ('Additional Data', {
            'fields': ('data',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def recipient_link(self, obj):
        """Display recipient as clickable link."""
        url = reverse('admin:authentication_customuser_change', args=[obj.recipient.id])
        return format_html('<a href="{}">{}</a>', url, obj.recipient.email)
    recipient_link.short_description = 'Recipient'
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.is_customer():
            return qs.filter(recipient=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view notifications (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Only OWNER and OPERATIONS can modify notifications."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_add_permission(self, request):
        """Only OWNER and OPERATIONS can create notifications."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete notifications."""
        return request.user.is_owner()
    
    actions = ['mark_as_read', 'resend_email']
    
    def mark_as_read(self, request, queryset):
        """Mark selected notifications as read."""
        count = 0
        for notification in queryset:
            if not notification.is_read:
                notification.mark_as_read()
                count += 1
        self.message_user(request, f'{count} notifications marked as read.')
    mark_as_read.short_description = 'Mark selected notifications as read'
    
    def resend_email(self, request, queryset):
        """Resend email for selected notifications."""
        from .tasks import send_notification_email
        count = 0
        for notification in queryset:
            if notification.should_send_email():
                send_notification_email.delay(notification.id)
                count += 1
        self.message_user(request, f'{count} email notifications queued for sending.')
    resend_email.short_description = 'Resend email for selected notifications'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin interface for AuditLog model."""
    
    list_display = ('action', 'user_link', 'table_name', 'record_id', 'ip_address', 'created_at')
    list_filter = ('action', 'table_name', 'created_at')
    search_fields = ('action', 'user__email', 'table_name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Action Details', {
            'fields': ('user', 'action', 'table_name', 'record_id')
        }),
        ('Data Changes', {
            'fields': ('old_values', 'new_values'),
            'classes': ('collapse',)
        }),
        ('Request Information', {
            'fields': ('ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def user_link(self, obj):
        """Display user as clickable link."""
        if obj.user:
            url = reverse('admin:authentication_customuser_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.email)
        return 'System'
    user_link.short_description = 'User'
    
    def get_queryset(self, request):
        """Only OWNER can view audit logs."""
        qs = super().get_queryset(request)
        if request.user.is_owner():
            return qs
        return qs.none()
    
    def has_module_permission(self, request):
        """Only OWNER can access audit logs."""
        return request.user.is_authenticated and request.user.is_owner()
    
    def has_change_permission(self, request, obj=None):
        """Audit logs cannot be modified."""
        return False
    
    def has_add_permission(self, request):
        """Audit logs are created automatically."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Audit logs cannot be deleted."""
        return False
