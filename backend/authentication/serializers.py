"""
Serializers for authentication and user management.

Implements Requirements 1.2, 8.2, 8.3 for user registration, profile management,
and data validation.
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import CustomUser, UserProfile


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    
    Implements Requirement 1.2: User registration with default unapproved status.
    """
    password = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Password for non-OAuth registration"
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Password confirmation"
    )
    
    class Meta:
        model = CustomUser
        fields = [
            'email', 'google_id', 'role', 'password', 'confirm_password'
        ]
        extra_kwargs = {
            'google_id': {'required': False},
            'role': {'required': False}
        }
    
    def validate_email(self, value):
        """Validate email uniqueness."""
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists.")
        return value
    
    def validate_role(self, value):
        """Validate role is in allowed choices."""
        if value and value not in dict(CustomUser.ROLE_CHOICES):
            raise serializers.ValidationError(f"Invalid role: {value}")
        return value
    
    def validate(self, attrs):
        """Validate password confirmation if password is provided."""
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')
        
        if password:
            if not confirm_password:
                raise serializers.ValidationError({
                    'confirm_password': 'Password confirmation is required.'
                })
            
            if password != confirm_password:
                raise serializers.ValidationError({
                    'confirm_password': 'Passwords do not match.'
                })
            
            # Validate password strength
            try:
                validate_password(password)
            except ValidationError as e:
                raise serializers.ValidationError({
                    'password': list(e.messages)
                })
        
        return attrs
    
    def create(self, validated_data):
        """Create user with default unapproved status."""
        # Remove password confirmation from validated data
        validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)
        
        # Set default values
        validated_data.setdefault('is_approved', False)  # Requirement 1.2
        validated_data.setdefault('role', 'CUSTOMER')
        
        # Create user
        user = CustomUser.objects.create(**validated_data)
        
        if password:
            user.set_password(password)
            user.save()
        
        # Create empty profile
        UserProfile.objects.create(user=user)
        
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile information.
    
    Implements Requirements 8.2, 8.3: User profile data completeness.
    """
    
    class Meta:
        model = UserProfile
        fields = [
            'first_name', 'last_name', 'phone', 'avatar_url',
            'notification_preferences', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def validate_phone(self, value):
        """Validate phone number format."""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '').isdigit():
            raise serializers.ValidationError("Invalid phone number format.")
        return value
    
    def validate_notification_preferences(self, value):
        """Validate notification preferences structure."""
        if value and not isinstance(value, dict):
            raise serializers.ValidationError("Notification preferences must be a JSON object.")
        return value


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for user information with profile data.
    """
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'google_id', 'role', 'is_approved', 'is_active',
            'date_joined', 'last_login', 'profile', 'full_name'
        ]
        read_only_fields = [
            'id', 'email', 'google_id', 'date_joined', 'last_login'
        ]
    
    def get_full_name(self, obj):
        """Get user's full name from profile."""
        return obj.get_full_name()


class UserApprovalSerializer(serializers.Serializer):
    """
    Serializer for user approval operations.
    
    Implements Requirement 1.4: Owner exclusive approval authority.
    """
    role = serializers.ChoiceField(
        choices=CustomUser.ROLE_CHOICES,
        required=True,
        help_text="Role to assign to the approved user"
    )
    
    def validate_role(self, value):
        """Validate role is in allowed choices."""
        if value not in dict(CustomUser.ROLE_CHOICES):
            raise serializers.ValidationError(f"Invalid role: {value}")
        return value


class TokenSerializer(serializers.Serializer):
    """
    Serializer for JWT token operations.
    """
    access_token = serializers.CharField(read_only=True)
    refresh_token = serializers.CharField(read_only=True)
    token_type = serializers.CharField(default='Bearer', read_only=True)
    expires_in = serializers.IntegerField(default=3600, read_only=True)  # 1 hour


class GoogleOAuthSerializer(serializers.Serializer):
    """
    Serializer for Google OAuth callback data.
    """
    id_token = serializers.CharField(
        required=True,
        help_text="Google ID token from OAuth callback"
    )
    
    def validate_id_token(self, value):
        """Basic validation for ID token format."""
        if not value or len(value) < 100:  # Basic length check
            raise serializers.ValidationError("Invalid ID token format.")
        return value


class RefreshTokenSerializer(serializers.Serializer):
    """
    Serializer for token refresh operations.
    """
    refresh_token = serializers.CharField(
        required=True,
        help_text="JWT refresh token"
    )


class TokenVerificationSerializer(serializers.Serializer):
    """
    Serializer for token verification operations.
    """
    token = serializers.CharField(
        required=True,
        help_text="JWT token to verify"
    )


class PendingUserSerializer(serializers.ModelSerializer):
    """
    Serializer for pending user approval list.
    """
    profile = UserProfileSerializer(read_only=True)
    days_pending = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'google_id', 'role', 'date_joined',
            'profile', 'days_pending'
        ]
        read_only_fields = ['id', 'email', 'google_id', 'date_joined']
    
    def get_days_pending(self, obj):
        """Calculate days since registration."""
        from django.utils import timezone
        delta = timezone.now() - obj.date_joined
        return delta.days