import { supabase } from '../../../lib/supabase';
import type { UserProfile, UserRole } from '../../shared/domain';
import type { IngredientReport, SupplyReportItem } from './model';

const normalizeReporterRole = (value: unknown): UserRole | undefined =>
  value === 'owner' || value === 'manager' || value === 'employee' ? value : undefined;

const mapIngredientReport = (item: unknown): IngredientReport => {
  const row = item as Record<string, unknown>;
  return {
    id: String(row.id),
    branchId: typeof row.branch_id === 'string' ? row.branch_id : undefined,
    note: typeof row.note === 'string' ? row.note : '',
    reporterName: typeof row.reporter_name === 'string' ? row.reporter_name : undefined,
    reporterRole: normalizeReporterRole(row.reporter_role),
    timestamp: String(row.reported_at),
    items: Array.isArray(row.items) ? (row.items as SupplyReportItem[]) : [],
  };
};

export type IngredientReportQuery = {
  branchId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export const listIngredientReports = async (
  profile: UserProfile,
  query: IngredientReportQuery = {},
): Promise<IngredientReport[]> => {
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);
  let request = supabase.from('ingredient_reports').select('*');
  if (profile.role !== 'owner' && profile.branchId) request = request.eq('branch_id', profile.branchId);
  if (profile.role === 'owner' && query.branchId) request = request.eq('branch_id', query.branchId);
  if (query.from) request = request.gte('reported_at', query.from);
  if (query.to) request = request.lt('reported_at', query.to);
  const { data, error } = await request
    .order('reported_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(mapIngredientReport);
};

export const saveIngredientReport = async (report: IngredientReport): Promise<IngredientReport> => {
  if (!report.branchId) throw new Error('Báo đồ chưa có chi nhánh.');
  const { error } = await supabase.from('ingredient_reports').upsert({
    id: report.id,
    branch_id: report.branchId,
    reporter_name: report.reporterName ?? null,
    reporter_role: report.reporterRole ?? null,
    note: report.note,
    reported_at: report.timestamp,
    items: report.items ?? [],
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return report;
};
