import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { Topbar } from '@/components/shared/topbar';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminNotificationsModule } from '@/components/admin/notifications-module';

export default async function AdminNotificationsPage() {
  const user = await getServerSession();
  if (!user) redirect('/login');
  if (user.role !== 'Admin') redirect('/login');

  return (
    <div className="flex flex-col h-screen">
      <Topbar user={user} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <AdminNotificationsModule />
        </main>
      </div>
    </div>
  );
}
