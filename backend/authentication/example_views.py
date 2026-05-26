"""
Example API views demonstrating role-based access control.

These views show how to implement the role-based permission system
for different user roles and access levels.

Implements Requirements 1.4, 1.5, 1.6, 7.1, 7.3 for role-based permissions.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .permissions import (
    OwnerOnlyPermission,
    OperationsPermission,
    CashierPermission,
    DeliveryPermission,
    CustomerPermission
)
from .decorators import (
    require_owner,
    require_operations,
    require_cashier,
    require_delivery,
    require_approved_user,
    RoleBasedViewMixin
)
from .utils import RoleManager, get_user_menu_items, can_access_django_admin


# Example using permission classes with APIView
class OwnerOnlyView(APIView):
    """
    Example view accessible only to OWNER role.
    
    Implements Requirements 1.4, 7.1: Owner exclusive authority.
    """
    permission_classes = [OwnerOnlyPermission]
    
    def get(self, request):
        """Get owner-only data."""
        return Response({
            'message': 'This data is only accessible to OWNER role',
            'user_role': request.user.role,
            'admin_access': can_access_django_admin(request.user)
        })
    
    def post(self, request):
        """Create owner-only resource."""
        return Response({
            'message': 'Resource created by OWNER',
            'created_by': request.user.email
        }, status=status.HTTP_201_CREATED)


class OperationsView(APIView):
    """
    Example view accessible to OWNER and OPERATIONS roles.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    permission_classes = [OperationsPermission]
    
    def get(self, request):
        """Get operations data."""
        return Response({
            'message': 'Operations data accessible to OWNER and OPERATIONS',
            'user_role': request.user.role,
            'permissions': RoleManager.ROLE_PERMISSIONS.get(request.user.role, [])
        })


class CashierView(APIView):
    """
    Example view accessible to OWNER, OPERATIONS, and CASHIER roles.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    permission_classes = [CashierPermission]
    
    def get(self, request):
        """Get cashier data."""
        return Response({
            'message': 'Cashier data accessible to OWNER, OPERATIONS, and CASHIER',
            'user_role': request.user.role,
            'can_process_payments': RoleManager.has_permission(request.user.role, 'payment_processing')
        })


class DeliveryView(APIView):
    """
    Example view accessible to OWNER, OPERATIONS, and DELIVERY roles.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    permission_classes = [DeliveryPermission]
    
    def get(self, request):
        """Get delivery data."""
        return Response({
            'message': 'Delivery data accessible to OWNER, OPERATIONS, and DELIVERY',
            'user_role': request.user.role,
            'can_manage_deliveries': RoleManager.has_permission(request.user.role, 'delivery_management')
        })


class CustomerView(APIView):
    """
    Example view accessible to all approved users.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    permission_classes = [CustomerPermission]
    
    def get(self, request):
        """Get customer data."""
        return Response({
            'message': 'Customer data accessible to all approved users',
            'user_role': request.user.role,
            'menu_items': get_user_menu_items(request.user)
        })


# Example using RoleBasedViewMixin
class InventoryManagementView(RoleBasedViewMixin, APIView):
    """
    Example view using RoleBasedViewMixin for inventory management.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    required_roles = ['OWNER', 'OPERATIONS']
    
    def get(self, request):
        """Get inventory data."""
        return Response({
            'message': 'Inventory management accessible to OWNER and OPERATIONS',
            'user_role': request.user.role,
            'inventory_permissions': RoleManager.has_permission(request.user.role, 'inventory_management')
        })
    
    def post(self, request):
        """Create inventory item."""
        return Response({
            'message': 'Inventory item created',
            'created_by': request.user.email,
            'user_role': request.user.role
        }, status=status.HTTP_201_CREATED)


