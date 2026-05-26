'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { BarcodeScanResult } from './BarcodeScanner';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

// Lazy-load the camera scanner — pulls in html5-qrcode only when modal opens.
const BarcodeScanner = dynamic(() => import('./BarcodeScanner'), { ssr: false });
import { formatBarcodeForDisplay, detectBarcodeFormat, getBarcodeFormatInfo } from '../../utils/barcodeValidation';
import { BARCODE_FORMATS } from '../../shared/constants';

export interface BarcodeInputProps {
  value?: string;
  onChange: (value: string, format?: string) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  supportedFormats?: string[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  showScanner?: boolean;
  showFormatInfo?: boolean;
  allowManualInput?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

const BarcodeInput: React.FC<BarcodeInputProps> = ({
  value = '',
  onChange,
  onValidationChange,
  supportedFormats = Object.values(BARCODE_FORMATS),
  placeholder = 'Enter or scan barcode...',
  label = 'Barcode',
  required = false,
  disabled = false,
  error,
  className = '',
  showScanner = true,
  showFormatInfo = true,
  allowManualInput = true,
  autoFocus = false,
  maxLength = 48,
}) => {
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize barcode scanner hook
  const scanner = useBarcodeScanner({
    supportedFormats,
    onScanSuccess: handleScanSuccess,
    onScanError: (error) => {
      console.warn('Barcode scan error:', error);
    },
  });

  // Handle successful scan
  function handleScanSuccess(result: BarcodeScanResult) {
    if (result.isValid) {
      setInputValue(result.decodedText);
      setDetectedFormat(result.format);
      onChange(result.decodedText, result.format);
      setShowScannerModal(false);

      // Validate and update state
      setIsValid(true);
      setValidationError(null);
      onValidationChange?.(true);
    } else {
      setValidationError(result.validationError || 'Invalid barcode');
      setIsValid(false);
      onValidationChange?.(false, result.validationError);
    }
  }

  // Handle manual input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    if (newValue.trim() === '') {
      setDetectedFormat(null);
      setIsValid(true);
      setValidationError(null);
      onChange('');
      onValidationChange?.(true);
      return;
    }

    // Detect format and validate
    const format = detectBarcodeFormat(newValue);
    setDetectedFormat(format);

    // Validate against supported formats
    const validation = scanner.validateManualInput(newValue, supportedFormats);
    setIsValid(validation.isValid);
    setValidationError(validation.error || null);

    onChange(newValue, format || undefined);
    onValidationChange?.(validation.isValid, validation.error);
  }, [onChange, onValidationChange, scanner, supportedFormats]);

  // Handle input blur (format validation)
  const handleInputBlur = useCallback(() => {
    if (inputValue.trim() && detectedFormat) {
      // Format the display value
      const formattedValue = formatBarcodeForDisplay(inputValue, detectedFormat);
      if (formattedValue !== inputValue) {
        setInputValue(formattedValue);
      }
    }
  }, [inputValue, detectedFormat]);

  // Handle input focus (remove formatting)
  const handleInputFocus = useCallback(() => {
    if (inputValue.includes(' ') || inputValue.includes('-')) {
      // Remove formatting for editing
      const cleanValue = inputValue.replace(/[\s-]/g, '');
      setInputValue(cleanValue);
    }
  }, [inputValue]);

  // Open scanner modal
  const openScanner = useCallback(() => {
    setShowScannerModal(true);
  }, []);

  // Close scanner modal
  const closeScanner = useCallback(() => {
    setShowScannerModal(false);
  }, []);

  // Clear input
  const clearInput = useCallback(() => {
    setInputValue('');
    setDetectedFormat(null);
    setIsValid(true);
    setValidationError(null);
    onChange('');
    onValidationChange?.(true);
    inputRef.current?.focus();
  }, [onChange, onValidationChange]);

  // Update input value when prop changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
      const format = detectBarcodeFormat(value);
      setDetectedFormat(format);
    }
  }, [value, inputValue]);

  // Get format info for display
  const formatInfo = detectedFormat ? getBarcodeFormatInfo(detectedFormat) : null;

  // Determine if there's an error to display
  const displayError = error || validationError;
  const hasError = !isValid || !!error;

  return (
    <div className={`barcode-input ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Group */}
      <div className="relative">
        {/* Text Input */}
        {allowManualInput && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            autoFocus={autoFocus}
            maxLength={maxLength}
            className={`
              block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
              ${hasError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }
              ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
              ${showScanner ? 'pr-20' : 'pr-10'}
            `}
          />
        )}

        {/* Read-only display when manual input is disabled */}
        {!allowManualInput && (
          <div className={`
            block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm bg-gray-50
            ${hasError ? 'border-red-300' : 'border-gray-300'}
            ${showScanner ? 'pr-20' : 'pr-10'}
          `}>
            {inputValue || <span className="text-gray-400">{placeholder}</span>}
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center">
          {/* Clear Button */}
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={clearInput}
              className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
              title="Clear barcode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Scanner Button */}
          {showScanner && !disabled && (
            <button
              type="button"
              onClick={openScanner}
              className="ml-1 mr-2 p-1 text-gray-400 hover:text-blue-600 focus:outline-none focus:text-blue-600"
              title="Scan barcode"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4.01M12 12V7.99" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Format Information */}
      {showFormatInfo && detectedFormat && formatInfo && (
        <div className="mt-2 flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>
            <strong>{formatInfo.name}</strong> - {formatInfo.description}
          </span>
        </div>
      )}

      {/* Error Message */}
      {displayError && (
        <div className="mt-2 flex items-center text-sm text-red-600">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{displayError}</span>
        </div>
      )}

      {/* Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeScanner}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Scan Barcode
                </h3>
                <button
                  onClick={closeScanner}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <BarcodeScanner
                onScanSuccess={scanner._handleScanSuccess}
                onScanError={scanner._handleScanError}
                onScannerReady={scanner._handleScannerReady}
                onScannerClosed={scanner._handleScannerClosed}
                supportedFormats={supportedFormats}
                width={500}
                height={300}
                autoStart={true}
                showFormatInfo={false}
              />

              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={closeScanner}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeInput;