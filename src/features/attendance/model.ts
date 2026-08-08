export type AttendanceInputField = 'morning' | 'afternoon' | 'opening';

export type AttendanceDayEntry = {
  morning: string;
  afternoon: string;
  opening: string;
  scheduled?: Partial<Record<AttendanceInputField, string>>;
};

export type AttendanceSheet = {
  id: string;
  userId?: string;
  branchId: string;
  employeeName: string;
  monthKey: string;
  days: Record<string, AttendanceDayEntry>;
  employeeConfirmedAt?: string;
  managerApprovedAt?: string;
  managerApprovedBy?: string;
  version?: number;
  updatedAt?: string;
};

export type BranchPayrollConfirmation = {
  id: string;
  branchId: string;
  monthKey: string;
  managerConfirmedAt?: string;
  managerCancelledAt?: string;
  managerName?: string;
  autoConfirmed?: boolean;
  version?: number;
  updatedAt?: string;
};
