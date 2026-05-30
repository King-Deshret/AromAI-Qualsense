// Supabase database type stubs.
// Replace with: npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string; name: string; email: string; role: string; status: string;
          shift: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; name: string; email: string; role: string;
          status?: string; shift?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; name?: string; email?: string; role?: string;
          status?: string; shift?: string | null; updated_at?: string;
        };
        Relationships: [];
      };
      lots: {
        Row: {
          id: string; lot_code: string; batch_name: string; product_type: string;
          estimated_units: number; production_date: string; shift: string;
          operator_id: string; status: string; created_at: string;
          updated_at: string; status_changed_at: string;
        };
        Insert: {
          id?: string; lot_code: string; batch_name: string; product_type: string;
          estimated_units: number; production_date: string; shift: string;
          operator_id: string; status?: string; created_at?: string;
          updated_at?: string; status_changed_at?: string;
        };
        Update: {
          lot_code?: string; batch_name?: string; product_type?: string;
          estimated_units?: number; production_date?: string; shift?: string;
          status?: string; updated_at?: string; status_changed_at?: string;
        };
        Relationships: [];
      };
      inspection_sessions: {
        Row: {
          id: string; lot_id: string; operator_id: string; started_at: string;
          ended_at: string | null; status: string; end_reason: string | null;
        };
        Insert: {
          id?: string; lot_id: string; operator_id: string; started_at?: string;
          ended_at?: string | null; status?: string; end_reason?: string | null;
        };
        Update: {
          ended_at?: string | null; status?: string; end_reason?: string | null;
        };
        Relationships: [];
      };
      frame_data: {
        Row: {
          id: string; session_id: string; lot_id: string; object_class: string;
          confidence_score: number; rot_level: number; color_rgb: Json;
          color_deviation: number; color_category: string; defect_types: Json;
          defect_count: number; defect_severity: string; anomaly_score: number;
          bbox_coordinates: Json; frame_timestamp: string;
        };
        Insert: {
          id?: string; session_id: string; lot_id: string; object_class: string;
          confidence_score: number; rot_level: number; color_rgb: Json;
          color_deviation: number; color_category: string; defect_types: Json;
          defect_count: number; defect_severity: string; anomaly_score: number;
          bbox_coordinates: Json; frame_timestamp?: string;
        };
        Update: {
          confidence_score?: number; rot_level?: number; anomaly_score?: number;
        };
        Relationships: [];
      };
      inspection_reports: {
        Row: {
          id: string; lot_id: string; session_id: string; final_grade: string;
          avg_confidence: number; avg_rot_level: number; final_anomaly_score: number;
          dominant_color_category: string; total_defects: number;
          defect_distribution: Json; total_objects_scanned: number;
          pass_count: number; fail_count: number; inspection_duration: number;
          snapshot_urls: Json; created_at: string;
        };
        Insert: {
          id?: string; lot_id: string; session_id: string; final_grade: string;
          avg_confidence: number; avg_rot_level: number; final_anomaly_score: number;
          dominant_color_category: string; total_defects: number;
          defect_distribution: Json; total_objects_scanned: number;
          pass_count: number; fail_count: number; inspection_duration: number;
          snapshot_urls?: Json; created_at?: string;
        };
        Update: {
          snapshot_urls?: Json;
        };
        Relationships: [];
      };
      decisions: {
        Row: {
          id: string; lot_id: string; inspection_report_id: string; decision: string;
          decided_by: string | null; is_system_decision: boolean;
          rules_evaluated: Json; override_reason: string | null;
          escalation_reason: string | null; decided_at: string;
        };
        Insert: {
          id?: string; lot_id: string; inspection_report_id: string; decision: string;
          decided_by?: string | null; is_system_decision?: boolean;
          rules_evaluated?: Json; override_reason?: string | null;
          escalation_reason?: string | null; decided_at?: string;
        };
        Update: {
          decision?: string; override_reason?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string; user_id: string; type: string; title: string; message: string;
          is_read: boolean; reference_type: string | null; reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string; user_id: string; type: string; title: string; message: string;
          is_read?: boolean; reference_type?: string | null; reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
      system_config: {
        Row: {
          id: string; confidence_min: number; rot_threshold_a: number;
          rot_threshold_b: number; rot_threshold_c: number;
          defect_threshold_a: number; defect_threshold_b: number; defect_threshold_c: number;
          anomaly_quarantine_threshold: number; anomaly_escalation_threshold: number;
          session_max_duration_sec: number; conveyor_stop_detect_sec: number;
          camera_url: string; camera_resolution: string; camera_fps: number;
          notification_config: Json; cron_config: Json; ai_service_status: string;
          updated_at: string;
        };
        Insert: {
          id?: string; confidence_min?: number; rot_threshold_a?: number;
          rot_threshold_b?: number; rot_threshold_c?: number;
          defect_threshold_a?: number; defect_threshold_b?: number; defect_threshold_c?: number;
          anomaly_quarantine_threshold?: number; anomaly_escalation_threshold?: number;
          session_max_duration_sec?: number; conveyor_stop_detect_sec?: number;
          camera_url?: string; camera_resolution?: string; camera_fps?: number;
          notification_config?: Json; cron_config?: Json; ai_service_status?: string;
          updated_at?: string;
        };
        Update: {
          confidence_min?: number; rot_threshold_a?: number; rot_threshold_b?: number;
          rot_threshold_c?: number; defect_threshold_a?: number; defect_threshold_b?: number;
          defect_threshold_c?: number; anomaly_quarantine_threshold?: number;
          anomaly_escalation_threshold?: number; session_max_duration_sec?: number;
          conveyor_stop_detect_sec?: number; camera_url?: string; camera_resolution?: string;
          camera_fps?: number; notification_config?: Json; cron_config?: Json;
          ai_service_status?: string; updated_at?: string;
        };
        Relationships: [];
      };
      thresholds: {
        Row: {
          id: string; product_type: string; grade: string; min_confidence: number;
          max_rot_level: number; max_defect_count: number; max_anomaly_score: number;
        };
        Insert: {
          id?: string; product_type: string; grade: string; min_confidence: number;
          max_rot_level: number; max_defect_count: number; max_anomaly_score: number;
        };
        Update: {
          min_confidence?: number; max_rot_level?: number;
          max_defect_count?: number; max_anomaly_score?: number;
        };
        Relationships: [];
      };
      shift_assignments: {
        Row: {
          id: string; shift_name: string; operator_id: string; manager_id: string;
          effective_date: string; status: string;
        };
        Insert: {
          id?: string; shift_name: string; operator_id: string; manager_id: string;
          effective_date: string; status?: string;
        };
        Update: {
          shift_name?: string; operator_id?: string; manager_id?: string;
          effective_date?: string; status?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string; action_type: string; actor_id: string | null;
          target_type: string; target_id: string; value_before: Json | null;
          value_after: Json | null; ip_address: string | null; status: string;
          created_at: string;
        };
        Insert: {
          id?: string; action_type: string; actor_id?: string | null;
          target_type: string; target_id: string; value_before?: Json | null;
          value_after?: Json | null; ip_address?: string | null;
          status?: string; created_at?: string;
        };
        // DB-level immutability enforced via SQL RULE — app-level Update kept for type compat
        Update: {
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
