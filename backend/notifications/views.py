"""
API views for notification system.

Implements Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7 for notification management.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth import get_user_model

from .models import Notification
from .serializers import (
    NotificationSerializer, NotificationCreateSerializer, NotificationPreferencesSerializer,
    BulkNotificationSerializer, NotificationSummarySerializer
)
from authentication.permissions import OwnerOnlyPermission, OperationsPermission

User = get_user_model()


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for notification management.
    
    Implements Requirements 12.4, 12.5 for notification display and delivery.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['notification_type', 'is_read']
    search_fields = ['title', 'message']
    ordering_fields = ['created_at', 'is_read']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Return notifications for the current user."""
        return Notification.objects.select_related('recipient').filter(recipient=self.request.user)
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer
    
    def perform_create(self, serializer):
        """Create notifications for multiple recipients."""
        recipients = serializer.validated_data.pop('recipients')
        notification_data = serializer.validated_data

        # Create notification for each recipient
        notifications = []
        for recipient_id in recipients:
            try:
                recipient = User.objects.get(id=recipient_id)
                notification = Notification.objects.create(
                    recipient=recipient,
                    **notification_data
                )
                notifications.append(notification)
            except User.DoesNotExist:
                # Skip recipients that don't exist
                continue

        return notifications
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get unread notifications for current user."""
        unread_notifications = self.get_queryset().filter(is_read=False)
        serializer = self.get_serializer(unread_notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get notification summary for current user."""
        queryset = self.get_queryset()
        
        total_notifications = queryset.count()
        unread_count = queryset.filter(is_read=False).count()
        recent_notifications = queryset[:5]
        
        # Count by notification type
        notification_types = dict(
            queryset.values('notification_type')
            .annotate(count=Count('id'))
            .values_list('notification_type', 'count')
        )
        
        summary_data = {
            'total_notifications': total_notifications,
            'unread_count': unread_count,
            'recent_notifications': recent_notifications,
            'notification_types': notification_types
        }
        
        serializer = NotificationSummarySerializer(summary_data)
        return Response(serializer.data)


class MarkNotificationReadView(APIView):
    """
    API view for marking individual notifications as read.
    
    Implements Requirements 12.4 for notification management.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        """Mark notification as read."""
        notification = get_object_or_404(
            Notification,
            pk=pk,
            recipient=request.user
        )
        
        if not notification.is_read:
            notification.is_read = True
            notification.save()
        
        serializer = NotificationSerializer(notification)
        return Response({
            'message': 'Notification marked as read',
            'notification': serializer.data
        })


class MarkAllNotificationsReadView(APIView):
    """
    API view for marking all notifications as read.
    
    Implements Requirements 12.4 for notification management.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Mark all notifications as read for current user."""
        unread_notifications = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        )
        
        count = unread_notifications.update(is_read=True)
        
        return Response({
            'message': f'{count} notifications marked as read'
        })


class UnreadNotificationCountView(APIView):
    """
    API view for getting unread notification count.
    
    Implements Requirements 12.4 for notification display.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get unread notification count for current user."""
        unread_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()
        
        return Response({
            'unread_count': unread_count
        })


class NotificationPreferencesView(APIView):
    """
    API view for getting notification preferences.
    
    Implements Requirements 12.6 for notification preference management.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get notification preferences for current user."""
        user = request.user
        
        # Get preferences from user profile
        if hasattr(user, 'profile') and user.profile.notification_preferences:
            preferences = user.profile.notification_preferences
        else:
            # Default preferences
            preferences = {
                'email_notifications': True,
                'low_stock_alerts': True,
                'order_updates': True,
                'return_updates': True,
                'user_approval_requests': user.role == 'OWNER',
                'system_alerts': True
            }
        
        serializer = NotificationPreferencesSerializer(preferences)
        return Response(serializer.data)


class UpdateNotificationPreferencesView(APIView):
    """
    API view for updating notification preferences.
    
    Implements Requirements 12.6 for notification preference management.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Update notification preferences for current user."""
        serializer = NotificationPreferencesSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            user = request.user
            
            # Update user profile with new preferences
            if hasattr(user, 'profile'):
                user.profile.notification_preferences = serializer.validated_data
                user.profile.save()
            
            return Response({
                'message': 'Notification preferences updated successfully',
                'preferences': serializer.validated_data
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LowStockNotificationView(APIView):
    """
    API view for sending low stock notifications.
    
    Implements Requirements 12.1 for low inventory alerts.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request):
        """Send low stock notifications to operations users."""
        from inventory.models import InventoryItem
        from django.db.models import F
        
        # Get low stock items
        low_stock_items = InventoryItem.objects.filter(
            is_active=True,
            stock_quantity__lte=F('min_stock_level')
        )
        
        if not low_stock_items.exists():
            return Response({
                'message': 'No low stock items found'
            })
        
        # Get operations users
        operations_users = User.objects.filter(
            role__in=['OWNER', 'OPERATIONS'],
            is_approved=True,
            is_active=True
        )
        
        # Create notifications
        notifications_created = 0
        for user in operations_users:
            # Check user preferences
            if (hasattr(user, 'profile') and 
                user.profile.notification_preferences and 
                not user.profile.notification_preferences.get('low_stock_alerts', True)):
                continue
            
            notification = Notification.objects.create(  # noqa: F841
                recipient=user,
                notification_type='LOW_STOCK',
                title='Low Stock Alert',
                message=f'{low_stock_items.count()} items are running low on stock',
                data={
                    'low_stock_count': low_stock_items.count(),
                    'items': [
                        {
                            'id': item.id,
                            'name': item.name,
                            'barcode': item.barcode,
                            'current_stock': item.stock_quantity,
                            'min_stock': item.min_stock_level
                        }
                        for item in low_stock_items[:10]  # Limit to first 10 items
                    ]
                }
            )
            notifications_created += 1
        
        return Response({
            'message': f'Low stock notifications sent to {notifications_created} users',
            'low_stock_items': low_stock_items.count()
        })


class PendingApprovalsNotificationView(APIView):
    """
    API view for sending pending approval notifications.
    
    Implements Requirements 12.3 for user approval notifications.
    """
    permission_classes = [permissions.IsAuthenticated, OwnerOnlyPermission]
    
    def post(self, request):
        """Send pending approval notifications to OWNER users."""
        # Get pending users
        pending_users = User.objects.filter(
            is_approved=False,
            is_active=True
        )
        
        if not pending_users.exists():
            return Response({
                'message': 'No pending user approvals found'
            })
        
        # Get OWNER users
        owner_users = User.objects.filter(
            role='OWNER',
            is_approved=True,
            is_active=True
        )
        
        # Create notifications
        notifications_created = 0
        for user in owner_users:
            # Check user preferences
            if (hasattr(user, 'profile') and 
                user.profile.notification_preferences and 
                not user.profile.notification_preferences.get('user_approval_requests', True)):
                continue
            
            notification = Notification.objects.create(  # noqa: F841
                recipient=user,
                notification_type='USER_APPROVAL',
                title='Pending User Approvals',
                message=f'{pending_users.count()} users are waiting for approval',
                data={
                    'pending_count': pending_users.count(),
                    'users': [
                        {
                            'id': u.id,
                            'email': u.email,
                            'role': u.role,
                            'date_joined': u.date_joined.isoformat()
                        }
                        for u in pending_users[:10]  # Limit to first 10 users
                    ]
                }
            )
            notifications_created += 1
        
        return Response({
            'message': f'Pending approval notifications sent to {notifications_created} users',
            'pending_users': pending_users.count()
        })


class SendBulkNotificationView(APIView):
    """
    API view for sending bulk notifications.
    
    Implements Requirements 12.1 for bulk notification sending.
    """
    permission_classes = [permissions.IsAuthenticated, OwnerOnlyPermission]
    
    def post(self, request):
        """Send bulk notifications to specified users or roles."""
        serializer = BulkNotificationSerializer(data=request.data)
        
        if serializer.is_valid():
            recipient_roles = serializer.validated_data.get('recipient_roles', [])
            recipient_ids = serializer.validated_data.get('recipient_ids', [])
            notification_type = serializer.validated_data['notification_type']
            title = serializer.validated_data['title']
            message = serializer.validated_data['message']
            data = serializer.validated_data.get('data', {})
            send_email = serializer.validated_data.get('send_email', False)
            
            # Build recipient queryset
            recipients = User.objects.filter(is_approved=True, is_active=True)
            
            if recipient_roles:
                recipients = recipients.filter(role__in=recipient_roles)
            elif recipient_ids:
                recipients = recipients.filter(id__in=recipient_ids)
            
            # Create notifications
            notifications_created = 0
            for recipient in recipients:
                notification = Notification.objects.create(
                    recipient=recipient,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    data=data
                )
                
                # Send email if requested
                if send_email:
                    try:
                        notification.send_email()
                    except Exception:
                        # Log error but don't fail the request
                        pass
                
                notifications_created += 1
            
            return Response({
                'message': f'Bulk notifications sent to {notifications_created} users',
                'recipients': notifications_created,
                'email_sent': send_email
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
