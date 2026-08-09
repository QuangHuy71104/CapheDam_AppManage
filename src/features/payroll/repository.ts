import { supabase } from '../../../lib/supabase';
import type { UserProfile } from '../../shared/domain';
import type { BranchPayrollConfirmation } from '../attendance/model';

const mapBranchPayrollConfirmation = (item: unknown): BranchPayrollConfirmation => {
  const row = item as Record<string, unknown>;
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    monthKey: String(row.month_key),
    managerConfirmedAt:
      typeof row.manager_confirmed_at === 'string' ? row.manager_confirmed_at : undefined,
    managerCancelledAt:
      typeof row.manager_cancelled_at === 'string' ? row.manager_cancelled_at : undefined,
    managerName: typeof row.manager_name === 'string' ? row.manager_name : undefined,
    autoConfirmed: Boolean(row.auto_confirmed),
    version: typeof row.version === 'number' ? row.version : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
};

export const listBranchPayrollConfirmations = async (
  profile: UserProfile,
  query: { branchId?: string; monthKey?: string; limit?: number; offset?: number } = {},
): Promise<BranchPayrollConfirmation[]> => {
  if (profile.role === 'employee') {
    return [];
  }

  const limit = Math.min(Math.max(query.limit ?? 120, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);
  let request = supabase.from('branch_payroll_confirmations').select('*');
  if (profile.role === 'manager' && profile.branchId) {
    request = request.eq('branch_id', profile.branchId);
  }

  if (profile.role === 'owner' && query.branchId) request = request.eq('branch_id', query.branchId);
  if (query.monthKey) request = request.eq('month_key', query.monthKey);

  const { data, error } = await request
    .order('month_key', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBranchPayrollConfirmation);
};

export const autoConfirmDuePayrolls = async (): Promise<BranchPayrollConfirmation[]> => {
  const { data, error } = await supabase.rpc('auto_confirm_due_payrolls');
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapBranchPayrollConfirmation);
};

export const saveBranchPayrollConfirmations = async (
  confirmations: BranchPayrollConfirmation[],
): Promise<BranchPayrollConfirmation[]> => {
  if (confirmations.length === 0) {
    return [];
  }

  return Promise.all(
    confirmations.map(async (confirmation) => {
      const { data, error } = await supabase.rpc('save_branch_payroll_cas', {
        p_id: confirmation.id,
        p_branch_id: confirmation.branchId,
        p_month_key: confirmation.monthKey,
        p_manager_confirmed_at: confirmation.managerConfirmedAt ?? null,
        p_manager_cancelled_at: confirmation.managerCancelledAt ?? null,
        p_manager_name: confirmation.managerName ?? null,
        p_auto_confirmed: Boolean(confirmation.autoConfirmed),
        p_expected_version: confirmation.version ?? null,
      });

      if (error) {
        throw error;
      }
      return mapBranchPayrollConfirmation(data);
    }),
  );
};
