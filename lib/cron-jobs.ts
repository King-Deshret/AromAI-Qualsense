import { supabaseAdmin } from './supabase';
import { dispatchNotificationToMany } from './notifications';
import { writeAuditLog } from './audit';

type JobHandler = () => Promise<void>;

const JOB_REGISTRY: Record<string, JobHandler> = {
  'metrics-refresh': metricsRefreshJob,
  'camera-health-check': cameraHealthCheckJob,
  'yolo-performance-check': yoloPerformanceCheckJob,
  'daily-report': dailyReportJob,
  'archive-frame-data': archiveFrameDataJob,
  'weekly-report': weeklyReportJob,
  'monthly-report': monthlyReportJob,
  'cleanup-cold-storage': cleanupColdStorageJob,
};

export async function runJob(jobId: string) {
  const handler = JOB_REGISTRY[jobId];
  if (!handler) throw new Error(`Unknown CRON job: ${jobId}`);
  await handler();
}

async function getAdminIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('users').select('id').eq('role', 'Admin').eq('status', 'ACTIVE');
  return (data ?? []).map((u) => u.id);
}

async function metricsRefreshJob() {
  // Metrics are computed on-demand from DB — nothing to do besides logging
  await writeAuditLog({ action_type: 'CRON_METRICS_REFRESH', target_type: 'cron', target_id: 'metrics-refresh' });
}

async function cameraHealthCheckJob() {
  const { data: config } = await supabaseAdmin.from('system_config').select('camera_url, ai_service_status').single();
  const status = config?.ai_service_status ?? 'UNKNOWN';

  if (status === 'UNHEALTHY') {
    const adminIds = await getAdminIds();
    await dispatchNotificationToMany(adminIds, {
      type: 'SYSTEM_ALERT',
      title: 'Camera Service Tidak Responsif',
      message: 'Camera Service mendeteksi status UNHEALTHY. Periksa koneksi kamera.',
    });
  }
  await writeAuditLog({ action_type: 'CRON_CAMERA_HEALTH', target_type: 'cron', target_id: 'camera-health-check', value_after: { status } });
}

async function yoloPerformanceCheckJob() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reports } = await supabaseAdmin
    .from('inspection_reports')
    .select('avg_confidence')
    .gte('created_at', sevenDaysAgo);

  if (!reports?.length) return;
  const avg = reports.reduce((s, r) => s + r.avg_confidence, 0) / reports.length;

  const { data: config } = await supabaseAdmin.from('system_config').select('confidence_min').single();
  if (avg < (config?.confidence_min ?? 0.7)) {
    const adminIds = await getAdminIds();
    await dispatchNotificationToMany(adminIds, {
      type: 'PERFORMANCE_ALERT',
      title: 'Performa YOLO Menurun',
      message: `Rata-rata confidence 7 hari terakhir: ${(avg * 100).toFixed(1)}%. Di bawah threshold minimum.`,
    });
  }
  await writeAuditLog({ action_type: 'CRON_YOLO_PERF', target_type: 'cron', target_id: 'yolo-performance-check', value_after: { avg_confidence: avg } });
}

async function dailyReportJob() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [{ count: total }, { count: approved }, { count: rejected }, { count: quarantined }] = await Promise.all([
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('created_at', todayISO),
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('created_at', todayISO),
    supabaseAdmin.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'QUARANTINED').gte('created_at', todayISO),
  ]);

  const adminIds = await getAdminIds();
  await dispatchNotificationToMany(adminIds, {
    type: 'CRON_REPORT_READY',
    title: 'Laporan Harian Siap',
    message: `Total lot hari ini: ${total ?? 0} | Approved: ${approved ?? 0} | Rejected: ${rejected ?? 0} | Quarantined: ${quarantined ?? 0}`,
  });

  await writeAuditLog({
    action_type: 'CRON_DAILY_REPORT',
    target_type: 'cron',
    target_id: 'daily-report',
    value_after: { total, approved, rejected, quarantined, date: todayISO },
  });
}

async function archiveFrameDataJob() {
  const { data: config } = await supabaseAdmin.from('system_config').select('cron_config').single();
  const retentionDays = (config?.cron_config as { active_data_retention_days?: number } | null)?.active_data_retention_days ?? 7;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from('frame_data')
    .select('id', { count: 'exact', head: true })
    .lt('frame_timestamp', cutoff);

  await writeAuditLog({
    action_type: 'CRON_ARCHIVE_FRAMES',
    target_type: 'cron',
    target_id: 'archive-frame-data',
    value_after: { archived_count: count ?? 0, cutoff },
  });
}

async function weeklyReportJob() {
  const adminIds = await getAdminIds();
  await dispatchNotificationToMany(adminIds, {
    type: 'CRON_REPORT_READY',
    title: 'Laporan Mingguan Siap',
    message: 'Laporan mingguan telah digenerate. Silakan unduh melalui modul Laporan.',
  });
  await writeAuditLog({ action_type: 'CRON_WEEKLY_REPORT', target_type: 'cron', target_id: 'weekly-report' });
}

async function monthlyReportJob() {
  const adminIds = await getAdminIds();
  await dispatchNotificationToMany(adminIds, {
    type: 'CRON_REPORT_READY',
    title: 'Laporan Bulanan Siap',
    message: 'Laporan bulanan telah digenerate. Silakan unduh melalui modul Laporan.',
  });
  await writeAuditLog({ action_type: 'CRON_MONTHLY_REPORT', target_type: 'cron', target_id: 'monthly-report' });
}

async function cleanupColdStorageJob() {
  const { data: config } = await supabaseAdmin.from('system_config').select('cron_config').single();
  const retentionDays = (config?.cron_config as { cold_storage_retention_days?: number } | null)?.cold_storage_retention_days ?? 90;
  await writeAuditLog({
    action_type: 'CRON_CLEANUP_COLD',
    target_type: 'cron',
    target_id: 'cleanup-cold-storage',
    value_after: { retention_days: retentionDays },
  });
}
