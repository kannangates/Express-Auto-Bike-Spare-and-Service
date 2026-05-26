"""
URL configuration for reports app.

Implements Requirements 9.1, 9.2, 9.3, 9.4: Report generation URL routing.
Implements Requirements 9.5: Multi-format export URL routing.
"""

from django.urls import path
from . import views

app_name = 'reports'

urlpatterns = [
    # Report generation endpoints
    path('sales/', views.SalesReportView.as_view(), name='sales-report'),
    path('inventory/', views.InventoryReportView.as_view(), name='inventory-report'),
    path('customers/', views.CustomerReportView.as_view(), name='customer-report'),
    path('returns/', views.ReturnReportView.as_view(), name='return-report'),
    
    # Report export endpoints
    path('export/<str:report_type>/', views.ReportExportView.as_view(), name='report-export'),
    path('export/bulk/', views.BulkReportExportView.as_view(), name='bulk-report-export'),
    path('export/progress/<str:export_id>/', views.ReportExportProgressView.as_view(), name='export-progress'),
    
    # Report templates
    path('templates/', views.ReportTemplateView.as_view(), name='report-templates'),
    
    # Report execution history
    path('history/', views.ReportExecutionHistoryView.as_view(), name='report-history'),
]