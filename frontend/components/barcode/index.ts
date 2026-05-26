// Barcode scanning components and utilities
export { default as BarcodeScanner } from './BarcodeScanner';
export { default as BarcodeInput } from './BarcodeInput';

// Types
export type { BarcodeScanResult, BarcodeScannerProps } from './BarcodeScanner';
export type { BarcodeInputProps } from './BarcodeInput';

// Hooks
export {
  useBarcodeScanner,
  useInventoryBarcodeScanner,
  useOrderBarcodeScanner,
  useReturnsBarcodeScanner,
  useQRCodeScanner
} from '../../hooks/useBarcodeScanner';

// Utilities
export {
  validateBarcode,
  detectBarcodeFormat,
  getBarcodeFormatInfo,
  isSupportedFormat,
  getSupportedFormats,
  formatBarcodeForDisplay,
  generateSampleBarcode
} from '../../utils/barcodeValidation';

// Types from utilities
export type {
  BarcodeValidationResult,
  BarcodeFormatInfo
} from '../../utils/barcodeValidation';