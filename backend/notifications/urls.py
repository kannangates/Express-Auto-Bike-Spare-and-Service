"""
URL configuration for notification system API endpoints.

Implements Requirements 11.1, 11.2, 11.5 for RESTful API design
and Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7 for notification management.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'notifications', views.NotificationViewSet, basename='notification')

# URL patterns
urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),
    
    # Notification management endpoints
    path('notifications/<int:pk>/mark-read/', views.MarkNotificationReadView.as_view(), name='notification-mark-read'),
    path('notifications/mark-all-read/', views.MarkAllNotificationsReadView.as_view(), name='notifications-mark-all-read'),
    path('notifications/unread-count/', views.UnreadNotificationCountView.as_view(), name='notification-unread-count'),
    
    # Notification preferences
    path('preferences/', views.NotificationPreferencesView.as_view(), name='notification-preferences'),
    path('preferences/update/', views.UpdateNotificationPreferencesView.as_view(), name='update-notification-preferences'),
    
    # System notifications (admin only)
    path('system/low-stock/', views.LowStockNotificationView.as_view(), name='system-low-stock'),
    path('system/pending-approvals/', views.PendingApprovalsNotificationView.as_view(), name='system-pending-approvals'),
    path('system/send-bulk/', views.SendBulkNotificationView.as_view(), name='system-send-bulk'),
]