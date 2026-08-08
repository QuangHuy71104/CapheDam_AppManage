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
  };
};

export const listBranchPayrollConfirmations = async (
  profile: UserProfile,
): Promise<BranchPayrollConfirmation[]> => {
  if (profile.role === 'employee') {
    return [];
  }

  let request = supabase.from('branch_payroll_confirmations').select('*');
  if (profile.role === 'manager' && profile.branchId) {
    request = request.eq('branch_id', profile.branchId);
  }

  const { data, error } = await request.order('month_key', { ascending: false });
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBranchPayrollConfirmation);
};

export const saveBranchPayrollConfirmations = async (
  confirmations: BranchPayrollConfirmation[],
): Promise<void> => {
  if (confirmations.length === 0) {
    return;
  }

  const rows = confirmations.map((confirmation) => ({
    id: confirmation.id,
    branch_id: confirmation.branchId,
    month_key: confirmation.monthKey,
    manager_confirmed_at: confirmation.managerConfirmedAt ?? null,
    manager_cancelled_at: confirmation.managerCancelledAt ?? null,
    manager_name: confirmation.managerName ?? null,
    auto_confirmed: Boolean(confirmation.autoConfirmed),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('branch_payroll_confirmations')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }
};
