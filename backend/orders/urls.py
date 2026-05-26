"""
URL configuration for order processing API endpoints.

Implements Requirements 11.1, 11.2, 11.5 for RESTful API design
and Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 for order processing.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'orders', views.CustomerOrderViewSet, basename='order')
router.register(r'items', views.OrderItemViewSet, basename='orderitem')

# URL patterns
urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),
    
    # Order management endpoints
    path('orders/<int:pk>/process/', views.ProcessOrderView.as_view(), name='order-process'),
    path('orders/<int:pk>/ship/', views.ShipOrderView.as_view(), name='order-ship'),
    path('orders/<int:pk>/deliver/', views.DeliverOrderView.as_view(), name='order-deliver'),
    path('orders/<int:pk>/cancel/', views.CancelOrderView.as_view(), name='order-cancel'),
    path('orders/<int:pk>/receipt/', views.OrderReceiptView.as_view(), name='order-receipt'),
    
    # Payment processing endpoints
    path('orders/<int:pk>/payment/', views.PaymentProcessingView.as_view(), name='order-payment'),
    path('orders/<int:pk>/payment/status/', views.PaymentStatusView.as_view(), name='order-payment-status'),
    path('orders/<int:pk>/credit-check/', views.CustomerCreditCheckView.as_view(), name='order-credit-check'),
    
    # Barcode scanning endpoints
    path('barcode/validate/', views.BarcodeOrderValidationView.as_view(), name='barcode-validate'),
    path('scan/add-item/', views.BarcodeScanAddItemView.as_view(), name='scan-add-item'),
    
    # Quick order creation
    path('quick-order/', views.QuickOrderCreateView.as_view(), name='quick-order'),
]