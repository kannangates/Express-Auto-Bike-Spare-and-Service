'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import BarcodeInput from '../barcode/BarcodeInput';
import { useReturnsBarcodeScanner } from '../../hooks/useBarcodeScanner';
import {
  Return,
  CreateReturnRequest,
  CreateReturnItemRequest,
  Order,
  OrderItem,
  User
} from '../../types';
import { ITEM_CONDITIONS } from '../../shared/constants';
import { validateBarcode } from '../../utils/barcodeValidation';

interface ReturnFormProps {
  returnItem?: Return;
  onSubmit: (data: CreateReturnRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  customers?: User[];
  onLookupOrder?: (orderNumber: string) => Promise<Order | null>;
  onLookupOrderItem?: (barcode: string, orderId?: number) => Promise<OrderItem | null>;
}

interface ReturnItemForm extends CreateReturnItemRequest {
  id?: string;
  barcode?: string;
  itemName?: string;
  unitPrice?: number;
  maxQuantity?: number;
  totalPrice?: number;
}

interface FormData {
  orderId: number | '';
  customerId: number | '';
  returnReason: string;
  returnReasonDetails: string;
  items: ReturnItemForm[];
  notes: string;
}

const RETURN_REASONS = [
  'Defective Product',
  'Wrong Item Received',
  'Damaged During Shipping',
  'Not as Described',
  'Changed Mind',
  'Duplicate Order',
  'Quality Issues',
  'Other',
];

const ReturnForm: React.FC<ReturnFormProps> = ({
  returnItem,
  onSubmit,
  onCancel,
  loading = false,
  customers = [],
  onLookupOrder,
  onLookupOrderItem,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [itemLookupLoading, setItemLookupLoading] = useState<string | null>(null);
  const [currentBarcodeInput, setCurrentBarcodeInput] = useState('');
  const [currentOrderNumber, setCurrentOrderNumber] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      orderId: returnItem?.orderId || '',
      customerId: returnItem?.customerId || '',
      returnReason: returnItem?.returnReason || '',
      returnReasonDetails: returnItem?.returnReasonDetails || '',
      items: returnItem?.items?.map(item => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        condition: item.condition,
        restockable: item.restockable,
        barcode: item.barcode,
        itemName: item.itemName,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })) || [],
      notes: returnItem?.notes || '',
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const watchedOrderId = watch('orderId');

