import { payrollPolicy } from '../../shared/domain';
import { toNumber } from '../../shared/lib/numbers';
import type { AttendanceSheet, BranchPayrollConfirmation } from '../attendance/model';

export type PayrollStatus =
  | 'draft'
  | 'employee_submitted'
  | 'manager_approved'
  | 'branch_submitted';

export type PayrollPolicy = {
  allowance: number;
  breakfastAllowance: number;
  hourlyRate: number;
};

const resolvePayrollPolicy = (sheet?: AttendanceSheet, override?: Partial<PayrollPolicy>): PayrollPolicy => ({
  allowance: override?.allowance ?? sheet?.allowance ?? payrollPolicy.monthlyAllowance,
  breakfastAllowance:
    override?.breakfastAllowance ?? sheet?.breakfastAllowance ?? payrollPolicy.breakfastPerMorningShift,
  hourlyRate: override?.hourlyRate ?? sheet?.hourlyRate ?? payrollPolicy.hourlyRate,
});

export const getPayrollStatus = (
  sheet: AttendanceSheet | undefined,
  branchConfirmation?: BranchPayrollConfirmation,
): PayrollStatus => {
  if (branchConfirmation?.managerConfirmedAt) {
    return 'branch_submitted';
  }
  if (sheet?.managerApprovedAt) {
    return 'manager_approved';
  }
  if (sheet?.employeeConfirmedAt) {
    return 'employee_submitted';
  }
  return 'draft';
};

export const calculatePayroll = (sheet?: AttendanceSheet, policyOverride?: Partial<PayrollPolicy>) => {
  const policy = resolvePayrollPolicy(sheet, policyOverride);
  const days = Object.values(sheet?.days ?? {});
  const openingHours = days.reduce((total, day) => total + toNumber(day.opening), 0);
  const morningHours = days.reduce((total, day) => total + toNumber(day.morning), 0) + openingHours;
  const afternoonHours = days.reduce((total, day) => total + toNumber(day.afternoon), 0);
  const morningShifts = days.filter((day) => toNumber(day.morning) + toNumber(day.opening) > 0).length;
  const afternoonShifts = days.filter((day) => toNumber(day.afternoon) > 0).length;
  const openingShifts = days.filter((day) => toNumber(day.opening) > 0).length;
  const totalHours = morningHours + afternoonHours;
  const breakfastMoney = morningShifts * policy.breakfastAllowance;
  const allowanceMoney = totalHours > 0 ? policy.allowance : 0;
  const wageMoney = Math.round(totalHours * policy.hourlyRate);
  const totalMoney = wageMoney + breakfastMoney + allowanceMoney;
  return {
    allowanceMoney,
    afternoonHours,
    afternoonShifts,
    breakfastMoney,
    morningHours,
    morningShifts,
    openingHours,
    openingShifts,
    totalHours,
    totalMoney,
    wageMoney,
  };
};

export const calculateBranchPayroll = (sheets: AttendanceSheet[]) =>
  sheets.reduce(
    (total, sheet) => {
      const payroll = calculatePayroll(sheet);
      return {
        employees: total.employees + 1,
        totalHours: total.totalHours + payroll.totalHours,
        totalMoney: total.totalMoney + payroll.totalMoney,
        morningShifts: total.morningShifts + payroll.morningShifts,
        afternoonShifts: total.afternoonShifts + payroll.afternoonShifts,
      };
    },
    { employees: 0, totalHours: 0, totalMoney: 0, morningShifts: 0, afternoonShifts: 0 },
  );

export const getBranchPayrollConfirmation = (
  confirmations: BranchPayrollConfirmation[],
  branchId: string,
  monthKey: string,
) => confirmations.find((confirmation) => confirmation.branchId === branchId && confirmation.monthKey === monthKey);

export const invalidateBranchPayroll = (
  confirmations: BranchPayrollConfirmation[],
  branchId: string,
  monthKey: string,
) =>
  confirmations.map((confirmation) =>
    confirmation.branchId === branchId && confirmation.monthKey === monthKey && confirmation.managerConfirmedAt
      ? {
          ...confirmation,
          managerConfirmedAt: undefined,
          managerCancelledAt: new Date().toISOString(),
          autoConfirmed: false,
        }
      : confirmation,
  );
