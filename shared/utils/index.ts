// Shared utility functions for Express Auto Bike Management System

import { BARCODE_FORMATS, ERROR_CODES, VALIDATION_RULES, VALIDATION_MESSAGES } from '../constants';
import type {
  BarcodeValidationResult,
  UserRole,
  BarcodeFormat,
  User,
  Order,
  Return,
  InventoryItem
} from '../types';

/**
 * Validates barcode format and returns validation result
 */
export function validateBarcode(barcode: string): BarcodeValidationResult {
  if (!barcode || typeof barcode !== 'string') {
    return {
      isValid: false,
      error: VALIDATION_MESSAGES.REQUIRED,
    };
  }

  const trimmedBarcode = barcode.trim();

  if (trimmedBarcode.length === 0) {
    return {
      isValid: false,
      error: 'Barcode cannot be empty',
    };
  }

  // UPC-A: 12 digits
  if (/^\d{12}$/.test(trimmedBarcode)) {
    return {
      isValid: true,
      format: BARCODE_FORMATS.UPC_A as BarcodeFormat,
    };
  }

  // UPC-E: 8 digits
  if (/^\d{8}$/.test(trimmedBarcode)) {
    return {
      isValid: true,
      format: BARCODE_FORMATS.UPC_E as BarcodeFormat,
    };
  }

  // EAN-13: 13 digits
  if (/^\d{13}$/.test(trimmedBarcode)) {
    return {
      isValid: true,
      format: BARCODE_FORMATS.EAN_13 as BarcodeFormat,
    };
  }

  // EAN-8: 8 digits (same as UPC-E but different standard)
  if (/^\d{8}$/.test(trimmedBarcode)) {
    return {
      isValid: true,
      format: BARCODE_FORMATS.EAN_8 as BarcodeFormat,
    };
  }

  // Code 128: Variable length alphanumeric
  if (/^[A-Za-z0-9\-\.\s]{1,48}$/.test(trimmedBarcode)) {
    return {
      isValid: true,
      format: BARCODE_FORMATS.CODE_128 as BarcodeFormat,
    };
  }

  // Code 39: Variable length alphanumeric with specific characters
  if (/^[A-Z0-9\-\.\s\$\/\+%]{1,43}$/.test(trimmedBarcode)) {
    return {
      isValid: true,
      format: BARCODE_FORMATS.CODE_39 as BarcodeFormat,
    };
  }

  return {
    isValid: false,
    error: `Invalid barcode format. Supported formats: ${Object.values(BARCODE_FORMATS).join(', ')}`,
  };
}

/**
 * Formats currency amount for display
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats date for display
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(dateObj);
}

/**
 * Generates a unique order number
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp.slice(-8)}-${random}`;
}

/**
 * Generates a unique return number
 */
