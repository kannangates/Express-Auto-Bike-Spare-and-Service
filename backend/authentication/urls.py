"""
Authentication URLs for Google OAuth integration and user management.

Implements Requirements 1.1, 1.2 for Google OAuth and user registration workflow.
"""

from django.urls import path, include
from . import views, example_views, admin_views

app_name = 'authentication'

urlpatterns = [
    # Google OAuth endpoints
    path('google/login/', views.GoogleOAuthLoginView.as_view(), name='google_login'),
    path('google/callback/', views.GoogleOAuthCallbackView.as_view(), name='google_callback'),
    
    # User registration and approval workflow
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('profile/', views.UserProfileView.as_view(), name='profile'),
    path('pending/phone/', views.PendingUserPhoneView.as_view(), name='pending_phone'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # User approval management (OWNER only)
    path('users/', views.UserListView.as_view(), name='user_list'),
    path('users/pending/', views.PendingUsersView.as_view(), name='pending_users'),
    path('users/<int:user_id>/approve/', views.ApproveUserView.as_view(), name='approve_user'),
    path('users/<int:user_id>/reject/', views.RejectUserView.as_view(), name='reject_user'),
    
    # Admin interface for user management
    path('admin/users/approval/', admin_views.AdminUserApprovalView.as_view(), name='admin_user_approval'),
    path('admin/users/bulk-approval/', admin_views.AdminBulkApprovalView.as_view(), name='admin_bulk_approval'),
    path('admin/users/profiles/', admin_views.AdminUserProfileManagementView.as_view(), name='admin_user_profiles'),
    path('admin/users/profiles/<int:user_id>/', admin_views.AdminUserProfileManagementView.as_view(), name='admin_user_profile'),
    path('admin/users/<int:user_id>/sync-google/', admin_views.sync_google_profile_data, name='sync_google_profile'),
    path('admin/dashboard/stats/', admin_views.AdminDashboardStatsView.as_view(), name='admin_dashboard_stats'),
    
    # Token management
    path('token/refresh/', views.RefreshTokenView.as_view(), name='token_refresh'),
    path('token/verify/', views.VerifyTokenView.as_view(), name='token_verify'),
    
    # Example role-based endpoints for testing
    path('examples/owner/', example_views.OwnerOnlyView.as_view(), name='example_owner'),
    path('examples/operations/', example_views.OperationsView.as_view(), name='example_operations'),
    path('examples/cashier/', example_views.CashierView.as_view(), name='example_cashier'),
    path('examples/delivery/', example_views.DeliveryView.as_view(), name='example_delivery'),
    path('examples/customer/', example_views.CustomerView.as_view(), name='example_customer'),
    path('examples/inventory/', example_views.InventoryManagementView.as_view(), name='example_inventory'),
    path('examples/dashboard/owner/', example_views.owner_dashboard, name='dashboard_owner'),
    path('examples/dashboard/operations/', example_views.operations_dashboard, name='dashboard_operations'),
    path('examples/dashboard/cashier/', example_views.cashier_dashboard, name='dashboard_cashier'),
    path('examples/dashboard/delivery/', example_views.delivery_dashboard, name='dashboard_delivery'),
    path('examples/profile/', example_views.user_profile_summary, name='profile_summary'),
    path('examples/admin-link/', example_views.django_admin_link, name='admin_link'),
    path('examples/role-info/', example_views.role_hierarchy_info, name='role_info'),
    path('examples/test-errors/', example_views.test_error_responses, name='test_errors'),
    
    # Django allauth URLs for Google OAuth
    path('accounts/', include('allauth.urls')),
]