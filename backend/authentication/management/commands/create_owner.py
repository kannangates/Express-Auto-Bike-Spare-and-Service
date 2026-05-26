"""
Management command to create an OWNER user for system administration.

This command creates a superuser with OWNER role and approved status,
allowing access to Django admin interface.
"""

from django.core.management.base import BaseCommand
from django.core.management import CommandError
from django.db import transaction
from authentication.models import CustomUser, UserProfile


class Command(BaseCommand):
    help = 'Create an OWNER user with admin privileges'
    
    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Gmail address for the owner')
        parser.add_argument('--first-name', type=str, default='', help='First name (optional)')
        parser.add_argument('--last-name', type=str, default='', help='Last name (optional)')

    def handle(self, *args, **options):
        email = options.get('email')

        if not email:
            # Interactive fallback
            self.stdout.write('Authentication is Google OAuth only — no password needed.')
            email = input('Owner Gmail address: ').strip()
            if not email:
                raise CommandError('Email is required')

        first_name = options.get('first_name') or ''
        last_name = options.get('last_name') or ''
        self.create_owner(email=email, first_name=first_name, last_name=last_name)

    @transaction.atomic
    def create_owner(self, email, first_name='', last_name=''):
        """
        Create (or promote) an OWNER record for a Google OAuth user.

        No password is set — the account is authenticated exclusively via
        Google OAuth. When the owner signs in with their Gmail, _process_id_token
        will match by email and link the google_id automatically.
        """
        try:
            user, created = CustomUser.objects.get_or_create(
                email=email,
                defaults={
                    'role': 'OWNER',
                    'is_approved': True,
                    'is_active': True,
                    'is_staff': True,
                    'is_superuser': True,
                }
            )

            if not created:
                # Promote existing account to OWNER
                user.role = 'OWNER'
                user.is_approved = True
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=['role', 'is_approved', 'is_staff', 'is_superuser'])

            # Unusable password — login is Google OAuth only
            user.set_unusable_password()
            user.save(update_fields=['password'])

            UserProfile.objects.get_or_create(
                user=user,
                defaults={'first_name': first_name, 'last_name': last_name}
            )

            status = 'Created' if created else 'Promoted existing account to'
            self.stdout.write(self.style.SUCCESS(
                f'{status} OWNER: {email}\n'
                f'Sign in at /login using this Gmail address via Google OAuth.'
            ))

        except Exception as e:
            raise CommandError(f'Error creating owner: {str(e)}')