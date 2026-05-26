'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BarcodeScanResult } from '../components/barcode/BarcodeScanner';
import { validateBarcode, BarcodeValidationResult } from '../utils/barcodeValidation';
import { BARCODE_FORMATS } from '../shared/constants';

export interface UseBarcodeScanner {
  // State
  isScanning: boolean;
  lastScanResult: BarcodeScanResult | null;
  scanHistory: BarcodeScanResult[];
  error: string | null;
  isReady: boolean;

  // Actions
  startScanning: () => void;
  stopScanning: () => void;
  clearHistory: () => void;
  clearError: () => void;
  validateManualInput: (barcode: string, allowedFormats?: string[]) => BarcodeValidationResult;

  // Configuration
  supportedFormats: string[];
  setSupportedFormats: (formats: string[]) => void;

  // Internal handlers (for BarcodeScanner component)
  _handleScanSuccess: (result: BarcodeScanResult) => void;
  _handleScanError: (error: string) => void;
  _handleScannerReady: () => void;
  _handleScannerClosed: () => void;
}

export interface UseBarcodeScannersOptions {
  supportedFormats?: string[];
  maxHistorySize?: number;
  autoValidate?: boolean;
  onScanSuccess?: (result: BarcodeScanResult) => void;
  onScanError?: (error: string) => void;
  onValidationError?: (error: string) => void;
}

export function useBarcodeScanner(options: UseBarcodeScannersOptions = {}): UseBarcodeScanner {
  const {
    supportedFormats: initialFormats = Object.values(BARCODE_FORMATS),
    maxHistorySize = 50,
    autoValidate = true,
    onScanSuccess,
    onScanError,
    onValidationError,
  } = options;

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<BarcodeScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<BarcodeScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [supportedFormats, setSupportedFormats] = useState<string[]>(initialFormats);

  // Refs for callbacks
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const onValidationErrorRef = useRef(onValidationError);

  // Update refs when callbacks change
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanErrorRef.current = onScanError;
    onValidationErrorRef.current = onValidationError;
  }, [onScanSuccess, onScanError, onValidationError]);

  // Handle scan success
  const handleScanSuccess = useCallback((result: BarcodeScanResult) => {
    setLastScanResult(result);
    setError(null);

    // Add to history (avoid duplicates)
    setScanHistory(prev => {
      const isDuplicate = prev.some(
        item => item.decodedText === result.decodedText && item.format === result.format
      );

      if (isDuplicate) return prev;

      const newHistory = [result, ...prev];
      return newHistory.slice(0, maxHistorySize);
    });

    // Additional validation if enabled
    if (autoValidate && result.isValid) {
      const validationResult = validateBarcode(result.decodedText, supportedFormats);
      if (!validationResult.isValid) {
        const errorMessage = validationResult.error || 'Barcode validation failed';
        setError(errorMessage);
        onValidationErrorRef.current?.(errorMessage);
        return;
      }
    }

    // Call success callback
    onScanSuccessRef.current?.(result);
  }, [maxHistorySize, autoValidate, supportedFormats]);

  // Handle scan error
  const handleScanError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onScanErrorRef.current?.(errorMessage);
  }, []);

  // Start scanning
  const startScanning = useCallback(() => {
    setIsScanning(true);
    setError(null);
  }, []);

  // Stop scanning
  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  // Clear scan history
  const clearHistory = useCallback(() => {
    setScanHistory([]);
    setLastScanResult(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Validate manual input
  const validateManualInput = useCallback((
    barcode: string,
    allowedFormats: string[] = supportedFormats
  ): BarcodeValidationResult => {
    return validateBarcode(barcode, allowedFormats);
  }, [supportedFormats]);

  // Handle scanner ready
  const handleScannerReady = useCallback(() => {
    setIsReady(true);
  }, []);

  // Handle scanner closed
  const handleScannerClosed = useCallback(() => {
    setIsReady(false);
    setIsScanning(false);
  }, []);

  return {
    // State
    isScanning,
    lastScanResult,
    scanHistory,
    error,
    isReady,

    // Actions
    startScanning,
    stopScanning,
    clearHistory,
    clearError,
    validateManualInput,

    // Configuration
    supportedFormats,
    setSupportedFormats,

    // Internal handlers (for BarcodeScanner component)
    _handleScanSuccess: handleScanSuccess,
    _handleScanError: handleScanError,
    _handleScannerReady: handleScannerReady,
    _handleScannerClosed: handleScannerClosed,
  } as UseBarcodeScanner;
}

// Specialized hooks for different use cases

/**
 * Hook for inventory management barcode scanning
 */
export function useInventoryBarcodeScanner(options: Omit<UseBarcodeScannersOptions, 'supportedFormats'> = {}) {
  return useBarcodeScanner({
    ...options,
    supportedFormats: [
      BARCODE_FORMATS.UPC_A,
      BARCODE_FORMATS.UPC_E,
      BARCODE_FORMATS.EAN_13,
      BARCODE_FORMATS.EAN_8,
      BARCODE_FORMATS.CODE_128,
      BARCODE_FORMATS.CODE_39,
    ],
  });
}

/**
 * Hook for order processing barcode scanning
 */
export function useOrderBarcodeScanner(options: Omit<UseBarcodeScannersOptions, 'supportedFormats'> = {}) {
  return useBarcodeScanner({
    ...options,
    supportedFormats: [
      BARCODE_FORMATS.UPC_A,
      BARCODE_FORMATS.UPC_E,
      BARCODE_FORMATS.EAN_13,
      BARCODE_FORMATS.EAN_8,
      BARCODE_FORMATS.CODE_128,
    ],
  });
}

/**
 * Hook for returns processing barcode scanning
 */
export function useReturnsBarcodeScanner(options: Omit<UseBarcodeScannersOptions, 'supportedFormats'> = {}) {
  return useBarcodeScanner({
    ...options,
    supportedFormats: [
      BARCODE_FORMATS.UPC_A,
      BARCODE_FORMATS.UPC_E,
      BARCODE_FORMATS.EAN_13,
      BARCODE_FORMATS.EAN_8,
      BARCODE_FORMATS.CODE_128,
    ],
  });
}

/**
 * Hook for QR code scanning (for special use cases)
 */
export function useQRCodeScanner(options: Omit<UseBarcodeScannersOptions, 'supportedFormats'> = {}) {
  return useBarcodeScanner({
    ...options,
    supportedFormats: [BARCODE_FORMATS.QR_CODE],
  });
}