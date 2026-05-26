from celery import shared_task
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email(self, notification_id: int):
    """
    Send email notification to user with enhanced templates and retry logic.
    
    Args:
        notification_id: ID of the notification to send
    """
    try:
        from .models import Notification
        
        notification = Notification.objects.get(id=notification_id)

        if notification.is_email_sent:
            logger.info(f"Email already sent for notification {notification_id}, skipping")
            return {'status': 'skipped', 'reason': 'already_sent'}

        if not notification.should_send_email():
            logger.info(f"Skipping email for notification {notification_id} - conditions not met")
            return {'status': 'skipped', 'reason': 'conditions_not_met'}
        
        # Prepare email content
        subject = notification.title
        
        # Choose appropriate template based on notification type
        template_map = {
            'USER_APPROVAL': 'notifications/user_approval_request.html',
            'USER_APPROVED': 'notifications/user_approved.html',
            'USER_REJECTED': 'notifications/user_rejected.html',
            'LOW_STOCK': 'notifications/low_stock_alert.html',
            'ORDER_STATUS': 'notifications/order_status_update.html',
            'RETURN_PROCESSED': 'notifications/return_processed.html',
            'SYSTEM_ALERT': 'notifications/system_alert.html',
        }
        
        template_name = template_map.get(
            notification.notification_type, 
            'notifications/email_notification.html'
        )
        
        # Create enhanced context for email templates
        context = {
            'notification': notification,
            'recipient': notification.recipient,
            'base_url': getattr(settings, 'FRONTEND_URL', 'http://localhost:3000'),
            'company_name': 'Express Auto Bike',
            'support_email': settings.DEFAULT_FROM_EMAIL,
            'current_year': timezone.now().year,
            'notification_data': notification.data,
        }
        
        # Create HTML email content
        html_message = render_to_string(template_name, context)
        
        # Create plain text version
        plain_message = strip_tags(html_message)
        
        # Use EmailMultiAlternatives for better email handling
        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[notification.recipient.email],
        )
        email.attach_alternative(html_message, "text/html")
        
        # Send email with timeout
        email.send(fail_silently=False)
        
        # Mark email as sent
        notification.mark_email_sent()
        
        logger.info(f"Email sent successfully for notification {notification_id} using template {template_name}")
        return {
            'status': 'sent',
            'notification_id': notification_id,
            'template': template_name,
            'recipient': notification.recipient.email
        }
        
    except Notification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found")
        return {'status': 'error', 'reason': 'notification_not_found'}
    except Exception as e:
        logger.error(f"Failed to send email for notification {notification_id}: {str(e)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            retry_delay = 60 * (2 ** self.request.retries)  # Exponential backoff
            logger.info(f"Retrying email send for notification {notification_id} in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=e)
        
        return {'status': 'failed', 'error': str(e), 'retries': self.request.retries}


@shared_task
def send_bulk_notifications(notification_ids: List[int]):
    """
    Send multiple email notifications efficiently.
    
    Args:
        notification_ids: List of notification IDs to send
    """
    results = []
    for notification_id in notification_ids:
        result = send_notification_email.delay(notification_id)
        results.append({
            'notification_id': notification_id,
            'task_id': result.id
        })
    
    logger.info(f"Queued {len(results)} email notifications for sending")
    return {
        'queued_count': len(results),
        'tasks': results
    }


@shared_task
def send_low_stock_alerts():
    """
    Check for low stock items and send alerts to operations users.
    
    This task should be run periodically (e.g., daily) to check inventory levels.
    """
    try:
        from inventory.models import InventoryItem
        from authentication.models import CustomUser
        from django.db.models import F
        
        # Get low stock items
        low_stock_items = InventoryItem.objects.filter(
            is_active=True,
            stock_quantity__lte=F('min_stock_level')
        ).select_related('category')
        
        if not low_stock_items.exists():
            logger.info("No low stock items found")
            return {'status': 'no_items', 'count': 0}
        
        # Get operations users who want low stock alerts
        operations_users = CustomUser.objects.filter(
            role__in=['OWNER', 'OPERATIONS'],
            is_approved=True,
            is_active=True
        )
        
        notifications_created = 0
        for user in operations_users:
            # Check user preferences
            if (hasattr(user, 'profile') and 
                user.profile.notification_preferences and 
                not user.profile.notification_preferences.get('lowStock', True)):
                continue
            
            from .models import Notification
            Notification.create_notification(
                recipient=user,
                notification_type='LOW_STOCK',
                title=f'Low Stock Alert - {low_stock_items.count()} Items',
                message=f'{low_stock_items.count()} items are running low on stock and need restocking.',
                data={
                    'low_stock_count': low_stock_items.count(),
                    'items': [
                        {
                            'id': item.id,
                            'name': item.name,
                            'barcode': item.barcode,
                            'current_stock': item.stock_quantity,
                            'min_stock': item.min_stock_level,
                            'category': item.category.name if item.category else 'Uncategorized'
                        }
                        for item in low_stock_items[:20]  # Limit to first 20 items
                    ]
                },
                priority='HIGH'
            )
            notifications_created += 1
        
        logger.info(f"Created {notifications_created} low stock notifications for {low_stock_items.count()} items")
        return {
            'status': 'success',
            'low_stock_items': low_stock_items.count(),
            'notifications_created': notifications_created
        }
        
    except Exception as e:
        logger.error(f"Failed to send low stock alerts: {str(e)}")
        return {'status': 'error', 'error': str(e)}


@shared_task
def cleanup_expired_notifications():
    """
    Clean up expired and old notifications.
    
    This task should be run periodically to maintain database performance.
    """
    try:
        from django.utils import timezone
        from .models import Notification
        
        # Delete notifications that expired more than 30 days ago
        cutoff_date = timezone.now() - timezone.timedelta(days=30)
        
        expired_count = Notification.objects.filter(
            expires_at__lt=cutoff_date
        ).delete()[0]
        
        # Also delete read notifications older than 90 days
        old_read_count = Notification.objects.filter(
            is_read=True,
            created_at__lt=timezone.now() - timezone.timedelta(days=90)
        ).delete()[0]
        
        logger.info(f"Cleaned up {expired_count} expired and {old_read_count} old read notifications")
        return {
            'status': 'success',
            'expired_deleted': expired_count,
            'old_read_deleted': old_read_count,
            'total_deleted': expired_count + old_read_count
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup notifications: {str(e)}")
        return {'status': 'error', 'error': str(e)}


@shared_task
def send_user_approval_notifications():
    """
    Send notifications to OWNER users about pending user approvals.
    
    This task should be run periodically to remind owners of pending approvals.
    """
    try:
        from authentication.models import CustomUser
        
        # Get pending users
        pending_users = CustomUser.objects.filter(
            is_approved=False,
            is_active=True
        )
        
        if not pending_users.exists():
            logger.info("No pending user approvals found")
            return {'status': 'no_pending', 'count': 0}
        
        # Get OWNER users who want approval notifications
        owner_users = CustomUser.objects.filter(
            role='OWNER',
            is_approved=True,
            is_active=True
        )
        
        notifications_created = 0
        for user in owner_users:
            # Check user preferences
            if (hasattr(user, 'profile') and 
                user.profile.notification_preferences and 
                not user.profile.notification_preferences.get('approvalRequests', True)):
                continue
            
            from .models import Notification
            notification = Notification.create_notification(  # noqa: F841
                recipient=user,
                notification_type='USER_APPROVAL',
                title=f'Pending User Approvals - {pending_users.count()} Users',
                message=f'{pending_users.count()} users are waiting for approval to access the system.',
                data={
                    'pending_count': pending_users.count(),
                    'users': [
                        {
                            'id': u.id,
                            'email': u.email,
                            'role': u.role,
                            'date_joined': u.date_joined.isoformat(),
                            'google_id': u.google_id
                        }
                        for u in pending_users[:10]  # Limit to first 10 users
                    ]
                },
                priority='HIGH'
            )
            notifications_created += 1
        
        logger.info(f"Created {notifications_created} user approval notifications for {pending_users.count()} pending users")
        return {
            'status': 'success',
            'pending_users': pending_users.count(),
            'notifications_created': notifications_created
        }
        
    except Exception as e:
        logger.error(f"Failed to send user approval notifications: {str(e)}")
        return {'status': 'error', 'error': str(e)}