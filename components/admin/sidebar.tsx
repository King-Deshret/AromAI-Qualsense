'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Package, FileText, Settings, ScrollText, Bell } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, key: 'overview' },
  { href: '/admin/users', label: 'Users', icon: Users, key: 'users' },
  { href: '/admin/lots', label: 'Lots', icon: Package, key: 'lots' },
  { href: '/admin/reports', label: 'Reports', icon: FileText, key: 'reports' },
  { href: '/admin/config', label: 'Config', icon: Settings, key: 'config' },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText, key: 'audit' },
  { href: '/admin/notifications', label: 'Notifikasi', icon: Bell, key: 'notifications' },
];

interface Props {
  activeModule?: string;
}

export function AdminSidebar({ activeModule }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <nav className="flex flex-col gap-1 p-3 mt-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
