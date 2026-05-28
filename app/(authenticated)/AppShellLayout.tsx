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
  Badge,
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
  IconChevronDown,
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

const ROLE_BADGE_COLOR: Record<UserRole, string> = {
  operator: '#2d6b45',
  qc_manager: '#1a4a2e',
  admin: '#c9a84c',
};

const ROLE_LABEL: Record<UserRole, string> = {
  operator: 'Operator',
  qc_manager: 'QC Manager',
  admin: 'Admin',
};

/** Navigation items with role-based visibility */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <IconDashboard size={18} />, minRole: 'operator' },
  { label: 'Lots', href: '/lots', icon: <IconPackage size={18} />, minRole: 'operator' },
  { label: 'New Lot', href: '/lots/new', icon: <IconPlus size={18} />, minRole: 'operator' },
  { label: 'Review Queue', href: '/review', icon: <IconClipboardCheck size={18} />, minRole: 'qc_manager' },
  { label: 'Reports', href: '/reports', icon: <IconChartBar size={18} />, minRole: 'qc_manager' },
  { label: 'Users', href: '/admin/users', icon: <IconUsers size={18} />, minRole: 'admin' },
  { label: 'Thresholds', href: '/admin/thresholds', icon: <IconAdjustments size={18} />, minRole: 'admin' },
  { label: 'System Config', href: '/admin/config', icon: <IconSettings size={18} />, minRole: 'admin' },
  { label: 'Audit Log', href: '/admin/audit', icon: <IconFileText size={18} />, minRole: 'admin' },
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
          background: '#0d2818',
        }}
      >
        <Loader size="lg" color="#c9a84c" />
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
      navbar={{ width: 240, breakpoint: 'sm' }}
      padding="md"
      styles={{
        root: { background: '#0d2818' },
        main: { background: '#0d2818', color: '#fff' },
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <AppShell.Header
        style={{
          background: 'rgba(13, 40, 24, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
        }}
      >
        <Group h="100%" px="md" justify="space-between">
          {/* Brand */}
          <Group gap={10}>
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(201, 168, 76, 0.15)',
                border: '1px solid rgba(201, 168, 76, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: 900, color: '#c9a84c', fontStyle: 'italic' }}>
                AQ
              </Text>
            </Box>
            <Text
              style={{
                fontWeight: 900,
                fontStyle: 'italic',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#fff',
                fontSize: '1rem',
              }}
            >
              AROMAI QC
            </Text>
          </Group>

          {/* Right side */}
          <Group gap="sm">
            <NotificationDropdown />

            {/* User menu */}
            <Menu shadow="xl" width={220} position="bottom-end">
              <Menu.Target>
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                  }}
                >
                  <Box
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(201, 168, 76, 0.2)',
                      border: '1px solid rgba(201, 168, 76, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconUser size={14} color="#c9a84c" />
                  </Box>
                  <Box>
                    <Text size="xs" fw={600} style={{ color: '#fff', lineHeight: 1.2 }}>
                      {displayName}
                    </Text>
                    {userRole && (
                      <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.2, fontSize: '0.65rem' }}>
                        {ROLE_LABEL[userRole]}
                      </Text>
                    )}
                  </Box>
                  <IconChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </Box>
              </Menu.Target>

              <Menu.Dropdown
                style={{
                  background: '#0d2818',
                  border: '1px solid rgba(201, 168, 76, 0.2)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}
              >
                <Menu.Label style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Group gap={6}>
                    <Text size="xs">{displayName}</Text>
                    {userRole && (
                      <Badge
                        size="xs"
                        style={{
                          background: ROLE_BADGE_COLOR[userRole],
                          color: '#fff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontSize: '0.6rem',
                        }}
                      >
                        {ROLE_LABEL[userRole]}
                      </Badge>
                    )}
                  </Group>
                </Menu.Label>
                <Menu.Divider style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  onClick={handleLogout}
                  style={{ color: '#f87171' }}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <AppShell.Navbar
        p="xs"
        style={{
          background: 'rgba(13, 40, 24, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(201, 168, 76, 0.1)',
        }}
      >
        <Stack gap={2}>
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href + '/'));

            return (
              <Box
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  position: 'relative',
                  background: isActive
                    ? 'rgba(201, 168, 76, 0.12)'
                    : 'transparent',
                  borderLeft: isActive
                    ? '3px solid #c9a84c'
                    : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Box
                  style={{
                    color: isActive ? '#c9a84c' : 'rgba(255,255,255,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
                <Text
                  size="xs"
                  style={{
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontWeight: isActive ? 700 : 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    fontSize: '0.72rem',
                  }}
                >
                  {item.label}
                </Text>
              </Box>
            );
          })}
        </Stack>
      </AppShell.Navbar>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

/* ─── Tiny helper ─────────────────────────────────────────────────────────── */
function Stack({ children, gap }: { children: React.ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: gap ?? 0 }}>
      {children}
    </div>
  );
}
