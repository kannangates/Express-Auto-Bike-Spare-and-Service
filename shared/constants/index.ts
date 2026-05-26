// Shared constants for Express Auto Bike Management System

// ============================================================================
// USER ROLES AND PERMISSIONS
// ============================================================================

export const USER_ROLES = {
  OWNER: 'OWNER',
  OPERATIONS: 'OPERATIONS',
  CASHIER: 'CASHIER',
  DELIVERY: 'DELIVERY',
  CUSTOMER: 'CUSTOMER',
} as const;

export const ROLE_PERMISSIONS = {
  [USER_ROLES.OWNER]: [
    'admin_access',
    'user_management',
    'inventory_management',
    'order_management',
    'return_management',
    'report_access',
    'system_configuration',
  ],
  [USER_ROLES.OPERATIONS]: [
    'inventory_management',
    'order_management',
    'return_management',
    'report_access',
  ],
  [USER_ROLES.CASHIER]: [
    'order_management',
    'return_management',
    'inventory_view',
  ],
  [USER_ROLES.DELIVERY]: [
    'order_view',
    'order_status_update',
    'inventory_view',
  ],
  [USER_ROLES.CUSTOMER]: [
    'order_view',
    'order_create',
    'return_create',
    'profile_management',
  ],
} as const;

// ============================================================================
// ORDER AND PAYMENT STATUS
// ============================================================================

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIAL: 'PARTIAL',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  CREDIT: 'CREDIT',
  BANK_TRANSFER: 'BANK_TRANSFER',
  DIGITAL_WALLET: 'DIGITAL_WALLET',
} as const;

// ============================================================================
// RETURN AND CREDIT STATUS
// ============================================================================

export const RETURN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PROCESSED: 'PROCESSED',
  REJECTED: 'REJECTED',
} as const;

export const ITEM_CONDITIONS = {
  NEW: 'NEW',
  USED: 'USED',
  DAMAGED: 'DAMAGED',
  DEFECTIVE: 'DEFECTIVE',
  UNKNOWN: 'UNKNOWN',
} as const;

export const CREDIT_TRANSACTION_TYPES = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
} as const;

export const CREDIT_REFERENCE_TYPES = {
  RETURN: 'RETURN',
  ORDER: 'ORDER',
  ADJUSTMENT: 'ADJUSTMENT',
  REFUND: 'REFUND',
} as const;

// ============================================================================
// INVENTORY AND STOCK MANAGEMENT
// ============================================================================

export const TRANSACTION_TYPES = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const REFERENCE_TYPES = {
  ORDER: 'ORDER',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  INITIAL: 'INITIAL',
} as const;

export const STOCK_STATUS = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export const NOTIFICATION_TYPES = {
  LOW_STOCK: 'LOW_STOCK',
  ORDER_STATUS: 'ORDER_STATUS',
  USER_APPROVAL: 'USER_APPROVAL',
  RETURN_PROCESSED: 'RETURN_PROCESSED',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INVENTORY_ALERT: 'INVENTORY_ALERT',
  CREDIT_APPLIED: 'CREDIT_APPLIED',
} as const;

export const NOTIFICATION_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const API_ENDPOINTS = {
  // Authentication
  AUTH: '/api/v1/auth',
  LOGIN: '/api/v1/auth/login',
  LOGOUT: '/api/v1/auth/logout',
  REFRESH: '/api/v1/auth/refresh',
  PROFILE: '/api/v1/auth/profile',

  // User management
  USERS: '/api/v1/users',
  USER_APPROVAL: '/api/v1/users/approve',
  USER_PROFILE: '/api/v1/users/profile',

  // Inventory management
  INVENTORY: '/api/v1/inventory',
  CATEGORIES: '/api/v1/inventory/categories',
  STOCK_TRANSACTIONS: '/api/v1/inventory/transactions',
  STOCK_ADJUSTMENT: '/api/v1/inventory/adjust',
  BULK_UPDATE: '/api/v1/inventory/bulk-update',
  LOW_STOCK: '/api/v1/inventory/low-stock',

  // Order management
  ORDERS: '/api/v1/orders',
  ORDER_ITEMS: '/api/v1/orders/items',
  ORDER_PROCESS: '/api/v1/orders/process',
  ORDER_STATUS: '/api/v1/orders/status',

  // Returns management
  RETURNS: '/api/v1/returns',
  RETURN_ITEMS: '/api/v1/returns/items',
  RETURN_APPROVE: '/api/v1/returns/approve',
  RETURN_PROCESS: '/api/v1/returns/process',

  // Credit management
  CREDITS: '/api/v1/credits',
  CREDIT_TRANSACTIONS: '/api/v1/credits/transactions',
  CREDIT_APPLY: '/api/v1/credits/apply',
  CREDIT_USE: '/api/v1/credits/use',

  // Reports
  REPORTS: '/api/v1/reports',
  SALES_REPORT: '/api/v1/reports/sales',
  INVENTORY_REPORT: '/api/v1/reports/inventory',
  CUSTOMER_REPORT: '/api/v1/reports/customers',
  RETURN_REPORT: '/api/v1/reports/returns',
  DASHBOARD: '/api/v1/reports/dashboard',

  // Notifications
  NOTIFICATIONS: '/api/v1/notifications',
  NOTIFICATION_PREFERENCES: '/api/v1/notifications/preferences',
  MARK_READ: '/api/v1/notifications/mark-read',
} as const;