  // Initialize barcode scanner
  const _scanner = useReturnsBarcodeScanner({
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

  // Handle order lookup
  const handleOrderLookup = async (orderNumber: string) => {
    if (!onLookupOrder || !orderNumber.trim()) return;

    try {
      setOrderLookupLoading(true);
      const order = await onLookupOrder(orderNumber.trim());

      if (!order) {
        alert('Order not found. Please check the order number and try again.');
        return;
      }

      setSelectedOrder(order);
      setValue('orderId', order.id);
      setValue('customerId', order.customerId || '');
      setCurrentOrderNumber('');
    } catch (error) {
      console.error('Order lookup error:', error);
      alert('Failed to lookup order. Please try again.');
    } finally {
      setOrderLookupLoading(false);
    }
  };

  // Handle barcode scanned or entered
  const handleBarcodeScanned = async (barcode: string) => {
    if (!onLookupOrderItem) {
      setBarcodeError('Item lookup service not available');
      return;
    }

    try {
      setItemLookupLoading(barcode);
      setBarcodeError(null);

      // Check if item already exists in the return
      const existingItemIndex = watchedItems.findIndex(item => item.barcode === barcode);

      if (existingItemIndex >= 0) {
        // Increment quantity of existing item (up to max available)
        const existingItem = watchedItems[existingItemIndex];
        if (!existingItem) return;
        const currentQty = existingItem.quantity ?? 0;
        const newQuantity = Math.min(
          currentQty + 1,
          existingItem.maxQuantity ?? currentQty + 1
        );

        if (newQuantity > currentQty) {
          const newTotalPrice = newQuantity * (existingItem.unitPrice ?? 0);

          update(existingItemIndex, {
            ...existingItem,
            quantity: newQuantity,
            totalPrice: newTotalPrice,
          });
        } else {
          setBarcodeError('Maximum returnable quantity already added for this item');
        }

        setCurrentBarcodeInput('');
        return;
      }

      // Lookup order item details
      const orderItem = await onLookupOrderItem(barcode, watchedOrderId || undefined);

      if (!orderItem) {
        setBarcodeError('Item not found in any order or not eligible for return.');
        return;
      }

      // Check if item is from the selected order (if order is specified)
      if (watchedOrderId && orderItem.orderId !== watchedOrderId) {
        setBarcodeError('This item is not from the selected order.');
        return;
      }

      // Add new item to return
      append({
        orderItemId: orderItem.id,
        quantity: 1,
        condition: ITEM_CONDITIONS.GOOD,
        restockable: true,
        barcode: orderItem.barcode,
        itemName: orderItem.itemName,
        unitPrice: orderItem.unitPrice,
        maxQuantity: orderItem.quantity,
        totalPrice: orderItem.unitPrice,
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

    if (item.maxQuantity && quantity > item.maxQuantity) {
      alert(`Only ${item.maxQuantity} units can be returned for this item`);
      return;
    }

    const newTotalPrice = quantity * (item.unitPrice || 0);
    update(index, {
      ...item,
      quantity,
      totalPrice: newTotalPrice,
    });
  };

  // Update item condition
  const updateItemCondition = (index: number, condition: string, restockable: boolean) => {
    const item = watchedItems[index];
    if (!item) return;

    update(index, {
      ...item,
      condition: condition as any,
      restockable,
    });
  };

  // Calculate return totals
  const calculateTotals = () => {
    const totalAmount = watchedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const totalItems = watchedItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      totalAmount,
      totalItems,
    };
  };

  const { totalAmount, totalItems } = calculateTotals();

  // Handle form submission
  const onFormSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      if (data.items.length === 0) {
        alert('Please add at least one item to the return');
        return;
      }

      // Validate all items have valid quantities and conditions
      const invalidItems = data.items.filter(
        item => !item.quantity || item.quantity <= 0 || !item.condition
      );
      if (invalidItems.length > 0) {
        alert('All items must have a quantity greater than 0 and a condition specified');
        return;
      }

      // Prepare submission data
      const submissionData: CreateReturnRequest = {
        orderId: data.orderId === '' ? undefined : Number(data.orderId),
        customerId: data.customerId === '' ? undefined : Number(data.customerId),
        returnReason: data.returnReason,
        returnReasonDetails: data.returnReasonDetails,
        items: data.items.map(item => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          condition: item.condition,
          restockable: item.restockable,
        })),
        notes: data.notes,
      };

      await onSubmit(submissionData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!returnItem;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          {isEditing ? 'Edit Return' : 'Process Return'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Scan barcodes to add items to the return and verify their condition.
        </p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
        {/* Order Lookup */}
        {!isEditing && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-900 mb-3">Order Lookup (Optional)</h4>
            <div className="flex space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={currentOrderNumber}
                  onChange={(e) => setCurrentOrderNumber(e.target.value)}
                  placeholder="Enter order number to lookup..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={loading || isSubmitting || orderLookupLoading}
                />
              </div>
              <button
                type="button"
                onClick={() => handleOrderLookup(currentOrderNumber)}
                disabled={!currentOrderNumber.trim() || loading || isSubmitting || orderLookupLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {orderLookupLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Looking up...
                  </>
                ) : (
                  'Lookup Order'
                )}
              </button>
            </div>
            {selectedOrder && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>Order Found:</strong> #{selectedOrder.orderNumber} - {selectedOrder.items?.length || 0} items
                  {selectedOrder.customer && (
                    <span className="ml-2">
                      ({selectedOrder.customer.profile?.firstName} {selectedOrder.customer.profile?.lastName} - {selectedOrder.customer.email})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Customer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer
          </label>
          <select
            {...register('customerId')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={loading || isSubmitting || !!selectedOrder?.customerId}
          >
            <option value="">Select Customer</option>
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

        {/* Return Reason */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Return Reason *
            </label>
            <select
              {...register('returnReason', { required: 'Return reason is required' })}
              className={`
                block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
                ${errors.returnReason
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }
              `}
              disabled={loading || isSubmitting}
            >
              <option value="">Select reason...</option>
              {RETURN_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            {errors.returnReason && (
              <p className="mt-1 text-sm text-red-600">{errors.returnReason.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Details
            </label>
            <input
              type="text"
              {...register('returnReasonDetails')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Additional details about the return..."
              disabled={loading || isSubmitting}
            />
          </div>
        </div>

        {/* Barcode Scanner Section */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-900 mb-3">Add Items by Barcode</h4>
          <div className="flex space-x-3">
            <div className="flex-1">
              <BarcodeInput
                value={currentBarcodeInput}
                onChange={handleBarcodeInputChange}
                placeholder="Scan or enter barcode to add return item..."
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
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Return Items */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Return Items</h4>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
              </svg>
              <p className="mt-2">No items added yet</p>
              <p className="text-sm">Scan or enter barcodes to add items to the return</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => {
                const item = watchedItems[index];
                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start space-x-4">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item?.itemName || 'Unknown Item'}</div>
                        <div className="text-sm text-gray-500">Barcode: {item?.barcode}</div>
                        {item?.maxQuantity && (
                          <div className="text-xs text-gray-400">Max returnable: {item.maxQuantity} units</div>
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
                          disabled={loading || isSubmitting || !!(item?.maxQuantity && (item.quantity ?? 0) >= item.maxQuantity)}
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

                    {/* Item Condition */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Item Condition *
                        </label>
                        <select
                          value={item?.condition || ''}
                          onChange={(e) => updateItemCondition(index, e.target.value, e.target.value === ITEM_CONDITIONS.NEW || e.target.value === ITEM_CONDITIONS.LIKE_NEW)}
                          className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          disabled={loading || isSubmitting}
                        >
                          <option value="">Select condition...</option>
                          {Object.entries(ITEM_CONDITIONS).map(([key, value]) => (
                            <option key={key} value={value}>
                              {value.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={item?.restockable || false}
                          onChange={(e) => updateItemCondition(index, item?.condition || ITEM_CONDITIONS.GOOD, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={loading || isSubmitting}
                        />
                        <label className="ml-2 block text-xs text-gray-700">
                          Restockable
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Return Summary */}
        {fields.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Return Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t border-gray-200 pt-2">
                <span>Total Amount:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Add any additional notes for this return..."
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
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isEditing ? 'Updating...' : 'Processing...'}
              </>
            ) : (
              <>
                {isEditing ? 'Update Return' : 'Process Return'}
                {fields.length > 0 && (
                  <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                    {totalItems} items
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

export default ReturnForm;