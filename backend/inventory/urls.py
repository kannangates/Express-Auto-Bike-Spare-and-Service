"""
URL configuration for inventory management API endpoints.

Implements Requirements 11.1, 11.2, 11.5 for RESTful API design
and Requirements 4.1, 4.2, 4.3, 4.4 for inventory management.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'categories', views.InventoryCategoryViewSet, basename='category')
router.register(r'items', views.InventoryItemViewSet, basename='item')
router.register(r'transactions', views.StockTransactionViewSet, basename='transaction')

# URL patterns
urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),
    
    # Custom endpoints
    path('barcode/validate/', views.BarcodeValidationView.as_view(), name='barcode-validate'),
    path('items/<int:pk>/adjust-stock/', views.StockAdjustmentView.as_view(), name='item-adjust-stock'),
    path('low-stock-alerts/', views.LowStockAlertView.as_view(), name='low-stock-alerts'),
    path('bulk-operations/', views.BulkInventoryOperationView.as_view(), name='bulk-operations'),
    
    # Barcode scanning endpoints
    path('scan/item/', views.BarcodeScanItemView.as_view(), name='scan-item'),
    path('scan/validate/', views.BarcodeScanValidateView.as_view(), name='scan-validate'),
]