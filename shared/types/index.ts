// Shared TypeScript types and interfaces for Express Auto Bike Management System

// ============================================================================
// USER MANAGEMENT TYPES
// ============================================================================

export interface User {
  id: number;
  email: string;
  googleId?: string;
  isApproved: boolean;
  role: UserRole;
  isActive: boolean;
  isStaff: boolean;
  dateJoined: string;
  lastLogin?: string;
  profile?: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
  notificationPreferences: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'OWNER' | 'OPERATIONS' | 'CASHIER' | 'DELIVERY' | 'CUSTOMER';

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  lowStock: boolean;
  orderUpdates: boolean;
  returnUpdates: boolean;
  approvalRequests: boolean;
  systemAlerts: boolean;
}

// ============================================================================
// INVENTORY MANAGEMENT TYPES
// ============================================================================

export interface InventoryCategory {
  id: number;
  name: string;
  description: string;
  parentId?: number;
  parent?: InventoryCategory;
  children?: InventoryCategory[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: number;
  barcode: string;
  name: string;
  description: string;
  categoryId?: number;
  category?: InventoryCategory;
  unitPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel?: number;
  isActive: boolean;
  createdBy?: number;
  createdByUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransaction {
  id: number;
  itemId: number;
  item?: InventoryItem;
  transactionType: StockTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: ReferenceType;
  referenceId?: number;
  notes: string;
  createdBy?: number;
  createdByUser?: User;
  createdAt: string;
}

export type StockTransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';
export type ReferenceType = 'ORDER' | 'RETURN' | 'ADJUSTMENT' | 'INITIAL';

// ============================================================================
// ORDER MANAGEMENT TYPES
// ============================================================================

export interface Order {
  id: number;
  orderNumber: string;
  customerId?: number;
  customer?: User;
  status: OrderStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  notes: string;
  items: OrderItem[];
  shippedAt?: string;
  deliveredAt?: string;
  createdBy?: number;
  createdByUser?: User;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL';

export interface OrderItem {
  id: number;
  orderId: number;
  order?: Order;
  itemId: number;
  item?: InventoryItem;
  barcode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
}

// ============================================================================
// RETURNS AND CREDIT MANAGEMENT TYPES
// ============================================================================

export interface Return {
  id: number;
  returnNumber: string;
  orderId?: number;
  order?: Order;
  customerId?: number;
  customer?: User;
  status: ReturnStatus;
  returnReason: string;
  returnReasonDetails: string;
  totalAmount: number;
  creditAmount: number;
  refundAmount: number;
  restockingFee: number;
  notes: string;
  items: ReturnItem[];
  processedBy?: number;
  processedByUser?: User;
  approvedBy?: number;
  approvedByUser?: User;
  createdAt: string;
  approvedAt?: string;
  processedAt?: string;
  updatedAt: string;
}

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED';

export interface ReturnItem {
  id: number;
  returnId: number;
  returnObj?: Return;
  orderItemId: number;
  orderItem?: OrderItem;
  barcode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  condition: ItemCondition;
  restockable: boolean;
  createdAt: string;
}

export type ItemCondition = 'NEW' | 'USED' | 'DAMAGED' | 'DEFECTIVE' | 'UNKNOWN';

export interface CustomerCredit {
  id: number;
  customerId: number;
  customer?: User;
  balance: number;
  totalEarned: number;
  totalUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: number;
  customerId: number;
  customer?: User;
  transactionType: CreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: CreditReferenceType;
  referenceId?: number;
  description: string;
  createdBy?: number;
  createdByUser?: User;
  createdAt: string;
}

export type CreditTransactionType = 'CREDIT' | 'DEBIT';
export type CreditReferenceType = 'RETURN' | 'ORDER' | 'ADJUSTMENT' | 'REFUND';

// ============================================================================
// API REQUEST AND RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  data?: T;
  message: string;
  success: boolean;
  errors?: Record<string, string[]>;
  timestamp?: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  fieldErrors?: Record<string, string[]>;
}

export interface PaginatedResponse<T = any> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
  pageSize?: number;
  currentPage?: number;
  totalPages?: number;
}

// Authentication API types
export interface LoginRequest {
  code: string;
  state?: string;
  redirectUri: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// User management API types
export interface CreateUserRequest {
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  isApproved?: boolean;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export interface UserApprovalRequest {
  userId: number;
  approved: boolean;
  notes?: string;
}

// Inventory API types
export interface CreateInventoryItemRequest {
  barcode: string;
  name: string;
  description?: string;
  categoryId?: number;
  unitPrice: number;
  stockQuantity: number;
  minStockLevel?: number;
  maxStockLevel?: number;
}

export interface UpdateInventoryItemRequest {
  name?: string;
  description?: string;
  categoryId?: number;
  unitPrice?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  isActive?: boolean;
}

export interface StockAdjustmentRequest {
  itemId: number;
  quantity: number;
  transactionType: StockTransactionType;
  notes?: string;
}

export interface BulkStockUpdateRequest {
  items: Array<{
    barcode: string;
    quantity: number;
    notes?: string;
  }>;
}

// Order API types
export interface CreateOrderRequest {
  customerId?: number;
  items: CreateOrderItemRequest[];
  paymentMethod?: string;
  taxRate?: number;
  discountAmount?: number;
  notes?: string;
}

export interface CreateOrderItemRequest {
  barcode: string;
  quantity: number;
  unitPrice?: number;
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
}

// Return API types
export interface CreateReturnRequest {
  orderId?: number;
  customerId?: number;
  returnReason?: string;
  returnReasonDetails?: string;
  items: CreateReturnItemRequest[];
  notes?: string;
}

export interface CreateReturnItemRequest {
  orderItemId: number;
  quantity: number;
  condition?: ItemCondition;
  restockable?: boolean;
}

export interface ProcessReturnRequest {
  returnId: number;
  creditAmount?: number;
  refundAmount?: number;
  restockingFee?: number;
  notes?: string;
}

// Credit API types
export interface ApplyCreditRequest {
  customerId: number;
  amount: number;
  description?: string;
}

export interface UseCreditRequest {
  customerId: number;
  amount: number;
  referenceType?: CreditReferenceType;
  referenceId?: number;
  description?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationEvent {
  id: number;
  userId: number;
  user?: User;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: string;
  readAt?: string;
}

export type NotificationType =
  | 'LOW_STOCK'
  | 'ORDER_STATUS'
  | 'USER_APPROVAL'
  | 'RETURN_PROCESSED'
  | 'SYSTEM_ALERT'
  | 'PAYMENT_FAILED'
  | 'INVENTORY_ALERT'
  | 'CREDIT_APPLIED';

export interface CreateNotificationRequest {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationPreferencesUpdate {
  email?: boolean;
  inApp?: boolean;
  lowStock?: boolean;
  orderUpdates?: boolean;
  returnUpdates?: boolean;
  approvalRequests?: boolean;
  systemAlerts?: boolean;
}
// ============================================================================
// BARCODE AND SCANNING TYPES
// ============================================================================

export interface BarcodeValidationResult {
  isValid: boolean;
  format?: string;
  error?: string;
}

export type BarcodeFormat =
  | 'UPC-A'
  | 'UPC-E'
  | 'EAN-13'
  | 'EAN-8'
  | 'Code 128'
  | 'Code 39'
  | 'ITF'
  | 'Codabar';

export interface BarcodeResult {
  text: string;
  format: BarcodeFormat;
  timestamp: number;
  confidence?: number;
}

export interface ScannerConfig {
  fps: number;
  qrbox: number | { width: number; height: number };
  aspectRatio: number;
  disableFlip: boolean;
  supportedScanTypes: string[];
  verbose?: boolean;
}

// ============================================================================
// DASHBOARD AND REPORTING TYPES
// ============================================================================

export interface DashboardMetrics {
  totalInventoryItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalInventoryValue: number;
  pendingOrders: number;
  processingOrders: number;
  todaysSales: number;
  todaysOrders: number;
  pendingReturns: number;
  totalCustomers: number;
  approvedCustomers: number;
  pendingApprovals: number;
  totalCredits: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'ORDER' | 'RETURN' | 'INVENTORY' | 'USER' | 'CREDIT';
  title: string;
  description: string;
  timestamp: string;
  userId?: number;
  user?: User;
  metadata?: Record<string, any>;
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  customerId?: number;
  status?: string;
  paymentMethod?: string;
  userId?: number;
  limit?: number;
  offset?: number;
}

export interface SalesReport {
  period: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalItems: number;
  topItems: Array<{
    item: InventoryItem;
    quantitySold: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    date: string;
    sales: number;
    orders: number;
  }>;
  salesByCategory: Array<{
    category: InventoryCategory;
    sales: number;
    orders: number;
  }>;
}

export interface InventoryReport {
  totalItems: number;
  totalValue: number;
  lowStockItems: InventoryItem[];
  outOfStockItems: InventoryItem[];
  topMovingItems: Array<{
    item: InventoryItem;
    quantityMoved: number;
    direction: 'IN' | 'OUT';
  }>;
  stockByCategory: Array<{
    category: InventoryCategory;
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
  }>;
  recentTransactions: StockTransaction[];
}

export interface CustomerReport {
  totalCustomers: number;
  activeCustomers: number;
  topCustomers: Array<{
    customer: User;
    totalOrders: number;
    totalSpent: number;
    creditBalance: number;
  }>;
  customersByRole: Array<{
    role: UserRole;
    count: number;
  }>;
  recentRegistrations: User[];
}

export interface ReturnReport {
  totalReturns: number;
  totalReturnValue: number;
  returnsByReason: Array<{
    reason: string;
    count: number;
    value: number;
  }>;
  returnsByStatus: Array<{
    status: ReturnStatus;
    count: number;
    value: number;
  }>;
  topReturnedItems: Array<{
    item: InventoryItem;
    returnCount: number;
    returnValue: number;
  }>;
  recentReturns: Return[];
}

// ============================================================================
// FORM AND UI TYPES
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
  disabled?: boolean;
  hidden?: boolean;
}

export type FormFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'datetime'
  | 'barcode'
  | 'currency'
  | 'phone';

export interface FormErrors {
  [key: string]: string | string[];
}

export interface TableColumn<T = any> {
  key: keyof T | string;
  title: string;
  dataIndex?: keyof T | string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
}

export interface TableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: PaginationConfig;
  rowKey?: keyof T | ((record: T) => string | number);
  onRowClick?: (record: T, index: number) => void;
  selection?: {
    selectedRowKeys: (string | number)[];
    onChange: (selectedRowKeys: (string | number)[], selectedRows: T[]) => void;
  };
  expandable?: {
    expandedRowRender: (record: T) => React.ReactNode;
    rowExpandable?: (record: T) => boolean;
  };
}

export interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number, range: [number, number]) => string;
  onChange: (page: number, pageSize: number) => void;
}

// ============================================================================
// PWA AND OFFLINE TYPES
// ============================================================================

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  data: any;
  timestamp: number;
  token: string;
  retryCount: number;
  maxRetries: number;
}

