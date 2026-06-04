"""
Dashboard URL configuration.

Implements Requirements 9.6: Dashboard analytics with key performance indicators.
"""

from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    path('stats/', views.DashboardStatsView.as_view(), name='dashboard_stats'),
    path('activity/', views.DashboardRecentActivityView.as_view(), name='dashboard_activity'),
    path('settings/', views.BusinessSettingsView.as_view(), name='business_settings'),
    path('tunnel-url/', views.TunnelUrlView.as_view(), name='tunnel_url'),
]