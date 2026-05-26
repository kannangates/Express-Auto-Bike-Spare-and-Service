from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import CustomerOrder, OrderItem


class OrderItemInline(admin.TabularInline):
    """Inline admin for OrderItem."""
    model = OrderItem
    extra = 0
    readonly_fields = ('barcode', 'item_name', 'total_price', 'created_at')
    fields = ('item', 'barcode', 'item_name', 'quantity', 'unit_price', 'total_price')
    
    def get_queryset(self, request):
        """Return all order items."""
        return super().get_queryset(request)


@admin.register(CustomerOrder)
class CustomerOrderAdmin(admin.ModelAdmin):
    """Admin interface for CustomerOrder model."""
    
    list_display = ('order_number', 'customer_link', 'status', 'total_amount', 'payment_status', 'item_count', 'created_at')
    list_filter = ('status', 'payment_status', 'created_at', 'created_by')
    search_fields = ('order_number', 'customer__email', 'notes')
    ordering = ('-created_at',)
    readonly_fields = ('order_number', 'created_at', 'updated_at', 'created_by', 'subtotal', 'tax_amount', 'total_amount')
    inlines = [OrderItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'customer', 'status', 'notes')
        }),
        ('Financial Details', {
            'fields': ('subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total_amount')
        }),
        ('Payment Information', {
            'fields': ('payment_method', 'payment_status', 'payment_reference')
        }),
        ('Shipping Information', {
            'fields': ('shipped_at', 'delivered_at')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
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
    
    def item_count(self, obj):
        """Return count of items in order."""
        return obj.get_item_count()
    item_count.short_description = 'Items'
    
    def save_model(self, request, obj, form, change):
        """Set created_by and log changes."""
        if not change:
            obj.created_by = request.user
        
        # Track status changes for notifications
        old_status = None
        if change:
            old_obj = CustomerOrder.objects.get(pk=obj.pk)
            old_status = old_obj.status
        
        super().save_model(request, obj, form, change)
        
        # Send notification if status changed
        if change and old_status and old_status != obj.status:
            from notifications.models import Notification
            Notification.create_order_status_notification(obj, old_status, obj.status)
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER']):
            return qs.filter(status__in=['PENDING', 'CONFIRMED', 'PROCESSING'])
        elif request.user.has_role_permission(['DELIVERY']):
            return qs.filter(status__in=['PROCESSING', 'SHIPPED'])
        elif request.user.is_customer():
            return qs.filter(customer=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view orders (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Role-based change permissions."""
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return True
        elif request.user.has_role_permission(['CASHIER']) and obj:
            return obj.status in ['PENDING', 'CONFIRMED']
        elif request.user.has_role_permission(['DELIVERY']) and obj:
            return obj.status in ['PROCESSING', 'SHIPPED']
        return False
    
    def has_add_permission(self, request):
        """OWNER, OPERATIONS, and CASHIER can create orders."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS', 'CASHIER'])
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete orders."""
        return request.user.is_owner()


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    """Admin interface for OrderItem model."""
    
    list_display = ('order_link', 'item_link', 'barcode', 'quantity', 'unit_price', 'total_price', 'created_at')
    list_filter = ('created_at', 'order__status')
    search_fields = ('order__order_number', 'item__name', 'barcode', 'item_name')
    ordering = ('-created_at',)
    readonly_fields = ('barcode', 'item_name', 'total_price', 'created_at')
    
    def order_link(self, obj):
        """Display order as clickable link."""
        url = reverse('admin:orders_customerorder_change', args=[obj.order.id])
        return format_html('<a href="{}">{}</a>', url, obj.order.order_number)
    order_link.short_description = 'Order'
    
    def item_link(self, obj):
        """Display item as clickable link."""
        if obj.item:
            url = reverse('admin:inventory_inventoryitem_change', args=[obj.item.id])
            return format_html('<a href="{}">{}</a>', url, obj.item.name)
        return obj.item_name
    item_link.short_description = 'Item'
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER', 'DELIVERY']):
            return qs.filter(order__status__in=['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'])
        elif request.user.is_customer():
            return qs.filter(order__customer=request.user)
        return qs.none()
    
    def has_module_permission(self, request):
        """All authenticated users can view order items (filtered by role)."""
        return request.user.is_authenticated
    
    def has_change_permission(self, request, obj=None):
        """Only OWNER and OPERATIONS can modify order items."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_add_permission(self, request):
        """Order items are managed through orders."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete order items."""
        return request.user.is_owner()
