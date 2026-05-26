#!/usr/bin/env python
"""
Script to set phone numbers for superusers.
Run this from the backend directory: python set_superuser_phones.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'express_auto_bike.settings')
django.setup()

from authentication.models import CustomUser, UserProfile

# Phone numbers mapping
PHONE_NUMBERS = {
    'expressspares78@gmail.com': '9840014848',
    'kannangates@gmail.com': '9940117071',
}

def set_phones():
    """Set phone numbers for superusers and ensure they're approved and active."""
    print('\n=== Setting Superuser Phone Numbers & Status ===\n')
    
    for email, phone in PHONE_NUMBERS.items():
        try:
            user = CustomUser.objects.get(email=email)
            
            # Update user status
            user.is_approved = True
            user.is_active = True
            user.save(update_fields=['is_approved', 'is_active'])
            
            # Set phone number
            profile, created = UserProfile.objects.get_or_create(user=user)
            profile.phone = phone
            profile.save()
            
            status = 'Created' if created else 'Updated'
            print(f'✓ {status} phone for {email}: {phone}')
            print(f'  - is_approved: True')
            print(f'  - is_active: True')
        except CustomUser.DoesNotExist:
            print(f'✗ User not found: {email}')
        except Exception as e:
            print(f'✗ Error setting phone for {email}: {str(e)}')
    
    print('\n✓ Done!\n')

if __name__ == '__main__':
    set_phones()