export function generateReturnNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RET-${timestamp.slice(-8)}-${random}`;
}

/**
 * Calculates order total with tax and discount
 */
export function calculateOrderTotal(
  subtotal: number,
  taxRate: number = 0,
  discountAmount: number = 0
): number {
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount - discountAmount;
  return Math.max(0, Math.round(total * 100) / 100); // Ensure non-negative and round to 2 decimals
}

/**
 * Checks if user has required permission
 */
export function hasPermission(userRole: UserRole, requiredPermissions: string[]): boolean {
  const rolePermissions = getRolePermissions(userRole);
  return requiredPermissions.every(permission => rolePermissions.includes(permission));
}

/**
 * Gets permissions for a user role
 */
export function getRolePermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    OWNER: [
      'admin_access',
      'user_management',
      'inventory_management',
      'order_management',
      'return_management',
      'report_access',
      'system_configuration',
    ],
    OPERATIONS: [
      'inventory_management',
      'order_management',
      'return_management',
      'report_access',
    ],
    CASHIER: [
      'order_management',
      'return_management',
      'inventory_view',
    ],
    DELIVERY: [
      'order_view',
      'order_status_update',
      'inventory_view',
    ],
    CUSTOMER: [
      'order_view',
      'order_create',
      'return_create',
      'profile_management',
    ],
  };

  return permissions[role] || [];
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  return VALIDATION_RULES.EMAIL.test(email);
}

/**
 * Validates phone number format
 */
export function isValidPhone(phone: string): boolean {
  return VALIDATION_RULES.PHONE.test(phone);
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Debounces function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttles function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Creates a delay promise for testing or rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely parses JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Generates a random string of specified length
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Converts snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
/**
 * Validates form field based on field configuration
 */
export function validateFormField(value: any, field: any): string | null {
  if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return VALIDATION_MESSAGES.REQUIRED;
  }

  if (!value) return null; // Skip validation for empty optional fields

  switch (field.type) {
    case 'email':
      return isValidEmail(value) ? null : VALIDATION_MESSAGES.INVALID_EMAIL;

    case 'phone':
      return isValidPhone(value) ? null : VALIDATION_MESSAGES.INVALID_PHONE;

    case 'barcode':
      const barcodeResult = validateBarcode(value);
      return barcodeResult.isValid ? null : (barcodeResult.error || VALIDATION_MESSAGES.INVALID_BARCODE);

    case 'number':
      const num = Number(value);
      if (isNaN(num)) return VALIDATION_MESSAGES.INVALID_NUMBER;
      if (field.validation?.min !== undefined && num < field.validation.min) {
        return `Value must be at least ${field.validation.min}`;
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        return `Value must be at most ${field.validation.max}`;
      }
      return null;

    case 'text':
    case 'textarea':
      const str = String(value);
      if (field.validation?.minLength && str.length < field.validation.minLength) {
        return `Must be at least ${field.validation.minLength} characters`;
      }
      if (field.validation?.maxLength && str.length > field.validation.maxLength) {
        return `Must be at most ${field.validation.maxLength} characters`;
      }
      if (field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(str)) {
          return field.validation.message || 'Invalid format';
        }
      }
      return null;

    default:
      return null;
  }
}

/**
 * Validates entire form object
 */
export function validateForm(values: Record<string, any>, fields: any[]): Record<string, string> {
  const errors: Record<string, string> = {};

  fields.forEach(field => {
    const error = validateFormField(values[field.name], field);
    if (error) {
      errors[field.name] = error;
    }
  });

  return errors;
}

/**
 * Formats user display name
 */
export function formatUserName(user: User): string {
  if (user.profile?.firstName && user.profile?.lastName) {
    return `${user.profile.firstName} ${user.profile.lastName}`;
  }
  if (user.profile?.firstName) {
    return user.profile.firstName;
  }
  return user.email.split('@')[0];
}

/**
 * Gets user initials for avatar
 */
export function getUserInitials(user: User): string {
  if (user.profile?.firstName && user.profile?.lastName) {
    return `${user.profile.firstName[0]}${user.profile.lastName[0]}`.toUpperCase();
  }
  if (user.profile?.firstName) {
    return user.profile.firstName.substring(0, 2).toUpperCase();
  }
  return user.email.substring(0, 2).toUpperCase();
}

/**
 * Formats order number for display
 */
export function formatOrderNumber(order: Order): string {
  return order.orderNumber || `#${order.id}`;
}

/**
 * Formats return number for display
 */
export function formatReturnNumber(returnObj: Return): string {
  return returnObj.returnNumber || `#${returnObj.id}`;
}

/**
 * Gets stock status for inventory item
 */
export function getStockStatus(item: InventoryItem): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
  if (item.stockQuantity === 0) {
    return 'OUT_OF_STOCK';
  }
  if (item.stockQuantity <= item.minStockLevel) {
    return 'LOW_STOCK';
  }
  return 'IN_STOCK';
}

/**
 * Calculates percentage of stock remaining
 */
export function getStockPercentage(item: InventoryItem): number {
  if (!item.maxStockLevel) {
    return item.stockQuantity > item.minStockLevel ? 100 :
      (item.stockQuantity / item.minStockLevel) * 100;
  }
  return (item.stockQuantity / item.maxStockLevel) * 100;
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculates time ago from timestamp
 */
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

/**
 * Truncates text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalizes first letter of each word
 */
export function capitalizeWords(text: string): string {
  return text.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Generates color based on string (for avatars, badges, etc.)
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Checks if current time is within business hours
 */
export function isBusinessHours(businessHours = { start: 9, end: 17 }): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  return currentHour >= businessHours.start && currentHour < businessHours.end;
}

/**
 * Formats business hours for display
 */
export function formatBusinessHours(start: number, end: number): string {
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  return `${formatHour(start)} - ${formatHour(end)}`;
}

/**
 * Calculates business days between two dates
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Validates credit card number using Luhn algorithm
 */
export function validateCreditCard(cardNumber: string): boolean {
  const num = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;

  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Masks sensitive information (credit card, phone, etc.)
 */
export function maskSensitiveInfo(value: string, type: 'creditCard' | 'phone' | 'email' = 'creditCard'): string {
  switch (type) {
    case 'creditCard':
      return value.replace(/\d(?=\d{4})/g, '*');
    case 'phone':
      return value.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2');
    case 'email':
      const [username, domain] = value.split('@');
      const maskedUsername = username.length > 2
        ? username.substring(0, 2) + '*'.repeat(username.length - 2)
        : username;
      return `${maskedUsername}@${domain}`;
    default:
      return value;
  }
}

/**
 * Generates a QR code data URL for given text
 */
export function generateQRCodeDataURL(text: string, size = 200): string {
  // This is a placeholder - in a real implementation, you'd use a QR code library
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12">
        QR: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}
      </text>
    </svg>
  `)}`;
}

/**
 * Exports data to CSV format
 */
export function exportToCSV(data: any[], filename: string, columns?: string[]): void {
  if (!data.length) return;

  const headers = columns || Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Merges objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {} as T[Extract<keyof T, string>];
        }
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return deepMerge(target, ...sources);
}