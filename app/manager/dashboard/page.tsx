import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { Topbar } from '@/components/shared/topbar';
import { ManagerDashboardClient } from '@/components/manager/dashboard-client';

export default async function ManagerDashboard() {
  const user = await getServerSession();
  if (!user) redirect('/login');
  if (user.role !== 'Manager') redirect('/login');

  return (
    <div className="flex flex-col h-screen">
      <Topbar user={user} />
      <ManagerDashboardClient />
    </div>
  );
}
