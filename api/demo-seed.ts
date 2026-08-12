import { createClient, type User } from '@supabase/supabase-js';

type VercelRequest = {
  body?: unknown;
  headers: { authorization?: string };
  method?: string;
};

type VercelResponse = {
  json: (body: Record<string, unknown>) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
};

type UserRole = 'manager' | 'employee';

type DemoPerson = {
  branchId: string;
  dateOfBirth: string;
  email: string;
  fullName: string;
  key: string;
  phone: string;
  role: UserRole;
};

const demoPassword = 'CapheDamDemo!2026';
const demoDomain = 'demo.caphedam.test';

const branchSeed: Array<{ branchId: string; manager: string; staff: string[] }> = [
  { branchId: 'minh-khai-1', manager: 'Quản lí Minh Khai 1', staff: ['Linh Anh', 'Vân', 'Phương'] },
  { branchId: 'minh-khai-2', manager: 'Quản lí Minh Khai 2', staff: ['Quyên', 'Oanh', 'Như'] },
  { branchId: 'nam-ky-khoi-nghia', manager: 'Quản lí Nam Kỳ Khởi Nghĩa', staff: ['Thành', 'Huy', 'Hà'] },
  { branchId: 'dien-bien-phu', manager: 'Quản lí Điện Biên Phủ', staff: ['Minh', 'Thắng', 'Vân Anh'] },
  { branchId: 'pham-dinh-ho', manager: 'Quản lí Phạm Đình Hổ', staff: ['Oanh', 'Linh', 'Phương Anh'] },
  { branchId: 'tung-thien-vuong', manager: 'Quản lí Tùng Thiện Vương', staff: ['Nhi', 'Quyên Anh', 'Thanh'] },
];

