import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { Topbar } from '@/components/shared/topbar';
import { AdminSidebar } from '@/components/admin/sidebar';

export default async function AdminReportsPage() {
  const user = await getServerSession();
  if (!user) redirect('/login');
  if (user.role !== 'Admin') redirect('/login');

  return (
    <div className="flex flex-col h-screen">
      <Topbar user={user} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">Laporan</h1>
              <a
                href="/api/reports/export"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                download
              >
                Ekspor CSV
              </a>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                <a
                  key={period}
                  href={`/api/reports/${period}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-semibold text-gray-800 capitalize">{period === 'daily' ? 'Harian' : period === 'weekly' ? 'Mingguan' : 'Bulanan'}</p>
                  <p className="text-xs text-gray-500 mt-1">Klik untuk melihat laporan {period === 'daily' ? 'harian' : period === 'weekly' ? 'mingguan' : 'bulanan'}</p>
                </a>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
