import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import type { ValidationReport, ValidationItem, ValidationSeverity } from '../../types';

export interface ValidationReportCardProps {
  report: ValidationReport;
}

const SEVERITY_ICON: Record<ValidationSeverity, typeof XCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  pass: CheckCircle2,
};

const SEVERITY_COLORS: Record<ValidationSeverity, string> = {
  error: 'border-semantic-error/30 bg-semantic-error/5',
  warning: 'border-semantic-warning/30 bg-semantic-warning/5',
  pass: 'border-semantic-success/30 bg-semantic-success/5',
};

const SEVERITY_TEXT_COLORS: Record<ValidationSeverity, string> = {
  error: 'text-semantic-error',
  warning: 'text-semantic-warning',
  pass: 'text-semantic-success',
};

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  error: '错误 · 必须修复',
  warning: '警告 · 建议修复',
  pass: '通过',
};

/**
 * Displays the validation report from the script doctor (剧本医生).
 * Red = errors (must fix), Yellow = warnings, Green = passes.
 */
export function ValidationReportCard({ report }: ValidationReportCardProps) {
  const sections: { severity: ValidationSeverity; items: ValidationItem[] }[] = [
    { severity: 'error', items: report.errors },
    { severity: 'warning', items: report.warnings },
    { severity: 'pass', items: report.passes },
  ];

  const totalItems = report.errors.length + report.warnings.length + report.passes.length;

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            report.passed
              ? 'bg-card-tint-mint'
              : report.errors.length > 0
                ? 'bg-semantic-error/10'
                : 'bg-card-tint-yellow'
          }`}
        >
          <ShieldAlert
            className={`h-5 w-5 ${
              report.passed
                ? 'text-semantic-success'
                : report.errors.length > 0
                  ? 'text-semantic-error'
                  : 'text-semantic-warning'
            }`}
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">剧本医生检查报告</h2>
          <p className="text-xs text-slate">
            {report.passed
              ? '✅ 全部检查通过'
              : `${report.errors.length} 项错误，${report.warnings.length} 项警告`}
            {totalItems === 0 ? ' · 暂无检查结果' : ` · 共 ${totalItems} 项`}
          </p>
        </div>
      </div>

      {totalItems === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          尚未执行剧本医生检查，点击下方「自洽性检查」按钮开始
        </p>
      ) : (
        <div className="space-y-3">
          {sections.map(({ severity, items }) =>
            items.length > 0 ? (
              <div key={severity}>
                <h3
                  className={`mb-2 text-sm font-semibold ${SEVERITY_TEXT_COLORS[severity]}`}
                >
                  {SEVERITY_LABELS[severity]} ({items.length})
                </h3>
                <div className="space-y-2">
                  {items.map((item, i) => {
                    const Icon = SEVERITY_ICON[severity];
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${SEVERITY_COLORS[severity]}`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${SEVERITY_TEXT_COLORS[severity]}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{item.message}</p>
                          {item.details && (
                            <p className="mt-0.5 text-xs text-slate">{item.details}</p>
                          )}
                          <p className="mt-1 text-xs text-steel capitalize">{item.type}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
