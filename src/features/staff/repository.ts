import { callAccountApi, callAuthenticatedApi } from '../../shared/api/account-client';
import type { UserProfile, UserRole } from '../../shared/domain';

export type { EmploymentType } from '../../shared/domain';
export type StaffRole = UserRole;
export type ManagedStaffProfile = UserProfile;

export type StaffBranchAlias = {
  managerId: string;
  employeeId: string;
  branchId: string;
  displayName: string;
  updatedAt?: string;
};

export type StaffManagementData = {
  profiles: ManagedStaffProfile[];
  aliases: StaffBranchAlias[];
};

export type DemoSeedResult = {
  accounts: Array<Pick<ManagedStaffProfile, 'branchId' | 'email' | 'fullName' | 'role'>>;
  alreadyConfirmedBranches: string[];
  createdUsers: number;
  monthKey: string;
  password: string;
  seededAttendance: number;
  skippedAttendance: number;
};

export const loadStaffManagement = () => callAccountApi<StaffManagementData>('GET');

export const saveManagedWorkProfile = async (
  id: string,
  patch: Pick<ManagedStaffProfile, 'allowance' | 'branchId' | 'breakfastAllowance' | 'employmentType' | 'hourlyRate' | 'role' | 'startDate'>,
) => {
  const result = await callAccountApi<{ profile: ManagedStaffProfile }>('PATCH', {
    action: 'save-work',
    allowance: patch.allowance,
    branchId: patch.role === 'owner' ? null : patch.branchId,
    breakfastAllowance: patch.breakfastAllowance,
    employmentType: patch.employmentType,
    hourlyRate: patch.hourlyRate,
    role: patch.role,
    startDate: patch.startDate,
    targetId: id,
  });

  return result.profile;
};

export const saveStaffBranchAlias = async ({
  branchId,
  displayName,
  employeeId,
}: Pick<StaffBranchAlias, 'branchId' | 'displayName' | 'employeeId'>) => {
  const result = await callAccountApi<{ alias: StaffBranchAlias | null }>('PATCH', {
    action: 'save-staff-alias',
    branchId,
    displayName: displayName.trim(),
    employeeId,
  });

  return result.alias;
};


export const seedDemoData = () =>
  callAuthenticatedApi<DemoSeedResult>(
    '/api/demo-seed',
    'POST',
    undefined,
    'Chưa tạo được dữ liệu thử nghiệm. Vui lòng thử lại.',
  );

export const getStaffDisplayName = (
  profile: Pick<ManagedStaffProfile, 'email' | 'fullName' | 'id'>,
  aliases: StaffBranchAlias[],
  managerId: string,
  branchId: string | null,
) => {
  const alias = aliases.find(
    (item) => item.managerId === managerId && item.employeeId === profile.id && item.branchId === branchId,
  );
  return alias?.displayName.trim() || profile.fullName.trim() || profile.email;
};
