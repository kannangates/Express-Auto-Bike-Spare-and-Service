"""
API views for inventory management.

Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 4.7 for inventory management,
barcode scanning integration, and stock tracking.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, F
from django.shortcuts import get_object_or_404

from .models import InventoryCategory, InventoryItem, StockTransaction
from .serializers import (
    InventoryCategorySerializer, InventoryItemSerializer, StockTransactionSerializer,
    StockAdjustmentSerializer, BarcodeValidationSerializer, LowStockAlertSerializer
)
from authentication.permissions import OperationsPermission, CashierPermission


class InventoryCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for inventory category management.
    
    Implements Requirements 4.1 for inventory organization.
    """
    queryset = InventoryCategory.objects.filter(is_active=True)
    serializer_class = InventoryCategorySerializer
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['parent', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Filter categories based on user permissions."""
        queryset = super().get_queryset()
        
        # Add any additional filtering based on user role if needed
        return queryset
    
    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get child categories."""
        category = self.get_object()
        children = category.children.filter(is_active=True)
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Get items in this category."""
        category = self.get_object()
        items = category.items.filter(is_active=True)
        serializer = InventoryItemSerializer(items, many=True)
        return Response(serializer.data)


class InventoryItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for inventory item management with barcode integration.

    Implements Requirements 4.1, 4.2, 4.3 for inventory management and barcode scanning.
    """
    queryset = InventoryItem.objects.select_related('category', 'created_by').filter(is_active=True)
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'description', 'barcode']
    ordering_fields = ['name', 'stock_quantity', 'unit_price', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Filter items with additional query parameters."""
        queryset = super().get_queryset()
        
        # Filter by stock status
        stock_status = self.request.query_params.get('stock_status')
        if stock_status == 'low':
            queryset = queryset.filter(stock_quantity__lte=F('min_stock_level'))
        elif stock_status == 'out':
            queryset = queryset.filter(stock_quantity=0)
        elif stock_status == 'in_stock':
            queryset = queryset.filter(stock_quantity__gt=F('min_stock_level'))
        
        # Filter by barcode
        barcode = self.request.query_params.get('barcode')
        if barcode:
            queryset = queryset.filter(barcode__icontains=barcode)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set created_by field when creating inventory item."""
        serializer.save(created_by=self.request.user)
    
    def perform_destroy(self, instance):
        """Perform soft delete by setting is_active to False."""
        instance.is_active = False
        instance.save()
    
    @action(detail=True, methods=['get'])
    def stock_history(self, request, pk=None):
        """Get stock transaction history for item."""
        item = self.get_object()
        transactions = item.stock_transactions.all()[:50]  # Last 50 transactions
        serializer = StockTransactionSerializer(transactions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get items with low stock levels (cached 30s — staleness acceptable)."""
        from django.core.cache import cache
        cache_key = 'inventory:low_stock_alert'
        # Note: this cache is invalidated in InventoryItem.update_stock()
        data = cache.get(cache_key)
        if data is None:
            items = self.get_queryset().filter(stock_quantity__lte=F('min_stock_level'))
            serializer = LowStockAlertSerializer([{'item': item} for item in items], many=True)
            data = serializer.data
            cache.set(cache_key, data, timeout=30)
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        """Manually adjust stock levels."""
        item = self.get_object()
        serializer = StockAdjustmentSerializer(data=request.data)
        
        if serializer.is_valid():
            adjustment_type = serializer.validated_data['adjustment_type']
            quantity = serializer.validated_data['quantity']
            notes = serializer.validated_data.get('notes', '')
            
            try:
                if adjustment_type == 'SET':
                    # Set stock to specific quantity
                    quantity_change = quantity - item.stock_quantity
                elif adjustment_type == 'ADD':
                    # Add to current stock
                    quantity_change = quantity
                elif adjustment_type == 'SUBTRACT':
                    # Subtract from current stock
                    quantity_change = -quantity
                
                new_stock = item.update_stock(
                    quantity_change=quantity_change,
                    transaction_type='ADJUSTMENT',
                    reference_type='ADJUSTMENT',
                    notes=notes,
                    user=request.user
                )
                
                return Response({
                    'message': 'Stock adjusted successfully',
                    'previous_stock': item.stock_quantity - quantity_change,
                    'new_stock': new_stock,
                    'adjustment': quantity_change
                })
                
            except ValueError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StockTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for stock transaction history (read-only).
    
    Implements Requirements 4.6, 4.7 for inventory transaction tracking.
    """
    queryset = StockTransaction.objects.select_related('item', 'created_by')
    serializer_class = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['item', 'transaction_type', 'reference_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter transactions with additional parameters."""
        queryset = super().get_queryset()
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        
        return queryset


class BarcodeValidationView(APIView):
    """
    API view for barcode validation.
    
    Implements Requirements 3.4, 3.5 for barcode format validation.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request):
        """Validate barcode format and existence."""
        serializer = BarcodeValidationSerializer(data=request.data)
        
        if serializer.is_valid():
            barcode = serializer.validated_data['barcode']
            
            try:
                item = InventoryItem.objects.get(barcode=barcode, is_active=True)
                item_serializer = InventoryItemSerializer(item)
                
                return Response({
                    'valid': True,
                    'item': item_serializer.data,
                    'message': 'Barcode is valid'
                })
                
            except InventoryItem.DoesNotExist:
                return Response({
                    'valid': False,
                    'item': None,
                    'message': 'Item with this barcode not found'
                }, status=status.HTTP_404_NOT_FOUND)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StockAdjustmentView(APIView):
    """
    API view for manual stock adjustments.
    
    Implements Requirement 4.7 for manual inventory adjustments.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request, pk):
        """Adjust stock for specific inventory item."""
        item = get_object_or_404(InventoryItem, pk=pk, is_active=True)
        serializer = StockAdjustmentSerializer(data=request.data)
        
        if serializer.is_valid():
            adjustment_type = serializer.validated_data['adjustment_type']
            quantity = serializer.validated_data['quantity']
            notes = serializer.validated_data.get('notes', '')
            
            try:
                if adjustment_type == 'SET':
                    quantity_change = quantity - item.stock_quantity
                elif adjustment_type == 'ADD':
                    quantity_change = quantity
                elif adjustment_type == 'SUBTRACT':
                    quantity_change = -quantity
                
                previous_stock = item.stock_quantity
                new_stock = item.update_stock(
                    quantity_change=quantity_change,
                    transaction_type='ADJUSTMENT',
                    reference_type='ADJUSTMENT',
                    notes=notes,
                    user=request.user
                )
                
                return Response({
                    'message': 'Stock adjusted successfully',
                    'item_id': item.id,
                    'barcode': item.barcode,
                    'item_name': item.name,
                    'previous_stock': previous_stock,
                    'new_stock': new_stock,
                    'adjustment': quantity_change
                })
                
            except ValueError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LowStockAlertView(APIView):
    """
    API view for low stock alerts.
    
    Implements Requirement 4.4 for low stock alert generation.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def get(self, request):
        """Get all items with low stock levels."""
        from django.db import models
        
        low_stock_items = InventoryItem.objects.filter(
            is_active=True,
            stock_quantity__lte=F('min_stock_level')
        ).order_by('stock_quantity')
        
        alert_data = []
        for item in low_stock_items:
            alert_data.append({
                'item': item,
                'alert_level': 'CRITICAL' if item.is_out_of_stock() else 'HIGH' if item.stock_quantity <= item.min_stock_level * 0.5 else 'MEDIUM',
                'recommended_order_quantity': (item.max_stock_level - item.stock_quantity) if item.max_stock_level else (item.min_stock_level * 2)
            })
        
        serializer = LowStockAlertSerializer(alert_data, many=True)
        return Response(serializer.data)


class BulkInventoryOperationView(APIView):
    """
    API view for bulk inventory operations.
    
    Implements Requirement 4.5 for bulk inventory updates.
    """
    permission_classes = [permissions.IsAuthenticated, OperationsPermission]
    
    def post(self, request):
        """Perform bulk inventory operations."""
        operation = request.data.get('operation')
        items_data = request.data.get('items', [])
        
        if not operation or not items_data:
            return Response(
                {'error': 'Operation and items data are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        errors = []
        
        for item_data in items_data:
            try:
                barcode = item_data.get('barcode')
                if not barcode:
                    errors.append({'error': 'Barcode is required for each item'})
                    continue
                
                item = InventoryItem.objects.get(barcode=barcode, is_active=True)
                
                if operation == 'update_prices':
                    new_price = item_data.get('unit_price')
                    if new_price:
                        item.unit_price = new_price
                        item.save()
                        results.append({
                            'barcode': barcode,
                            'operation': 'price_updated',
                            'new_price': new_price
                        })
                
                elif operation == 'adjust_stock':
                    quantity_change = item_data.get('quantity_change', 0)
                    notes = item_data.get('notes', 'Bulk stock adjustment')
                    
                    new_stock = item.update_stock(
                        quantity_change=quantity_change,
                        transaction_type='ADJUSTMENT',
                        reference_type='ADJUSTMENT',
                        notes=notes,
                        user=request.user
                    )
                    
                    results.append({
                        'barcode': barcode,
                        'operation': 'stock_adjusted',
                        'new_stock': new_stock,
                        'change': quantity_change
                    })
                
            except InventoryItem.DoesNotExist:
                errors.append({
                    'barcode': barcode,
                    'error': 'Item not found'
                })
            except Exception as e:
                errors.append({
                    'barcode': barcode,
                    'error': str(e)
                })
        
        return Response({
            'results': results,
            'errors': errors,
            'total_processed': len(results),
            'total_errors': len(errors)
        })


class BarcodeScanItemView(APIView):
    """
    API view for barcode scanning to get item information.
    
    Implements Requirements 3.2, 4.2 for barcode scanning integration.
    """
    permission_classes = [permissions.IsAuthenticated, CashierPermission]
    
    def post(self, request):
        """Scan barcode and return item information."""
        barcode = request.data.get('barcode')
        
        if not barcode:
            return Response(
                {'error': 'Barcode is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            item = InventoryItem.objects.get(barcode=barcode, is_active=True)
            serializer = InventoryItemSerializer(item)
            
            return Response({
                'success': True,
                'item': serializer.data,
                'stock_status': item.get_stock_status(),
                'can_order': item.stock_quantity > 0
            })
            
        except InventoryItem.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Item with this barcode not found',
                'barcode': barcode
            }, status=status.HTTP_404_NOT_FOUND)


class BarcodeScanValidateView(APIView):
    """
    API view for barcode format validation only.
    
    Implements Requirements 3.4, 3.5 for barcode format validation.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Validate barcode format without checking existence."""
        serializer = BarcodeValidationSerializer(data=request.data)
        
        if serializer.is_valid():
            return Response({
                'valid': True,
                'barcode': serializer.validated_data['barcode'],
                'message': 'Barcode format is valid'
            })
        
        return Response({
            'valid': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
