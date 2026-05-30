'use client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './notification-bell';
import type { User } from '@/lib/types';

interface TopbarProps {
  user: User;
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
          A
        </div>
        <span className="text-sm font-semibold text-gray-800">AromAI QC</span>
        <span className="text-xs text-gray-400 ml-2">
          {user.role} — {user.name}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
