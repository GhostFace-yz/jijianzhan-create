import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationReportCard } from '../../src/components/outline/ValidationReportCard';
import type { ValidationReport } from '../../src/types';

const emptyReport: ValidationReport = {
  errors: [],
  warnings: [],
  passes: [],
  passed: true,
};

const reportWithErrors: ValidationReport = {
  passed: false,
  errors: [
    { type: 'character_location', severity: 'error', message: '角色A位置矛盾', details: '第3集同时出现在场景X和场景Y' },
  ],
  warnings: [
    { type: 'emotion_curve', severity: 'warning', message: '情绪曲线连续5集无起伏' },
  ],
  passes: [
    { type: 'costume_continuity', severity: 'pass', message: '服装连续性检查通过' },
  ],
};

const allPassReport: ValidationReport = {
  passed: true,
  errors: [],
  warnings: [],
  passes: [
    { type: 'character_location', severity: 'pass', message: '角色位置一致性检查通过' },
    { type: 'emotion_curve', severity: 'pass', message: '情绪曲线检查通过' },
  ],
};

describe('ValidationReportCard', () => {
  it('shows empty state when no checks run', () => {
    render(<ValidationReportCard report={emptyReport} />);
    expect(screen.getByText(/尚未执行剧本医生检查/)).toBeInTheDocument();
  });

  it('displays error items in red', () => {
    render(<ValidationReportCard report={reportWithErrors} />);
    expect(screen.getByText('角色A位置矛盾')).toBeInTheDocument();
    // Error severity label
    expect(screen.getByText(/错误 · 必须修复/)).toBeInTheDocument();
  });

  it('displays warning items', () => {
    render(<ValidationReportCard report={reportWithErrors} />);
    expect(screen.getByText('情绪曲线连续5集无起伏')).toBeInTheDocument();
    expect(screen.getByText(/警告 · 建议修复/)).toBeInTheDocument();
  });

  it('displays pass items in green', () => {
    render(<ValidationReportCard report={reportWithErrors} />);
    expect(screen.getByText('服装连续性检查通过')).toBeInTheDocument();
    // The section header for passes is rendered
    const passHeaders = screen.getAllByText(/通过/);
    expect(passHeaders.length).toBeGreaterThan(0);
  });

  it('shows passed status when all clear', () => {
    render(<ValidationReportCard report={allPassReport} />);
    expect(screen.getByText(/全部检查通过/)).toBeInTheDocument();
  });

  it('shows error count when errors exist', () => {
    render(<ValidationReportCard report={reportWithErrors} />);
    expect(screen.getByText(/1 项错误/)).toBeInTheDocument();
    expect(screen.getByText(/1 项警告/)).toBeInTheDocument();
  });
});
