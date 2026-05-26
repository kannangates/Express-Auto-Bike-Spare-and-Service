'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import BarcodeInput from '../barcode/BarcodeInput';
import { useInventoryBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { InventoryItem, CreateInventoryItemRequest, UpdateInventoryItemRequest } from '../../types';
import { validateBarcode } from '../../utils/barcodeValidation';

interface InventoryFormProps {
  item?: InventoryItem;
  onSubmit: (data: CreateInventoryItemRequest | UpdateInventoryItemRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  categories?: Array<{ id: number; name: string }>;
}

interface FormData {
  barcode: string;
  name: string;
  description: string;
  categoryId: number | '';
  unitPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
}

const InventoryForm: React.FC<InventoryFormProps> = ({
  item,
  onSubmit,
  onCancel,
  loading = false,
  categories = [],
}) => {
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      barcode: item?.barcode || '',
      name: item?.name || '',
      description: item?.description || '',
      categoryId: item?.categoryId || '',
      unitPrice: item?.unitPrice || 0,
      stockQuantity: item?.stockQuantity || 0,
      minStockLevel: item?.minStockLevel || 10,
      maxStockLevel: item?.maxStockLevel || 100,
    },
  });

  const barcodeValue = watch('barcode');

  // Initialize barcode scanner
  const _scanner = useInventoryBarcodeScanner({
    onScanSuccess: (result) => {
      if (result.isValid) {
        setValue('barcode', result.decodedText);
        setBarcodeError(null);
      } else {
        setBarcodeError(result.validationError || 'Invalid barcode');
      }
    },
    onScanError: (error) => {
      setBarcodeError(error);
    },
  });

  // Handle barcode input change
  const handleBarcodeChange = (value: string, _format?: string) => {
    setValue('barcode', value);

    if (value.trim()) {
      const validation = validateBarcode(value);
      if (!validation.isValid) {
        setBarcodeError(validation.error || 'Invalid barcode format');
      } else {
        setBarcodeError(null);
      }
    } else {
      setBarcodeError(null);
    }
  };

  // Handle barcode validation change
  const handleBarcodeValidation = (isValid: boolean, error?: string) => {
    setBarcodeError(error || null);
  };

  // Handle form submission
  const onFormSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      // Validate barcode is required
      if (!data.barcode.trim()) {
        setBarcodeError('Barcode is required for inventory items');
        return;
      }

      // Final barcode validation
      const barcodeValidation = validateBarcode(data.barcode);
      if (!barcodeValidation.isValid) {
        setBarcodeError(barcodeValidation.error || 'Invalid barcode');
        return;
      }

      // Prepare submission data
      const submissionData = {
        ...data,
        categoryId: data.categoryId === '' ? undefined : Number(data.categoryId),
        unitPrice: Number(data.unitPrice),
        stockQuantity: Number(data.stockQuantity),
        minStockLevel: Number(data.minStockLevel),
        maxStockLevel: data.maxStockLevel ? Number(data.maxStockLevel) : undefined,
      };

      await onSubmit(submissionData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when item changes
  React.useEffect(() => {
    if (item) {
      setValue('barcode', item.barcode ?? '');
      setValue('name', item.name);
      setValue('description', item.description || '');
      setValue('categoryId', item.categoryId || '');
      setValue('unitPrice', item.unitPrice);
      setValue('stockQuantity', item.stockQuantity);
      setValue('minStockLevel', item.minStockLevel);
      setValue('maxStockLevel', item.maxStockLevel || 100);
    }
  }, [item, setValue]);

  const isEditing = !!item;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          {isEditing ? 'Edit Inventory Item' : 'Add New Inventory Item'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {isEditing
            ? 'Update the inventory item details below.'
            : 'Scan or enter a barcode to add a new inventory item.'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
        {/* Barcode Input - Required */}
        <div>
          <BarcodeInput
            label="Barcode *"
            value={barcodeValue}
            onChange={handleBarcodeChange}
            onValidationChange={handleBarcodeValidation}
            placeholder="Scan or enter barcode..."
            required
            disabled={loading || isSubmitting || isEditing} // Disable barcode editing for existing items
            error={barcodeError || undefined}
            showScanner={!isEditing} // Only show scanner for new items
            autoFocus={!isEditing}
          />
          {isEditing && (
            <p className="mt-1 text-xs text-gray-500">
              Barcode cannot be changed for existing items
            </p>
          )}
        </div>

        {/* Item Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Item Name *
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Item name is required',
              maxLength: { value: 200, message: 'Name cannot exceed 200 characters' }
            })}
            className={`
              block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
              ${errors.name
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }
            `}
            placeholder="Enter item name..."
            disabled={loading || isSubmitting}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            {...register('description', {
              maxLength: { value: 1000, message: 'Description cannot exceed 1000 characters' }
            })}
            rows={3}
            className={`
              block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
              ${errors.description
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }
            `}
            placeholder="Enter item description..."
            disabled={loading || isSubmitting}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            {...register('categoryId')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={loading || isSubmitting}
          >
            <option value="">Select a category...</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Price and Stock Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Price *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">₹</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('unitPrice', {
                  required: 'Unit price is required',
                  min: { value: 0, message: 'Price cannot be negative' },
                  valueAsNumber: true
                })}
                className={`
                  block w-full pl-7 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
                  ${errors.unitPrice
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }
                `}
                placeholder="0.00"
                disabled={loading || isSubmitting}
              />
            </div>
            {errors.unitPrice && (
              <p className="mt-1 text-sm text-red-600">{errors.unitPrice.message}</p>
            )}
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock Quantity *
            </label>
            <input
              type="number"
              min="0"
              {...register('stockQuantity', {
                required: 'Stock quantity is required',
                min: { value: 0, message: 'Stock cannot be negative' },
                valueAsNumber: true
              })}
              className={`
                block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
                ${errors.stockQuantity
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }
              `}
              placeholder="0"
              disabled={loading || isSubmitting}
            />
            {errors.stockQuantity && (
              <p className="mt-1 text-sm text-red-600">{errors.stockQuantity.message}</p>
            )}
          </div>
        </div>

        {/* Stock Level Thresholds */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minimum Stock Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Stock Level *
            </label>
            <input
              type="number"
              min="0"
              {...register('minStockLevel', {
                required: 'Minimum stock level is required',
                min: { value: 0, message: 'Minimum stock cannot be negative' },
                valueAsNumber: true
              })}
              className={`
                block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
                ${errors.minStockLevel
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }
              `}
              placeholder="10"
              disabled={loading || isSubmitting}
            />
            {errors.minStockLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.minStockLevel.message}</p>
            )}
          </div>

          {/* Maximum Stock Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Stock Level
            </label>
            <input
              type="number"
              min="0"
              {...register('maxStockLevel', {
                min: { value: 0, message: 'Maximum stock cannot be negative' },
                valueAsNumber: true
              })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="100"
              disabled={loading || isSubmitting}
            />
            {errors.maxStockLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.maxStockLevel.message}</p>
            )}
          </div>
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
            disabled={loading || isSubmitting || !!barcodeError || !barcodeValue.trim()}
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
              isEditing ? 'Update Item' : 'Create Item'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InventoryForm;