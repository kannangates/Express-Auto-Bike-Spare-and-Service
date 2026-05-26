"""
URL configuration for returns and credit management API endpoints.

Implements Requirements 11.1, 11.2, 11.5 for RESTful API design
and Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7 for returns and credit management.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'returns', views.CustomerReturnViewSet, basename='return')
router.register(r'return-items', views.ReturnItemViewSet, basename='returnitem')
router.register(r'credit-accounts', views.CustomerCreditViewSet, basename='credit')
router.register(r'credit-transactions', views.CreditTransactionViewSet, basename='credit-transaction')

# URL patterns
urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),
    
    # Return management endpoints
    path('returns/<int:pk>/approve/', views.ApproveReturnView.as_view(), name='return-approve'),
    path('returns/<int:pk>/process/', views.ProcessReturnView.as_view(), name='return-process'),
    path('returns/<int:pk>/reject/', views.RejectReturnView.as_view(), name='return-reject'),
    
    # Credit management endpoints
    path('credit/<int:customer_id>/apply/', views.ApplyCreditView.as_view(), name='credit-apply'),
    path('credit/<int:customer_id>/use/', views.UseCreditView.as_view(), name='credit-use'),
    path('credit/<int:customer_id>/balance/', views.CreditBalanceView.as_view(), name='credit-balance'),
    path('credit/<int:customer_id>/summary/', views.CreditSummaryView.as_view(), name='credit-summary'),
    path('credit/bulk-apply/', views.BulkCreditApplicationView.as_view(), name='credit-bulk-apply'),
    
    # Credit memo generation
    path('returns/<int:pk>/credit-memo/', views.CreditMemoView.as_view(), name='credit-memo'),
    
    # Barcode scanning endpoints
    path('barcode/validate/', views.BarcodeReturnValidationView.as_view(), name='barcode-validate'),
    path('scan/return-item/', views.BarcodeScanReturnItemView.as_view(), name='scan-return-item'),
    
    # Return creation with order lookup
    path('create-from-order/<int:order_id>/', views.CreateReturnFromOrderView.as_view(), name='create-from-order'),
]