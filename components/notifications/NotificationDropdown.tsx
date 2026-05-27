'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Badge,
  Popover,
  Text,
  Stack,
  Group,
  Loader,
  Box,
  ScrollArea,
  UnstyledButton,
} from '@mantine/core';
import { IconBell, IconCircleFilled } from '@tabler/icons-react';

const POLL_INTERVAL = 30_000; // 30 seconds

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_type: string | null;
  reference_id: string | null;
  date_created: string;
}

/**
 * NotificationDropdown component for the app header.
 *
 * - Displays a bell icon with unread count badge
 * - Polls /api/notifications/unread-count every 30 seconds
 * - On click, opens a popover showing recent notifications
 * - Each notification shows title, message, timestamp, read/unread indicator
 * - Clicking a notification marks it as read and navigates to the referenced entity
 *
 * Validates: Requirements 13.7, 13.8
 */
export function NotificationDropdown() {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count', {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.data?.count ?? 0);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchUnreadCount]);

  // Fetch recent notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(
        '/api/items/notifications?sort=-date_created&limit=10&fields=id,title,message,is_read,reference_type,reference_id,date_created',
        { credentials: 'include' }
      );
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data ?? []);
      }
    } catch {
      // Silently ignore fetch errors
    } finally {
      setLoadingList(false);
    }
  }, []);

  // When popover opens, fetch notifications
  useEffect(() => {
    if (opened) {
      fetchNotifications();
    }
  }, [opened, fetchNotifications]);

  // Mark a notification as read
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/items/notifications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      // Decrement unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently ignore mark-as-read errors
    }
  };

  // Handle notification click: mark as read and navigate
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setOpened(false);

    // Navigate to the referenced entity
    if (notification.reference_type && notification.reference_id) {
      const path = getNavigationPath(
        notification.reference_type,
        notification.reference_id
      );
      if (path) {
        router.push(path);
      }
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={380}
      position="bottom-end"
      shadow="lg"
      withArrow
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label="Notifications"
          onClick={() => setOpened((o) => !o)}
          pos="relative"
        >
          <IconBell size={22} />
          {unreadCount > 0 && (
            <Badge
              size="xs"
              circle
              color="red"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                padding: '0 4px',
                minWidth: 16,
                height: 16,
                fontSize: 10,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Box px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Badge size="sm" variant="light" color="blue">
                {unreadCount} unread
              </Badge>
            )}
          </Group>
        </Box>

        <ScrollArea.Autosize mah={400}>
          {loadingList ? (
            <Box py="xl" style={{ display: 'flex', justifyContent: 'center' }}>
              <Loader size="sm" />
            </Box>
          ) : notifications.length === 0 ? (
            <Box py="xl" px="md" style={{ textAlign: 'center' }}>
              <Text size="sm" c="dimmed">
                No notifications
              </Text>
            </Box>
          ) : (
            <Stack gap={0}>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Individual notification item in the dropdown list */
function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      px="md"
      py="sm"
      style={{
        display: 'block',
        width: '100%',
        borderBottom: '1px solid var(--mantine-color-gray-1)',
        backgroundColor: notification.is_read
          ? 'transparent'
          : 'var(--mantine-color-blue-0)',
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = notification.is_read
          ? 'transparent'
          : 'var(--mantine-color-blue-0)';
      }}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        {!notification.is_read && (
          <IconCircleFilled
            size={8}
            color="var(--mantine-color-blue-6)"
            style={{ marginTop: 6, flexShrink: 0 }}
          />
        )}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={notification.is_read ? 400 : 600} lineClamp={1}>
            {notification.title}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
            {notification.message}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {formatTimestamp(notification.date_created)}
          </Text>
        </Box>
      </Group>
    </UnstyledButton>
  );
}

/** Format a timestamp into a human-readable relative or absolute string */
function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);
    const diffDay = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return '';
  }
}

/** Map reference_type + reference_id to a navigation path */
function getNavigationPath(
  referenceType: string,
  referenceId: string
): string | null {
  switch (referenceType) {
    case 'lots':
      return `/lots/${referenceId}`;
    case 'inspections':
      return `/lots/${referenceId}`;
    case 'reviews':
      return `/review`;
    default:
      return null;
  }
}
