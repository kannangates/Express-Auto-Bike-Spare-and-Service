'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import BarcodeInput from './BarcodeInput';
import type { BarcodeScanResult } from './BarcodeScanner';
import { useInventoryBarcodeScanner } from '../../hooks/useBarcodeScanner';

const BarcodeScanner = dynamic(() => import('./BarcodeScanner'), { ssr: false });
import { BARCODE_FORMATS } from '../../shared/constants';
import { generateSampleBarcode, formatBarcodeForDisplay } from '../../utils/barcodeValidation';

const BarcodeScannerDemo: React.FC = () => {
  const [barcodeValue, setBarcodeValue] = useState('');
  const [scanResults, setScanResults] = useState<BarcodeScanResult[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  // Initialize barcode scanner hook
  const scanner = useInventoryBarcodeScanner({
    onScanSuccess: (result) => {
      setScanResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
    },
    onScanError: (error) => {
      console.error('Scan error:', error);
    },
  });

  const handleBarcodeChange = (value: string, format?: string) => {
    setBarcodeValue(value);
    console.log('Barcode changed:', { value, format });
  };

  const handleValidationChange = (isValid: boolean, error?: string) => {
    console.log('Validation changed:', { isValid, error });
  };

  const generateSample = (format: string) => {
    const sample = generateSampleBarcode(format);
    setBarcodeValue(sample);
  };

  const clearResults = () => {
    setScanResults([]);
    scanner.clearHistory();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Barcode Scanner Demo
        </h1>
        <p className="text-gray-600">
          Test the barcode scanning functionality with manual input or camera scanning
        </p>
      </div>

      {/* Barcode Input Component */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Barcode Input Component
        </h2>

        <BarcodeInput
          value={barcodeValue}
          onChange={handleBarcodeChange}
          onValidationChange={handleValidationChange}
          label="Product Barcode"
          placeholder="Enter or scan a barcode..."
          required
          showScanner
          showFormatInfo
          allowManualInput
          supportedFormats={[
            BARCODE_FORMATS.UPC_A,
            BARCODE_FORMATS.UPC_E,
            BARCODE_FORMATS.EAN_13,
            BARCODE_FORMATS.EAN_8,
            BARCODE_FORMATS.CODE_128,
            BARCODE_FORMATS.CODE_39,
          ]}
        />

        {barcodeValue && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <h4 className="text-sm font-medium text-green-900 mb-1">Current Value:</h4>
            <p className="text-sm text-green-700 font-mono">{barcodeValue}</p>
            <p className="text-sm text-green-600 mt-1">
              Formatted: {formatBarcodeForDisplay(barcodeValue)}
            </p>
          </div>
        )}
      </div>

      {/* Sample Barcodes */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Sample Barcodes
        </h2>
        <p className="text-gray-600 mb-4">
          Click to generate sample barcodes for testing:
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.values(BARCODE_FORMATS).slice(0, 6).map((format) => (
            <button
              key={format}
              onClick={() => generateSample(format)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      {/* Standalone Scanner */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Standalone Scanner
          </h2>
          <button
            onClick={() => setShowScanner(!showScanner)}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${showScanner
              ? 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
              : 'text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500'
              }`}
          >
            {showScanner ? 'Hide Scanner' : 'Show Scanner'}
          </button>
        </div>

        {showScanner && (
          <BarcodeScanner
            onScanSuccess={scanner._handleScanSuccess}
            onScanError={scanner._handleScanError}
            onScannerReady={scanner._handleScannerReady}
            onScannerClosed={scanner._handleScannerClosed}
            supportedFormats={[
              BARCODE_FORMATS.UPC_A,
              BARCODE_FORMATS.UPC_E,
              BARCODE_FORMATS.EAN_13,
              BARCODE_FORMATS.EAN_8,
              BARCODE_FORMATS.CODE_128,
              BARCODE_FORMATS.CODE_39,
            ]}
            width={600}
            height={400}
            autoStart={false}
          />
        )}
      </div>

      {/* Scan Results */}
      {scanResults.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Scan Results ({scanResults.length})
            </h2>
            <button
              onClick={clearResults}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 focus:outline-none"
            >
              Clear Results
            </button>
          </div>

          <div className="space-y-3">
            {scanResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-md border ${result.isValid
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">
                      {result.decodedText}
                    </p>
                    <p className="text-xs text-gray-600">
                      Format: {result.format}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${result.isValid
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {result.isValid ? 'Valid' : 'Invalid'}
                  </div>
                </div>
                {result.validationError && (
                  <p className="text-xs text-red-600 mt-1">
                    {result.validationError}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scanner State */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Scanner State:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Scanning:</span>
            <span className={`ml-2 font-medium ${scanner.isScanning ? 'text-green-600' : 'text-gray-600'}`}>
              {scanner.isScanning ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Ready:</span>
            <span className={`ml-2 font-medium ${scanner.isReady ? 'text-green-600' : 'text-gray-600'}`}>
              {scanner.isReady ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">History:</span>
            <span className="ml-2 font-medium text-gray-900">
              {scanner.scanHistory.length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Error:</span>
            <span className={`ml-2 font-medium ${scanner.error ? 'text-red-600' : 'text-gray-600'}`}>
              {scanner.error ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        {scanner.error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {scanner.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerDemo;