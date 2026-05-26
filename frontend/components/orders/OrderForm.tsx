'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import BarcodeInput from '../barcode/BarcodeInput';
import { useOrderBarcodeScanner } from '../../hooks/useBarcodeScanner';
import {
  Order,
  CreateOrderRequest,
  CreateOrderItemRequest,
  InventoryItem,
  User
} from '../../types';
import { PAYMENT_METHODS } from '../../shared/constants';
import { validateBarcode } from '../../utils/barcodeValidation';

interface OrderFormProps {
  order?: Order;
  onSubmit: (data: CreateOrderRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  customers?: User[];
  onLookupItem?: (barcode: string) => Promise<InventoryItem | null>;
}

interface OrderItemForm extends CreateOrderItemRequest {
  id?: string;
  itemName?: string;
  availableStock?: number;
  totalPrice?: number;
}

interface FormData {
  customerId: number | '';
  items: OrderItemForm[];
  paymentMethod: string;
  taxRate: number;
  discountAmount: number;
  notes: string;
}

const OrderForm: React.FC<OrderFormProps> = ({
  order,
  onSubmit,
  onCancel,
  loading = false,
  customers = [],
  onLookupItem,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemLookupLoading, setItemLookupLoading] = useState<string | null>(null);
  const [currentBarcodeInput, setCurrentBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      customerId: order?.customerId || '',
      items: order?.items?.map(item => ({
        barcode: item.barcode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemName: item.itemName,
        totalPrice: item.totalPrice,
      })) || [],
      paymentMethod: order?.paymentMethod || PAYMENT_METHODS.CASH,
      taxRate: order?.taxRate || 0.18, // 18% GST
      discountAmount: order?.discountAmount || 0,
      notes: order?.notes || '',
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const watchedTaxRate = watch('taxRate');
  const watchedDiscountAmount = watch('discountAmount');

  // Initialize barcode scanner
  const _scanner = useOrderBarcodeScanner({
    onScanSuccess: async (result) => {
      if (result.isValid) {
        await handleBarcodeScanned(result.decodedText);
        setBarcodeError(null);
      } else {
        setBarcodeError(result.validationError || 'Invalid barcode');
      }
    },
    onScanError: (error) => {
      setBarcodeError(error);
    },
  });

  // Handle barcode scanned or entered
  const handleBarcodeScanned = async (barcode: string) => {
    if (!onLookupItem) {
      setBarcodeError('Item lookup service not available');
      return;
    }

    try {
      setItemLookupLoading(barcode);
      setBarcodeError(null);

      // Check if item already exists in the order
      const existingItemIndex = watchedItems.findIndex(item => item.barcode === barcode);

      if (existingItemIndex >= 0) {
        // Increment quantity of existing item
        const existingItem = watchedItems[existingItemIndex];
        if (!existingItem) return;
        const newQuantity = (existingItem.quantity ?? 0) + 1;
        const newTotalPrice = newQuantity * (existingItem.unitPrice ?? 0);

        update(existingItemIndex, {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: newTotalPrice,
        });

        setCurrentBarcodeInput('');
        return;
      }

      // Lookup item details
      const item = await onLookupItem(barcode);

      if (!item) {
        setBarcodeError('Item not found. Please check the barcode and try again.');
        return;
      }

      if (!item.isActive) {
        setBarcodeError('This item is not active and cannot be ordered.');
        return;
      }

      if (item.stockQuantity <= 0) {
        setBarcodeError('This item is out of stock.');
        return;
      }

      // Add new item to order
      append({
        barcode: item.barcode,
        quantity: 1,
        unitPrice: item.unitPrice,
        itemName: item.name,
        availableStock: item.stockQuantity,
        totalPrice: item.unitPrice,
      });

      setCurrentBarcodeInput('');
    } catch (error) {
      console.error('Item lookup error:', error);
      setBarcodeError('Failed to lookup item. Please try again.');
    } finally {
      setItemLookupLoading(null);
    }
  };

  // Handle barcode input change
  const handleBarcodeInputChange = (value: string) => {
    setCurrentBarcodeInput(value);
    setBarcodeError(null);
  };

  // Handle manual barcode entry
  const handleManualBarcodeEntry = async () => {
    if (!currentBarcodeInput.trim()) return;

    const validation = validateBarcode(currentBarcodeInput);
    if (!validation.isValid) {
      setBarcodeError(validation.error || 'Invalid barcode format');
      return;
    }

    await handleBarcodeScanned(currentBarcodeInput);
  };

  // Update item quantity
  const updateItemQuantity = (index: number, quantity: number) => {
    const item = watchedItems[index];
    if (!item || quantity < 0) return;

    if (quantity === 0) {
      remove(index);
      return;
    }

    if (item.availableStock && quantity > item.availableStock) {
      alert(`Only ${item.availableStock} units available in stock`);
      return;
    }

    const newTotalPrice = quantity * item.unitPrice!;
    update(index, {
      ...item,
      quantity,
      totalPrice: newTotalPrice,
    });
  };

  // Calculate order totals
  const calculateTotals = () => {
    const subtotal = watchedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const taxAmount = subtotal * (watchedTaxRate || 0);
    const total = subtotal + taxAmount - (watchedDiscountAmount || 0);

    return {
      subtotal,
      taxAmount,
      total: Math.max(0, total), // Ensure total is not negative
    };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  // Handle form submission
  const onFormSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      if (data.items.length === 0) {
        alert('Please add at least one item to the order');
        return;
      }

      // Validate all items have valid quantities
      const invalidItems = data.items.filter(item => !item.quantity || item.quantity <= 0);
      if (invalidItems.length > 0) {
        alert('All items must have a quantity greater than 0');
        return;
      }

      // Prepare submission data
      const submissionData: CreateOrderRequest = {
        customerId: data.customerId === '' ? undefined : Number(data.customerId),
        items: data.items.map(item => ({
          barcode: item.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        paymentMethod: data.paymentMethod,
        taxRate: data.taxRate,
        discountAmount: data.discountAmount,
        notes: data.notes,
      };

      await onSubmit(submissionData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!order;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          {isEditing ? 'Edit Order' : 'Create New Order'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Scan barcodes to add items to the order quickly and accurately.
        </p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
        {/* Customer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer
          </label>
          <select
            {...register('customerId')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={loading || isSubmitting}
          >
            <option value="">Walk-in Customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.profile?.firstName && customer.profile?.lastName
                  ? `${customer.profile.firstName} ${customer.profile.lastName} (${customer.email})`
                  : customer.email
                }
              </option>
            ))}
          </select>
        </div>

        {/* Barcode Scanner Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Add Items by Barcode</h4>
          <div className="flex space-x-3">
            <div className="flex-1">
              <BarcodeInput
                value={currentBarcodeInput}
                onChange={handleBarcodeInputChange}
                placeholder="Scan or enter barcode to add item..."
                disabled={loading || isSubmitting || !!itemLookupLoading}
                error={barcodeError || undefined}
                showScanner={true}
                allowManualInput={true}
              />
            </div>
            <button
              type="button"
              onClick={handleManualBarcodeEntry}
              disabled={!currentBarcodeInput.trim() || loading || isSubmitting || !!itemLookupLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {itemLookupLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Looking up...
                </>
              ) : (
                'Add Item'
              )}
            </button>
          </div>
        </div>

        {/* Order Items */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Order Items</h4>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="mt-2">No items added yet</p>
              <p className="text-sm">Scan or enter barcodes to add items to the order</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const item = watchedItems[index];
                return (
                  <div key={field.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item?.itemName || 'Unknown Item'}</div>
                      <div className="text-sm text-gray-500">Barcode: {item?.barcode}</div>
                      {item?.availableStock && (
                        <div className="text-xs text-gray-400">Available: {item.availableStock} units</div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => updateItemQuantity(index, (item?.quantity || 1) - 1)}
                        disabled={loading || isSubmitting}
                        className="inline-flex items-center justify-center w-8 h-8 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>

                      <span className="w-12 text-center font-medium">{item?.quantity || 0}</span>

                      <button
                        type="button"
                        onClick={() => updateItemQuantity(index, (item?.quantity || 0) + 1)}
                        disabled={loading || isSubmitting || !!(item?.availableStock && (item.quantity ?? 0) >= item.availableStock)}
                        className="inline-flex items-center justify-center w-8 h-8 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">₹{item?.unitPrice?.toFixed(2) || '0.00'}</div>
                      <div className="text-sm text-gray-500">₹{item?.totalPrice?.toFixed(2) || '0.00'}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={loading || isSubmitting}
                      className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:bg-red-50 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Summary */}
        {fields.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Order Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({((watchedTaxRate || 0) * 100).toFixed(1)}%):</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
              {watchedDiscountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-₹{watchedDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-lg border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment and Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              {...register('paymentMethod')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={loading || isSubmitting}
            >
              {Object.entries(PAYMENT_METHODS).map(([key, value]) => (
                <option key={key} value={value}>
                  {value.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Tax Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register('taxRate', {
                min: { value: 0, message: 'Tax rate cannot be negative' },
                max: { value: 100, message: 'Tax rate cannot exceed 100%' },
                valueAsNumber: true
              })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="18.00"
              disabled={loading || isSubmitting}
            />
            {errors.taxRate && (
              <p className="mt-1 text-sm text-red-600">{errors.taxRate.message}</p>
            )}
          </div>
        </div>

        {/* Discount Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discount Amount
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">₹</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('discountAmount', {
                min: { value: 0, message: 'Discount cannot be negative' },
                valueAsNumber: true
              })}
              className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="0.00"
              disabled={loading || isSubmitting}
            />
          </div>
          {errors.discountAmount && (
            <p className="mt-1 text-sm text-red-600">{errors.discountAmount.message}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Add any additional notes for this order..."
            disabled={loading || isSubmitting}
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || isSubmitting || fields.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                {isEditing ? 'Update Order' : 'Create Order'}
                {fields.length > 0 && (
                  <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                    ₹{total.toFixed(2)}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderForm;