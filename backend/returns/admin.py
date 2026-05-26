from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import CustomerReturn, ReturnItem, CustomerCredit, CreditTransaction


class ReturnItemInline(admin.TabularInline):
    """Inline admin for ReturnItem."""
    model = ReturnItem
    extra = 0
    readonly_fields = ('barcode', 'item_name', 'total_price', 'created_at')
    fields = ('order_item', 'barcode', 'item_name', 'quantity', 'unit_price', 'total_price', 'condition', 'restockable')


@admin.register(CustomerReturn)
class CustomerReturnAdmin(admin.ModelAdmin):
    """Admin interface for CustomerReturn model."""
    
    list_display = ('return_number', 'customer_link', 'order_link', 'status', 'total_amount', 'credit_amount', 'processed_by', 'created_at')
    list_filter = ('status', 'created_at', 'processed_by', 'approved_by')
    search_fields = ('return_number', 'customer__email', 'order__order_number', 'return_reason')
    ordering = ('-created_at',)
    readonly_fields = ('return_number', 'total_amount', 'created_at', 'updated_at', 'approved_at', 'processed_at')
    inlines = [ReturnItemInline]
    
    fieldsets = (
        ('Return Information', {
            'fields': ('return_number', 'order', 'customer', 'status')
        }),
        ('Return Details', {
            'fields': ('return_reason', 'return_reason_details', 'notes')
        }),
        ('Financial Details', {
            'fields': ('total_amount', 'credit_amount', 'refund_amount', 'restocking_fee')
        }),
        ('Processing Information', {
            'fields': ('approved_by', 'approved_at', 'processed_by', 'processed_at')
        }),
        ('Audit Information', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def customer_link(self, obj):
        """Display customer as clickable link."""
        if obj.customer:
            url = reverse('admin:authentication_customuser_change', args=[obj.customer.id])
            return format_html('<a href="{}">{}</a>', url, obj.customer.email)
        return '-'
    customer_link.short_description = 'Customer'
    
    def order_link(self, obj):
        """Display order as clickable link."""
        if obj.order:
            url = reverse('admin:orders_customerorder_change', args=[obj.order.id])
            return format_html('<a href="{}">{}</a>', url, obj.order.order_number)
        return '-'
    order_link.short_description = 'Original Order'
    
    def save_model(self, request, obj, form, change):
        """Handle return processing and notifications."""
        old_status = None
        if change:
            old_obj = CustomerReturn.objects.get(pk=obj.pk)
            old_status = old_obj.status
        
        super().save_model(request, obj, form, change)
        
        # Send notification if status changed
        if change and old_status and old_status != obj.status:
            from notifications.models import Notification
            if obj.status == 'APPROVED':
                Notification.create_return_notification(obj, 'RETURN_APPROVED')
            elif obj.status == 'PROCESSED':
                Notification.create_return_notification(obj, 'RETURN_PROCESSED')
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER']):
            return qs.filter(status__in=['PENDING', 'APPROVED'])
        elif request.user.is_customer():
            return qs.filter(customer=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view returns (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Role-based change permissions."""
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return True
        elif request.user.has_role_permission(['CASHIER']) and obj:
            return obj.status in ['PENDING', 'APPROVED']
        return False
    
    def has_add_permission(self, request):
        """OWNER, OPERATIONS, and CASHIER can create returns."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS', 'CASHIER'])
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete returns."""
        return request.user.is_owner()


@admin.register(ReturnItem)
class ReturnItemAdmin(admin.ModelAdmin):
    """Admin interface for ReturnItem model."""
    
    list_display = ('return_link', 'order_item_link', 'barcode', 'quantity', 'condition', 'restockable', 'total_price', 'created_at')
    list_filter = ('condition', 'restockable', 'created_at')
    search_fields = ('return_obj__return_number', 'barcode', 'item_name')
    ordering = ('-created_at',)
    readonly_fields = ('barcode', 'item_name', 'total_price', 'created_at')
    
    def return_link(self, obj):
        """Display return as clickable link."""
        url = reverse('admin:returns_customerreturn_change', args=[obj.return_obj.id])
        return format_html('<a href="{}">{}</a>', url, obj.return_obj.return_number)
    return_link.short_description = 'Return'
    
    def order_item_link(self, obj):
        """Display order item as clickable link."""
        if obj.order_item:
            url = reverse('admin:orders_orderitem_change', args=[obj.order_item.id])
            return format_html('<a href="{}">{}</a>', url, f"{obj.order_item.item_name} (Order: {obj.order_item.order.order_number})")
        return '-'
    order_item_link.short_description = 'Order Item'
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER']):
            return qs.filter(return_obj__status__in=['PENDING', 'APPROVED', 'PROCESSED'])
        elif request.user.is_customer():
            return qs.filter(return_obj__customer=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view return items (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Only OWNER and OPERATIONS can modify return items."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_add_permission(self, request):
        """Return items are managed through returns."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete return items."""
        return request.user.is_owner()


@admin.register(CustomerCredit)
class CustomerCreditAdmin(admin.ModelAdmin):
    """Admin interface for CustomerCredit model."""
    
    list_display = ('customer_link', 'balance', 'total_earned', 'total_used', 'updated_at')
    list_filter = ('updated_at',)
    search_fields = ('customer__email',)
    ordering = ('-balance',)
    readonly_fields = ('balance', 'total_earned', 'total_used', 'created_at', 'updated_at')
    
    def customer_link(self, obj):
        """Display customer as clickable link."""
        url = reverse('admin:authentication_customuser_change', args=[obj.customer.id])
        return format_html('<a href="{}">{}</a>', url, obj.customer.email)
    customer_link.short_description = 'Customer'
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER']):
            return qs.filter(balance__gt=0)
        elif request.user.is_customer():
            return qs.filter(customer=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view credits (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Only OWNER can modify credit accounts."""
        return request.user.is_owner()
    
    def has_add_permission(self, request):
        """Credit accounts are created automatically."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete credit accounts."""
        return request.user.is_owner()


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    """Admin interface for CreditTransaction model."""
    
    list_display = ('customer_link', 'transaction_type', 'amount_display', 'balance_before', 'balance_after', 'reference_info', 'created_at')
    list_filter = ('transaction_type', 'reference_type', 'created_at')
    search_fields = ('customer__email', 'description')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    def customer_link(self, obj):
        """Display customer as clickable link."""
        url = reverse('admin:authentication_customuser_change', args=[obj.customer.id])
        return format_html('<a href="{}">{}</a>', url, obj.customer.email)
    customer_link.short_description = 'Customer'
    
    def amount_display(self, obj):
        """Display amount with appropriate sign."""
        return obj.get_amount_display()
    amount_display.short_description = 'Amount'
    
    def reference_info(self, obj):
        """Display reference information."""
        if obj.reference_type and obj.reference_id:
            return f"{obj.reference_type} #{obj.reference_id}"
        return obj.reference_type or '-'
    reference_info.short_description = 'Reference'
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER']):
            return qs.filter(created_at__gte=timezone.now() - timezone.timedelta(days=30))
        elif request.user.is_customer():
            return qs.filter(customer=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view credit transactions (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Credit transactions cannot be modified."""
        return False
    
    def has_add_permission(self, request):
        """Credit transactions are created automatically."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete credit transactions."""
        return request.user.is_owner()
