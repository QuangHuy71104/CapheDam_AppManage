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

type UserRole = 'owner' | 'manager' | 'employee';
type EmploymentType = 'full_time' | 'part_time';

type ProfileRow = {
  avatar_url: string;
  branch_id: string | null;
  created_at: string;
  date_of_birth: string | null;
  email: string;
  employment_type: EmploymentType;
  full_name: string;
  id: string;
  phone: string;
  role: UserRole;
  start_date: string;
};

type AccountProfile = {
  avatarUrl: string;
  branchId: string | null;
  dateOfBirth: string;
  email: string;
  employmentType: EmploymentType;
  fullName: string;
  id: string;
  phone: string;
  role: UserRole;
  startDate: string;
};

type StaffBranchAliasRow = {
  branch_id: string;
  display_name: string;
  employee_id: string;
  manager_id: string;
  updated_at: string;
};

type StaffBranchAlias = {
  branchId: string;
  displayName: string;
  employeeId: string;
  managerId: string;
  updatedAt: string;
};

const validRoles: UserRole[] = ['owner', 'manager', 'employee'];
const validEmploymentTypes: EmploymentType[] = ['full_time', 'part_time'];
const profileFields = 'id,email,full_name,role,branch_id,phone,avatar_url,employment_type,start_date,date_of_birth,created_at';

