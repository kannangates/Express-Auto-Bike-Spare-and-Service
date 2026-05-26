'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeResult } from 'html5-qrcode';
import { BARCODE_FORMATS, BARCODE_VALIDATION_PATTERNS } from '../../shared/constants';

export interface BarcodeScanResult {
  decodedText: string;
  format: string;
  isValid: boolean;
  validationError?: string;
}

export interface BarcodeScannerProps {
  onScanSuccess: (result: BarcodeScanResult) => void;
  onScanError?: (error: string) => void;
  onScannerReady?: () => void;
  onScannerClosed?: () => void;
  supportedFormats?: string[];
  width?: number;
  height?: number;
  fps?: number;
  qrbox?: number | { width: number; height: number };
  aspectRatio?: number;
  disableFlip?: boolean;
  verbose?: boolean;
  className?: string;
  showFormatInfo?: boolean;
  autoStart?: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onScanError,
  onScannerReady,
  onScannerClosed,
  supportedFormats = Object.values(BARCODE_FORMATS),
  width = 600,
  height = 400,
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.777778, // 16:9
  disableFlip = false,
  verbose = false,
  className = '',
  showFormatInfo = true,
  autoStart = true,
}) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Validate barcode format and content
  const validateBarcode = useCallback((decodedText: string, format: string): BarcodeScanResult => {
    const normalizedFormat = format.toUpperCase().replace(/[_\s]/g, '-');

    // Check if format is supported
    if (!supportedFormats.some(f => f.toUpperCase().replace(/[_\s]/g, '-') === normalizedFormat)) {
      return {
        decodedText,
        format,
        isValid: false,
        validationError: `Unsupported barcode format: ${format}. Supported formats: ${supportedFormats.join(', ')}`
      };
    }

    // Validate barcode content based on format
    const validationPattern = Object.entries(BARCODE_VALIDATION_PATTERNS).find(
      ([key]) => key.toUpperCase().replace(/[_\s]/g, '-') === normalizedFormat
    )?.[1];

    if (validationPattern && !validationPattern.test(decodedText)) {
      return {
        decodedText,
        format,
        isValid: false,
        validationError: `Invalid barcode content for format ${format}. Please check the barcode and try again.`
      };
    }

    return {
      decodedText,
      format,
      isValid: true
    };
  }, [supportedFormats]);

  // Handle successful scan
  const handleScanSuccess = useCallback((decodedText: string, result: Html5QrcodeResult) => {
    const validationResult = validateBarcode(decodedText, result.result.format?.formatName || 'UNKNOWN');

    if (verbose) {
      console.log('Barcode scan success:', {
        decodedText,
        format: result.result.format?.formatName,
        validationResult
      });
    }

    onScanSuccess(validationResult);
  }, [validateBarcode, onScanSuccess, verbose]);

  // Handle scan error
  const handleScanError = useCallback((errorMessage: string, error?: any) => {
    // Only log actual errors, not "No QR code found" messages
    if (!errorMessage.includes('No QR code found') && !errorMessage.includes('QR code parse error')) {
      if (verbose) {
        console.warn('Barcode scan error:', errorMessage, error);
      }

      const userFriendlyError = errorMessage.includes('NotAllowedError')
        ? 'Camera access denied. Please allow camera permissions and try again.'
        : errorMessage.includes('NotFoundError')
          ? 'No camera found. Please ensure your device has a camera.'
          : errorMessage.includes('NotReadableError')
            ? 'Camera is being used by another application. Please close other camera apps and try again.'
            : `Scanning error: ${errorMessage}`;

      setError(userFriendlyError);
      onScanError?.(userFriendlyError);
    }
  }, [onScanError, verbose]);

  // Check camera permissions
  const checkCameraPermission = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permission.state);

        permission.addEventListener('change', () => {
          setCameraPermission(permission.state);
        });
      }
    } catch (error) {
      console.warn('Could not check camera permissions:', error);
      setCameraPermission('unknown');
    }
  }, []);

  // Initialize scanner
  const initializeScanner = useCallback(() => {
    if (!elementRef.current || scannerRef.current) return;

    const config: any = {
      fps,
      qrbox,
      aspectRatio,
      disableFlip,
      verbose,
      supportedScanTypes: [
        // Map our supported formats to Html5Qrcode scan types
        ...supportedFormats.includes(BARCODE_FORMATS.QR_CODE) ? [0] : [], // QR_CODE
        ...supportedFormats.some(f => f.includes('UPC') || f.includes('EAN') || f.includes('Code')) ? [1] : [], // SUPPORTED_FORMATS
      ],
    };

    try {
      scannerRef.current = new Html5QrcodeScanner(
        elementRef.current.id,
        config,
        verbose
      );

      scannerRef.current.render(handleScanSuccess, handleScanError);
      setIsScanning(true);
      setError(null);
      onScannerReady?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize scanner';
      setError(errorMessage);
      onScanError?.(errorMessage);
    }
  }, [
    fps,
    qrbox,
    aspectRatio,
    disableFlip,
    verbose,
    supportedFormats,
    handleScanSuccess,
    handleScanError,
    onScannerReady,
    onScanError
  ]);

  // Start scanning
  const startScanning = useCallback(() => {
    if (!isScanning) {
      initializeScanner();
    }
  }, [isScanning, initializeScanner]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
        onScannerClosed?.();
      } catch (error) {
        console.warn('Error stopping scanner:', error);
      }
    }
  }, [isScanning, onScannerClosed]);

  // Initialize on mount
  useEffect(() => {
    checkCameraPermission();

    if (autoStart) {
      initializeScanner();
    }

    return () => {
      stopScanning();
    };
  }, [checkCameraPermission, autoStart, initializeScanner, stopScanning]);

  // Generate unique ID for scanner element
  const scannerId = `barcode-scanner-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`barcode-scanner ${className}`}>
      {/* Scanner Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Barcode Scanner</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isScanning ? 'bg-green-500' : 'bg-gray-400'
              }`} />
            <span className="text-sm text-gray-600">
              {isScanning ? 'Scanning...' : 'Ready'}
            </span>
          </div>
        </div>

        {cameraPermission === 'denied' && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              Camera access is required for barcode scanning. Please enable camera permissions in your browser settings.
            </p>
          </div>
        )}
      </div>

      {/* Scanner Element */}
      <div
        id={scannerId}
        ref={elementRef}
        className="barcode-scanner-container border border-gray-300 rounded-lg overflow-hidden"
        style={{ width, height }}
      />

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Format Information */}
      {showFormatInfo && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Supported Barcode Formats:</h4>
          <div className="flex flex-wrap gap-2">
            {supportedFormats.map((format) => (
              <span
                key={format}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="mt-4 flex space-x-3">
        {!isScanning ? (
          <button
            onClick={startScanning}
            disabled={cameraPermission === 'denied'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start Scanning
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Stop Scanning
          </button>
        )}

        {error && (
          <button
            onClick={() => {
              setError(null);
              if (!isScanning) {
                startScanning();
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;