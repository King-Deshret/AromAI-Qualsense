import { supabaseAdmin } from './supabase';
import type { InspectionReport, DecisionValue, RuleEvaluation } from './types';

export interface AutoDecisionResult {
  decision: DecisionValue;
  rules_evaluated: RuleEvaluation[];
}

export async function runAutoDecision(report: InspectionReport): Promise<AutoDecisionResult> {
  const { data: config } = await supabaseAdmin.from('system_config').select('*').single();
  const { data: thresholds } = await supabaseAdmin
    .from('thresholds')
    .select('*')
    .eq('product_type', 'default');

  const rules: RuleEvaluation[] = [];

  if (!config) {
    return { decision: 'QUARANTINED', rules_evaluated: [] };
  }

  // Rule 1: Confidence >= minimum
  const confRule: RuleEvaluation = {
    rule: 'avg_confidence >= confidence_min',
    passed: report.avg_confidence >= config.confidence_min,
    expected: `>= ${config.confidence_min}`,
    actual: String(report.avg_confidence.toFixed(4)),
  };
  rules.push(confRule);

  // Rule 2: Anomaly score — quarantine threshold
  const anomalyQuarantine: RuleEvaluation = {
    rule: 'final_anomaly_score < anomaly_quarantine_threshold',
    passed: report.final_anomaly_score < config.anomaly_quarantine_threshold,
    expected: `< ${config.anomaly_quarantine_threshold}`,
    actual: String(report.final_anomaly_score.toFixed(4)),
  };
  rules.push(anomalyQuarantine);

  // Rule 3: Anomaly score — escalation threshold
  const anomalyEscalation: RuleEvaluation = {
    rule: 'final_anomaly_score < anomaly_escalation_threshold',
    passed: report.final_anomaly_score < config.anomaly_escalation_threshold,
    expected: `< ${config.anomaly_escalation_threshold}`,
    actual: String(report.final_anomaly_score.toFixed(4)),
  };
  rules.push(anomalyEscalation);

  // Grade-specific rules from thresholds table
  if (thresholds?.length) {
    const gradeThreshold = thresholds.find((t) => t.grade === report.final_grade);
    if (gradeThreshold) {
      rules.push({
        rule: `avg_rot_level <= rot_threshold_${report.final_grade.toLowerCase()}`,
        passed: report.avg_rot_level <= gradeThreshold.max_rot_level,
        expected: `<= ${gradeThreshold.max_rot_level}`,
        actual: String(report.avg_rot_level.toFixed(2)),
      });
      rules.push({
        rule: `total_defects <= defect_threshold_${report.final_grade.toLowerCase()}`,
        passed: report.total_defects <= gradeThreshold.max_defect_count,
        expected: `<= ${gradeThreshold.max_defect_count}`,
        actual: String(report.total_defects),
      });
    }
  }

  // Decision logic
  if (!anomalyEscalation.passed) {
    return { decision: 'QUARANTINED', rules_evaluated: rules };
  }

  if (!anomalyQuarantine.passed) {
    return { decision: 'QUARANTINED', rules_evaluated: rules };
  }

  const criticalRules = [confRule];
  const allCriticalPassed = criticalRules.every((r) => r.passed);
  const allPassed = rules.every((r) => r.passed);

  if (allPassed) return { decision: 'APPROVED', rules_evaluated: rules };
  if (!allCriticalPassed || report.final_grade === 'Reject') {
    return { decision: 'REJECTED', rules_evaluated: rules };
  }
  return { decision: 'QUARANTINED', rules_evaluated: rules };
}
