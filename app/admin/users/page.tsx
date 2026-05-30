import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { Topbar } from '@/components/shared/topbar';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminUsersModule } from '@/components/admin/users-module';

export default async function AdminUsersPage() {
  const user = await getServerSession();
  if (!user) redirect('/login');
  if (user.role !== 'Admin') redirect('/login');

  return (
    <div className="flex flex-col h-screen">
      <Topbar user={user} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar activeModule="users" />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <AdminUsersModule />
        </main>
      </div>
    </div>
  );
}
