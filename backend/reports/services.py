"""
Report generation services and business logic.

Implements Requirements 9.1, 9.2, 9.3, 9.4: Report generation services.
Implements Requirements 9.5: Multi-format report export (PDF, Excel, CSV).
"""

import csv
import io
import json
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional
from django.db.models import Q, Count, Sum, Avg, F, Case, When, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.conf import settings
from inventory.models import InventoryItem, StockTransaction
from orders.models import CustomerOrder, OrderItem
from returns.models import CustomerReturn, ReturnItem
from authentication.models import CustomUser

# PDF generation imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Excel generation imports
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.chart import BarChart, Reference
import xlsxwriter

User = get_user_model()


class ReportGenerationService:
    """Service class for generating various business reports."""
    
    def generate_sales_report(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate sales report with filtering and analysis.
        
        Implements Requirements 9.1: Sales reports with date filtering and customer analysis.
        """
        # Build base queryset
        queryset = CustomerOrder.objects.select_related(
            'customer', 'created_by'
        ).prefetch_related('order_items')
        
        # Apply filters
        queryset = self._apply_sales_filters(queryset, filters)
        
        # Get report data
        orders = queryset.order_by('-created_at')[filters.get('offset', 0):filters.get('offset', 0) + filters.get('limit', 1000)]
        
        report_data = []
        for order in orders:
            customer_name = f"{order.customer.first_name or ''} {order.customer.last_name or ''}".strip()
            if not customer_name:
                customer_name = order.customer.email.split('@')[0]
            
            report_data.append({
                'order_number': order.order_number,
                'order_date': order.created_at,
                'customer_email': order.customer.email if order.customer else 'N/A',
                'customer_name': customer_name if order.customer else 'N/A',
                'status': order.status,
                'subtotal': order.subtotal,
                'tax_amount': order.tax_amount or Decimal('0.00'),
                'discount_amount': order.discount_amount or Decimal('0.00'),
                'total_amount': order.total_amount,
                'payment_method': order.payment_method or 'N/A',
                'payment_status': order.payment_status or 'N/A',
                'items_count': order.order_items.count(),
                'created_by': order.created_by.email if order.created_by else 'System'
            })
        
        # Generate summary statistics
        summary = self._generate_sales_summary(queryset)
        
        return {
            'data': report_data,
            'summary': summary,
            'total_records': queryset.count(),
            'filters_applied': filters
        }
    
    def generate_inventory_report(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate inventory report with stock levels and movement tracking.
        
        Implements Requirements 9.2: Inventory reports with stock levels and movement tracking.
        """
        # Build base queryset
        queryset = InventoryItem.objects.select_related('category').prefetch_related(
            'stock_transactions', 'order_items', 'return_items'
        )
        
        # Apply filters
        queryset = self._apply_inventory_filters(queryset, filters)
        
        # Get report data
        items = queryset.order_by('name')[filters.get('offset', 0):filters.get('offset', 0) + filters.get('limit', 1000)]
        
        report_data = []
        for item in items:
            # Calculate stock status
            stock_status = 'HEALTHY'
            if item.stock_quantity == 0:
                stock_status = 'OUT_OF_STOCK'
            elif item.stock_quantity <= item.min_stock_level:
                stock_status = 'LOW_STOCK'
            
            # Get last transaction date
            last_transaction = item.stock_transactions.order_by('-created_at').first()
            last_transaction_date = last_transaction.created_at if last_transaction else item.created_at
            
            # Calculate totals
            total_sold = item.order_items.filter(
                order__status='COMPLETED'
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            total_returned = item.return_items.filter(
                return__status='PROCESSED'
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            report_data.append({
                'barcode': item.barcode,
                'name': item.name,
                'category': item.category.name if item.category else 'Uncategorized',
                'unit_price': item.unit_price,
                'stock_quantity': item.stock_quantity,
                'min_stock_level': item.min_stock_level,
                'stock_value': item.unit_price * item.stock_quantity,
                'stock_status': stock_status,
                'last_transaction_date': last_transaction_date,
                'total_sold': total_sold,
                'total_returned': total_returned,
                'is_active': item.is_active
            })
        
        # Generate summary statistics
        summary = self._generate_inventory_summary(queryset)
        
        return {
            'data': report_data,
            'summary': summary,
            'total_records': queryset.count(),
            'filters_applied': filters
        }
    
    def generate_customer_report(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate customer report with purchase history and credit balances.
        
        Implements Requirements 9.3: Customer reports with purchase history and credit balances.
        """
        # Build base queryset
        queryset = CustomUser.objects.filter(role='CUSTOMER').prefetch_related(
            'customer_orders', 'customer_returns', 'customer_credits'
        )
        
        # Apply filters
        queryset = self._apply_customer_filters(queryset, filters)
        
        # Get report data
        customers = queryset.order_by('email')[filters.get('offset', 0):filters.get('offset', 0) + filters.get('limit', 1000)]
        
        report_data = []
        for customer in customers:
            # Calculate customer metrics
            completed_orders = customer.customer_orders.filter(status='COMPLETED')
            total_orders = completed_orders.count()
            total_spent = completed_orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
            total_returns = customer.customer_returns.count()
            
            # Get credit balance
            credit_record = customer.customer_credits.first()
            credit_balance = credit_record.balance if credit_record else Decimal('0.00')
            
            # Last order date
            last_order = completed_orders.order_by('-created_at').first()
            last_order_date = last_order.created_at if last_order else None
            
            # Average order value
            avg_order_value = total_spent / total_orders if total_orders > 0 else Decimal('0.00')
            
            # Customer status
            customer_status = 'ACTIVE'
            if total_orders == 0:
                customer_status = 'NEW'
            elif last_order_date and last_order_date < timezone.now() - timedelta(days=90):
                customer_status = 'INACTIVE'
            
            report_data.append({
                'email': customer.email,
                'first_name': customer.first_name or '',
                'last_name': customer.last_name or '',
                'phone': customer.phone or '',
                'registration_date': customer.date_joined,
                'total_orders': total_orders,
                'total_spent': total_spent,
                'total_returns': total_returns,
                'credit_balance': credit_balance,
                'last_order_date': last_order_date,
                'avg_order_value': avg_order_value,
                'customer_status': customer_status
            })
        
        # Generate summary statistics
        summary = self._generate_customer_summary(queryset)
        
        return {
            'data': report_data,
            'summary': summary,
            'total_records': queryset.count(),
            'filters_applied': filters
        }
    
    def generate_return_report(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate return report with reason analysis and trends.
        
        Implements Requirements 9.4: Return reports with reason analysis and trends.
        """
        # Build base queryset
        queryset = CustomerReturn.objects.select_related(
            'customer', 'order', 'processed_by'
        ).prefetch_related('return_items')
        
        # Apply filters
        queryset = self._apply_return_filters(queryset, filters)
        
        # Get report data
        returns = queryset.order_by('-created_at')[filters.get('offset', 0):filters.get('offset', 0) + filters.get('limit', 1000)]
        
        report_data = []
        for return_item in returns:
            customer_name = f"{return_item.customer.first_name or ''} {return_item.customer.last_name or ''}".strip()
            if not customer_name:
                customer_name = return_item.customer.email.split('@')[0]
            
            # Calculate processing time
            processing_time_days = 0
            if return_item.processed_at and return_item.created_at:
                processing_time_days = (return_item.processed_at - return_item.created_at).days
            
            report_data.append({
                'return_number': return_item.return_number,
                'return_date': return_item.created_at,
                'order_number': return_item.order.order_number if return_item.order else 'N/A',
                'customer_email': return_item.customer.email if return_item.customer else 'N/A',
                'customer_name': customer_name if return_item.customer else 'N/A',
                'return_reason': return_item.return_reason or 'Not specified',
                'status': return_item.status,
                'total_amount': return_item.total_amount,
                'credit_amount': return_item.credit_amount or Decimal('0.00'),
                'refund_amount': return_item.refund_amount or Decimal('0.00'),
                'items_count': return_item.return_items.count(),
                'processed_by': return_item.processed_by.email if return_item.processed_by else 'N/A',
                'processing_time_days': processing_time_days
            })
        
        # Generate summary statistics
        summary = self._generate_return_summary(queryset)
        
        return {
            'data': report_data,
            'summary': summary,
            'total_records': queryset.count(),
            'filters_applied': filters
        }
    
    def _apply_sales_filters(self, queryset, filters: Dict[str, Any]):
        """Apply filters to sales report queryset."""
        if filters.get('start_date'):
            queryset = queryset.filter(created_at__gte=filters['start_date'])
        
        if filters.get('end_date'):
            queryset = queryset.filter(created_at__lte=filters['end_date'])
        
        if filters.get('customer_id'):
            queryset = queryset.filter(customer_id=filters['customer_id'])
        
        if filters.get('status'):
            queryset = queryset.filter(status=filters['status'])
        
        if filters.get('min_amount'):
            queryset = queryset.filter(total_amount__gte=filters['min_amount'])
        
        if filters.get('max_amount'):
            queryset = queryset.filter(total_amount__lte=filters['max_amount'])
        
        if filters.get('search'):
            search_term = filters['search']
            queryset = queryset.filter(
                Q(order_number__icontains=search_term) |
                Q(customer__email__icontains=search_term) |
                Q(customer__first_name__icontains=search_term) |
                Q(customer__last_name__icontains=search_term)
            )
        
        return queryset
    
    def _apply_inventory_filters(self, queryset, filters: Dict[str, Any]):
        """Apply filters to inventory report queryset."""
        if filters.get('category_id'):
            queryset = queryset.filter(category_id=filters['category_id'])
        
        if filters.get('search'):
            search_term = filters['search']
            queryset = queryset.filter(
                Q(name__icontains=search_term) |
                Q(barcode__icontains=search_term) |
                Q(description__icontains=search_term)
            )
        
        return queryset
    
    def _apply_customer_filters(self, queryset, filters: Dict[str, Any]):
        """Apply filters to customer report queryset."""
        if filters.get('start_date'):
            queryset = queryset.filter(date_joined__gte=filters['start_date'])
        
        if filters.get('end_date'):
            queryset = queryset.filter(date_joined__lte=filters['end_date'])
        
        if filters.get('search'):
            search_term = filters['search']
            queryset = queryset.filter(
                Q(email__icontains=search_term) |
                Q(first_name__icontains=search_term) |
                Q(last_name__icontains=search_term) |
                Q(phone__icontains=search_term)
            )
        
        return queryset
    
    def _apply_return_filters(self, queryset, filters: Dict[str, Any]):
        """Apply filters to return report queryset."""
        if filters.get('start_date'):
            queryset = queryset.filter(created_at__gte=filters['start_date'])
        
        if filters.get('end_date'):
            queryset = queryset.filter(created_at__lte=filters['end_date'])
        
        if filters.get('customer_id'):
            queryset = queryset.filter(customer_id=filters['customer_id'])
        
        if filters.get('status'):
            queryset = queryset.filter(status=filters['status'])
        
        if filters.get('search'):
            search_term = filters['search']
            queryset = queryset.filter(
                Q(return_number__icontains=search_term) |
                Q(return_reason__icontains=search_term) |
                Q(customer__email__icontains=search_term) |
                Q(order__order_number__icontains=search_term)
            )
        
        return queryset
    
    def _generate_sales_summary(self, queryset) -> Dict[str, Any]:
        """Generate summary statistics for sales report."""
        summary_data = queryset.aggregate(
            total_orders=Count('id'),
            total_revenue=Sum('total_amount'),
            avg_order_value=Avg('total_amount'),
            total_tax=Sum('tax_amount'),
            total_discounts=Sum('discount_amount')
        )
        
        # Status distribution
        status_counts = queryset.values('status').annotate(count=Count('id'))
        status_distribution = {item['status']: item['count'] for item in status_counts}
        
        return {
            'total_orders': summary_data['total_orders'] or 0,
            'total_revenue': float(summary_data['total_revenue'] or 0),
            'avg_order_value': float(summary_data['avg_order_value'] or 0),
            'total_tax': float(summary_data['total_tax'] or 0),
            'total_discounts': float(summary_data['total_discounts'] or 0),
            'status_distribution': status_distribution
        }
    
    def _generate_inventory_summary(self, queryset) -> Dict[str, Any]:
        """Generate summary statistics for inventory report."""
        summary_data = queryset.aggregate(
            total_items=Count('id'),
            total_stock_value=Sum(F('unit_price') * F('stock_quantity')),
            avg_unit_price=Avg('unit_price'),
            total_stock_quantity=Sum('stock_quantity')
        )
        
        # Stock status distribution
        low_stock_count = queryset.filter(stock_quantity__lte=F('min_stock_level')).count()
        out_of_stock_count = queryset.filter(stock_quantity=0).count()
        healthy_stock_count = summary_data['total_items'] - low_stock_count
        
        return {
            'total_items': summary_data['total_items'] or 0,
            'total_stock_value': float(summary_data['total_stock_value'] or 0),
            'avg_unit_price': float(summary_data['avg_unit_price'] or 0),
            'total_stock_quantity': summary_data['total_stock_quantity'] or 0,
            'stock_status_distribution': {
                'HEALTHY': healthy_stock_count,
                'LOW_STOCK': low_stock_count,
                'OUT_OF_STOCK': out_of_stock_count
            }
        }
    
    def _generate_customer_summary(self, queryset) -> Dict[str, Any]:
        """Generate summary statistics for customer report."""
        total_customers = queryset.count()
        
        # Calculate aggregated customer metrics
        customer_metrics = []
        for customer in queryset:
            completed_orders = customer.customer_orders.filter(status='COMPLETED')
            total_spent = completed_orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
            customer_metrics.append({
                'total_spent': float(total_spent),
                'total_orders': completed_orders.count(),
                'total_returns': customer.customer_returns.count()
            })
        
        if customer_metrics:
            avg_customer_value = sum(m['total_spent'] for m in customer_metrics) / len(customer_metrics)
            avg_orders_per_customer = sum(m['total_orders'] for m in customer_metrics) / len(customer_metrics)
            avg_returns_per_customer = sum(m['total_returns'] for m in customer_metrics) / len(customer_metrics)
        else:
            avg_customer_value = 0
            avg_orders_per_customer = 0
            avg_returns_per_customer = 0
        
        return {
            'total_customers': total_customers,
            'avg_customer_lifetime_value': avg_customer_value,
            'avg_orders_per_customer': avg_orders_per_customer,
            'avg_returns_per_customer': avg_returns_per_customer
        }
    
    def _generate_return_summary(self, queryset) -> Dict[str, Any]:
        """Generate summary statistics for return report."""
        summary_data = queryset.aggregate(
            total_returns=Count('id'),
            total_return_value=Sum('total_amount'),
            total_credits_issued=Sum('credit_amount'),
            total_refunds_issued=Sum('refund_amount'),
            avg_return_value=Avg('total_amount')
        )
        
        # Status distribution
        status_counts = queryset.values('status').annotate(count=Count('id'))
        status_distribution = {item['status']: item['count'] for item in status_counts}
        
        # Return reasons analysis
        reason_counts = queryset.exclude(
            return_reason__isnull=True
        ).values('return_reason').annotate(count=Count('id')).order_by('-count')[:10]
        
        return {
            'total_returns': summary_data['total_returns'] or 0,
            'total_return_value': float(summary_data['total_return_value'] or 0),
            'total_credits_issued': float(summary_data['total_credits_issued'] or 0),
            'total_refunds_issued': float(summary_data['total_refunds_issued'] or 0),
            'avg_return_value': float(summary_data['avg_return_value'] or 0),
            'status_distribution': status_distribution,
            'top_return_reasons': list(reason_counts)
        }


class ReportExportService:
    """
    Service for exporting reports in various formats.
    
    Implements Requirements 9.5: Export reports in multiple formats (PDF, Excel, CSV).
    """
    
    def __init__(self):
        """Initialize export service with styling configurations."""
        self.pdf_styles = getSampleStyleSheet()
        self.excel_header_style = {
            'font': Font(bold=True, color='FFFFFF'),
            'fill': PatternFill(start_color='366092', end_color='366092', fill_type='solid'),
            'alignment': Alignment(horizontal='center', vertical='center'),
            'border': Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
        }
        self.excel_data_style = {
            'alignment': Alignment(horizontal='left', vertical='center'),
            'border': Border(
                left=Side(style='thin'),
                right=Side(style='thin'),
                top=Side(style='thin'),
                bottom=Side(style='thin')
            )
        }
    
    def export_to_csv(self, data: List[Dict[str, Any]], filename: str) -> str:
        """Export report data to CSV format."""
        if not data:
            return ""
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        
        for row in data:
            # Convert datetime objects to strings
            formatted_row = {}
            for key, value in row.items():
                if isinstance(value, datetime):
                    formatted_row[key] = value.isoformat()
                elif isinstance(value, Decimal):
                    formatted_row[key] = float(value)
                else:
                    formatted_row[key] = value
            writer.writerow(formatted_row)
        
        return output.getvalue()
    
    def export_to_json(self, data: Dict[str, Any]) -> str:
        """Export report data to JSON format."""
        def json_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, Decimal):
                return float(obj)
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        return json.dumps(data, default=json_serializer, indent=2)
    
    def export_to_pdf(self, report_data: Dict[str, Any], report_type: str, filename: str) -> bytes:
        """
        Export report data to PDF format with professional formatting.
        
        Implements Requirements 9.5: PDF export for all report types.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72,
                              topMargin=72, bottomMargin=18)
        
        # Build PDF content
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.pdf_styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#366092')
        )
        
        report_titles = {
            'sales': 'Sales Report',
            'inventory': 'Inventory Report',
            'customer': 'Customer Report',
            'returns': 'Returns Report'
        }
        
        title = Paragraph(report_titles.get(report_type, 'Business Report'), title_style)
        story.append(title)
        
        # Report metadata
        metadata_style = ParagraphStyle(
            'Metadata',
            parent=self.pdf_styles['Normal'],
            fontSize=10,
            spaceAfter=20,
            alignment=TA_LEFT
        )
        
        generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        metadata = Paragraph(f"Generated: {generated_at} | Total Records: {report_data.get('total_records', 0)}", metadata_style)
        story.append(metadata)
        
        # Summary section
        if 'summary' in report_data:
            story.append(self._create_pdf_summary_section(report_data['summary'], report_type))
            story.append(Spacer(1, 20))
        
        # Data table
        if report_data.get('data'):
            story.append(self._create_pdf_data_table(report_data['data'], report_type))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    def export_to_excel(self, report_data: Dict[str, Any], report_type: str, filename: str) -> bytes:
        """
        Export report data to Excel format with professional formatting and charts.
        
        Implements Requirements 9.5: Excel export with proper formatting.
        """
        buffer = io.BytesIO()
        workbook = openpyxl.Workbook()
        
        # Remove default sheet and create named sheets
        workbook.remove(workbook.active)
        
        # Create main data sheet
        data_sheet = workbook.create_sheet(title="Report Data")
        
        # Create summary sheet
        summary_sheet = workbook.create_sheet(title="Summary")
        
        # Populate data sheet
        if report_data.get('data'):
            self._populate_excel_data_sheet(data_sheet, report_data['data'], report_type)
        
        # Populate summary sheet
        if report_data.get('summary'):
            self._populate_excel_summary_sheet(summary_sheet, report_data['summary'], report_type)
        
        # Add metadata sheet
        metadata_sheet = workbook.create_sheet(title="Metadata")
        self._populate_excel_metadata_sheet(metadata_sheet, report_data, report_type)
        
        # Save to buffer
        workbook.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()
    
    def _create_pdf_summary_section(self, summary: Dict[str, Any], report_type: str) -> Table:
        """Create PDF summary section with key metrics."""
        summary_style = ParagraphStyle(
            'SummaryHeader',
            parent=self.pdf_styles['Heading2'],
            fontSize=14,
            spaceAfter=10,
            textColor=colors.HexColor('#366092')
        )
        
        summary_data = []
        summary_data.append([Paragraph("Summary", summary_style), ""])
        
        if report_type == 'sales':
            summary_data.extend([
                ["Total Orders", f"{summary.get('total_orders', 0):,}"],
                ["Total Revenue", f"${summary.get('total_revenue', 0):,.2f}"],
                ["Average Order Value", f"${summary.get('avg_order_value', 0):,.2f}"],
                ["Total Tax", f"${summary.get('total_tax', 0):,.2f}"],
                ["Total Discounts", f"${summary.get('total_discounts', 0):,.2f}"]
            ])
        elif report_type == 'inventory':
            summary_data.extend([
                ["Total Items", f"{summary.get('total_items', 0):,}"],
                ["Total Stock Value", f"${summary.get('total_stock_value', 0):,.2f}"],
                ["Average Unit Price", f"${summary.get('avg_unit_price', 0):,.2f}"],
                ["Total Stock Quantity", f"{summary.get('total_stock_quantity', 0):,}"]
            ])
        elif report_type == 'customer':
            summary_data.extend([
                ["Total Customers", f"{summary.get('total_customers', 0):,}"],
                ["Avg Customer Lifetime Value", f"${summary.get('avg_customer_lifetime_value', 0):,.2f}"],
                ["Avg Orders per Customer", f"{summary.get('avg_orders_per_customer', 0):.1f}"],
                ["Avg Returns per Customer", f"{summary.get('avg_returns_per_customer', 0):.1f}"]
            ])
        elif report_type == 'returns':
            summary_data.extend([
                ["Total Returns", f"{summary.get('total_returns', 0):,}"],
                ["Total Return Value", f"${summary.get('total_return_value', 0):,.2f}"],
                ["Total Credits Issued", f"${summary.get('total_credits_issued', 0):,.2f}"],
                ["Average Return Value", f"${summary.get('avg_return_value', 0):,.2f}"]
            ])
        
        table = Table(summary_data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        return table
    
    def _create_pdf_data_table(self, data: List[Dict[str, Any]], report_type: str) -> Table:
        """Create PDF data table with proper formatting."""
        if not data:
            return Table([["No data available"]])
        
        # Get column headers
        headers = list(data[0].keys())
        
        # Format headers for display
        formatted_headers = [self._format_column_header(header) for header in headers]
        
        # Prepare table data
        table_data = [formatted_headers]
        
        # Add data rows (limit to first 100 rows for PDF)
        for row in data[:100]:
            formatted_row = []
            for key in headers:
                value = row.get(key, '')
                if isinstance(value, datetime):
                    formatted_row.append(value.strftime('%Y-%m-%d %H:%M'))
                elif isinstance(value, Decimal):
                    if 'amount' in key.lower() or 'price' in key.lower() or 'value' in key.lower():
                        formatted_row.append(f"${float(value):,.2f}")
                    else:
                        formatted_row.append(f"{float(value):,.2f}")
                elif isinstance(value, (int, float)):
                    if 'amount' in key.lower() or 'price' in key.lower() or 'value' in key.lower():
                        formatted_row.append(f"${value:,.2f}")
                    else:
                        formatted_row.append(f"{value:,}")
                else:
                    formatted_row.append(str(value))
            table_data.append(formatted_row)
        
        # Create table with dynamic column widths
        col_count = len(headers)
        col_width = 7.5 * inch / col_count
        table = Table(table_data, colWidths=[col_width] * col_count)
        
        # Apply table styling
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#366092')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        return table
    
    def _populate_excel_data_sheet(self, sheet, data: List[Dict[str, Any]], report_type: str):
        """Populate Excel data sheet with formatted data."""
        if not data:
            sheet['A1'] = "No data available"
            return
        
        # Get headers
        headers = list(data[0].keys())
        formatted_headers = [self._format_column_header(header) for header in headers]
        
        # Write headers
        for col, header in enumerate(formatted_headers, 1):
            cell = sheet.cell(row=1, column=col, value=header)
            cell.font = self.excel_header_style['font']
            cell.fill = self.excel_header_style['fill']
            cell.alignment = self.excel_header_style['alignment']
            cell.border = self.excel_header_style['border']
        
        # Write data
        for row_idx, row_data in enumerate(data, 2):
            for col_idx, key in enumerate(headers, 1):
                value = row_data.get(key, '')
                
                # Format value based on type
                if isinstance(value, datetime):
                    formatted_value = value.strftime('%Y-%m-%d %H:%M:%S')
                elif isinstance(value, Decimal):
                    formatted_value = float(value)
                else:
                    formatted_value = value
                
                cell = sheet.cell(row=row_idx, column=col_idx, value=formatted_value)
                cell.alignment = self.excel_data_style['alignment']
                cell.border = self.excel_data_style['border']
                
                # Apply number formatting for currency fields
                if isinstance(formatted_value, (int, float)) and any(term in key.lower() for term in ['amount', 'price', 'value']):
                    cell.number_format = '$#,##0.00'
        
        # Auto-adjust column widths
        for column in sheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            sheet.column_dimensions[column_letter].width = adjusted_width
    
    def _populate_excel_summary_sheet(self, sheet, summary: Dict[str, Any], report_type: str):
        """Populate Excel summary sheet with key metrics and charts."""
        # Title
        sheet['A1'] = f"{report_type.title()} Report Summary"
        sheet['A1'].font = Font(size=16, bold=True, color='366092')
        sheet['A1'].alignment = Alignment(horizontal='center')
        sheet.merge_cells('A1:D1')
        
        # Summary metrics
        row = 3
        sheet[f'A{row}'] = "Key Metrics"
        sheet[f'A{row}'].font = Font(size=14, bold=True)
        row += 1
        
        if report_type == 'sales':
            metrics = [
                ("Total Orders", summary.get('total_orders', 0)),
                ("Total Revenue", f"${summary.get('total_revenue', 0):,.2f}"),
                ("Average Order Value", f"${summary.get('avg_order_value', 0):,.2f}"),
                ("Total Tax", f"${summary.get('total_tax', 0):,.2f}"),
                ("Total Discounts", f"${summary.get('total_discounts', 0):,.2f}")
            ]
        elif report_type == 'inventory':
            metrics = [
                ("Total Items", summary.get('total_items', 0)),
                ("Total Stock Value", f"${summary.get('total_stock_value', 0):,.2f}"),
                ("Average Unit Price", f"${summary.get('avg_unit_price', 0):,.2f}"),
                ("Total Stock Quantity", summary.get('total_stock_quantity', 0))
            ]
        elif report_type == 'customer':
            metrics = [
                ("Total Customers", summary.get('total_customers', 0)),
                ("Avg Customer Lifetime Value", f"${summary.get('avg_customer_lifetime_value', 0):,.2f}"),
                ("Avg Orders per Customer", f"{summary.get('avg_orders_per_customer', 0):.1f}"),
                ("Avg Returns per Customer", f"{summary.get('avg_returns_per_customer', 0):.1f}")
            ]
        elif report_type == 'returns':
            metrics = [
                ("Total Returns", summary.get('total_returns', 0)),
                ("Total Return Value", f"${summary.get('total_return_value', 0):,.2f}"),
                ("Total Credits Issued", f"${summary.get('total_credits_issued', 0):,.2f}"),
                ("Average Return Value", f"${summary.get('avg_return_value', 0):,.2f}")
            ]
        else:
            metrics = []
        
        for metric_name, metric_value in metrics:
            sheet[f'A{row}'] = metric_name
            sheet[f'B{row}'] = metric_value
            sheet[f'A{row}'].font = Font(bold=True)
            row += 1
    
    def _populate_excel_metadata_sheet(self, sheet, report_data: Dict[str, Any], report_type: str):
        """Populate Excel metadata sheet with report information."""
        sheet['A1'] = "Report Metadata"
        sheet['A1'].font = Font(size=16, bold=True)
        
        metadata = [
            ("Report Type", report_type.title()),
            ("Generated At", datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            ("Total Records", report_data.get('total_records', 0)),
            ("Execution Time", f"{report_data.get('execution_time_seconds', 0):.2f} seconds"),
        ]
        
        # Add filters if present
        if report_data.get('filters_applied'):
            metadata.append(("Filters Applied", ""))
            for key, value in report_data['filters_applied'].items():
                if value:
                    metadata.append((f"  {key}", str(value)))
        
        for row, (key, value) in enumerate(metadata, 3):
            sheet[f'A{row}'] = key
            sheet[f'B{row}'] = value
            if not key.startswith('  '):
                sheet[f'A{row}'].font = Font(bold=True)
        
        # Auto-adjust column widths
        sheet.column_dimensions['A'].width = 20
        sheet.column_dimensions['B'].width = 30
    
    def _format_column_header(self, header: str) -> str:
        """Format column header for display."""
        # Convert snake_case to Title Case
        return header.replace('_', ' ').title()
    
    def get_export_filename(self, report_type: str, export_format: str) -> str:
        """Generate standardized filename for exports."""
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        return f"{report_type}_report_{timestamp}.{export_format}"
    
    def get_content_type(self, export_format: str) -> str:
        """Get appropriate content type for export format."""
        content_types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        return content_types.get(export_format, 'application/octet-stream')