"""
Management command to set phone numbers for users.
"""

from django.core.management.base import BaseCommand
from authentication.models import CustomUser, UserProfile


class Command(BaseCommand):
    help = 'Set phone numbers for users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email of the user to update'
        )
        parser.add_argument(
            '--phone',
            type=str,
            help='Phone number to set'
        )
        parser.add_argument(
            '--approve',
            action='store_true',
            help='Mark user as approved'
        )
        parser.add_argument(
            '--activate',
            action='store_true',
            help='Mark user as active'
        )
        parser.add_argument(
            '--list-missing',
            action='store_true',
            help='List all users with missing phone numbers'
        )

    def handle(self, *args, **options):
        if options['list_missing']:
            self.list_missing_phones()
        elif options['email'] and options['phone']:
            self.set_phone(options['email'], options['phone'])
            if options['approve'] or options['activate']:
                self.update_user_status(options['email'], options['approve'], options['activate'])
        else:
            self.interactive_mode()

    def list_missing_phones(self):
        """List all users with missing phone numbers."""
        users_without_phone = CustomUser.objects.filter(
            profile__phone__isnull=True
        ) | CustomUser.objects.filter(
            profile__phone__exact=''
        )
        
        if not users_without_phone.exists():
            self.stdout.write(self.style.SUCCESS('All users have phone numbers!'))
            return
        
        self.stdout.write(self.style.WARNING(f'\nUsers without phone numbers ({users_without_phone.count()}):'))
        self.stdout.write('-' * 60)
        
        for user in users_without_phone:
            self.stdout.write(f'  Email: {user.email}')
            self.stdout.write(f'  Role: {user.role}')
            self.stdout.write(f'  Approved: {user.is_approved}')
            self.stdout.write('-' * 60)

    def set_phone(self, email, phone):
        """Set phone number for a specific user."""
        try:
            user = CustomUser.objects.get(email=email)
            profile, created = UserProfile.objects.get_or_create(user=user)
            profile.phone = phone
            profile.save()
            
            self.stdout.write(
                self.style.SUCCESS(f'✓ Phone number set for {email}: {phone}')
            )
        except CustomUser.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'✗ User with email {email} not found')
            )

    def update_user_status(self, email, approve=False, activate=False):
        """Update user approval and active status."""
        try:
            user = CustomUser.objects.get(email=email)
            
            if approve:
                user.is_approved = True
                self.stdout.write(self.style.SUCCESS(f'✓ Marked {email} as approved'))
            
            if activate:
                user.is_active = True
                self.stdout.write(self.style.SUCCESS(f'✓ Marked {email} as active'))
            
            if approve or activate:
                user.save()
        except CustomUser.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'✗ User with email {email} not found')
            )

    def interactive_mode(self):
        """Interactive mode to set phone numbers."""
        self.stdout.write(self.style.SUCCESS('\n=== User Phone Number Setup ===\n'))
        
        # First, show users without phones
        users_without_phone = CustomUser.objects.filter(
            profile__phone__isnull=True
        ) | CustomUser.objects.filter(
            profile__phone__exact=''
        )
        
        if not users_without_phone.exists():
            self.stdout.write(self.style.SUCCESS('All users already have phone numbers!'))
            return
        
        self.stdout.write(f'Found {users_without_phone.count()} users without phone numbers:\n')
        
        for idx, user in enumerate(users_without_phone, 1):
            self.stdout.write(f'{idx}. {user.email} ({user.role})')
        
        self.stdout.write('\nEnter phone numbers for each user:')
        self.stdout.write('(Press Enter to skip a user)\n')
        
        for user in users_without_phone:
            phone = input(f'Phone for {user.email}: ').strip()
            
            if phone:
                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.phone = phone
                profile.save()
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Set phone for {user.email}')
                )
            else:
                self.stdout.write(f'⊘ Skipped {user.email}')
        
        self.stdout.write(self.style.SUCCESS('\n✓ Done!'))
