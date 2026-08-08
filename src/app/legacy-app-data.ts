import type { UserRole } from '../shared/domain';
import type { AttendanceSheet, BranchPayrollConfirmation } from '../features/attendance/model';
import type { IngredientReport } from '../features/inventory/model';
import type { ShiftCloseReport } from '../features/closing/model';

export type AttendanceType = 'clockIn' | 'clockOut';

export type AttendanceEvent = {
  id: string;
  employeeName: string;
  note: string;
  timestamp: string;
  type: AttendanceType;
};



export type AppData = {
  attendance: AttendanceEvent[];
  attendanceSheets: AttendanceSheet[];
  branchPayrolls: BranchPayrollConfirmation[];
  ingredients: IngredientReport[];
  closings: ShiftCloseReport[];
};

/**
 * Transitional aggregate snapshot.
 *
 * New features should not add fields here. Prefer feature repositories and
 * per-entity Supabase mutations. This type remains temporarily to preserve the
 * current offline/snapshot synchronization semantics during incremental refactor.
 */
export const initialData: AppData = {
  attendance: [],
  attendanceSheets: [],
  branchPayrolls: [],
  ingredients: [],
  closings: [],
};

export const normalizeAppData = (value: Partial<AppData> | null | undefined): AppData => ({
  attendance: Array.isArray(value?.attendance) ? value.attendance : [],
  attendanceSheets: Array.isArray(value?.attendanceSheets) ? value.attendanceSheets : [],
  branchPayrolls: Array.isArray(value?.branchPayrolls) ? value.branchPayrolls : [],
  ingredients: Array.isArray(value?.ingredients) ? value.ingredients : [],
  closings: Array.isArray(value?.closings) ? value.closings : [],
});
