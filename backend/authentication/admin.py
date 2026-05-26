"""
Django admin configuration for authentication models.

Implements Requirements 7.1, 7.3, 7.5 for Django admin access restriction
to OWNER role and activity audit logging.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.admin import AdminSite
from django.http import HttpResponseForbidden
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
import logging

from .models import CustomUser, UserProfile

logger = logging.getLogger(__name__)


class RestrictedAdminSite(AdminSite):
    """
    Custom admin site that restricts access to OWNER role only.
    
    Implements Requirements 7.1, 7.3: Django admin access restriction.
    """
    
    site_header = "Express Auto Bike Management System"
    site_title = "Express Auto Bike Admin"
    index_title = "Administration"
    
    def has_permission(self, request):
        """
        Check if user has permission to access admin site.
        Only OWNER role users can access Django admin.
        """
        if not request.user.is_active or not request.user.is_authenticated:
            return False
        # Allow superusers always
        if request.user.is_superuser:
            return True
        # Allow OWNER role with approval
        return (
            request.user.role == 'OWNER' and
            request.user.is_approved
        )
    
    def admin_view(self, view, cacheable=False):
        """Override admin view to add additional permission checks."""
        def inner(request, *args, **kwargs):
            if not self.has_permission(request):
                logger.warning(f"Unauthorized admin access attempt by {request.user.email if request.user.is_authenticated else 'anonymous'}")
                return HttpResponseForbidden("Access denied. OWNER role required.")
            return view(request, *args, **kwargs)
        return inner


# Create custom admin site instance
admin_site = RestrictedAdminSite(name='restricted_admin')


class UserProfileInline(admin.StackedInline):
    """Inline admin for user profile."""
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    fields = ['first_name', 'last_name', 'phone', 'avatar_url', 'notification_preferences']


@admin.register(CustomUser, site=admin_site)
class CustomUserAdmin(UserAdmin):
    """
    Custom user admin with role-based fields and approval management.
    
    Implements Requirements 7.5: Admin activity audit logging.
    """
    
    inlines = [UserProfileInline]
    
    list_display = [
        'email', 'role', 'is_approved', 'is_active', 
        'date_joined', 'last_login', 'google_id_display'
    ]
    list_filter = ['role', 'is_approved', 'is_active', 'date_joined']
    search_fields = ['email', 'google_id', 'profile__first_name', 'profile__last_name']
    ordering = ['-date_joined']
    
    fieldsets = (
        (None, {
            'fields': ('email', 'password')
        }),
        ('Google OAuth', {
            'fields': ('google_id',),
            'classes': ('collapse',)
        }),
        ('Permissions', {
            'fields': ('role', 'is_approved', 'is_active', 'is_staff', 'is_superuser'),
        }),
        ('Important dates', {
            'fields': ('last_login', 'date_joined'),
            'classes': ('collapse',)
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'is_approved'),
        }),
    )
    
    readonly_fields = ['date_joined', 'last_login', 'google_id']
    
    def google_id_display(self, obj):
        """Display Google ID with formatting."""
        if obj.google_id:
            return format_html('<code>{}</code>', obj.google_id[:20] + '...' if len(obj.google_id) > 20 else obj.google_id)
        return '-'
    google_id_display.short_description = 'Google ID'
    
    def save_model(self, request, obj, form, change):
        """Override save to log admin activities."""
        action = 'Updated' if change else 'Created'
        old_values = {}
        
        if change:
            # Get old values for comparison
            old_obj = CustomUser.objects.get(pk=obj.pk)
            old_values = {
                'role': old_obj.role,
                'is_approved': old_obj.is_approved,
                'is_active': old_obj.is_active,
            }
        
        super().save_model(request, obj, form, change)
        
        # Log the admin activity (Requirement 7.5)
        logger.info(
            f"Admin activity: {action} user {obj.email} "
            f"(role: {obj.role}, approved: {obj.is_approved}) "
            f"by {request.user.email}"
        )
        
        # Log specific changes
        if change:
            changes = []
            if old_values.get('role') != obj.role:
                changes.append(f"role: {old_values.get('role')} -> {obj.role}")
            if old_values.get('is_approved') != obj.is_approved:
                changes.append(f"approved: {old_values.get('is_approved')} -> {obj.is_approved}")
            if old_values.get('is_active') != obj.is_active:
                changes.append(f"active: {old_values.get('is_active')} -> {obj.is_active}")
            
            if changes:
                logger.info(f"User {obj.email} changes: {', '.join(changes)} by {request.user.email}")
    
    def delete_model(self, request, obj):
        """Override delete to log admin activities."""
        logger.info(
            f"Admin activity: Deleted user {obj.email} "
            f"(role: {obj.role}) by {request.user.email}"
        )
        
        super().delete_model(request, obj)
    
    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related('profile')


@admin.register(UserProfile, site=admin_site)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin for user profiles."""
    
    list_display = ['user', 'first_name', 'last_name', 'phone', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__email', 'first_name', 'last_name', 'phone']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        (None, {
            'fields': ('user', 'first_name', 'last_name', 'phone', 'avatar_url')
        }),
        ('Preferences', {
            'fields': ('notification_preferences',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """Override save to log admin activities."""
        action = 'Updated' if change else 'Created'
        
        logger.info(
            f"Admin activity: {action} profile for {obj.user.email} "
            f"by {request.user.email}"
        )
        
        super().save_model(request, obj, form, change)


# Replace default admin site with restricted one
admin.site = admin_site
