'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { api } from '@/utils/api';
import { NotificationEvent } from '../../types';
import { Bell, Settings, CheckCircle, Clock, Filter, Search } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Fetch notifications
  const fetchNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: reset ? '1' : page.toString(),
        page_size: '20',
      });

      if (filter === 'unread') {
        params.append('is_read', 'false');
      } else if (filter === 'read') {
        params.append('is_read', 'true');
      }

      if (typeFilter !== 'all') {
        params.append('notification_type', typeFilter);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await api.get(`/api/v1/notifications/notifications/?${params}`);

      if (reset) {
        setNotifications(response.data.results);
        setPage(1);
      } else {
        setNotifications(prev => [...prev, ...response.data.results]);
      }

      setHasMore(!!response.data.next);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setErrorMsg('Failed to load notifications. Please refresh the page.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, searchQuery, page]);

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      await api.post(`/api/v1/notifications/notifications/${notificationId}/mark-read/`);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setErrorMsg(error instanceof Error ? error.message : 'Failed to mark as read');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.post('/api/v1/notifications/notifications/mark-all-read/');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setErrorMsg(error instanceof Error ? error.message : 'Failed to mark all as read');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Load more notifications
  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  // Effect to fetch notifications when filters change
  useEffect(() => {
    fetchNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeFilter, searchQuery]);

  // Effect to fetch more notifications when page changes
  useEffect(() => {
    if (page > 1) {
      fetchNotifications(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return '📦';
      case 'ORDER_STATUS':
        return '🛍️';
      case 'USER_APPROVAL':
        return '👤';
      case 'RETURN_PROCESSED':
        return '↩️';
      case 'SYSTEM_ALERT':
        return '⚠️';
      default:
        return '📢';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  const notificationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'LOW_STOCK', label: 'Low Stock' },
    { value: 'ORDER_STATUS', label: 'Order Updates' },
    { value: 'USER_APPROVAL', label: 'User Approvals' },
    { value: 'RETURN_PROCESSED', label: 'Returns' },
    { value: 'SYSTEM_ALERT', label: 'System Alerts' },
  ];

  return (
    <ProtectedRoute requireApproval>
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <Bell className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                  <p className="text-gray-600">Stay updated with system activities</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={markAllAsRead}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark All Read
                </button>
                <a
                  href="/notifications/preferences"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Preferences
                </a>
              </div>
            </div>

            {/* Error toast */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4 text-sm">
                {errorMsg}
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notifications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="sm:w-40">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | 'unread' | 'read')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>

                {/* Type Filter */}
                <div className="sm:w-48">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {notificationTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
                  <p className="text-gray-500">
                    {filter === 'unread' ? 'You have no unread notifications.' :
                      filter === 'read' ? 'You have no read notifications.' :
                        'You have no notifications yet.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">
                            {getNotificationIcon(notification.type)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </h3>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="inline-flex items-center">
                              <Filter className="h-3 w-3 mr-1" />
                              {notification.type.replace('_', ' ').toLowerCase()}
                            </span>
                            {notification.isRead && (
                              <span className="inline-flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Read
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Load More Button */}
              {hasMore && notifications.length > 0 && (
                <div className="p-6 border-t border-gray-100 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}