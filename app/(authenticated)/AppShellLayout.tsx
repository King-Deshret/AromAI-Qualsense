'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AppShell,
  Group,
  Text,
  Menu,
  ActionIcon,
  NavLink,
  Loader,
  Box,
} from '@mantine/core';
import {
  IconDashboard,
  IconPackage,
  IconPlus,
  IconClipboardCheck,
  IconChartBar,
  IconUsers,
  IconAdjustments,
  IconSettings,
  IconFileText,
  IconLogout,
  IconUser,
} from '@tabler/icons-react';
import { NotificationDropdown } from '@/components/notifications';

/** User roles in hierarchical order */
type UserRole = 'operator' | 'qc_manager' | 'admin';

interface SessionUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Minimum role required to see this item */
  minRole: UserRole;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  operator: 0,
  qc_manager: 1,
  admin: 2,
};

/** Navigation items with role-based visibility */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <IconDashboard size={20} />, minRole: 'operator' },
  { label: 'Lots', href: '/lots', icon: <IconPackage size={20} />, minRole: 'operator' },
  { label: 'New Lot', href: '/lots/new', icon: <IconPlus size={20} />, minRole: 'operator' },
  { label: 'Review Queue', href: '/review', icon: <IconClipboardCheck size={20} />, minRole: 'qc_manager' },
  { label: 'Reports', href: '/reports', icon: <IconChartBar size={20} />, minRole: 'qc_manager' },
  { label: 'Users', href: '/admin/users', icon: <IconUsers size={20} />, minRole: 'admin' },
  { label: 'Thresholds', href: '/admin/thresholds', icon: <IconAdjustments size={20} />, minRole: 'admin' },
  { label: 'System Config', href: '/admin/config', icon: <IconSettings size={20} />, minRole: 'admin' },
  { label: 'Audit Log', href: '/admin/audit', icon: <IconFileText size={20} />, minRole: 'admin' },
];

/** Check if a user role meets the minimum required role */
function hasAccess(userRole: UserRole | null, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/** Normalize role string from API to our UserRole type */
function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'qc_manager') return 'qc_manager';
  if (lower === 'operator') return 'operator';
  return null;
}

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch session on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const json = await res.json();
        setUser(json.data?.user ?? null);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Continue with redirect even if logout API fails
    }
    router.replace('/login');
  };

  if (loading) {
    return (
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <Loader size="lg" />
      </Box>
    );
  }

  const userRole = normalizeRole(user?.role);
  const visibleNavItems = NAV_ITEMS.filter((item) => hasAccess(userRole, item.minRole));
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : user?.email ?? 'User';

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      {/* Header */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700} size="lg">
            AromAI QC
          </Text>

          <Group gap="sm">
            {/* Notification dropdown */}
            <NotificationDropdown />

            {/* User menu */}
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" aria-label="User menu">
                  <IconUser size={22} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  {displayName}
                  {userRole && (
                    <Text size="xs" c="dimmed">
                      {userRole.replace('_', ' ').toUpperCase()}
                    </Text>
                  )}
                </Menu.Label>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  onClick={handleLogout}
                  color="red"
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Sidebar Navigation */}
      <AppShell.Navbar p="xs">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.href}
            label={item.label}
            leftSection={item.icon}
            active={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))}
            onClick={() => router.push(item.href)}
            style={{ borderRadius: 6, marginBottom: 2 }}
          />
        ))}
      </AppShell.Navbar>

      {/* Main content */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