// ============================================================================
// BARCODE FORMATS
// ============================================================================

export const BARCODE_FORMATS = {
  UPC_A: 'UPC-A',
  UPC_E: 'UPC-E',
  EAN_13: 'EAN-13',
  EAN_8: 'EAN-8',
  CODE_128: 'Code 128',
  CODE_39: 'Code 39',
  ITF: 'ITF',
  CODABAR: 'Codabar',
  QR_CODE: 'QR Code',
  DATA_MATRIX: 'Data Matrix',
} as const;

export const BARCODE_VALIDATION_PATTERNS = {
  [BARCODE_FORMATS.UPC_A]: /^\d{12}$/,
  [BARCODE_FORMATS.UPC_E]: /^\d{8}$/,
  [BARCODE_FORMATS.EAN_13]: /^\d{13}$/,
  [BARCODE_FORMATS.EAN_8]: /^\d{8}$/,
  [BARCODE_FORMATS.CODE_128]: /^[A-Za-z0-9\-\.\s]{1,48}$/,
  [BARCODE_FORMATS.CODE_39]: /^[A-Z0-9\-\.\s\$\/\+%]{1,43}$/,
} as const;

// ============================================================================
// HTTP STATUS CODES
// ============================================================================

export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_NOT_APPROVED: 'ACCOUNT_NOT_APPROVED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_VALUE: 'INVALID_VALUE',

  // Business logic errors
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  RETURN_NOT_FOUND: 'RETURN_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  BARCODE_DUPLICATE: 'BARCODE_DUPLICATE',
  INVALID_BARCODE: 'INVALID_BARCODE',
  INVALID_ORDER_STATUS: 'INVALID_ORDER_STATUS',
  INVALID_RETURN_STATUS: 'INVALID_RETURN_STATUS',
  INSUFFICIENT_CREDIT: 'INSUFFICIENT_CREDIT',

  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// ============================================================================
// PAGINATION AND CACHING
// ============================================================================

export const DEFAULT_PAGINATION = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
} as const;

export const CACHE_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_PERMISSIONS: 'user_permissions',
  INVENTORY_ITEMS: 'inventory_items',
  INVENTORY_CATEGORIES: 'inventory_categories',
  LOW_STOCK_ITEMS: 'low_stock_items',
  ORDER_STATS: 'order_stats',
  DASHBOARD_METRICS: 'dashboard_metrics',
  NOTIFICATION_COUNT: 'notification_count',
  CUSTOMER_CREDITS: 'customer_credits',
} as const;

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
  WEEK: 604800, // 7 days
} as const;

// ============================================================================
// FORM VALIDATION
// ============================================================================

export const VALIDATION_RULES = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  BARCODE_BASIC: /^[A-Za-z0-9\-]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 1000,
  NOTES_MAX_LENGTH: 2000,
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_BARCODE: 'Please enter a valid barcode',
  PASSWORD_TOO_SHORT: `Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters`,
  NAME_TOO_LONG: `Name cannot exceed ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`,
  DESCRIPTION_TOO_LONG: `Description cannot exceed ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} characters`,
  NOTES_TOO_LONG: `Notes cannot exceed ${VALIDATION_RULES.NOTES_MAX_LENGTH} characters`,
  INVALID_NUMBER: 'Please enter a valid number',
  NEGATIVE_NUMBER: 'Number cannot be negative',
  ZERO_OR_NEGATIVE: 'Number must be greater than zero',
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const UI_CONSTANTS = {
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1200,

  // Animation durations (ms)
  ANIMATION_FAST: 150,
  ANIMATION_NORMAL: 300,
  ANIMATION_SLOW: 500,

  // Debounce delays (ms)
  SEARCH_DEBOUNCE: 300,
  INPUT_DEBOUNCE: 500,
  RESIZE_DEBOUNCE: 100,

  // Auto-save intervals (ms)
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SYNC_INTERVAL: 60000, // 1 minute
} as const;

// ============================================================================
// PWA CONSTANTS
// ============================================================================

export const PWA_CONSTANTS = {
  APP_NAME: 'Express Auto Bike Management',
  APP_SHORT_NAME: 'BikeManager',
  APP_DESCRIPTION: 'Bike spare parts and service management system',
  THEME_COLOR: '#1976d2',
  BACKGROUND_COLOR: '#ffffff',

  // Service worker
  SW_UPDATE_INTERVAL: 3600000, // 1 hour
  SW_CACHE_NAME: 'bike-manager-v1',

  // Offline storage
  OFFLINE_STORAGE_KEY: 'bike_manager_offline',
  MAX_OFFLINE_ACTIONS: 100,
  OFFLINE_RETRY_ATTEMPTS: 3,
  OFFLINE_RETRY_DELAY: 5000, // 5 seconds
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  ENABLE_PWA: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_BARCODE_SCANNING: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_CREDIT_SYSTEM: true,
  ENABLE_REPORTS: true,
  ENABLE_BULK_OPERATIONS: true,
  ENABLE_ADVANCED_SEARCH: true,
  ENABLE_EXPORT: true,
  ENABLE_AUDIT_LOG: true,
} as const;

// ============================================================================
// EXPORT ALL CONSTANTS
// ============================================================================

// All constants are exported above