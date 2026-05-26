'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function NotificationPreferencesPage() {
  return (
    <ProtectedRoute requireApproval>
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Notification Preferences
              </h1>
              <p className="text-gray-600">
                Customize how and when you receive notifications from the system.
              </p>
            </div>

            <NotificationPreferences />
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}