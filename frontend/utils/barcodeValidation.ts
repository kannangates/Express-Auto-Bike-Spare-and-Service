import { BARCODE_FORMATS, BARCODE_VALIDATION_PATTERNS, ERROR_CODES } from '../shared/constants';

export interface BarcodeValidationResult {
  isValid: boolean;
  format?: string;
  normalizedCode?: string;
  error?: string;
  errorCode?: string;
}

export interface BarcodeFormatInfo {
  name: string;
  description: string;
  pattern: RegExp;
  length?: number | number[];
  checkDigit?: boolean;
}

// Extended barcode format information
export const BARCODE_FORMAT_INFO: Record<string, BarcodeFormatInfo> = {
  [BARCODE_FORMATS.UPC_A]: {
    name: 'UPC-A',
    description: 'Universal Product Code (12 digits)',
    pattern: BARCODE_VALIDATION_PATTERNS[BARCODE_FORMATS.UPC_A]!,
    length: 12,
    checkDigit: true,
  },
  [BARCODE_FORMATS.UPC_E]: {
    name: 'UPC-E',
    description: 'Universal Product Code (8 digits)',
    pattern: BARCODE_VALIDATION_PATTERNS[BARCODE_FORMATS.UPC_E]!,
    length: 8,
    checkDigit: true,
  },
  [BARCODE_FORMATS.EAN_13]: {
    name: 'EAN-13',
    description: 'European Article Number (13 digits)',
    pattern: BARCODE_VALIDATION_PATTERNS[BARCODE_FORMATS.EAN_13]!,
    length: 13,
    checkDigit: true,
  },
  [BARCODE_FORMATS.EAN_8]: {
    name: 'EAN-8',
    description: 'European Article Number (8 digits)',
    pattern: BARCODE_VALIDATION_PATTERNS[BARCODE_FORMATS.EAN_8]!,
    length: 8,
    checkDigit: true,
  },
  [BARCODE_FORMATS.CODE_128]: {
    name: 'Code 128',
    description: 'High-density alphanumeric barcode',
    pattern: BARCODE_VALIDATION_PATTERNS[BARCODE_FORMATS.CODE_128]!,
    length: [1, 48],
    checkDigit: false,
  },
  [BARCODE_FORMATS.CODE_39]: {
    name: 'Code 39',
    description: 'Alphanumeric barcode with special characters',
    pattern: BARCODE_VALIDATION_PATTERNS[BARCODE_FORMATS.CODE_39]!,
    length: [1, 43],
    checkDigit: false,
  },
};

/**
 * Validates a barcode string against supported formats
 */
export function validateBarcode(
  barcode: string,
  allowedFormats: string[] = Object.values(BARCODE_FORMATS)
): BarcodeValidationResult {
  if (!barcode || typeof barcode !== 'string') {
    return {
      isValid: false,
      error: 'Barcode is required and must be a string',
      errorCode: ERROR_CODES.REQUIRED_FIELD,
    };
  }

  const trimmedBarcode = barcode.trim();

  if (trimmedBarcode.length === 0) {
    return {
      isValid: false,
      error: 'Barcode cannot be empty',
      errorCode: ERROR_CODES.REQUIRED_FIELD,
    };
  }

  // Try to detect format and validate
  for (const format of allowedFormats) {
    const formatInfo = BARCODE_FORMAT_INFO[format];
    if (!formatInfo) continue;

    if (formatInfo.pattern.test(trimmedBarcode)) {
      // Additional length validation
      if (typeof formatInfo.length === 'number') {
        if (trimmedBarcode.length !== formatInfo.length) {
          continue;
        }
      } else if (Array.isArray(formatInfo.length)) {
        const [min, max] = formatInfo.length;
        if (min !== undefined && max !== undefined &&
          (trimmedBarcode.length < min || trimmedBarcode.length > max)) {
          continue;
        }
      }

      // Check digit validation for numeric formats
      if (formatInfo.checkDigit && !validateCheckDigit(trimmedBarcode, format)) {
        return {
          isValid: false,
          format,
          error: `Invalid check digit for ${formatInfo.name} barcode`,
          errorCode: ERROR_CODES.INVALID_BARCODE,
        };
      }

      return {
        isValid: true,
        format,
        normalizedCode: normalizeBarcode(trimmedBarcode, format),
      };
    }
  }

  return {
    isValid: false,
    error: `Invalid barcode format. Supported formats: ${allowedFormats.join(', ')}`,
    errorCode: ERROR_CODES.INVALID_BARCODE,
  };
}

/**
 * Validates check digit for UPC/EAN barcodes
 */
function validateCheckDigit(barcode: string, format: string): boolean {
  if (!barcode || !/^\d+$/.test(barcode)) return false;

  switch (format) {
    case BARCODE_FORMATS.UPC_A:
    case BARCODE_FORMATS.EAN_13:
      return validateEAN13CheckDigit(barcode);
    case BARCODE_FORMATS.UPC_E:
    case BARCODE_FORMATS.EAN_8:
      return validateEAN8CheckDigit(barcode);
    default:
      return true; // No check digit validation for other formats
  }
}

