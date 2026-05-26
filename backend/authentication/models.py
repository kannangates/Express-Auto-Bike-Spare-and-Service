from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.core.validators import EmailValidator
from .managers import CustomUserManager
from django.db.models.signals import post_save
from django.dispatch import receiver


class CustomUser(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with Google OAuth integration and role-based access control.
    
    Supports five user roles: OWNER, OPERATIONS, CASHIER, DELIVERY, CUSTOMER
    Implements Requirements 1.2, 1.4, 1.5 for user authentication and authorization.
    """
    
    ROLE_CHOICES = [
        ('OWNER', 'Owner'),
        ('OPERATIONS', 'Operations'),
        ('CASHIER', 'Cashier'),
        ('DELIVERY', 'Delivery'),
        ('CUSTOMER', 'Customer'),
    ]
    
    email = models.EmailField(
        unique=True,
        validators=[EmailValidator()],
        help_text='Required. Enter a valid email address.'
    )
    google_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        help_text='Google OAuth ID for single sign-on authentication'
    )
    is_approved = models.BooleanField(
        default=False,
        help_text='Designates whether this user has been approved by an OWNER. '
                  'Unapproved users cannot access the system.'
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='CUSTOMER',
        help_text='User role determining system access permissions'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Designates whether this user should be treated as active. '
                  'Unselect this instead of deleting accounts.'
    )
    is_staff = models.BooleanField(
        default=False,
        help_text='Designates whether the user can log into the admin site.'
    )
    date_joined = models.DateTimeField(
        default=timezone.now,
        help_text='Date and time when the user account was created'
    )
    last_login = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date and time of the user\'s last login'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = CustomUserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'auth_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['google_id']),
            models.Index(fields=['role']),
            models.Index(fields=['is_approved']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        """Return the user's full name from their profile."""
        if hasattr(self, 'profile'):
            return f"{self.profile.first_name} {self.profile.last_name}".strip()
        return self.email
    
    def get_short_name(self):
        """Return the user's first name or email."""
        if hasattr(self, 'profile') and self.profile.first_name:
            return self.profile.first_name
        return self.email.split('@')[0]
    
    def is_owner(self):
        """Check if user has OWNER role."""
        return self.role == 'OWNER'
    
    def is_operations(self):
        """Check if user has OPERATIONS role."""
        return self.role == 'OPERATIONS'
    
    def is_cashier(self):
        """Check if user has CASHIER role."""
        return self.role == 'CASHIER'
    
    def is_delivery(self):
        """Check if user has DELIVERY role."""
        return self.role == 'DELIVERY'
    
    def is_customer(self):
        """Check if user has CUSTOMER role."""
        return self.role == 'CUSTOMER'
    
    def has_role_permission(self, required_roles):
        """
        Check if user's role is in the list of required roles.
        
        Args:
            required_roles (list): List of role strings that are allowed
            
        Returns:
            bool: True if user's role is in required_roles
        """
        return self.role in required_roles
    
    def can_access_admin(self):
        """Check if user can access Django admin interface (OWNER only)."""
        return self.is_owner() and self.is_approved
    
    def can_approve_users(self):
        """Check if user can approve other users (OWNER only)."""
        return self.is_owner() and self.is_approved
    
    def save(self, *args, **kwargs):
        """Override save to set is_staff for OWNER role."""
        # Track approval status changes for notifications
        
        if self.role == 'OWNER':
            self.is_staff = True
        else:
            self.is_staff = False
        
        is_new = not self.pk
        super().save(*args, **kwargs)
        
        # Trigger user approval request notification for new unapproved users
        if is_new and not self.is_approved:
            self._trigger_approval_request_notification()
    
    def _trigger_approval_request_notification(self):
        """Trigger user approval request notification."""
        try:
            from notifications.models import Notification
            Notification.create_user_approval_notification(self)
        except Exception as e:
            # Log error but don't fail the save
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create user approval notification for {self.email}: {str(e)}")


# Signal handlers for user notifications
@receiver(post_save, sender=CustomUser)
def handle_user_approval_notifications(sender, instance, created, **kwargs):
    """Handle user approval-related notifications."""
    if not created and instance.is_approved:
        # Check if this is a newly approved user
        try:
            # This will be handled in the views when approval happens
            # to ensure we have the approver information
            pass
        except Exception:
            pass


class UserProfile(models.Model):
    """
    Extended user profile information and notification preferences.
    
    Implements Requirements 8.2, 8.3 for user profile data completeness.
    """
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    first_name = models.CharField(
        max_length=100,
        blank=True,
        help_text='User\'s first name'
    )
    last_name = models.CharField(
        max_length=100,
        blank=True,
        help_text='User\'s last name'
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        help_text='User\'s phone number'
    )
    avatar_url = models.URLField(
        blank=True,
        help_text='URL to user\'s profile picture'
    )
    notification_preferences = models.JSONField(
        default=dict,
        help_text='User notification preferences in JSON format'
    )
    # Google OAuth metadata — stored on first login and refreshed on every subsequent login
    google_locale = models.CharField(
        max_length=10,
        blank=True,
        help_text='Language/locale returned by Google (e.g. "en")'
    )
    google_hd = models.CharField(
        max_length=255,
        blank=True,
        help_text='Google Workspace hosted domain (e.g. "company.com"), empty for personal accounts'
    )
    google_verified_email = models.BooleanField(
        null=True,
        blank=True,
        help_text='Whether Google has verified this email address'
    )
    google_raw_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Full Google ID token payload stored for future use'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_profile'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['phone']),
        ]
    
    def __str__(self):
        return f"{self.user.email} Profile"
    
    def get_full_name(self):
        """Return the full name."""
        return f"{self.first_name} {self.last_name}".strip()
    
    def get_display_name(self):
        """Return display name (full name or email)."""
        full_name = self.get_full_name()
        return full_name if full_name else self.user.email
