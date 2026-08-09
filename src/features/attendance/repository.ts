import { supabase } from '../../../lib/supabase';
import type { UserProfile } from '../../shared/domain';
import type { AttendanceDayEntry, AttendanceInputField, AttendanceSheet } from './model';

const isSunday = (dayKey: string) => new Date(`${dayKey}T12:00:00`).getDay() === 0;

const normalizeAttendanceDays = (value: unknown): Record<string, AttendanceDayEntry> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, Partial<AttendanceDayEntry>>).reduce<Record<string, AttendanceDayEntry>>(
    (days, [key, entry]) => {
      const scheduled =
        entry.scheduled && typeof entry.scheduled === 'object' && !Array.isArray(entry.scheduled)
          ? Object.entries(entry.scheduled).reduce<Partial<Record<AttendanceInputField, string>>>(
              (result, [field, hours]) => {
                if (
                  (field === 'morning' || field === 'afternoon' || field === 'opening') &&
                  typeof hours === 'string' &&
                  !(field === 'afternoon' && isSunday(key))
                ) {
                  result[field] = hours;
                }
                return result;
              },
              {},
            )
          : undefined;

      days[key] = {
        morning: typeof entry.morning === 'string' ? entry.morning : '',
        afternoon: isSunday(key) ? '' : typeof entry.afternoon === 'string' ? entry.afternoon : '',
        opening: typeof entry.opening === 'string' ? entry.opening : '',
        ...(scheduled && Object.keys(scheduled).length > 0 ? { scheduled } : {}),
      };
      return days;
    },
    {},
  );
};

const mapAttendanceSheet = (item: unknown): AttendanceSheet => {
  const row = item as Record<string, unknown>;
  return {
    id: String(row.id),
    userId: typeof row.user_id === 'string' ? row.user_id : undefined,
    branchId: String(row.branch_id),
    employeeName: String(row.employee_name),
    monthKey: String(row.month_key),
    days: normalizeAttendanceDays(row.days),
    employeeConfirmedAt:
      typeof row.employee_confirmed_at === 'string' ? row.employee_confirmed_at : undefined,
    managerApprovedAt:
      typeof row.manager_approved_at === 'string' ? row.manager_approved_at : undefined,
    managerApprovedBy:
      typeof row.manager_approved_by === 'string' ? row.manager_approved_by : undefined,
    hourlyRate: typeof row.hourly_rate_snapshot === 'number' ? row.hourly_rate_snapshot : undefined,
    allowance: typeof row.allowance_snapshot === 'number' ? row.allowance_snapshot : undefined,
    breakfastAllowance:
      typeof row.breakfast_allowance_snapshot === 'number' ? row.breakfast_allowance_snapshot : undefined,
    version: typeof row.version === 'number' ? row.version : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
};

export type AttendanceSheetQuery = {
  branchId?: string;
  monthKey?: string;
  limit?: number;
  offset?: number;
};

export const listAttendanceSheets = async (
  profile: UserProfile,
  query: AttendanceSheetQuery = {},
): Promise<AttendanceSheet[]> => {
  const limit = Math.min(Math.max(query.limit ?? 300, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);
  let request = supabase.from('attendance_sheets').select('*');

  if (profile.role === 'manager' && profile.branchId) {
    request = request.eq('branch_id', profile.branchId);
  } else if (profile.role === 'employee') {
    request = request.eq('user_id', profile.id);
  }

  if (profile.role === 'owner' && query.branchId) request = request.eq('branch_id', query.branchId);
  if (query.monthKey) request = request.eq('month_key', query.monthKey);

  const { data, error } = await request
    .order('month_key', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAttendanceSheet);
};

export const saveAttendanceSheets = async (
  sheets: AttendanceSheet[],
  profile: UserProfile,
): Promise<AttendanceSheet[]> => {
  if (sheets.length === 0) {
    return [];
  }

  return Promise.all(
    sheets.map(async (sheet) => {
      const { data, error } = await supabase.rpc('save_attendance_sheet_cas', {
        p_id: sheet.id,
        p_user_id: sheet.userId ?? (profile.role === 'employee' ? profile.id : null),
        p_branch_id: sheet.branchId,
        p_employee_name: sheet.employeeName,
        p_month_key: sheet.monthKey,
        p_days: sheet.days,
        p_employee_confirmed_at: sheet.employeeConfirmedAt ?? null,
        p_manager_approved_at: sheet.managerApprovedAt ?? null,
        p_manager_approved_by: sheet.managerApprovedBy ?? null,
        p_expected_version: sheet.version ?? null,
      });
      if (error) {
        throw error;
      }
      return mapAttendanceSheet(data);
    }),
  );
};
