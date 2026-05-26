// Frontend-specific types that extend shared types
export * from '../shared/constants';

// ============================================================================
// CORE DATA MODEL TYPES
// ============================================================================

export enum UserRole {
  OWNER = 'OWNER',
  OPERATIONS = 'OPERATIONS',
  CASHIER = 'CASHIER',
  DELIVERY = 'DELIVERY',
  CUSTOMER = 'CUSTOMER',
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  isApproved: boolean;
  googleId?: string;
  profile?: UserProfile;
  createdAt: string;
  lastLogin?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  barcode?: string;
  description?: string;
  // Category can be an ID (for form payloads) or a string name (from API responses)
  category?: string | number;
  categoryId?: number;
  // Canonical field names matching backend serializer (camelCase of snake_case)
  unitPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel?: number;
  isActive: boolean;
  // Legacy aliases kept for backward compatibility
  price?: number;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  sku?: string;
  cost?: number;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  inventoryItemId?: number;
  orderId?: number;
  barcode?: string;
  itemName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  // Legacy alias
  price?: number;
  subtotal?: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId?: number;
  items: OrderItem[];
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total?: number;
  totalAmount?: number;
  subtotal?: number;
  taxRate?: number;
  discountAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  // Optional customer object included in some API responses
  customer?: {
    id: number;
    email: string;
    profile?: {
      firstName?: string;
      lastName?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReturnItem {
  id: number;
  orderItemId: number;
  quantity: number;
  reason?: string;
  condition?: string;
  restockable?: boolean;
  barcode?: string;
  itemName?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export interface Return {
  id: number;
  returnNumber: string;
  orderId: number;
  customerId?: number;
  items: ReturnItem[];
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
  returnReason?: string;
  returnReasonDetails?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEvent {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ReportFilters {
  start_date: string;
  end_date: string;
  search: string;
  limit: number;
  offset: number;
  [key: string]: string | number;
}

export interface BarcodeResult {
  text: string;
  format: string;
  timestamp: number;
}

export interface ScannerConfig {
  fps: number;
  qrbox: number;
  aspectRatio: number;
  disableFlip: boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: any; label: string }>;
}

export interface FormErrors {
  [key: string]: string;
}

export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sorter?: boolean | ((a: T, b: T) => number);
  fixed?: 'left' | 'right';
}

export interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  onChange?: (page: number, pageSize: number) => void;
}

export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface Theme {
  mode: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
}

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface CreateInventoryItemRequest {
  name: string;
  barcode?: string;
  description?: string;
  categoryId?: number;
  // Accept both naming conventions
  unitPrice?: number;
  stockQuantity?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  // Legacy aliases
  sku?: string;
  category?: string;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  price?: number;
  cost?: number;
  location?: string;
}

export interface UpdateInventoryItemRequest extends Partial<CreateInventoryItemRequest> {
  id: number;
}

export interface CreateOrderItemRequest {
  barcode?: string;
  inventoryItemId?: number;
  quantity: number;
  unitPrice?: number;
  price?: number;
  itemName?: string;
  availableStock?: number;
  totalPrice?: number;
}

export interface CreateOrderRequest {
  customerId?: number;
  items: Array<CreateOrderItemRequest>;
  paymentMethod?: string;
  taxRate?: number;
  discountAmount?: number;
  notes?: string;
}

export interface CreateReturnItemRequest {
  orderItemId?: number;
  barcode?: string;
  quantity: number;
  reason?: string;
  condition?: string;
  restockable?: boolean;
  itemName?: string;
  unitPrice?: number;
  maxQuantity?: number;
  totalPrice?: number;
}

export interface CreateReturnRequest {
  orderId?: number;
  customerId?: number;
  returnReason?: string;
  returnReasonDetails?: string;
  notes?: string;
  items: Array<CreateReturnItemRequest>;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerCredit {
  id: number;
  customerId: number;
  balance: number;
  currency: string;
}

export interface CreditTransaction {
  id: number;
  customerCreditId: number;
  amount: number;
  type: 'credit' | 'debit';
  description?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  lowStock: boolean;
  orderUpdates: boolean;
  returnUpdates: boolean;
  approvalRequests: boolean;
  systemAlerts: boolean;
}

// Frontend-specific React component types
import * as React from 'react';

// ============================================================================
// REACT COMPONENT PROP TYPES
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  id?: string;
  'data-testid'?: string;
}

export interface RouteGuardProps extends BaseComponentProps {
  requiredRoles?: UserRole[];
  requiredPermissions?: string[];
  requireApproval?: boolean;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export interface LayoutProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  loading?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

// ============================================================================
// FORM COMPONENT TYPES
// ============================================================================

export interface FormProps<T = any> extends BaseComponentProps {
  initialValues?: Partial<T>;
  onSubmit: (values: T) => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  fields: FormField[];
  errors?: FormErrors;
  submitText?: string;
  cancelText?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
}

export interface InputProps extends BaseComponentProps {
  name: string;
  label?: string;
  type?: string;
  value?: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  help?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export interface SelectProps extends Omit<InputProps, 'type'> {
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  loading?: boolean;
}

export interface BarcodeInputProps extends Omit<InputProps, 'type'> {
  onScan?: (result: BarcodeResult) => void;
  scannerConfig?: Partial<ScannerConfig>;
  showScanner?: boolean;
  validateBarcode?: boolean;
}

// ============================================================================
// TABLE COMPONENT TYPES
// ============================================================================

export interface TableProps<T = any> extends BaseComponentProps {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: PaginationConfig;
  rowKey?: keyof T | ((record: T) => string | number);
  onRowClick?: (record: T, index: number) => void;
  selection?: {
    selectedRowKeys: (string | number)[];
    onChange: (selectedRowKeys: (string | number)[], selectedRows: T[]) => void;
    type?: 'checkbox' | 'radio';
  };
  expandable?: {
    expandedRowRender: (record: T) => React.ReactNode;
    rowExpandable?: (record: T) => boolean;
    expandedRowKeys?: (string | number)[];
    onExpandedRowsChange?: (expandedRowKeys: (string | number)[]) => void;
  };
  scroll?: {
    x?: number | string;
    y?: number | string;
  };
  size?: 'small' | 'middle' | 'large';
  bordered?: boolean;
  showHeader?: boolean;
  sticky?: boolean;
}

// ============================================================================
// MODAL AND DRAWER TYPES
// ============================================================================

export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number | string;
  height?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: React.ReactNode;
  loading?: boolean;
  destroyOnClose?: boolean;
}

export interface DrawerProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  width?: number | string;
  height?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: React.ReactNode;
  loading?: boolean;
}

// ============================================================================
// NOTIFICATION COMPONENT TYPES
// ============================================================================

export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
  onClose?: () => void;
  action?: React.ReactNode;
}

export interface ToastProps extends NotificationProps {
  id: string;
  timestamp: number;
}

// ============================================================================
// DASHBOARD COMPONENT TYPES
// ============================================================================

export interface DashboardCardProps extends BaseComponentProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  loading?: boolean;
  onClick?: () => void;
}

export interface ChartProps extends BaseComponentProps {
  data: any[];
  type: 'line' | 'bar' | 'pie' | 'area' | 'column';
  xField?: string;
  yField?: string;
  colorField?: string;
  title?: string;
  height?: number;
  loading?: boolean;
}

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

export interface SearchProps extends BaseComponentProps {
  value?: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  allowClear?: boolean;
  size?: 'small' | 'middle' | 'large';
  enterButton?: boolean | React.ReactNode;
}

export interface FilterProps<T = any> extends BaseComponentProps {
  filters: FilterConfig<T>[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onReset?: () => void;
  loading?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface FilterConfig<T = any> {
  key: keyof T | string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'number' | 'numberRange';
  options?: Array<{ value: any; label: string }>;
  placeholder?: string;
  multiple?: boolean;
}

// ============================================================================
// BARCODE SCANNER COMPONENT TYPES
// ============================================================================

export interface BarcodeScannerProps extends BaseComponentProps {
  onScan: (result: BarcodeResult) => void;
  onError?: (error: string) => void;
  config?: Partial<ScannerConfig>;
  width?: number | string;
  height?: number | string;
  showResult?: boolean;
  continuous?: boolean;
  autoStart?: boolean;
}

// ============================================================================
// INVENTORY COMPONENT TYPES
// ============================================================================

export interface InventoryItemCardProps extends BaseComponentProps {
  item: InventoryItem;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  onStockAdjust?: (item: InventoryItem) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface StockLevelIndicatorProps extends BaseComponentProps {
  current: number;
  minimum: number;
  maximum?: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// ============================================================================
// ORDER COMPONENT TYPES
// ============================================================================

export interface OrderCardProps extends BaseComponentProps {
  order: Order;
  onView?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onProcess?: (order: Order) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface OrderStatusBadgeProps extends BaseComponentProps {
  status: Order['status'];
  size?: 'small' | 'medium' | 'large';
}

// ============================================================================
// RETURN COMPONENT TYPES
// ============================================================================

export interface ReturnCardProps extends BaseComponentProps {
  return: Return;
  onView?: (returnItem: Return) => void;
  onApprove?: (returnItem: Return) => void;
  onReject?: (returnItem: Return) => void;
  onProcess?: (returnItem: Return) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface ReturnStatusBadgeProps extends BaseComponentProps {
  status: Return['status'];
  size?: 'small' | 'medium' | 'large';
}

// ============================================================================
// USER COMPONENT TYPES
// ============================================================================

export interface UserAvatarProps extends BaseComponentProps {
  user: User;
  size?: number | 'small' | 'medium' | 'large';
  showName?: boolean;
  showRole?: boolean;
  onClick?: (user: User) => void;
}

export interface UserRoleBadgeProps extends BaseComponentProps {
  role: UserRole;
  size?: 'small' | 'medium' | 'large';
}

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  dependencies?: any[];
}

export interface UseApiResult<T = any> extends AsyncState<T> {
  execute: (...args: any[]) => Promise<T>;
  reset: () => void;
}

export interface UsePaginationOptions {
  pageSize?: number;
  total?: number;
  onChange?: (page: number, pageSize: number) => void;
}

export interface UsePaginationResult {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger: boolean;
  showQuickJumper: boolean;
  showTotal: (total: number, range: [number, number]) => string;
  onChange: (page: number, pageSize: number) => void;
  reset: () => void;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (credentials: any) => Promise<{ access_token: string; user: User }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isApproved: boolean;
}

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Partial<Theme>) => void;
}

export interface NotificationContextValue {
  notifications: NotificationEvent[];
  unreadCount: number;
  showNotification: (notification: Omit<NotificationProps, 'onClose'>) => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ComponentSize = 'small' | 'medium' | 'large';
export type ComponentVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type ComponentState = 'default' | 'hover' | 'active' | 'disabled' | 'loading';

export interface ComponentTheme {
  size: ComponentSize;
  variant: ComponentVariant;
  state: ComponentState;
}