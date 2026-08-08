import { supabase } from '../../../lib/supabase';
import type { UserProfile } from '../../shared/domain';
import type { ShiftCloseReport } from './model';

const mapShiftCloseReport = (item: unknown): ShiftCloseReport => {
  const row = item as Record<string, unknown>;
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as Partial<ShiftCloseReport>)
      : {};

  return {
    machineMoney: '',
    storeMoney: '',
    note: '',
    timestamp: String(row.reported_at),
    ...payload,
    id: String(row.id),
    branchId: typeof row.branch_id === 'string' ? row.branch_id : payload.branchId,
  };
};

export const listShiftCloseReports = async (profile: UserProfile): Promise<ShiftCloseReport[]> => {
  let request = supabase.from('shift_close_reports').select('*');

  if (profile.role !== 'owner' && profile.branchId) {
    request = request.eq('branch_id', profile.branchId);
  }

  const { data, error } = await request.order('reported_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapShiftCloseReport);
};

export const saveShiftCloseReport = async (report: ShiftCloseReport): Promise<ShiftCloseReport> => {
  if (!report.branchId) {
    throw new Error('Báo ca chưa có chi nhánh.');
  }

  const { error } = await supabase.from('shift_close_reports').upsert({
    id: report.id,
    branch_id: report.branchId,
    reported_at: report.timestamp,
    payload: report,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  return report;
};