export type OfflineActionType =
  | 'CREATE_ORDER'
  | 'UPDATE_INVENTORY'
  | 'PROCESS_RETURN'
  | 'UPDATE_USER'
  | 'CREATE_NOTIFICATION';

export interface SyncStatus {
  isOnline: boolean;
  lastSync: string;
  pendingActions: number;
  syncInProgress: boolean;
  syncErrors: string[];
}

// ============================================================================
// UTILITY AND COMMON TYPES
// ============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated?: string;
}

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditableEntity extends BaseEntity {
  createdBy?: number;
  createdByUser?: User;
  updatedBy?: number;
  updatedByUser?: User;
}

export interface SoftDeletableEntity extends AuditableEntity {
  isActive: boolean;
  deletedAt?: string;
  deletedBy?: number;
  deletedByUser?: User;
}

// React component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export interface RouteGuardProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  requiredPermissions?: string[];
  requireApproval?: boolean;
  fallback?: React.ReactNode;
}

// Theme and styling types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  breakpoints: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      xxl: string;
    };
    fontWeight: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
}

// ============================================================================
// ADDITIONAL API TYPES FOR COMPREHENSIVE COVERAGE
// ============================================================================

// Bulk operations
export interface BulkOperationRequest<T = any> {
  items: T[];
  operation: 'create' | 'update' | 'delete';
  options?: Record<string, any>;
}

