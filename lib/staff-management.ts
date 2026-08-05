import { supabase } from './supabase';

export type StaffRole = 'owner' | 'manager' | 'employee';
export type EmploymentType = 'full_time' | 'part_time';

export type ManagedStaffProfile = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  branchId: string | null;
  phone: string;
  avatarUrl: string;
  employmentType: EmploymentType;
  startDate: string;
  dateOfBirth: string;
};

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

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  let accessToken = data.session?.access_token;

  if (!accessToken) {
    const refreshed = await supabase.auth.refreshSession();
    accessToken = refreshed.data.session?.access_token;
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.');
  }

  return accessToken;
};

const callAccountApi = async <T,>(method: 'GET' | 'PATCH', body?: Record<string, unknown>): Promise<T> => {
  const sendRequest = async (accessToken: string) =>
    fetch('/api/account', {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      method,
    });

  let response: Response;
  try {
    let accessToken = await getAccessToken();
    response = await sendRequest(accessToken);

    if (response.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token ?? '';
      if (accessToken) {
        response = await sendRequest(accessToken);
      }
    }
  } catch {
    throw new Error('Không kết nối được. Vui lòng kiểm tra mạng rồi thử lại.');
  }

  const result = (await response!.json().catch(() => ({}))) as T & { message?: string };
  if (!response!.ok) {
    throw new Error(result.message || 'Chưa thực hiện được. Vui lòng thử lại.');
  }

  return result;
};

export const loadStaffManagement = () => callAccountApi<StaffManagementData>('GET');

export const saveManagedWorkProfile = async (
  id: string,
  patch: Pick<ManagedStaffProfile, 'branchId' | 'employmentType' | 'role' | 'startDate'>,
) => {
  const result = await callAccountApi<{ profile: ManagedStaffProfile }>('PATCH', {
    action: 'save-work',
    branchId: patch.role === 'owner' ? null : patch.branchId,
    employmentType: patch.employmentType,
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

export const seedDemoData = async (): Promise<DemoSeedResult> => {
  const sendRequest = async (accessToken: string) =>
    fetch('/api/demo-seed', {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: 'POST',
    });

  let response: Response;
  try {
    let accessToken = await getAccessToken();
    response = await sendRequest(accessToken);

    if (response.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token ?? '';
      if (accessToken) {
        response = await sendRequest(accessToken);
      }
    }
  } catch {
    throw new Error('Không kết nối được. Vui lòng kiểm tra mạng rồi thử lại.');
  }

  const result = (await response!.json().catch(() => ({}))) as DemoSeedResult & { message?: string };
  if (!response!.ok) {
    throw new Error(result.message || 'Chưa tạo được dữ liệu thử nghiệm. Vui lòng thử lại.');
  }

  return result;
};

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