/**
 * Validates EAN-13/UPC-A check digit
 */
function validateEAN13CheckDigit(barcode: string): boolean {
  if (barcode.length !== 13 && barcode.length !== 12) return false;

  const digits = barcode.slice(0, -1).split('').map(Number);
  const checkDigit = parseInt(barcode.slice(-1));

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i];
    if (digit !== undefined) {
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }
  }

  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return calculatedCheckDigit === checkDigit;
}

/**
 * Validates EAN-8/UPC-E check digit
 */
function validateEAN8CheckDigit(barcode: string): boolean {
  if (barcode.length !== 8) return false;

  const digits = barcode.slice(0, -1).split('').map(Number);
  const checkDigit = parseInt(barcode.slice(-1));

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i];
    if (digit !== undefined) {
      sum += digit * (i % 2 === 0 ? 3 : 1);
    }
  }

  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return calculatedCheckDigit === checkDigit;
}

/**
 * Normalizes barcode format for consistent storage
 */
function normalizeBarcode(barcode: string, format: string): string {
  switch (format) {
    case BARCODE_FORMATS.UPC_A:
    case BARCODE_FORMATS.UPC_E:
    case BARCODE_FORMATS.EAN_13:
    case BARCODE_FORMATS.EAN_8:
      // Remove any non-digit characters and pad if necessary
      return barcode.replace(/\D/g, '');

    case BARCODE_FORMATS.CODE_128:
    case BARCODE_FORMATS.CODE_39:
      // Uppercase and trim whitespace
      return barcode.toUpperCase().trim();

    default:
      return barcode.trim();
  }
}

/**
 * Detects the most likely barcode format from a string
 */
export function detectBarcodeFormat(barcode: string): string | null {
  if (!barcode) return null;

  const trimmedBarcode = barcode.trim();

  // Check each format in order of specificity
  for (const [format, info] of Object.entries(BARCODE_FORMAT_INFO)) {
    if (info.pattern.test(trimmedBarcode)) {
      // Additional length validation
      if (typeof info.length === 'number') {
        if (trimmedBarcode.length === info.length) {
          return format;
        }
      } else if (Array.isArray(info.length)) {
        const [min, max] = info.length;
        if (min !== undefined && max !== undefined &&
          trimmedBarcode.length >= min && trimmedBarcode.length <= max) {
          return format;
        }
      } else {
        return format;
      }
    }
  }

  return null;
}

/**
 * Gets human-readable format information
 */
export function getBarcodeFormatInfo(format: string): BarcodeFormatInfo | null {
  return BARCODE_FORMAT_INFO[format] || null;
}

/**
 * Checks if a barcode format is supported
 */
export function isSupportedFormat(format: string): boolean {
  return format in BARCODE_FORMAT_INFO;
}

/**
 * Gets all supported barcode formats
 */
export function getSupportedFormats(): string[] {
  return Object.keys(BARCODE_FORMAT_INFO);
}

/**
 * Formats barcode for display (adds separators where appropriate)
 */
export function formatBarcodeForDisplay(barcode: string, format?: string): string {
  if (!barcode) return '';

  const detectedFormat = format || detectBarcodeFormat(barcode);

  switch (detectedFormat) {
    case BARCODE_FORMATS.UPC_A:
      // Format: 0 12345 67890 1
      if (barcode.length === 12) {
        return `${barcode[0]} ${barcode.slice(1, 6)} ${barcode.slice(6, 11)} ${barcode[11]}`;
      }
      break;

    case BARCODE_FORMATS.EAN_13:
      // Format: 123 4567 890123
      if (barcode.length === 13) {
        return `${barcode.slice(0, 3)} ${barcode.slice(3, 7)} ${barcode.slice(7, 13)}`;
      }
      break;

    case BARCODE_FORMATS.UPC_E:
    case BARCODE_FORMATS.EAN_8:
      // Format: 1234 5678
      if (barcode.length === 8) {
        return `${barcode.slice(0, 4)} ${barcode.slice(4)}`;
      }
      break;
  }

  return barcode;
}

/**
 * Generates a sample barcode for testing purposes
 */
export function generateSampleBarcode(format: string): string {
  switch (format) {
    case BARCODE_FORMATS.UPC_A:
      return '012345678905'; // Valid UPC-A with check digit
    case BARCODE_FORMATS.UPC_E:
      return '01234565'; // Valid UPC-E with check digit
    case BARCODE_FORMATS.EAN_13:
      return '1234567890128'; // Valid EAN-13 with check digit
    case BARCODE_FORMATS.EAN_8:
      return '12345670'; // Valid EAN-8 with check digit
    case BARCODE_FORMATS.CODE_128:
      return 'SAMPLE123';
    case BARCODE_FORMATS.CODE_39:
      return 'SAMPLE-39';
    default:
      return 'SAMPLE';
  }
}