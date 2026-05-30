// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'Operator' | 'Manager' | 'Admin';
export type UserStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'INACTIVE';

export type LotStatus =
  | 'INSPECTION_RUNNING'
  | 'MANAGER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'QUARANTINED'
  | 'ESCALATED';

export type SessionStatus = 'RUNNING' | 'COMPLETED';
export type SessionEndReason =
  | 'CONVEYOR_STOPPED'
  | 'UNIT_COUNT_REACHED'
  | 'MAX_DURATION'
  | 'MANUAL';

export type Grade = 'A' | 'B' | 'C' | 'Reject';
export type RotCategory = 'Fresh' | 'Early Decay' | 'Moderate' | 'Severely Rotten';
export type ColorCategory = 'Normal' | 'Pucat' | 'Terlalu Matang' | 'Abnormal';
export type DefectSeverity = 'Minor' | 'Moderate' | 'Severe';

export type DecisionValue = 'APPROVED' | 'REJECTED' | 'QUARANTINED' | 'ESCALATED';

export type NotificationType =
  | 'SESSION_COMPLETE'
  | 'LOT_READY_FOR_REVIEW'
  | 'LOT_APPROVED'
  | 'LOT_REJECTED'
  | 'LOT_QUARANTINED'
  | 'LOT_ESCALATED'
  | 'CRITICAL_QUALITY_ALERT'
  | 'SYSTEM_ALERT'
  | 'USER_ALERT'
  | 'DATA_ALERT'
  | 'PERFORMANCE_ALERT'
  | 'CRON_REPORT_READY';

export type ShiftName = 'Pagi' | 'Siang' | 'Malam';
export type ShiftAssignmentStatus = 'ACTIVE' | 'INACTIVE';
export type AiServiceStatus = 'HEALTHY' | 'UNHEALTHY';

// ─── Database Entities ────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  shift?: ShiftName;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  lot_code: string;
  batch_name: string;
  product_type: string;
  estimated_units: number;
  production_date: string;
  shift: ShiftName;
  operator_id: string;
  status: LotStatus;
  created_at: string;
  updated_at: string;
  status_changed_at: string;
  operator?: User;
}

export interface InspectionSession {
  id: string;
  lot_id: string;
  operator_id: string;
  started_at: string;
  ended_at?: string;
  status: SessionStatus;
  end_reason?: SessionEndReason;
  lot?: Lot;
}

export interface FrameData {
  id: string;
  session_id: string;
  lot_id: string;
  object_class: string;
  confidence_score: number;
  rot_level: number;
  color_rgb: { r: number; g: number; b: number };
  color_deviation: number;
  color_category: ColorCategory;
  defect_types: string[];
  defect_count: number;
  defect_severity: DefectSeverity;
  anomaly_score: number;
  bbox_coordinates: { x: number; y: number; width: number; height: number };
  frame_timestamp: string;
}

export interface InspectionReport {
  id: string;
  lot_id: string;
  session_id: string;
  final_grade: Grade;
  avg_confidence: number;
  avg_rot_level: number;
  final_anomaly_score: number;
  dominant_color_category: ColorCategory;
  total_defects: number;
  defect_distribution: Record<string, number>;
  total_objects_scanned: number;
  pass_count: number;
  fail_count: number;
  inspection_duration: number;
  snapshot_urls: string[];
  created_at: string;
}

export interface Decision {
  id: string;
  lot_id: string;
  inspection_report_id: string;
  decision: DecisionValue;
  decided_by?: string;
  is_system_decision: boolean;
  rules_evaluated: RuleEvaluation[];
  override_reason?: string;
  escalation_reason?: string;
  decided_at: string;
  decider?: User;
}

export interface RuleEvaluation {
  rule: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  confidence_min: number;
  rot_threshold_a: number;
  rot_threshold_b: number;
  rot_threshold_c: number;
  defect_threshold_a: number;
  defect_threshold_b: number;
  defect_threshold_c: number;
  anomaly_quarantine_threshold: number;
  anomaly_escalation_threshold: number;
  session_max_duration_sec: number;
  conveyor_stop_detect_sec: number;
  camera_url: string;
  camera_resolution: string;
  camera_fps: number;
  notification_config: NotificationConfig;
  cron_config: CronConfig;
  ai_service_status: AiServiceStatus;
  updated_at: string;
}

export type NotificationConfig = {
  [eventType: string]: { in_app: boolean; email: boolean; push: boolean } | string[];
} & {
  report_recipients: string[];
}

export interface CronConfig {
  metrics_refresh_cron: string;
  camera_health_cron: string;
  daily_report_cron: string;
  archive_frame_data_cron: string;
  weekly_report_cron: string;
  monthly_report_cron: string;
  cleanup_cold_storage_cron: string;
  active_data_retention_days: number;
  cold_storage_retention_days: number;
}

export interface Threshold {
  id: string;
  product_type: string;
  grade: Grade;
  min_confidence: number;
  max_rot_level: number;
  max_defect_count: number;
  max_anomaly_score: number;
}

export interface ShiftAssignment {
  id: string;
  shift_name: ShiftName;
  operator_id: string;
  manager_id: string;
  effective_date: string;
  status: ShiftAssignmentStatus;
  operator?: User;
  manager?: User;
}

export interface AuditLog {
  id: string;
  action_type: string;
  actor_id?: string;
  target_type: string;
  target_id: string;
  value_before?: Record<string, unknown>;
  value_after?: Record<string, unknown>;
  ip_address?: string;
  status: string;
  created_at: string;
  actor?: User;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  code: string;
  message: string;
  errors?: Array<{
    field: string;
    constraint: string;
    message: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

// ─── Session & Auth ───────────────────────────────────────────────────────────

export interface AuthSession {
  user: User;
  token: string;
  expires_at: string;
}

// ─── Dashboard Aggregates ─────────────────────────────────────────────────────

export interface LiveSessionAggregate {
  total_objects_scanned: number;
  pass_count: number;
  fail_count: number;
  avg_confidence: number;
  avg_rot_level: number;
  avg_anomaly_score: number;
  defect_distribution: Record<string, number>;
  estimated_grade: Grade;
}

export interface MetricsSummary {
  pending_lots: number;
  pass_rate: number;
  fail_rate: number;
  avg_confidence: number;
  total_approved_today: number;
  total_rejected_today: number;
  total_quarantined_today: number;
  active_operators: number;
  active_managers: number;
  unhandled_alerts: number;
}

// ─── YOLO Frame Payload ───────────────────────────────────────────────────────

export interface YoloFramePayload {
  lot_id: string;
  session_id: string;
  object_class: string;
  confidence_score: number;
  rot_level: number;
  color_rgb: { r: number; g: number; b: number };
  color_deviation: number;
  color_category: ColorCategory;
  defect_types: string[];
  defect_count: number;
  defect_severity: DefectSeverity;
  anomaly_score: number;
  bbox_coordinates: { x: number; y: number; width: number; height: number };
  frame_timestamp: string;
}

// ─── State Machine ────────────────────────────────────────────────────────────

export const VALID_STATUS_TRANSITIONS: Record<LotStatus, LotStatus[]> = {
  INSPECTION_RUNNING: ['MANAGER_REVIEW'],
  MANAGER_REVIEW: ['APPROVED', 'REJECTED', 'QUARANTINED', 'ESCALATED'],
  ESCALATED: ['APPROVED', 'REJECTED', 'QUARANTINED'],
  APPROVED: [],
  REJECTED: [],
  QUARANTINED: [],
};
