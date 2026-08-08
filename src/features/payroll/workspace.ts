import type { AttendanceSheet, BranchPayrollConfirmation } from '../attendance/model';

export type PayrollWorkspace = {
  attendanceSheets: AttendanceSheet[];
  branchPayrolls: BranchPayrollConfirmation[];
};

export const initialPayrollWorkspace: PayrollWorkspace = {
  attendanceSheets: [],
  branchPayrolls: [],
};

export const normalizePayrollWorkspace = (
  value: Partial<PayrollWorkspace> | null | undefined,
): PayrollWorkspace => ({
  attendanceSheets: Array.isArray(value?.attendanceSheets) ? value.attendanceSheets : [],
  branchPayrolls: Array.isArray(value?.branchPayrolls) ? value.branchPayrolls : [],
});
