from django.contrib.auth.models import BaseUserManager
from django.core.exceptions import ValidationError
from django.core.validators import validate_email


class CustomUserManager(BaseUserManager):
    """
    Custom user manager for CustomUser model.
    
    Handles user creation with email as the unique identifier
    and implements role-based user creation methods.
    """
    
    def _create_user(self, email, password=None, **extra_fields):
        """
        Create and save a user with the given email and password.
        """
        if not email:
            raise ValueError('The Email field must be set')
        
        try:
            validate_email(email)
        except ValidationError:
            raise ValueError('Invalid email address')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        
        user.save(using=self._db)
        return user
    
    def create_user(self, email, password=None, **extra_fields):
        """
        Create and save a regular user.
        """
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_approved', False)  # Default to not approved
        extra_fields.setdefault('role', 'CUSTOMER')  # Default role
        
        return self._create_user(email, password, **extra_fields)
    
    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and save a superuser (OWNER role).
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_approved', True)  # Superusers are auto-approved
        extra_fields.setdefault('role', 'OWNER')  # Superusers are OWNER role
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        if extra_fields.get('role') != 'OWNER':
            raise ValueError('Superuser must have role=OWNER.')
        
        return self._create_user(email, password, **extra_fields)
    
    def create_google_user(self, email, google_id, **extra_fields):
        """
        Create a user from Google OAuth authentication.
        """
        extra_fields.setdefault('is_approved', False)  # Require approval
        extra_fields.setdefault('role', 'CUSTOMER')  # Default role
        
        user = self._create_user(email, password=None, google_id=google_id, **extra_fields)
        return user
    
    def get_approved_users(self):
        """
        Return queryset of approved users only.
        """
        return self.filter(is_approved=True, is_active=True)
    
    def get_users_by_role(self, role):
        """
        Return queryset of users with specific role.
        """
        return self.filter(role=role, is_active=True)
    
    def get_pending_approval(self):
        """
        Return queryset of users pending approval.
        """
        return self.filter(is_approved=False, is_active=True)