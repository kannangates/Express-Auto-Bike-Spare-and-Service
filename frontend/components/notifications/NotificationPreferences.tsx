'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Bell, Mail, AlertTriangle, Package, ShoppingCart, RotateCcw, Users, Shield } from 'lucide-react';
import { api } from '@/utils/api';
import { NotificationPreferences as NotificationPreferencesType } from '../../types';

interface NotificationPreferencesProps {
  className?: string;
}

interface PreferenceItem {
  key: keyof NotificationPreferencesType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'general' | 'alerts' | 'updates' | 'admin';
}

const preferenceItems: PreferenceItem[] = [
  {
    key: 'email',
    label: 'Email Notifications',
    description: 'Receive notifications via email',
    icon: <Mail className="h-4 w-4" />,
    category: 'general'
  },
  {
    key: 'inApp',
    label: 'In-App Notifications',
    description: 'Show notifications in the application',
    icon: <Bell className="h-4 w-4" />,
    category: 'general'
  },
  {
    key: 'lowStock',
    label: 'Low Stock Alerts',
    description: 'Get notified when inventory items are running low',
    icon: <Package className="h-4 w-4" />,
    category: 'alerts'
  },
  {
    key: 'orderUpdates',
    label: 'Order Updates',
    description: 'Receive notifications about order status changes',
    icon: <ShoppingCart className="h-4 w-4" />,
    category: 'updates'
  },
  {
    key: 'returnUpdates',
    label: 'Return Updates',
    description: 'Get notified about return processing and approvals',
    icon: <RotateCcw className="h-4 w-4" />,
    category: 'updates'
  },
  {
    key: 'approvalRequests',
    label: 'User Approval Requests',
    description: 'Receive notifications for pending user approvals (OWNER only)',
    icon: <Users className="h-4 w-4" />,
    category: 'admin'
  },
  {
    key: 'systemAlerts',
    label: 'System Alerts',
    description: 'Important system notifications and security alerts',
    icon: <Shield className="h-4 w-4" />,
    category: 'alerts'
  }
];

const categoryLabels = {
  general: 'General Settings',
  alerts: 'Alert Notifications',
  updates: 'Status Updates',
  admin: 'Administrative Notifications'
};

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ className = '' }) => {
  const [preferences, setPreferences] = useState<NotificationPreferencesType>({
    email: true,
    inApp: true,
    lowStock: true,
    orderUpdates: true,
    returnUpdates: true,
    approvalRequests: false,
    systemAlerts: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // Fetch current preferences
  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/notifications/preferences/');
      setPreferences(response.data);

      // Get user role from profile or auth context
      const userResponse = await api.get('/api/v1/auth/profile/');
      setUserRole(userResponse.data.role);
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.post('/api/v1/notifications/preferences/update/', preferences);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save notification preferences:', error);
      setError(error.response?.data?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Handle preference change
  const handlePreferenceChange = (key: keyof NotificationPreferencesType, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Load preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, []);

  // Group preferences by category
  const groupedPreferences = preferenceItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category]?.push(item);
    return acc;
  }, {} as Record<string, PreferenceItem[]>);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </div>
                </div>
                <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              <p className="text-sm text-gray-600">Manage how you receive notifications</p>
            </div>
          </div>
          <button
            onClick={savePreferences}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-5 w-5 text-green-500">✓</div>
              </div>
              <p className="ml-2 text-sm text-green-700">Preferences saved successfully!</p>
            </div>
          </div>
        )}

        {/* Preference Categories */}
        <div className="space-y-8">
          {Object.entries(groupedPreferences).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-base font-medium text-gray-900 mb-4">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h3>
              <div className="space-y-3">
                {items.map((item) => {
                  // Hide admin preferences for non-OWNER users
                  if (item.category === 'admin' && userRole !== 'OWNER') {
                    return null;
                  }

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-500">
                          {item.icon}
                        </div>
                        <div>
                          <label
                            htmlFor={item.key}
                            className="text-sm font-medium text-gray-900 cursor-pointer"
                          >
                            {item.label}
                          </label>
                          <p className="text-xs text-gray-600 mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            id={item.key}
                            type="checkbox"
                            checked={preferences[item.key]}
                            onChange={(e) => handlePreferenceChange(item.key, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <Bell className="h-5 w-5 text-blue-500 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">About Notifications</h4>
              <p className="text-sm text-blue-700">
                Email notifications require a valid email address in your profile.
                In-app notifications will appear in the notification bell at the top of the page.
                You can change these preferences at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;