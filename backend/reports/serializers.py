"""
Serializers for reports API endpoints.

Implements Requirements 9.1, 9.2, 9.3, 9.4: Report generation serialization.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ReportTemplate, ReportExecution

User = get_user_model()


class ReportTemplateSerializer(serializers.ModelSerializer):
    """Serializer for report templates."""
    
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    
    class Meta:
        model = ReportTemplate
        fields = [
            'id', 'name', 'report_type', 'description', 'filters', 'columns',
            'is_active', 'created_by', 'created_by_email', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ReportExecutionSerializer(serializers.ModelSerializer):
    """Serializer for report execution tracking."""
    
    template_name = serializers.CharField(source='template.name', read_only=True)
    template_type = serializers.CharField(source='template.report_type', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    
    class Meta:
        model = ReportExecution
        fields = [
            'id', 'template', 'template_name', 'template_type', 'status',
            'filters_applied', 'total_records', 'file_path', 'error_message',
            'execution_time_seconds', 'created_by', 'created_by_email',
            'created_at', 'completed_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'completed_at']


class ReportFilterSerializer(serializers.Serializer):
    """Serializer for report filter parameters."""
    
    start_date = serializers.DateTimeField(required=False)
    end_date = serializers.DateTimeField(required=False)
    customer_id = serializers.IntegerField(required=False)
    category_id = serializers.IntegerField(required=False)
    status = serializers.CharField(required=False)
    min_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    max_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    search = serializers.CharField(required=False)
    limit = serializers.IntegerField(default=1000, min_value=1, max_value=10000)
    offset = serializers.IntegerField(default=0, min_value=0)
    
    def validate(self, data):
        """Validate filter parameters."""
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] > data['end_date']:
                raise serializers.ValidationError("Start date must be before end date")
        
        if data.get('min_amount') and data.get('max_amount'):
            if data['min_amount'] > data['max_amount']:
                raise serializers.ValidationError("Minimum amount must be less than maximum amount")
        
        return data


class SalesReportDataSerializer(serializers.Serializer):
    """Serializer for sales report data."""
    
    order_number = serializers.CharField()
    order_date = serializers.DateTimeField()
    customer_email = serializers.CharField()
    customer_name = serializers.CharField()
    status = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.CharField()
    payment_status = serializers.CharField()
    items_count = serializers.IntegerField()
    created_by = serializers.CharField()


class InventoryReportDataSerializer(serializers.Serializer):
    """Serializer for inventory report data."""
    
    barcode = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField()
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = serializers.IntegerField()
    min_stock_level = serializers.IntegerField()
    stock_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_status = serializers.CharField()
    last_transaction_date = serializers.DateTimeField()
    total_sold = serializers.IntegerField()
    total_returned = serializers.IntegerField()
    is_active = serializers.BooleanField()


class CustomerReportDataSerializer(serializers.Serializer):
    """Serializer for customer report data."""
    
    email = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField()
    registration_date = serializers.DateTimeField()
    total_orders = serializers.IntegerField()
    total_spent = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_returns = serializers.IntegerField()
    credit_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    last_order_date = serializers.DateTimeField()
    avg_order_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    customer_status = serializers.CharField()


class ReturnReportDataSerializer(serializers.Serializer):
    """Serializer for return report data."""
    
    return_number = serializers.CharField()
    return_date = serializers.DateTimeField()
    order_number = serializers.CharField()
    customer_email = serializers.CharField()
    customer_name = serializers.CharField()
    return_reason = serializers.CharField()
    status = serializers.CharField()
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    credit_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    refund_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    items_count = serializers.IntegerField()
    processed_by = serializers.CharField()
    processing_time_days = serializers.IntegerField()