const send = (response: VercelResponse, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const getText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isValidDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const getBearerToken = (request: VercelRequest) => {
  const authorization = request.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getMetadata = (user?: User | null) => (user?.user_metadata ?? {}) as Record<string, unknown>;

const toAccountProfile = (row: ProfileRow, user?: User | null): AccountProfile => {
  const metadata = getMetadata(user);
  const role = validRoles.includes(row.role) ? row.role : 'employee';
  const employmentType = validEmploymentTypes.includes(metadata.employmentType as EmploymentType)
    ? (metadata.employmentType as EmploymentType)
    : validEmploymentTypes.includes(row.employment_type)
      ? row.employment_type
    : role === 'owner'
      ? 'full_time'
      : 'part_time';
  const metadataStartDate = getText(metadata.startDate);
  const metadataDateOfBirth = getText(metadata.dateOfBirth);

  return {
    id: row.id,
    email: row.email,
    fullName: getText(metadata.fullName) || row.full_name,
    role,
    branchId: role === 'owner' ? null : row.branch_id,
    phone: getText(metadata.phone) || row.phone,
    avatarUrl: getText(metadata.avatarUrl) || row.avatar_url,
    employmentType,
    dateOfBirth: isValidDateOnly(metadataDateOfBirth)
      ? metadataDateOfBirth
      : isValidDateOnly(row.date_of_birth ?? '')
        ? row.date_of_birth!
        : '',
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(metadataStartDate)
      ? metadataStartDate
      : row.start_date || row.created_at.slice(0, 10),
  };
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const runtimeEnvironment = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;
  const supabaseUrl = runtimeEnvironment?.VITE_SUPABASE_URL ?? runtimeEnvironment?.SUPABASE_URL;
  const secretKey = runtimeEnvironment?.SUPABASE_SECRET_KEY ?? runtimeEnvironment?.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    return send(response, 503, {
      message: 'Tính năng này đang được chuẩn bị. Vui lòng thử lại sau.',
    });
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = getBearerToken(request);

  if (!token) {
    return send(response, 401, { message: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.' });
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return send(response, 401, { message: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.' });
  }

  const { data: requesterRow, error: requesterError } = await admin
    .from('profiles')
    .select(profileFields)
    .eq('id', userData.user.id)
    .single();

  if (requesterError || !requesterRow) {
    return send(response, 403, { message: 'Không tìm thấy thông tin tài khoản của bạn.' });
  }

  const requester = requesterRow as ProfileRow;

  if (request.method === 'GET') {
    if (requester.role !== 'owner' && requester.role !== 'manager') {
      return send(response, 403, { message: 'Chỉ Chủ cửa hàng mới được xem danh sách nhân viên.' });
    }

    if (requester.role === 'manager' && !requester.branch_id) {
      return send(response, 403, { message: 'Tài khoản quản lí chưa được gán chi nhánh.' });
    }

    const profilesRequest = requester.role === 'manager'
      ? admin
          .from('profiles')
          .select(profileFields)
          .eq('branch_id', requester.branch_id!)
          .order('full_name')
      : admin
          .from('profiles')
          .select(profileFields)
          .order('full_name');
    const { data: profileRows, error: profilesError } = await profilesRequest;
    if (profilesError) {
      return send(response, 500, { message: 'Chưa tải được danh sách nhân viên. Vui lòng thử lại.' });
    }

    // Roster data comes from the canonical profile row. Listing every Auth
    // user on each HR/schedule open is both expensive and can surface stale
    // user_metadata instead of the employee's configured display name.
    const profiles = (profileRows as ProfileRow[]).map((row) => toAccountProfile(row));
    let aliases: StaffBranchAlias[] = [];

    if (requester.role === 'manager') {
      const { data: aliasRows, error: aliasesError } = await admin
        .from('staff_branch_aliases')
        .select('manager_id,employee_id,branch_id,display_name,updated_at')
        .eq('manager_id', requester.id)
        .eq('branch_id', requester.branch_id!);
      if (aliasesError) {
        return send(response, 500, { message: 'Chưa tải được tên xếp lịch của nhân sự.' });
      }
      aliases = (aliasRows as StaffBranchAliasRow[]).map((row) => ({
        managerId: row.manager_id,
        employeeId: row.employee_id,
        branchId: row.branch_id,
        displayName: row.display_name,
        updatedAt: row.updated_at,
      }));
    }

    return send(response, 200, { profiles, aliases });
  }

  if (request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, PATCH');
    return send(response, 405, { message: 'Thao tác này chưa được hỗ trợ.' });
  }

  const body = (request.body ?? {}) as Record<string, unknown>;
  const action = getText(body.action);

  if (action === 'save-self') {
    const fullName = getText(body.fullName);
    const phone = getText(body.phone);
    const avatarUrl = getText(body.avatarUrl);
    const dateOfBirth = getText(body.dateOfBirth);

    if (!fullName) {
      return send(response, 400, { message: 'Vui lòng nhập họ và tên.' });
    }
    if (dateOfBirth && (!isValidDateOnly(dateOfBirth) || dateOfBirth > new Date().toISOString().slice(0, 10))) {
      return send(response, 400, { message: 'Ngày sinh chưa hợp lệ.' });
    }

    const currentMetadata = getMetadata(userData.user);
    const { data: updatedAuth, error: authError } = await admin.auth.admin.updateUserById(userData.user.id, {
      user_metadata: { ...currentMetadata, avatarUrl, dateOfBirth, fullName, phone },
    });
    if (authError) {
      return send(response, 500, { message: 'Chưa lưu được thông tin cá nhân. Vui lòng thử lại.' });
    }

    const { data: updatedRow, error: profileError } = await admin
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        date_of_birth: dateOfBirth || null,
        full_name: fullName,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.user.id)
      .select(profileFields)
      .single();
    if (profileError || !updatedRow) {
      return send(response, 500, { message: 'Chưa lưu được tên mới. Vui lòng thử lại.' });
    }

    return send(response, 200, { profile: toAccountProfile(updatedRow as ProfileRow, updatedAuth.user) });
  }

  if (action === 'save-work') {
    if (requester.role !== 'owner') {
      return send(response, 403, { message: 'Chỉ Chủ cửa hàng mới được đổi thông tin làm việc.' });
    }

    const targetId = getText(body.targetId);
    const role = body.role as UserRole;
    const employmentType = body.employmentType as EmploymentType;
    const startDate = getText(body.startDate);
    const branchId = role === 'owner' ? null : getText(body.branchId);

    if (!targetId || !validRoles.includes(role) || !validEmploymentTypes.includes(employmentType)) {
      return send(response, 400, { message: 'Thông tin làm việc chưa đầy đủ.' });
    }
    if (role !== 'owner' && !branchId) {
      return send(response, 400, { message: 'Vui lòng chọn nơi làm việc.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return send(response, 400, { message: 'Ngày bắt đầu làm việc chưa đúng.' });
    }
    if (targetId === requester.id && role !== 'owner') {
      return send(response, 400, { message: 'Chủ cửa hàng không thể tự đổi vị trí của mình.' });
    }

    const { data: targetUserData, error: targetUserError } = await admin.auth.admin.getUserById(targetId);
    if (targetUserError || !targetUserData.user) {
      return send(response, 404, { message: 'Không tìm thấy tài khoản nhân viên này.' });
    }

    const { data: updatedRow, error: profileError } = await admin
      .from('profiles')
      .update({
        branch_id: branchId,
        employment_type: employmentType,
        role,
        start_date: startDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId)
      .select(profileFields)
      .single();
    if (profileError || !updatedRow) {
      return send(response, 500, { message: 'Chưa lưu được chức vụ hoặc nơi làm việc. Vui lòng thử lại.' });
    }

    const currentMetadata = getMetadata(targetUserData.user);
    const { data: updatedAuth, error: authError } = await admin.auth.admin.updateUserById(targetId, {
      user_metadata: {
        ...currentMetadata,
        branchId,
        employmentType,
        role,
        startDate,
      },
    });
    if (authError) {
      return send(response, 500, { message: 'Đã lưu chức vụ nhưng chưa lưu được thông tin còn lại. Vui lòng thử lại.' });
    }

    return send(response, 200, { profile: toAccountProfile(updatedRow as ProfileRow, updatedAuth.user) });
  }

  if (action === 'save-staff-alias') {
    if (requester.role !== 'manager' || !requester.branch_id) {
      return send(response, 403, { message: 'Chỉ Quản lí chi nhánh mới được đổi tên xếp lịch.' });
    }

    const employeeId = getText(body.employeeId);
    const branchId = getText(body.branchId);
    const displayName = getText(body.displayName);

    if (!employeeId || !branchId || branchId !== requester.branch_id) {
      return send(response, 400, { message: 'Nhân sự hoặc chi nhánh chưa đúng.' });
    }
    if (displayName.length > 80) {
      return send(response, 400, { message: 'Tên xếp lịch không được dài quá 80 ký tự.' });
    }

    const { data: employeeRow, error: employeeError } = await admin
      .from('profiles')
      .select('id,branch_id')
      .eq('id', employeeId)
      .maybeSingle();
    if (employeeError || !employeeRow || employeeRow.branch_id !== requester.branch_id) {
      return send(response, 404, { message: 'Không tìm thấy nhân sự thuộc chi nhánh của bạn.' });
    }

    if (!displayName) {
      const { error: deleteError } = await admin
        .from('staff_branch_aliases')
        .delete()
        .eq('manager_id', requester.id)
        .eq('employee_id', employeeId)
        .eq('branch_id', branchId);
      if (deleteError) {
        return send(response, 500, { message: 'Chưa đặt lại được tên nhân sự.' });
      }
      return send(response, 200, { alias: null });
    }

    const { data: savedAlias, error: aliasError } = await admin
      .from('staff_branch_aliases')
      .upsert(
        {
          manager_id: requester.id,
          employee_id: employeeId,
          branch_id: branchId,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'manager_id,employee_id,branch_id' },
      )
      .select('manager_id,employee_id,branch_id,display_name,updated_at')
      .single();
    if (aliasError || !savedAlias) {
      return send(response, 500, { message: 'Chưa lưu được tên xếp lịch.' });
    }

    const row = savedAlias as StaffBranchAliasRow;
    return send(response, 200, {
      alias: {
        managerId: row.manager_id,
        employeeId: row.employee_id,
        branchId: row.branch_id,
        displayName: row.display_name,
        updatedAt: row.updated_at,
      },
    });
  }

  if (action === 'save-avatar') {
    const imageData = getText(body.imageData);
    const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return send(response, 400, { message: 'Ảnh đã chọn không đọc được. Vui lòng chọn ảnh khác.' });
    }

    const binaryImage = atob(match[2]);
    const image = Uint8Array.from(binaryImage, (character) => character.charCodeAt(0));
    if (image.byteLength > 1024 * 1024) {
      return send(response, 400, { message: 'Ảnh quá lớn. Vui lòng chọn ảnh khác.' });
    }

    const { data: bucket } = await admin.storage.getBucket('avatars');
    if (!bucket) {
      const { error: createBucketError } = await admin.storage.createBucket('avatars', {
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 1024 * 1024,
        public: true,
      });
      if (createBucketError && !createBucketError.message.toLowerCase().includes('already exists')) {
        return send(response, 500, { message: 'Chưa chuẩn bị được nơi lưu ảnh. Vui lòng thử lại.' });
      }
    }

    const path = `${userData.user.id}/avatar.webp`;
    const { error: uploadError } = await admin.storage.from('avatars').upload(path, image, {
      cacheControl: '3600',
      contentType: match[1],
      upsert: true,
    });
    if (uploadError) {
      return send(response, 500, { message: 'Chưa lưu được ảnh đại diện. Vui lòng thử lại.' });
    }

    const { data: publicData } = admin.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
    const currentMetadata = getMetadata(userData.user);
    const { error: authError } = await admin.auth.admin.updateUserById(userData.user.id, {
      user_metadata: { ...currentMetadata, avatarUrl },
    });
    if (authError) {
      return send(response, 500, { message: 'Ảnh đã tải lên nhưng chưa gắn vào tài khoản. Vui lòng thử lại.' });
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', userData.user.id);
    if (profileError) {
      return send(response, 500, { message: 'Ảnh đã lưu nhưng chưa hiện trong hồ sơ. Vui lòng thử lại.' });
    }

    return send(response, 200, { avatarUrl });
  }

  return send(response, 400, { message: 'Không nhận ra thao tác bạn vừa chọn.' });
}