# Example using function-based views with decorators
@api_view(['GET'])
@require_owner
def owner_dashboard(request):
    """
    Owner dashboard accessible only to OWNER role.
    
    Implements Requirements 1.4, 7.1: Owner exclusive authority.
    """
    return Response({
        'message': 'Owner dashboard',
        'user_role': request.user.role,
        'admin_access': can_access_django_admin(request.user),
        'system_stats': {
            'total_users': 100,  # Example data
            'pending_approvals': 5,
            'system_health': 'good'
        }
    })


@api_view(['GET', 'POST'])
@require_operations
def operations_dashboard(request):
    """
    Operations dashboard accessible to OWNER and OPERATIONS roles.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    if request.method == 'GET':
        return Response({
            'message': 'Operations dashboard',
            'user_role': request.user.role,
            'operations_stats': {
                'inventory_items': 500,
                'low_stock_alerts': 12,
                'pending_orders': 25
            }
        })
    
    elif request.method == 'POST':
        return Response({
            'message': 'Operations action performed',
            'performed_by': request.user.email,
            'user_role': request.user.role
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@require_cashier
def cashier_dashboard(request):
    """
    Cashier dashboard accessible to OWNER, OPERATIONS, and CASHIER roles.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    return Response({
        'message': 'Cashier dashboard',
        'user_role': request.user.role,
        'cashier_stats': {
            'daily_sales': 1500.00,
            'transactions_today': 45,
            'returns_processed': 3
        }
    })


@api_view(['GET'])
@require_delivery
def delivery_dashboard(request):
    """
    Delivery dashboard accessible to OWNER, OPERATIONS, and DELIVERY roles.
    
    Implements Requirement 1.6: Role-based API access control.
    """
    return Response({
        'message': 'Delivery dashboard',
        'user_role': request.user.role,
        'delivery_stats': {
            'pending_deliveries': 15,
            'completed_today': 8,
            'delivery_routes': 3
        }
    })


@api_view(['GET'])
@require_approved_user
def user_profile_summary(request):
    """
    User profile summary accessible to all approved users.
    
    Implements Requirement 1.3: Access control for unapproved users.
    """
    return Response({
        'message': 'User profile summary',
        'user': {
            'email': request.user.email,
            'role': request.user.role,
            'is_approved': request.user.is_approved,
            'permissions': RoleManager.ROLE_PERMISSIONS.get(request.user.role, [])
        },
        'menu_items': get_user_menu_items(request.user)
    })


# Example Django view with decorator (non-DRF)
@require_http_methods(["GET"])
@require_owner
def django_admin_link(request):
    """
    Provide Django admin link for OWNER users only.
    
    Implements Requirements 7.1, 7.3: Django admin access restriction.
    """
    return JsonResponse({
        'admin_url': '/admin/',
        'message': 'Django admin access granted',
        'user_role': request.user.role,
        'admin_permissions': True
    })


# Example view showing role hierarchy
@api_view(['GET'])
@require_approved_user
def role_hierarchy_info(request):
    """
    Show role hierarchy and permissions for current user.
    
    Implements Requirement 1.5: Valid role assignment.
    """
    user_role = request.user.role
    
    return Response({
        'message': 'Role hierarchy information',
        'current_role': user_role,
        'role_level': RoleManager.get_role_level(user_role),
        'role_description': RoleManager.get_role_description(user_role),
        'permissions': RoleManager.ROLE_PERMISSIONS.get(user_role, []),
        'accessible_roles': RoleManager.get_accessible_roles(user_role),
        'role_hierarchy': RoleManager.ROLE_HIERARCHY
    })


# Example view for testing error responses
@api_view(['GET'])
@require_operations
def test_error_responses(request):
    """
    Test view for demonstrating error responses.
    
    Implements Requirements 1.7, 11.7: Unauthorized access error responses.
    """
    return Response({
        'message': 'This endpoint tests error responses for unauthorized access',
        'user_role': request.user.role,
        'access_granted': True,
        'test_info': {
            'unauthorized_users_get': '401 AUTH_REQUIRED',
            'unapproved_users_get': '403 ACCOUNT_NOT_APPROVED',
            'insufficient_role_gets': '403 INSUFFICIENT_PERMISSIONS'
        }
    })