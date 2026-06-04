"""
Dashboard views for reporting and analytics.

Implements Requirements 9.6: Dashboard analytics with key performance indicators.
"""

from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Sum, Avg, Q, F, DecimalField
from django.db.models.functions import Coalesce
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from authentication.permissions import OperationsPermission
from authentication.models import CustomUser
from inventory.models import InventoryItem, StockTransaction
from orders.models import CustomerOrder, OrderItem
from returns.models import CustomerReturn, ReturnItem
from notifications.models import Notification
import logging

logger = logging.getLogger(__name__)


class DashboardStatsView(APIView):
    """
    Main dashboard statistics API.
    
    Provides comprehensive KPIs for the bike spare parts management system.
    Implements Requirements 9.6: Dashboard analytics with key performance indicators.
    """
    permission_classes = [IsAuthenticated, OperationsPermission]
    
    def get(self, request):
        """Get dashboard statistics with optional date range filtering (cached 30s)."""
        from django.core.cache import cache
        try:
            # Parse date range parameters
            start_date_str = request.GET.get('start_date')
            end_date_str = request.GET.get('end_date')
            days = int(request.GET.get('days', 30))

            # Set default date range
            if start_date_str and end_date_str:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            else:
                end_date = timezone.now()
                start_date = end_date - timedelta(days=days)

            # Cache key keyed on date range bucket; 30s TTL keeps it near-real-time
            cache_key = f'dashboard:stats:{start_date.date()}:{end_date.date()}:{days}'
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached, status=status.HTTP_200_OK)

            # Inventory KPIs
            inventory_stats = self._get_inventory_stats()

            # Sales KPIs
            sales_stats = self._get_sales_stats(start_date, end_date)

            # Order KPIs
            order_stats = self._get_order_stats(start_date, end_date)

            # Returns KPIs
            return_stats = self._get_return_stats(start_date, end_date)

            # Customer KPIs
            customer_stats = self._get_customer_stats(start_date, end_date)

            # System KPIs
            system_stats = self._get_system_stats()

            payload = {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': (end_date - start_date).days
                },
                'inventory': inventory_stats,
                'sales': sales_stats,
                'orders': order_stats,
                'returns': return_stats,
                'customers': customer_stats,
                'system': system_stats,
                'last_updated': timezone.now().isoformat()
            }
            cache.set(cache_key, payload, timeout=30)
            return Response(payload, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Dashboard stats error: {str(e)}")
            return Response({
                'error': 'DASHBOARD_ERROR',
                'message': 'Error retrieving dashboard statistics'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    def _get_inventory_stats(self):
        """Get inventory-related KPIs."""
        inventory_stats = InventoryItem.objects.filter(is_active=True).aggregate(
            total_items=Count('id'),
            total_stock_value=Coalesce(Sum(F('stock_quantity') * F('unit_price'), output_field=DecimalField()), 0),
            low_stock_count=Count('id', filter=Q(stock_quantity__lte=F('min_stock_level'))),
            out_of_stock_count=Count('id', filter=Q(stock_quantity=0)),
            avg_stock_level=Coalesce(Avg('stock_quantity'), 0),
        )

        total_items = inventory_stats['total_items']
        low_stock_items = inventory_stats['low_stock_count']

        return {
            'total_items': total_items,
            'total_stock_value': float(inventory_stats['total_stock_value']),
            'low_stock_items': low_stock_items,
            'out_of_stock_items': inventory_stats['out_of_stock_count'],
            'avg_stock_level': float(inventory_stats['avg_stock_level']),
            'stock_health_percentage': round(
                ((total_items - low_stock_items) / total_items * 100) if total_items > 0 else 0, 2
            )
        }
    
    def _get_sales_stats(self, start_date, end_date):
        """Get sales-related KPIs for the specified period."""
        completed_orders = CustomerOrder.objects.filter(
            status='DELIVERED',
            created_at__range=[start_date, end_date]
        )
        
        total_sales = completed_orders.aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        
        total_orders = completed_orders.count()
        
        avg_order_value = completed_orders.aggregate(
            avg=Avg('total_amount')
        )['avg'] or 0
        
        # Today's sales
        today = timezone.now().date()
        todays_sales = CustomerOrder.objects.filter(
            status='DELIVERED',
            created_at__date=today
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Top selling items
        top_items = OrderItem.objects.filter(
            order__status='DELIVERED',
            order__created_at__range=[start_date, end_date]
        ).values('item__name', 'item__barcode').annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum(F('quantity') * F('unit_price'))
        ).order_by('-total_quantity')[:5]
        
        return {
            'total_sales': float(total_sales),
            'total_orders': total_orders,
            'avg_order_value': float(avg_order_value),
            'todays_sales': float(todays_sales),
            'top_selling_items': list(top_items)
        }
    
    def _get_order_stats(self, start_date, end_date):
        """Get order-related KPIs for the specified period."""
        orders_in_period = CustomerOrder.objects.filter(
            created_at__range=[start_date, end_date]
        )
        
        order_status_counts = orders_in_period.values('status').annotate(
            count=Count('id')
        )
        status_distribution = {item['status']: item['count'] for item in order_status_counts}
        
        order_counts = CustomerOrder.objects.aggregate(
            pending=Count('id', filter=Q(status='PENDING')),
            processing=Count('id', filter=Q(status__in=['CONFIRMED', 'SHIPPED'])),
        )
        pending_orders = order_counts['pending']
        processing_orders = order_counts['processing']
        
        # Order fulfillment rate
        total_orders = orders_in_period.count()
        completed_orders = orders_in_period.filter(status='DELIVERED').count()
        fulfillment_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
        
        return {
            'pending_orders': pending_orders,
            'processing_orders': processing_orders,
            'status_distribution': status_distribution,
            'fulfillment_rate': round(fulfillment_rate, 2),
            'total_orders_period': total_orders
        }
    
    def _get_return_stats(self, start_date, end_date):
        """Get return-related KPIs for the specified period."""
        returns_in_period = CustomerReturn.objects.filter(
            created_at__range=[start_date, end_date]
        )
        
        total_returns = returns_in_period.count()
        total_return_value = returns_in_period.aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        
        pending_returns = CustomerReturn.objects.filter(status='PENDING').count()
        
        # Return rate calculation
        orders_in_period = CustomerOrder.objects.filter(
            status='DELIVERED',
            created_at__range=[start_date, end_date]
        ).count()
        return_rate = (total_returns / orders_in_period * 100) if orders_in_period > 0 else 0
        
        # Return reasons analysis
        return_reasons = returns_in_period.exclude(
            return_reason__isnull=True
        ).values('return_reason').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        
        return {
            'total_returns': total_returns,
            'total_return_value': float(total_return_value),
            'pending_returns': pending_returns,
            'return_rate': round(return_rate, 2),
            'top_return_reasons': list(return_reasons)
        }
    
    def _get_customer_stats(self, start_date, end_date):
        """Get customer-related KPIs for the specified period."""
        total_customers = CustomUser.objects.filter(role='CUSTOMER').count()
        from django.db.models import Exists, OuterRef
        active_customers = CustomUser.objects.filter(
            role='CUSTOMER',
            customerorder__created_at__range=[start_date, end_date]
        ).values('id').distinct().count()
        
        new_customers = CustomUser.objects.filter(
            role='CUSTOMER',
            date_joined__range=[start_date, end_date]
        ).count()
        
        # Customer lifetime value (simplified)
        customer_values = CustomerOrder.objects.filter(
            status='DELIVERED',
            customer__role='CUSTOMER'
        ).values('customer').annotate(
            total_spent=Sum('total_amount'),
            order_count=Count('id')
        )
        
        avg_customer_value = customer_values.aggregate(
            avg=Avg('total_spent')
        )['avg'] or 0
        
        return {
            'total_customers': total_customers,
            'active_customers': active_customers,
            'new_customers': new_customers,
            'avg_customer_lifetime_value': float(avg_customer_value)
        }
    
    def _get_system_stats(self):
        """Get system-related KPIs."""
        total_users = CustomUser.objects.count()
        pending_approvals = CustomUser.objects.filter(is_approved=False).count()
        unread_notifications = Notification.objects.filter(is_read=False).count()
        
        # Recent activity (last 24 hours)
        last_24h = timezone.now() - timedelta(hours=24)
        recent_orders = CustomerOrder.objects.filter(created_at__gte=last_24h).count()
        recent_returns = CustomerReturn.objects.filter(created_at__gte=last_24h).count()
        recent_stock_transactions = StockTransaction.objects.filter(
            created_at__gte=last_24h
        ).count()
        
        return {
            'total_users': total_users,
            'pending_approvals': pending_approvals,
            'unread_notifications': unread_notifications,
            'recent_activity_24h': {
                'orders': recent_orders,
                'returns': recent_returns,
                'stock_transactions': recent_stock_transactions
            }
        }


class DashboardRecentActivityView(APIView):
    """
    Recent activity feed for dashboard.
    
    Provides real-time activity updates for the dashboard.
    """
    permission_classes = [IsAuthenticated, OperationsPermission]
    
    def get(self, request):
        """Get recent activity across the system."""
        try:
            limit = int(request.GET.get('limit', 20))
            hours = int(request.GET.get('hours', 24))
            
            since = timezone.now() - timedelta(hours=hours)
            
            activities = []
            
            # Recent orders
            try:
                recent_orders = CustomerOrder.objects.filter(
                    created_at__gte=since
                ).select_related('customer', 'created_by').order_by('-created_at')[:limit//4]
                
                for order in recent_orders:
                    activities.append({
                        'type': 'order',
                        'action': f'Order #{order.order_number} created',
                        'details': f'Status: {order.status}, Amount: ₹{order.total_amount}',
                        'user': order.created_by.email if order.created_by else 'System',
                        'timestamp': order.created_at.isoformat()
                    })
            except Exception as e:
                logger.warning(f"Error fetching recent orders: {str(e)}")
            
            # Recent returns
            try:
                recent_returns = CustomerReturn.objects.filter(
                    created_at__gte=since
                ).select_related('customer', 'processed_by').order_by('-created_at')[:limit//4]
                
                for return_item in recent_returns:
                    activities.append({
                        'type': 'return',
                        'action': f'Return #{return_item.return_number} processed',
                        'details': f'Status: {return_item.status}, Amount: ₹{return_item.total_amount}',
                        'user': return_item.processed_by.email if return_item.processed_by else 'System',
                        'timestamp': return_item.created_at.isoformat()
                    })
            except Exception as e:
                logger.warning(f"Error fetching recent returns: {str(e)}")
            
            # Recent stock transactions
            try:
                recent_stock = StockTransaction.objects.filter(
                    created_at__gte=since
                ).select_related('item', 'created_by').order_by('-created_at')[:limit//4]
                
                for transaction in recent_stock:
                    activities.append({
                        'type': 'inventory',
                        'action': f'Stock {transaction.transaction_type.lower()} for {transaction.item.name}',
                        'details': f'Quantity: {transaction.quantity}, Type: {transaction.transaction_type}',
                        'user': transaction.created_by.email if transaction.created_by else 'System',
                        'timestamp': transaction.created_at.isoformat()
                    })
            except Exception as e:
                logger.warning(f"Error fetching recent stock transactions: {str(e)}")
            
            # Recent user approvals
            try:
                recent_approvals = CustomUser.objects.filter(
                    is_approved=True
                ).order_by('-updated_at')[:limit//4]
                
                for user in recent_approvals:
                    activities.append({
                        'type': 'user',
                        'action': f'User {user.email} approved',
                        'details': f'Role: {user.role}',
                        'user': 'System',
                        'timestamp': user.updated_at.isoformat()
                    })
            except Exception as e:
                logger.warning(f"Error fetching recent user approvals: {str(e)}")
            
            # Sort all activities by timestamp
            activities.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return Response({
                'activities': activities[:limit],
                'period_hours': hours,
                'last_updated': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Dashboard activity error: {str(e)}")
            return Response({
                'error': 'ACTIVITY_ERROR',
                'message': 'Error retrieving recent activity',
                'details': str(e) if settings.DEBUG else None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BusinessSettingsView(APIView):
    """Store and retrieve business settings as JSON."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), OperationsPermission()]
        return [IsAuthenticated()]

    def get(self, request):
        from django.core.cache import cache
        settings_data = cache.get('business_settings', {})
        return Response(settings_data, status=status.HTTP_200_OK)

    def post(self, request):
        from django.core.cache import cache
        existing = cache.get('business_settings', {})
        existing.update(request.data)
        cache.set('business_settings', existing, timeout=None)
        return Response(existing, status=status.HTTP_200_OK)


class TunnelUrlView(APIView):
    """Return the active trycloudflare.com tunnel URL stored in Redis by deploy.sh."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache
        url = cache.get('tunnel_url', '')
        return Response({'url': url}, status=status.HTTP_200_OK)
