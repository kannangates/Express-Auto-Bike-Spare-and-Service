from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Q
from .models import InventoryCategory, InventoryItem, StockTransaction


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    """Admin interface for InventoryCategory model."""
    
    list_display = ('name', 'parent', 'is_active', 'item_count', 'created_at')
    list_filter = ('is_active', 'parent', 'created_at')
    search_fields = ('name', 'description')
    ordering = ('name',)
    readonly_fields = ('created_at', 'updated_at')
    
    def item_count(self, obj):
        """Return count of items in this category."""
        return obj.items.filter(is_active=True).count()
    item_count.short_description = 'Active Items'
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        return qs.none()
    
    def has_module_permission(self, request):
        """Only OWNER and OPERATIONS can access categories."""
        return request.user.is_authenticated and request.user.has_role_permission(['OWNER', 'OPERATIONS'])


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    """Admin interface for InventoryItem model."""
    
    list_display = ('name', 'barcode', 'category', 'unit_price', 'stock_quantity', 'stock_status', 'is_active', 'created_at')
    list_filter = ('is_active', 'category', 'created_at', 'created_by')
    search_fields = ('name', 'barcode', 'description')
    ordering = ('name',)
    readonly_fields = ('created_at', 'updated_at', 'created_by')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('barcode', 'name', 'description', 'category', 'is_active')
        }),
        ('Pricing', {
            'fields': ('unit_price',)
        }),
        ('Stock Management', {
            'fields': ('stock_quantity', 'min_stock_level', 'max_stock_level')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def stock_status(self, obj):
        """Display stock status with color coding."""
        status = obj.get_stock_status()
        if status == 'OUT_OF_STOCK':
            return format_html('<span style="color: red; font-weight: bold;">OUT OF STOCK</span>')
        elif status == 'LOW_STOCK':
            return format_html('<span style="color: orange; font-weight: bold;">LOW STOCK</span>')
        else:
            return format_html('<span style="color: green;">IN STOCK</span>')
    stock_status.short_description = 'Stock Status'
    
    def save_model(self, request, obj, form, change):
        """Set created_by and trigger low stock alerts."""
        if not change:
            obj.created_by = request.user
        
        # Check if stock was updated and is now low
        old_stock = None
        if change:
            old_obj = InventoryItem.objects.get(pk=obj.pk)
            old_stock = old_obj.stock_quantity
        
        super().save_model(request, obj, form, change)
        
        # Trigger low stock alert if needed
        if obj.is_low_stock() and (not change or old_stock > obj.min_stock_level):
            from notifications.models import Notification
            Notification.create_low_stock_alert(obj)
    
    def get_queryset(self, request):
        """Filter based on user role."""
        qs = super().get_queryset(request)
        if request.user.has_role_permission(['OWNER', 'OPERATIONS']):
            return qs
        elif request.user.has_role_permission(['CASHIER']):
            return qs.filter(is_active=True)
        return qs.none()
    
    def has_module_permission(self, request):
        """OWNER, OPERATIONS, and CASHIER can access inventory."""
        return request.user.is_authenticated and request.user.has_role_permission(['OWNER', 'OPERATIONS', 'CASHIER'])
    
    def has_change_permission(self, request, obj=None):
        """Only OWNER and OPERATIONS can modify inventory."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_add_permission(self, request):
        """Only OWNER and OPERATIONS can add inventory."""
        return request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete inventory."""
        return request.user.is_owner()


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    """Admin interface for StockTransaction model."""
    
    list_display = ('item', 'transaction_type', 'quantity_display', 'previous_stock', 'new_stock', 'reference_info', 'created_by', 'created_at')
    list_filter = ('transaction_type', 'reference_type', 'created_at', 'created_by')
    search_fields = ('item__name', 'item__barcode', 'notes')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    def quantity_display(self, obj):
        """Display quantity with appropriate sign."""
        return obj.get_quantity_display()
    quantity_display.short_description = 'Quantity Change'
    
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
        return qs.none()
    
    def has_module_permission(self, request):
        """Only OWNER and OPERATIONS can view stock transactions."""
        return request.user.is_authenticated and request.user.has_role_permission(['OWNER', 'OPERATIONS'])
    
    def has_add_permission(self, request):
        """Stock transactions are created automatically."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Stock transactions cannot be modified."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Only OWNER can delete stock transactions."""
        return request.user.is_owner()
