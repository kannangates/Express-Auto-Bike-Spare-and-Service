// Barcode format constants
export const BARCODE_FORMATS = {
  UPC_A: 'UPC_A',
  UPC_E: 'UPC_E',
  EAN_13: 'EAN_13',
  EAN_8: 'EAN_8',
  CODE_128: 'CODE_128',
  CODE_39: 'CODE_39',
  QR_CODE: 'QR_CODE',
  ITF: 'ITF',
  CODABAR: 'CODABAR',
} as const;

// Barcode validation patterns
export const BARCODE_VALIDATION_PATTERNS: Record<string, RegExp> = {
  [BARCODE_FORMATS.UPC_A]: /^\d{12}$/,
  [BARCODE_FORMATS.UPC_E]: /^\d{8}$/,
  [BARCODE_FORMATS.EAN_13]: /^\d{13}$/,
  [BARCODE_FORMATS.EAN_8]: /^\d{8}$/,
  [BARCODE_FORMATS.CODE_128]: /^[\x00-\x7F]{1,48}$/,
  [BARCODE_FORMATS.CODE_39]: /^[A-Z0-9\-\.\ \$\/\+\%]{1,43}$/,
  [BARCODE_FORMATS.QR_CODE]: /^.{1,4296}$/,
  [BARCODE_FORMATS.ITF]: /^\d{6,80}$/,
  [BARCODE_FORMATS.CODABAR]: /^[A-D][0-9\-\$\:\/\.\+]{1,}[A-D]$/,
};

// Error codes
export const ERROR_CODES = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_BARCODE: 'INVALID_BARCODE',
  INVALID_LENGTH: 'INVALID_LENGTH',
  INVALID_CHECK_DIGIT: 'INVALID_CHECK_DIGIT',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  DUPLICATE_BARCODE: 'DUPLICATE_BARCODE',
  BARCODE_NOT_FOUND: 'BARCODE_NOT_FOUND',
  CAMERA_ACCESS_DENIED: 'CAMERA_ACCESS_DENIED',
  CAMERA_NOT_FOUND: 'CAMERA_NOT_FOUND',
  CAMERA_IN_USE: 'CAMERA_IN_USE',
  SCANNER_INITIALIZATION_FAILED: 'SCANNER_INITIALIZATION_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Item condition constants
export const ITEM_CONDITIONS = {
  NEW: 'NEW',
  LIKE_NEW: 'LIKE_NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
  DAMAGED: 'DAMAGED',
  DEFECTIVE: 'DEFECTIVE',
  OPENED: 'OPENED',
  UNOPENED: 'UNOPENED',
} as const;

// Item condition labels for display
export const ITEM_CONDITION_LABELS: Record<string, string> = {
  [ITEM_CONDITIONS.NEW]: 'New',
  [ITEM_CONDITIONS.LIKE_NEW]: 'Like New',
  [ITEM_CONDITIONS.GOOD]: 'Good',
  [ITEM_CONDITIONS.FAIR]: 'Fair',
  [ITEM_CONDITIONS.POOR]: 'Poor',
  [ITEM_CONDITIONS.DAMAGED]: 'Damaged',
  [ITEM_CONDITIONS.DEFECTIVE]: 'Defective',
  [ITEM_CONDITIONS.OPENED]: 'Opened',
  [ITEM_CONDITIONS.UNOPENED]: 'Unopened',
};

// Order status constants
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  CONFIRMED: 'CONFIRMED',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

// Return status constants
export const RETURN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RECEIVED: 'RECEIVED',
  INSPECTED: 'INSPECTED',
  REFUNDED: 'REFUNDED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// Payment method constants
export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  NET_BANKING: 'NET_BANKING',
  WALLET: 'WALLET',
  COD: 'COD',
} as const;

// User role constants
export const USER_ROLES = {
  OWNER: 'OWNER',
  OPERATIONS: 'OPERATIONS',
  CASHIER: 'CASHIER',
  DELIVERY: 'DELIVERY',
  CUSTOMER: 'CUSTOMER',
} as const;

// Notification type constants
export const NOTIFICATION_TYPES = {
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_READY: 'ORDER_READY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURN_APPROVED: 'RETURN_APPROVED',
  RETURN_REJECTED: 'RETURN_REJECTED',
  RETURN_REFUNDED: 'RETURN_REFUNDED',
  USER_APPROVAL_REQUEST: 'USER_APPROVAL_REQUEST',
  USER_APPROVED: 'USER_APPROVED',
  USER_REJECTED: 'USER_REJECTED',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
} as const;

