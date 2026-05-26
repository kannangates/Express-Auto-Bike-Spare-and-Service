// Authentication components
export { AuthProvider, useAuth, withAuth } from '../contexts/AuthContext'
export { ProtectedRoute, OwnerRoute, OperationsRoute, CashierRoute, DeliveryRoute, CustomerRoute, AdminRoute, InventoryRoute, OrderRoute, ReportRoute } from './auth/ProtectedRoute'
export { RoleBasedAccess, OwnerOnly, OperationsOnly, CashierOnly, DeliveryOnly, CustomerOnly, AdminOnly, InventoryAccess, OrderAccess, ReportAccess, useRoleBasedAccess } from './auth/RoleBasedAccess'
export { UserProfile, UserProfilePopup } from './auth/UserProfile'

// Layout components
export { MainLayout } from './layout/MainLayout'

// Barcode scanning components
export * from './barcode'

// Inventory management components
export * from './inventory'

// Order management components
export * from './orders'

// Returns management components
export * from './returns'