export interface BulkOperationResponse<T = any> {
  successful: T[];
  failed: Array<{
    item: T;
    error: string;
    index: number;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Search and filtering
export interface SearchRequest {
  query: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    pageSize: number;
  };
}

export interface SearchResponse<T = any> extends PaginatedResponse<T> {
  query: string;
  filters: Record<string, any>;
  totalTime: number;
  suggestions?: string[];
}

// File upload types
export interface FileUploadRequest {
  file: File;
  category?: string;
  metadata?: Record<string, any>;
}

export interface FileUploadResponse {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

// Export types
export interface ExportRequest {
  format: 'pdf' | 'excel' | 'csv';
  data?: any[];
  template?: string;
  options?: Record<string, any>;
}

export interface ExportResponse {
  id: string;
  filename: string;
  url: string;
  format: string;
  size: number;
  expiresAt: string;
  createdAt: string;
}

// System health and monitoring
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    error?: string;
  }>;
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
}

// Audit log types
export interface AuditLogEntry {
  id: string;
  userId?: number;
  user?: User;
  action: string;
  resource: string;
  resourceId?: number;
  changes?: Record<string, {
    old: any;
    new: any;
  }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface AuditLogRequest {
  startDate?: string;
  endDate?: string;
  userId?: number;
  action?: string;
  resource?: string;
  resourceId?: number;
}

// ============================================================================
// ENHANCED PERMISSION TYPES
// ============================================================================

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  inheritedFrom?: UserRole[];
}

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'process'
  | 'export'
  | 'admin'
  | 'view_all'
  | 'view_own'
  | 'manage';

export type PermissionResource =
  | 'users'
  | 'inventory'
  | 'orders'
  | 'returns'
  | 'credits'
  | 'reports'
  | 'notifications'
  | 'system'
  | 'audit_logs'
  | 'settings';

// Permission check utilities
export interface PermissionCheck {
  resource: PermissionResource;
  action: PermissionAction;
  resourceId?: number;
  conditions?: Record<string, any>;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  conditions?: Record<string, any>;
}

// ============================================================================
// ENHANCED NOTIFICATION TYPES
// ============================================================================

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  bodyTemplate: string;
  emailTemplate?: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    event: string;
    conditions: Record<string, any>;
  };
  template: string;
  recipients: {
    roles?: UserRole[];
    users?: number[];
    conditions?: Record<string, any>;
  };
  channels: ('email' | 'in_app' | 'sms' | 'push')[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: number;
  userId: number;
  channel: 'email' | 'in_app' | 'sms' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  attempts: number;
  lastAttemptAt?: string;
  deliveredAt?: string;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// All types are exported above