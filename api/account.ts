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
  branch_id: string | null;
  created_at: string;
  email: string;
  full_name: string;
  id: string;
  role: UserRole;
};

type AccountProfile = {
  avatarUrl: string;
  branchId: string | null;
  email: string;
  employmentType: EmploymentType;
  fullName: string;
  id: string;
  phone: string;
  role: UserRole;
  startDate: string;
};

const validRoles: UserRole[] = ['owner', 'manager', 'employee'];
const validEmploymentTypes: EmploymentType[] = ['full_time', 'part_time'];

const send = (response: VercelResponse, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const getText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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
    : role === 'owner'
      ? 'full_time'
      : 'part_time';
  const metadataStartDate = getText(metadata.startDate);

  return {
    id: row.id,
    email: row.email,
    fullName: getText(metadata.fullName) || row.full_name,
    role,
    branchId: role === 'owner' ? null : row.branch_id,
    phone: getText(metadata.phone),
    avatarUrl: getText(metadata.avatarUrl),
    employmentType,
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(metadataStartDate)
      ? metadataStartDate
      : row.created_at.slice(0, 10),
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
    .select('id,email,full_name,role,branch_id,created_at')
    .eq('id', userData.user.id)
    .single();

  if (requesterError || !requesterRow) {
    return send(response, 403, { message: 'Không tìm thấy thông tin tài khoản của bạn.' });
  }

  const requester = requesterRow as ProfileRow;

  if (request.method === 'GET') {
    if (requester.role !== 'owner') {
      return send(response, 403, { message: 'Chỉ Chủ cửa hàng mới được xem danh sách nhân viên.' });
    }

    const { data: profileRows, error: profilesError } = await admin
      .from('profiles')
      .select('id,email,full_name,role,branch_id,created_at')
      .order('full_name');
    if (profilesError) {
      return send(response, 500, { message: 'Chưa tải được danh sách nhân viên. Vui lòng thử lại.' });
    }

    const users: User[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) {
        return send(response, 500, { message: 'Chưa tải được thông tin nhân viên. Vui lòng thử lại.' });
      }
      users.push(...data.users);
      if (data.users.length < 100) break;
    }

    const usersById = new Map(users.map((user) => [user.id, user]));
    const profiles = (profileRows as ProfileRow[]).map((row) => toAccountProfile(row, usersById.get(row.id)));
    return send(response, 200, { profiles });
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

    if (!fullName) {
      return send(response, 400, { message: 'Vui lòng nhập họ và tên.' });
    }

    const currentMetadata = getMetadata(userData.user);
    const { data: updatedAuth, error: authError } = await admin.auth.admin.updateUserById(userData.user.id, {
      user_metadata: { ...currentMetadata, avatarUrl, fullName, phone },
    });
    if (authError) {
      return send(response, 500, { message: 'Chưa lưu được thông tin cá nhân. Vui lòng thử lại.' });
    }

    const { data: updatedRow, error: profileError } = await admin
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', userData.user.id)
      .select('id,email,full_name,role,branch_id,created_at')
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
      .update({ branch_id: branchId, role, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select('id,email,full_name,role,branch_id,created_at')
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

    return send(response, 200, { avatarUrl });
  }

  return send(response, 400, { message: 'Không nhận ra thao tác bạn vừa chọn.' });
}