// Stock transaction type constants
export const STOCK_TRANSACTION_TYPES = {
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  DAMAGE: 'DAMAGE',
  TRANSFER: 'TRANSFER',
  RESTOCK: 'RESTOCK',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login/',
    LOGOUT: '/api/v1/auth/logout/',
    REFRESH: '/api/v1/auth/refresh/',
    VERIFY: '/api/v1/auth/verify/',
    GOOGLE_LOGIN: '/api/v1/auth/google/login/',
    GOOGLE_CALLBACK: '/api/v1/auth/google/callback/',
  },
  USERS: {
    LIST: '/api/v1/auth/users/',
    DETAIL: (id: number) => `/api/v1/auth/users/${id}/`,
    PROFILE: '/api/v1/auth/profile/',
    APPROVE: (id: number) => `/api/v1/auth/users/${id}/approve/`,
    REJECT: (id: number) => `/api/v1/auth/users/${id}/reject/`,
  },
  INVENTORY: {
    LIST: '/api/v1/inventory/items/',
    DETAIL: (id: number) => `/api/v1/inventory/items/${id}/`,
    BARCODE: (barcode: string) => `/api/v1/inventory/items/barcode/${barcode}/`,
    LOW_STOCK: '/api/v1/inventory/items/low-stock/',
    TRANSACTIONS: '/api/v1/inventory/transactions/',
  },
  ORDERS: {
    LIST: '/api/v1/orders/',
    DETAIL: (id: number) => `/api/v1/orders/${id}/`,
    CREATE: '/api/v1/orders/',
    UPDATE_STATUS: (id: number) => `/api/v1/orders/${id}/update-status/`,
  },
  RETURNS: {
    LIST: '/api/v1/returns/',
    DETAIL: (id: number) => `/api/v1/returns/${id}/`,
    CREATE: '/api/v1/returns/',
    APPROVE: (id: number) => `/api/v1/returns/${id}/approve/`,
    REJECT: (id: number) => `/api/v1/returns/${id}/reject/`,
  },
  NOTIFICATIONS: {
    LIST: '/api/v1/notifications/',
    DETAIL: (id: number) => `/api/v1/notifications/${id}/`,
    MARK_READ: (id: number) => `/api/v1/notifications/${id}/mark-read/`,
    MARK_ALL_READ: '/api/v1/notifications/mark-all-read/',
  },
  DASHBOARD: {
    STATS: '/api/v1/dashboard/stats/',
  },
  REPORTS: {
    SALES: '/api/v1/reports/sales/',
    INVENTORY: '/api/v1/reports/inventory/',
    ORDERS: '/api/v1/reports/orders/',
    RETURNS: '/api/v1/reports/returns/',
  },
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

// Date format constants
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  INPUT: 'YYYY-MM-DD',
  INPUT_WITH_TIME: 'YYYY-MM-DDTHH:mm',
  API: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
} as const;

// Currency format
export const CURRENCY = {
  CODE: 'INR',
  SYMBOL: '₹',
  LOCALE: 'en-IN',
} as const;

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
} as const;

// Validation rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PHONE_PATTERN: /^[6-9]\d{9}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  BARCODE_MIN_LENGTH: 6,
  BARCODE_MAX_LENGTH: 48,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 1000,
  NOTES_MAX_LENGTH: 500,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth-token',
  REFRESH_TOKEN: 'refresh-token',
  USER_PREFERENCES: 'user-preferences',
  THEME: 'theme',
  LANGUAGE: 'language',
  RECENT_SEARCHES: 'recent-searches',
  CART: 'cart',
} as const;

// Toast notification durations (in milliseconds)
export const TOAST_DURATION = {
  SUCCESS: 3000,
  ERROR: 5000,
  WARNING: 4000,
  INFO: 3000,
} as const;

// Debounce delays (in milliseconds)
export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  INPUT: 500,
  RESIZE: 200,
  SCROLL: 100,
} as const;

// Cache durations (in milliseconds)
export const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Export types for TypeScript
export type BarcodeFormat = typeof BARCODE_FORMATS[keyof typeof BARCODE_FORMATS];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type ItemCondition = typeof ITEM_CONDITIONS[keyof typeof ITEM_CONDITIONS];
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];
export type ReturnStatus = typeof RETURN_STATUS[keyof typeof RETURN_STATUS];
export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type StockTransactionType = typeof STOCK_TRANSACTION_TYPES[keyof typeof STOCK_TRANSACTION_TYPES];