const send = (response: VercelResponse, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const getBearerToken = (request: VercelRequest) => {
  const authorization = request.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getDaysInMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

const toDemoSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const buildDemoPeople = (): DemoPerson[] => {
  let position = 0;

  return branchSeed.flatMap(({ branchId, manager, staff }) => {
    const people: DemoPerson[] = [
      {
        branchId,
        dateOfBirth: `199${position % 8}-0${(position % 8) + 1}-15`,
        email: `demo.manager.${branchId}@${demoDomain}`,
        fullName: manager,
        key: `manager-${branchId}`,
        phone: `090${String(1000000 + position).slice(-7)}`,
        role: 'manager',
      },
    ];
    position += 1;

    staff.forEach((fullName, staffIndex) => {
      people.push({
        branchId,
        dateOfBirth: `200${(position + staffIndex) % 5}-0${((position + staffIndex) % 8) + 1}-12`,
        email: `demo.staff.${branchId}.${toDemoSlug(fullName)}@${demoDomain}`,
        fullName,
        key: `staff-${branchId}-${toDemoSlug(fullName)}`,
        phone: `091${String(1000000 + position + staffIndex).slice(-7)}`,
        role: 'employee',
      });
    });
    position += staff.length;
    return people;
  });
};

type AdminUserLister = {
  listUsers: (options: { page: number; perPage: number }) => Promise<{
    data: { users: User[] };
    error: unknown;
  }>;
};

const listAllUsers = async (adminAuth: AdminUserLister): Promise<User[]> => {
  const users: User[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminAuth.listUsers({ page, perPage: 100 });
    if (error) {
      throw new Error('Không tải được danh sách tài khoản để chuẩn bị dữ liệu mẫu.');
    }
    users.push(...data.users);
    if (data.users.length < 100) {
      break;
    }
  }

  return users;
};

const createDemoDays = (monthKey: string, staffOffset: number) => {
  const days: Record<string, { morning: string; afternoon: string; opening: string }> = {};
  const totalDays = getDaysInMonth(monthKey);
  const today = new Date();
  const monthIsCurrent = getMonthKey(today) === monthKey;
  const maxDay = monthIsCurrent ? Math.max(1, Math.min(today.getDate(), 7)) : Math.min(totalDays, 7);

  for (let day = 1; day <= maxDay; day += 1) {
    const weekday = new Date(`${monthKey}-${String(day).padStart(2, '0')}T00:00:00`).getDay();
    if (weekday === 0) {
      continue;
    }
    days[`${monthKey}-${String(day).padStart(2, '0')}`] = {
      morning: day % 3 === staffOffset % 3 ? '4' : '5',
      afternoon: day % 4 === staffOffset % 4 ? '3.5' : '4',
      opening: day % 2 === staffOffset % 2 ? '0.5' : '',
    };
  }

  return days;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { message: 'Thao tác này chưa được hỗ trợ.' });
  }

  const runtimeEnvironment = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;
  const supabaseUrl = runtimeEnvironment?.VITE_SUPABASE_URL ?? runtimeEnvironment?.SUPABASE_URL;
  const secretKey = runtimeEnvironment?.SUPABASE_SECRET_KEY ?? runtimeEnvironment?.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    return send(response, 503, {
      message: 'Chưa cấu hình quyền tạo dữ liệu mẫu. Vui lòng kiểm tra SUPABASE_SECRET_KEY trên máy chủ.',
    });
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = getBearerToken(request);
  if (!token) {
    return send(response, 401, { message: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.' });
  }

  const { data: requesterData, error: requesterAuthError } = await admin.auth.getUser(token);
  if (requesterAuthError || !requesterData.user) {
    return send(response, 401, { message: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.' });
  }

  const { data: requester, error: requesterError } = await admin
    .from('profiles')
    .select('id,role')
    .eq('id', requesterData.user.id)
    .maybeSingle();
  if (requesterError || !requester || requester.role !== 'owner') {
    return send(response, 403, { message: 'Chỉ Chủ cửa hàng mới có thể tạo dữ liệu thử nghiệm.' });
  }

  try {
    const people = buildDemoPeople();
    const users = await listAllUsers(admin.auth.admin);
    const usersByEmail = new Map(
      users
        .filter((user) => user.email)
        .map((user) => [user.email!.trim().toLowerCase(), user]),
    );
    const peopleWithIds: Array<DemoPerson & { id: string }> = [];
    let createdUsers = 0;

    for (const person of people) {
      const existingUser = usersByEmail.get(person.email.toLowerCase());
      const userMetadata = {
        branchId: person.branchId,
        dateOfBirth: person.dateOfBirth,
        demoAccount: true,
        employmentType: 'part_time',
        fullName: person.fullName,
        phone: person.phone,
        role: person.role,
      };

      if (existingUser) {
        const { data: updated, error } = await admin.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
          // Re-seeding deliberately restores the documented demo credential,
          // so the owner can always log into every demo account listed below.
          password: demoPassword,
          user_metadata: { ...(existingUser.user_metadata ?? {}), ...userMetadata },
        });
        if (error || !updated.user) {
          throw new Error(`Không cập nhật được tài khoản mẫu ${person.email}.`);
        }
        peopleWithIds.push({ ...person, id: updated.user.id });
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: person.email,
          email_confirm: true,
          password: demoPassword,
          user_metadata: userMetadata,
        });
        if (error || !created.user) {
          throw new Error(`Không tạo được tài khoản mẫu ${person.email}.`);
        }
        peopleWithIds.push({ ...person, id: created.user.id });
        createdUsers += 1;
      }
    }

    const today = new Date();
    const monthKey = getMonthKey(today);
    const profileRows = peopleWithIds.map((person) => ({
      avatar_url: '',
      branch_id: person.branchId,
      date_of_birth: person.dateOfBirth,
      email: person.email,
      employment_type: 'part_time',
      full_name: person.fullName,
      id: person.id,
      phone: person.phone,
      role: person.role,
      start_date: `${today.getFullYear()}-01-02`,
      updated_at: today.toISOString(),
    }));
    const { error: profilesError } = await admin.from('profiles').upsert(profileRows, { onConflict: 'id' });
    if (profilesError) {
      throw new Error('Không lưu được hồ sơ mẫu. Hãy chạy lại database/supabase-schema.sql rồi thử lại.');
    }

    const employeePeople = peopleWithIds.filter((person) => person.role === 'employee');
    const { data: existingAttendance, error: existingAttendanceError } = await admin
      .from('attendance_sheets')
      .select('id,user_id,branch_id,employee_name')
      .eq('month_key', monthKey)
      .in('branch_id', branchSeed.map((item) => item.branchId));
    if (existingAttendanceError) {
      throw new Error('Không kiểm tra được bảng công hiện có trước khi tạo dữ liệu mẫu.');
    }
    const attendanceByName = new Map(
      (existingAttendance ?? []).map((row) => {
        const item = row as Record<string, unknown>;
        return [`${String(item.branch_id)}|${String(item.employee_name).trim().toLocaleLowerCase('vi-VN')}`, item];
      }),
    );
    let skippedAttendance = 0;
    const attendanceRows = employeePeople.flatMap((person, index) => {
      const existing = attendanceByName.get(`${person.branchId}|${person.fullName.trim().toLocaleLowerCase('vi-VN')}`);
      // Never bind a demo account to a real person's time sheet just because
      // they share a display name. Existing demo accounts retain their row ID.
      if (existing && existing.user_id !== person.id) {
        skippedAttendance += 1;
        return [];
      }
      return [{
        branch_id: person.branchId,
        days: createDemoDays(monthKey, index),
        employee_confirmed_at: new Date(today.getTime() - (index + 1) * 60_000).toISOString(),
        employee_name: person.fullName,
        id: typeof existing?.id === 'string' ? existing.id : `demo-attendance-${person.key}-${monthKey}`,
        month_key: monthKey,
        updated_at: today.toISOString(),
        user_id: person.id,
      }];
    });
    if (attendanceRows.length > 0) {
      const { error: attendanceError } = await admin
        .from('attendance_sheets')
        .upsert(attendanceRows, { onConflict: 'id' });
      if (attendanceError) {
        throw new Error('Đã tạo tài khoản nhưng chưa tạo được bảng công mẫu. Hãy chạy lại database/supabase-schema.sql rồi thử lại.');
      }
    }

    const { data: confirmations } = await admin
      .from('branch_payroll_confirmations')
      .select('branch_id,manager_confirmed_at')
      .eq('month_key', monthKey)
      .not('manager_confirmed_at', 'is', null);
    const alreadyConfirmedBranches = (confirmations ?? []).map((item) => String(item.branch_id));

    return send(response, 200, {
      accounts: peopleWithIds.map((person) => ({
        branchId: person.branchId,
        email: person.email,
        fullName: person.fullName,
        role: person.role,
      })),
      alreadyConfirmedBranches,
      createdUsers,
      monthKey,
      password: demoPassword,
      seededAttendance: attendanceRows.length,
      skippedAttendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chưa tạo được dữ liệu thử nghiệm.';
    return send(response, 500, { message });
  }
}
