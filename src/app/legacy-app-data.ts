import type { UserRole } from '../shared/domain';
import type { AttendanceSheet, BranchPayrollConfirmation } from '../features/attendance/model';



export type AppData = {
  attendanceSheets: AttendanceSheet[];
  branchPayrolls: BranchPayrollConfirmation[];
};

/**
 * Transitional aggregate snapshot.
 *
 * New features should not add fields here. Prefer feature repositories and
 * per-entity Supabase mutations. This type remains temporarily to preserve the
 * current offline/snapshot synchronization semantics during incremental refactor.
 */
export const initialData: AppData = {
  attendanceSheets: [],
  branchPayrolls: [],
};

export const normalizeAppData = (value: Partial<AppData> | null | undefined): AppData => ({
  attendanceSheets: Array.isArray(value?.attendanceSheets) ? value.attendanceSheets : [],
  branchPayrolls: Array.isArray(value?.branchPayrolls) ? value.branchPayrolls : [],
});
