import { describe, expect, it } from 'vitest';
import { payrollPolicy } from '../../src/shared/domain';
import {
  calculateBranchPayroll,
  calculatePayroll,
  getPayrollStatus,
} from '../../src/features/payroll/domain';
import type {
  AttendanceSheet,
  BranchPayrollConfirmation,
} from '../../src/features/attendance/model';

const sheet = (
  id: string,
  days: AttendanceSheet['days'],
  overrides: Partial<AttendanceSheet> = {},
): AttendanceSheet => ({
  id,
  branchId: 'minh-khai-1',
  employeeName: `Nhân viên ${id}`,
  monthKey: '2026-08',
  days,
  ...overrides,
});

describe('payroll calculation', () => {
  it('calculates hours, breakfast allowance and monthly allowance', () => {
    const result = calculatePayroll(
      sheet('a', {
        '2026-08-03': { morning: '8', afternoon: '', opening: '' },
        '2026-08-04': { morning: '', afternoon: '8', opening: '' },
      }),
    );

    expect(result.morningHours).toBe(8);
    expect(result.afternoonHours).toBe(8);
    expect(result.totalHours).toBe(16);
    expect(result.morningShifts).toBe(1);
    expect(result.afternoonShifts).toBe(1);
    expect(result.breakfastMoney).toBe(payrollPolicy.breakfastPerMorningShift);
    expect(result.allowanceMoney).toBe(payrollPolicy.monthlyAllowance);
    expect(result.wageMoney).toBe(16 * payrollPolicy.hourlyRate);
    expect(result.totalMoney).toBe(
      16 * payrollPolicy.hourlyRate +
        payrollPolicy.breakfastPerMorningShift +
        payrollPolicy.monthlyAllowance,
    );
  });

  it('counts opening hours as morning work and a breakfast shift', () => {
    const result = calculatePayroll(
      sheet('opening', {
        '2026-08-05': { morning: '', afternoon: '', opening: '2' },
      }),
    );

    expect(result.openingHours).toBe(2);
    expect(result.morningHours).toBe(2);
    expect(result.openingShifts).toBe(1);
    expect(result.morningShifts).toBe(1);
    expect(result.breakfastMoney).toBe(payrollPolicy.breakfastPerMorningShift);
  });

  it('does not pay monthly allowance when there are no worked hours', () => {
    const result = calculatePayroll(
      sheet('empty', {
        '2026-08-06': { morning: '', afternoon: '', opening: '' },
      }),
    );

    expect(result.totalHours).toBe(0);
    expect(result.allowanceMoney).toBe(0);
    expect(result.totalMoney).toBe(0);
  });

  it('uses the employee payroll snapshot instead of global defaults', () => {
    const result = calculatePayroll(
      sheet(
        'custom-policy',
        { '2026-08-03': { morning: '4', afternoon: '', opening: '' } },
        { hourlyRate: 30000, allowance: 350000, breakfastAllowance: 40000 },
      ),
    );

    expect(result.wageMoney).toBe(120000);
    expect(result.breakfastMoney).toBe(40000);
    expect(result.allowanceMoney).toBe(350000);
    expect(result.totalMoney).toBe(510000);
  });
});

describe('payroll approval status', () => {
  it('moves through draft -> employee -> manager -> branch submitted', () => {
    const draft = sheet('status', {});
    expect(getPayrollStatus(draft)).toBe('draft');

    const employee = { ...draft, employeeConfirmedAt: '2026-08-08T01:00:00.000Z' };
    expect(getPayrollStatus(employee)).toBe('employee_submitted');

    const approved = {
      ...employee,
      managerApprovedAt: '2026-08-08T02:00:00.000Z',
      managerApprovedBy: 'manager-1',
    };
    expect(getPayrollStatus(approved)).toBe('manager_approved');

    const confirmation: BranchPayrollConfirmation = {
      id: 'confirm-1',
      branchId: approved.branchId,
      monthKey: approved.monthKey,
      managerConfirmedAt: '2026-08-08T03:00:00.000Z',
    };
    expect(getPayrollStatus(approved, confirmation)).toBe('branch_submitted');
  });
});

describe('branch payroll aggregation', () => {
  it('aggregates employees, hours and money from individual sheets', () => {
    const first = sheet('first', {
      '2026-08-03': { morning: '8', afternoon: '', opening: '' },
    });
    const second = sheet('second', {
      '2026-08-04': { morning: '', afternoon: '4', opening: '' },
    });

    const firstPayroll = calculatePayroll(first);
    const secondPayroll = calculatePayroll(second);
    const branch = calculateBranchPayroll([first, second]);

    expect(branch.employees).toBe(2);
    expect(branch.totalHours).toBe(firstPayroll.totalHours + secondPayroll.totalHours);
    expect(branch.totalMoney).toBe(firstPayroll.totalMoney + secondPayroll.totalMoney);
    expect(branch.morningShifts).toBe(1);
    expect(branch.afternoonShifts).toBe(1);
  });
});
