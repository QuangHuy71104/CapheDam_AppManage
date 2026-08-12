import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  type KeyboardTypeOptions,
  type TextInputProps,
  useWindowDimensions,
  View,
} from './lib/web-ui';
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Camera,
  CircleAlert,
  CheckCircle2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  DoorClosed,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Mail,
  PackageCheck,
  Phone,
  RefreshCcw,
  Save,
  ShieldCheck,
  Store,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  LockKeyhole,
  X,
  XCircle,
} from 'lucide-react';
import { lazy, Suspense, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { webStorage } from './lib/storage';
import { parseAttendanceGrid } from './lib/attendance-grid';
import type { PublishedWorkSchedule } from './src/features/schedule/core';
import {
  getStaffDisplayName,
  loadStaffManagement,
  type ManagedStaffProfile,
  type StaffBranchAlias,
} from './src/features/staff/repository';

import { colors } from './src/shared/ui/theme';
import { styles } from './src/app/styles';
import {
  ClosingFormField,
  FormField,
  HistoryList,
  HistoryRow,
  PrimaryButton,
  SectionTitle,
  TransferSumField,
} from './src/app/components';
import {
  formatTransferExpression,
  isNumericText,
  sanitizeDigits,
  sanitizeShiftHours,
  sumTransferExpression,
  toNumber,
  trimTransferExpression,
} from './src/shared/lib/numbers';
import {
  branches,
  defaultBranchId,
  isStoreOwnerName,
  payrollPolicy,
  type Branch,
  type EmploymentType,
  type UserProfile,
  type UserRole,
} from './src/shared/domain';
import { isValidEmailAddress, minimumPasswordLength, normalizeEmailAddress } from './src/features/auth/domain';
import { callAccountApi } from './src/shared/api/account-client';
import { createSupplyState, supplyItems } from './src/features/inventory/catalog';
import { listIngredientReports, saveIngredientReport as persistIngredientReport } from './src/features/inventory/repository';
import type {
  IngredientReport,
  SupplyReportItem,
} from './src/features/inventory/model';
import { IngredientScreen } from './src/features/inventory/IngredientScreen';
import {
  createEmptyBalanceReport,
  createStockBalanceReport,
  deriveCupBalance,
  restorePlasticCupInput,
  restoreStockBalanceInput,
} from './src/features/closing/balance';
import { listShiftCloseReports, saveShiftCloseReport as persistShiftCloseReport } from './src/features/closing/repository';
import type {
  BalanceReportBase,
  CupBalanceStatus,
  PlasticCupInput,
  PlasticCupKey,
  ShiftCloseReport,
} from './src/features/closing/model';
import type {
  AttendanceDayEntry,
  AttendanceInputField,
  AttendanceSheet,
} from './src/features/attendance/model';
import { listAttendanceSheets } from './src/features/attendance/repository';
import {
  calculateBranchPayroll,
  calculatePayroll,
  invalidateBranchPayroll,
} from './src/features/payroll/domain';
import { listBranchPayrollConfirmations } from './src/features/payroll/repository';
import { syncPayrollWorkspace } from './src/features/payroll/workspace-sync';
import {
  initialPayrollWorkspace,
  normalizePayrollWorkspace,
  type PayrollWorkspace,
} from './src/features/payroll/workspace';
type TabKey = 'attendance' | 'ingredients' | 'closing' | 'ownerPayroll' | 'staffManagement' | 'schedule';
type AppPage = { key: 'main' } | { key: 'managerPayrollEmployee'; employeeId: string };
type AuthFeedback = {
  tone: 'success' | 'error' | 'info';
  title: string;
  message: string;
};
const publicSignupEnabled = import.meta.env.VITE_ENABLE_PUBLIC_SIGNUP === 'true';
const StaffManagementScreen = lazy(() =>
  import('./src/features/staff/StaffManagementScreen').then((module) => ({ default: module.StaffManagementScreen })),
);
const WorkScheduleScreen = lazy(() =>
  import('./src/features/schedule/WorkScheduleScreen').then((module) => ({ default: module.WorkScheduleScreen })),
);





type PendingSignupDraft = {
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
};

const PAYROLL_WORKSPACE_STORAGE_PREFIX = 'caphedam-payroll-workspace-v3:';
const getPayrollWorkspaceStorageKey = (userId: string) => `${PAYROLL_WORKSPACE_STORAGE_PREFIX}${userId}`;
const PROFILE_OVERRIDE_PREFIX = 'caphedam-profile-override-';
const logoImage = new URL('./assets/logo.jpg', import.meta.url).href;


const roleOptions: Array<{ key: UserRole; label: string; description: string; icon: typeof Clock3 }> = [
  {
    key: 'employee',
    label: 'Nhân viên',
    description: 'Chấm công, báo đồ và báo ca theo chi nhánh.',
    icon: UserRound,
  },
  {
    key: 'manager',
    label: 'Quản lí chi nhánh',
    description: 'Kiểm tra và duyệt bảng lương nhân viên cho chủ cửa hàng xem.',
    icon: UserCog,
  },
  {
    key: 'owner',
    label: 'Chủ cửa hàng',
    description: 'Xem bảng lương đã được quản lí duyệt của toàn bộ chi nhánh.',
    icon: ShieldCheck,
  },
];


const plasticCupTemplates: Array<{ key: PlasticCupKey; label: string }> = [
  { key: 'small', label: 'Ly nhỏ' },
  { key: 'large', label: 'Ly lớn' },
  { key: 'icedTea', label: 'Trà đá' },
];

const createPlasticCupState = (): Record<PlasticCupKey, PlasticCupInput> => ({
  small: { opening: '', remaining: '', machineCups: '', status: 'enough', variance: '' },
  large: { opening: '', remaining: '', machineCups: '', status: 'enough', variance: '' },
  icedTea: { opening: '', remaining: '', machineCups: '', status: 'enough', variance: '' },
});

const createBalanceInputState = (): PlasticCupInput => ({
  opening: '',
  remaining: '',
  machineCups: '',
  status: 'enough',
  variance: '',
});

const employeeTabItems: Array<{
  key: TabKey;
  label: string;
  icon: typeof Clock3;
}> = [
  { key: 'attendance', label: 'Chấm công', icon: Clock3 },
  { key: 'ingredients', label: 'Báo đồ', icon: PackageCheck },
  { key: 'closing', label: 'Báo ca', icon: DoorClosed },
];

const ownerTabItems: Array<{
  key: TabKey;
  label: string;
  icon: typeof Clock3;
}> = [
  { key: 'ownerPayroll', label: 'Bảng lương', icon: WalletCards },
  { key: 'staffManagement', label: 'Nhân sự', icon: UsersRound },
];

const managerTabItems: Array<{
  key: TabKey;
  label: string;
  icon: typeof Clock3;
}> = [
  { key: 'attendance', label: 'Duyệt lương', icon: WalletCards },
  ...employeeTabItems.filter((item) => item.key !== 'attendance'),
  { key: 'staffManagement', label: 'Nhân sự', icon: UsersRound },
  { key: 'schedule', label: 'Xếp lịch', icon: CalendarDays },
];

const getTabItemsForRole = (role: UserRole) =>
  role === 'owner' ? ownerTabItems : role === 'manager' ? managerTabItems : employeeTabItems;


const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const formatProfileDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));

const formatSeniority = (startDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(start.getTime()) || start > today) {
    return 'Chưa xác định';
  }

  let months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) {
    months -= 1;
  }
  months = Math.max(0, months);

  if (months === 0) {
    return 'Dưới 1 tháng';
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return [years > 0 ? `${years} năm` : '', remainingMonths > 0 ? `${remainingMonths} tháng` : '']
    .filter(Boolean)
    .join(' ');
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

const legacyCurrency = (value?: number) => (typeof value === 'number' ? formatCurrency(value) : '');

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value);

const getMonthKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${date.getFullYear()}-${month}`;
};

const parseMonthKey = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
  };
};

const formatMonthKey = (monthKey: string) => {
  const { month, year } = parseMonthKey(monthKey);

  return `Tháng ${month}/${year}`;
};

const shiftMonthKey = (monthKey: string, offset: number) => {
  const { month, year } = parseMonthKey(monthKey);
  const nextDate = new Date(year, month - 1 + offset, 1);

  return getMonthKey(nextDate);
};

const getDaysInMonth = (monthKey: string) => {
  const { month, year } = parseMonthKey(monthKey);

  return new Date(year, month, 0).getDate();
};

const getAttendanceDayKey = (monthKey: string, day: number) => `${monthKey}-${String(day).padStart(2, '0')}`;

const isSundayAttendanceDay = (monthKey: string, day: number) => {
  const { month, year } = parseMonthKey(monthKey);
  return new Date(year, month - 1, day).getDay() === 0;
};

const isSundayAttendanceDayKey = (dayKey: string) => new Date(`${dayKey}T12:00:00`).getDay() === 0;

const formatHoursInput = (hours: number) => String(hours).replace('.', ',');

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekdayLabel = (monthKey: string, day: number) => {
  const { month, year } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
};

const isCurrentMonth = (monthKey: string) => monthKey === getMonthKey();
const isFutureMonth = (monthKey: string) => monthKey > getMonthKey();

const getBranchById = (branchId: string) => branches.find((branch) => branch.id === branchId) ?? branches[0];

const getReportBranchId = (report: { branchId?: string }) => report.branchId ?? defaultBranchId;

const createEmptyAttendanceSheet = (
  branchId: string,
  employeeName: string,
  monthKey: string,
  userId?: string,
  policy?: Pick<AttendanceSheet, 'allowance' | 'breakfastAllowance' | 'hourlyRate'>,
): AttendanceSheet => ({
  id: createId(),
  userId,
  branchId,
  employeeName,
  monthKey,
  days: {},
  ...policy,
});

const getAttendanceSheet = (
  sheets: AttendanceSheet[],
  branchId: string,
  employeeName: string,
  monthKey: string,
  userId?: string,
) =>
  sheets.find(
    (sheet) =>
      sheet.branchId === branchId &&
      sheet.monthKey === monthKey &&
      (userId
        ? sheet.userId === userId || (!sheet.userId && sheet.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase())
        : sheet.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase()),
  );

const updateSheetCollection = (
  sheets: AttendanceSheet[],
  branchId: string,
  employeeName: string,
  monthKey: string,
  userId: string | undefined,
  updater: (sheet: AttendanceSheet) => AttendanceSheet,
) => {
  const index = sheets.findIndex(
    (sheet) =>
      sheet.branchId === branchId &&
      sheet.monthKey === monthKey &&
      (userId
        ? sheet.userId === userId || (!sheet.userId && sheet.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase())
        : sheet.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase()),
  );
  const baseSheet = index >= 0 ? sheets[index] : createEmptyAttendanceSheet(branchId, employeeName, monthKey, userId);
  const nextSheet = updater({
    ...baseSheet,
    employeeName: employeeName.trim() || baseSheet.employeeName,
    userId: baseSheet.userId ?? userId,
  });

  if (index < 0) {
    return [nextSheet, ...sheets];
  }

  return sheets.map((sheet, sheetIndex) => (sheetIndex === index ? nextSheet : sheet));
};

const normalizeRole = (value: unknown): UserRole =>
  value === 'owner' || value === 'manager' || value === 'employee' ? value : 'employee';

const normalizeBranchId = (role: UserRole, value: unknown) => {
  if (role === 'owner') {
    return null;
  }

  return typeof value === 'string' && branches.some((branch) => branch.id === value) ? value : defaultBranchId;
};

const normalizeEmploymentType = (value: unknown, role: UserRole): EmploymentType =>
  value === 'full_time' || value === 'part_time' ? value : role === 'owner' ? 'full_time' : 'part_time';

const normalizeProfileDate = (value: unknown, fallback?: unknown) => {
  const candidate = typeof value === 'string' && value ? value : typeof fallback === 'string' ? fallback : '';
  const match = candidate.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
};

const normalizeOptionalProfileDate = (value: unknown) => {
  const candidate = typeof value === 'string' ? value : '';
  const match = candidate.match(/^\d{4}-\d{2}-\d{2}$/);
  return match?.[0] ?? '';
};

type EditableProfileOverride = Pick<UserProfile, 'avatarUrl' | 'dateOfBirth' | 'fullName' | 'phone'>;

const readLocalProfileOverride = async (userId: string): Promise<Partial<EditableProfileOverride>> => {
  try {
    const rawValue = await webStorage.getItem(`${PROFILE_OVERRIDE_PREFIX}${userId}`);
    if (!rawValue) {
      return {};
    }
    const value = JSON.parse(rawValue) as Record<string, unknown>;
    return {
      avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
      dateOfBirth: typeof value.dateOfBirth === 'string' ? normalizeOptionalProfileDate(value.dateOfBirth) : undefined,
      fullName: typeof value.fullName === 'string' && value.fullName.trim() ? value.fullName.trim() : undefined,
      phone: typeof value.phone === 'string' ? value.phone : undefined,
    };
  } catch {
    return {};
  }
};

const saveLocalProfileOverride = async (userId: string, value: EditableProfileOverride) => {
  try {
    await webStorage.setItem(`${PROFILE_OVERRIDE_PREFIX}${userId}`, JSON.stringify(value));
  } catch {
    // Auth/database persistence still succeeds if device storage is unavailable.
  }
};

const applySelfProfileOverrides = async (profile: UserProfile, user: User) => {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const localValue = await readLocalProfileOverride(user.id);
  const metadataName = typeof metadata?.fullName === 'string' && metadata.fullName.trim() ? metadata.fullName.trim() : undefined;
  const metadataPhone = typeof metadata?.phone === 'string' ? metadata.phone : undefined;
  const metadataAvatar = typeof metadata?.avatarUrl === 'string' ? metadata.avatarUrl : undefined;
  const metadataDateOfBirth =
    typeof metadata?.dateOfBirth === 'string' ? normalizeOptionalProfileDate(metadata.dateOfBirth) : undefined;

  return {
    ...profile,
    fullName: localValue.fullName ?? metadataName ?? profile.fullName,
    phone: localValue.phone ?? metadataPhone ?? profile.phone,
    avatarUrl: localValue.avatarUrl ?? metadataAvatar ?? profile.avatarUrl,
    dateOfBirth: localValue.dateOfBirth ?? metadataDateOfBirth ?? profile.dateOfBirth,
    employmentType: normalizeEmploymentType(metadata?.employmentType, profile.role),
    startDate: normalizeProfileDate(metadata?.startDate, profile.startDate),
  };
};

const mapProfileRow = (row: Record<string, unknown>, user: User): UserProfile => {
  const fullName = typeof row.full_name === 'string' ? row.full_name : '';
  const storedRole = normalizeRole(row.role);
  const role = storedRole === 'owner' && !isStoreOwnerName(fullName) ? 'employee' : storedRole;
  const branchId = normalizeBranchId(role, row.branch_id);
  const normalizedEmail = typeof row.email === 'string' && row.email ? normalizeEmailAddress(row.email) : '';
  const getMoneyValue = (value: unknown, fallback: number) => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  return {
    id: typeof row.id === 'string' && row.id ? row.id : user.id,
    email: normalizedEmail || normalizeEmailAddress(user.email ?? ''),
    fullName,
    role,
    branchId,
    phone: typeof row.phone === 'string' ? row.phone : '',
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : '',
    dateOfBirth: normalizeOptionalProfileDate(row.date_of_birth),
    employmentType: normalizeEmploymentType(row.employment_type, role),
    startDate: normalizeProfileDate(row.start_date, row.created_at),
    hourlyRate: getMoneyValue(row.hourly_rate, payrollPolicy.hourlyRate),
    allowance: getMoneyValue(row.allowance, payrollPolicy.monthlyAllowance),
    breakfastAllowance: getMoneyValue(row.breakfast_allowance, payrollPolicy.breakfastPerMorningShift),
  };
};


const fetchUserProfile = async (user: User, signupDraft?: PendingSignupDraft | null): Promise<UserProfile> => {
  const { data: row, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (row) {
    return applySelfProfileOverrides(mapProfileRow(row as Record<string, unknown>, user), user);
  }

  const normalizedUserEmail = normalizeEmailAddress(user.email ?? '');
  const draftMatchesUser = signupDraft?.email === normalizedUserEmail;
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const metadataRole = normalizeRole(metadata?.role);
  const fallbackFullName = draftMatchesUser
    ? signupDraft.fullName
    : typeof metadata?.fullName === 'string'
      ? metadata.fullName
      : '';
  const requestedFallbackRole = draftMatchesUser ? signupDraft.role : metadataRole;
  const fallbackRole = requestedFallbackRole === 'owner' && !isStoreOwnerName(fallbackFullName)
    ? 'employee'
    : requestedFallbackRole;
  const fallbackEmail = normalizedUserEmail || signupDraft?.email || '';

  if (!fallbackEmail) {
    throw new Error('Không tìm thấy email của tài khoản.');
  }

  const fallbackProfile: UserProfile = {
    id: user.id,
    email: fallbackEmail,
    fullName: fallbackFullName,
    role: fallbackRole,
    branchId: draftMatchesUser
      ? signupDraft.branchId
      : normalizeBranchId(fallbackRole, metadata?.branchId),
    phone: typeof metadata?.phone === 'string' ? metadata.phone : '',
    avatarUrl: typeof metadata?.avatarUrl === 'string' ? metadata.avatarUrl : '',
    dateOfBirth: typeof metadata?.dateOfBirth === 'string' ? normalizeOptionalProfileDate(metadata.dateOfBirth) : '',
    employmentType: normalizeEmploymentType(metadata?.employmentType, fallbackRole),
    startDate: new Date().toISOString().slice(0, 10),
    hourlyRate: payrollPolicy.hourlyRate,
    allowance: payrollPolicy.monthlyAllowance,
    breakfastAllowance: payrollPolicy.breakfastPerMorningShift,
  };

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      id: fallbackProfile.id,
      email: fallbackProfile.email,
      full_name: fallbackProfile.fullName,
      role: fallbackProfile.role,
      branch_id: fallbackProfile.branchId,
      date_of_birth: fallbackProfile.dateOfBirth || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    throw upsertError;
  }

  return applySelfProfileOverrides(fallbackProfile, user);
};

const saveOwnProfile = async ({
  avatarUrl,
  dateOfBirth,
  fullName,
  phone,
}: {
  avatarUrl: string;
  dateOfBirth: string;
  fullName: string;
  phone: string;
}) => {
  const result = await callAccountApi<{ profile: UserProfile }>('PATCH', {
    action: 'save-self',
    avatarUrl,
    dateOfBirth,
    fullName: fullName.trim(),
    phone: phone.trim(),
  });
  return result.profile;
};

const compressAvatarFile = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn một ảnh trong điện thoại.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ảnh đại diện không được lớn hơn 10 MB.');
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.max(0, (bitmap.width - sourceSize) / 2);
  const sourceY = Math.max(0, (bitmap.height - sourceSize) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  if (!context) {
    bitmap.close();
    throw new Error('Trình duyệt không xử lý được ảnh này.');
  }

  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không thể tối ưu ảnh đại diện.'))),
      'image/webp',
      0.84,
    );
  });
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Không đọc được ảnh đại diện.'));
    reader.readAsDataURL(blob);
  });

const uploadProfileAvatar = async (profileId: string, image: Blob) => {
  void profileId;
  const imageData = await blobToDataUrl(image);
  const result = await callAccountApi<{ avatarUrl: string }>('PATCH', {
    action: 'save-avatar',
    imageData,
  });
  return result.avatarUrl;
};

const loadAppDataFromSupabase = async (profile: UserProfile): Promise<PayrollWorkspace> => {
  const attendanceSheets = await listAttendanceSheets(profile);
  const branchPayrolls = await listBranchPayrollConfirmations(profile);

  return normalizePayrollWorkspace({
    attendanceSheets,
    branchPayrolls,
  });
};

const getFriendlyErrorMessage = (error: unknown, fallback = 'Chưa thực hiện được. Vui lòng thử lại.') => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : '';
  const message = rawMessage.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu chưa đúng.';
  }
  if (message.includes('email not confirmed')) {
    return 'Email này chưa được xác nhận.';
  }
  if (message.includes('already registered') || message.includes('already exists') || message.includes('duplicate')) {
    return 'Thông tin này đã có. Vui lòng kiểm tra lại.';
  }
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('timeout')) {
    return 'Không kết nối được. Vui lòng kiểm tra mạng rồi thử lại.';
  }
  if (message.includes('row-level security') || message.includes('permission') || message.includes('not allowed')) {
    return 'Tài khoản của bạn không được phép thực hiện việc này.';
  }
  if (message.includes('jwt') || message.includes('session') || message.includes('refresh token')) {
    return 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.';
  }
  if (message.includes('version_conflict') || message.includes('40001')) {
    return 'Dữ liệu đã được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi tiếp tục chỉnh sửa.';
  }
  if (
    message.includes('schema') ||
    message.includes('column') ||
    message.includes('constraint') ||
    message.includes('pgrst')
  ) {
    return 'Ứng dụng chưa sẵn sàng để lưu mục này. Vui lòng báo người phụ trách.';
  }
  if (rawMessage && /[^\u0000-\u007f]/.test(rawMessage)) {
    return rawMessage;
  }

  return fallback;
};

type ScheduledEmployeeHours = {
  allowance: number;
  breakfastAllowance: number;
  employeeName: string;
  hourlyRate: number;
  days: Map<string, Partial<Record<AttendanceInputField, string>>>;
};

const attendanceFields: AttendanceInputField[] = ['morning', 'afternoon', 'opening'];

// A published schedule owns only the hours it placed in the sheet. If a
// manager later corrects a cell by hand, a re-send of the week keeps that
// correction instead of overwriting it.
const applyPublishedScheduleToAttendance = (current: PayrollWorkspace, schedule: PublishedWorkSchedule): PayrollWorkspace => {
  const scheduledByEmployeeId = new Map<string, ScheduledEmployeeHours>();
  const scheduledByName = new Map<string, ScheduledEmployeeHours>();
  const affectedDateKeys = new Set<string>();

  const weekStart = new Date(`${schedule.weekStart}T12:00:00`);
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + dayOffset);
    affectedDateKeys.add(getLocalDateKey(day));
  }

  schedule.assignments.forEach((assignment) => {
    if (assignment.shift === 'afternoon' && isSundayAttendanceDayKey(assignment.dateKey)) {
      return;
    }

    const normalizedName = assignment.employeeName.trim().toLocaleLowerCase('vi-VN');
    if (!assignment.employeeId || !normalizedName) {
      return;
    }

    let employee = scheduledByEmployeeId.get(assignment.employeeId);
    if (!employee) {
      employee = {
        allowance: assignment.allowance,
        breakfastAllowance: assignment.breakfastAllowance,
        employeeName: assignment.employeeName.trim(),
        hourlyRate: assignment.hourlyRate,
        days: new Map(),
      };
      scheduledByEmployeeId.set(assignment.employeeId, employee);
      scheduledByName.set(normalizedName, employee);
    }

    const hoursForDay = employee.days.get(assignment.dateKey) ?? {};
    if (assignment.shift === 'opening') {
      const morningHours = toNumber(hoursForDay.morning ?? '') + assignment.hours;
      hoursForDay.morning = formatHoursInput(morningHours);
      hoursForDay.opening = '';
    } else {
      hoursForDay[assignment.shift] = formatHoursInput(assignment.hours);
    }
    employee.days.set(assignment.dateKey, hoursForDay);
    affectedDateKeys.add(assignment.dateKey);
  });

  const nextSheets = [...current.attendanceSheets];
  scheduledByEmployeeId.forEach((employee, userId) => {
    const monthKeys = new Set([...employee.days.keys()].map((dateKey) => getMonthKey(new Date(`${dateKey}T12:00:00`))));
    monthKeys.forEach((monthKey) => {
      const exists = nextSheets.some(
        (sheet) =>
          sheet.branchId === schedule.branchId &&
          sheet.monthKey === monthKey &&
          (sheet.userId === userId || (!sheet.userId && sheet.employeeName.trim().toLocaleLowerCase('vi-VN') === employee.employeeName.toLocaleLowerCase('vi-VN'))),
      );
      if (!exists) {
        nextSheets.push(
          createEmptyAttendanceSheet(schedule.branchId, employee.employeeName, monthKey, userId, {
            allowance: employee.allowance,
            breakfastAllowance: employee.breakfastAllowance,
            hourlyRate: employee.hourlyRate,
          }),
        );
      }
    });
  });

  let changed = false;
  const attendanceSheets = nextSheets.map((sheet) => {
    if (sheet.branchId !== schedule.branchId) {
      return sheet;
    }

    const employee = sheet.userId
      ? scheduledByEmployeeId.get(sheet.userId)
      : scheduledByName.get(sheet.employeeName.trim().toLocaleLowerCase('vi-VN'));
    const datesInSheet = [...affectedDateKeys].filter((dateKey) => getMonthKey(new Date(`${dateKey}T12:00:00`)) === sheet.monthKey);
    if (datesInSheet.length === 0) {
      return sheet;
    }

    let sheetChanged = false;
    const nextDays = { ...sheet.days };

    datesInSheet.forEach((dateKey) => {
      const currentEntry = nextDays[dateKey] ?? { morning: '', afternoon: '', opening: '' };
      const desired = employee?.days.get(dateKey);
      const priorScheduled = currentEntry.scheduled ?? {};
      const nextScheduled: Partial<Record<AttendanceInputField, string>> = {};
      const nextEntry: AttendanceDayEntry = {
        morning: currentEntry.morning ?? '',
        afternoon: currentEntry.afternoon ?? '',
        opening: currentEntry.opening ?? '',
      };
      let dayChanged = false;

      attendanceFields.forEach((field) => {
        const previousValue = priorScheduled[field];
        const nextValue = desired?.[field];
        const currentValue = currentEntry[field] ?? '';

        if (previousValue !== undefined && (currentValue === previousValue || currentValue === '')) {
          const replacement = nextValue ?? '';
          if (nextEntry[field] !== replacement) {
            nextEntry[field] = replacement;
            dayChanged = true;
          }
        } else if (previousValue === undefined && nextValue !== undefined && currentValue === '') {
          nextEntry[field] = nextValue;
          dayChanged = true;
        }

        if (nextValue !== undefined) {
          nextScheduled[field] = nextValue;
        }
      });

      if (Object.keys(nextScheduled).length > 0) {
        nextEntry.scheduled = nextScheduled;
      }

      if (JSON.stringify(currentEntry.scheduled ?? {}) !== JSON.stringify(nextScheduled)) {
        dayChanged = true;
      }

      if (dayChanged) {
        nextDays[dateKey] = nextEntry;
        sheetChanged = true;
      }
    });

    if (!sheetChanged) {
      return sheet;
    }

    changed = true;
    return {
      ...sheet,
      days: nextDays,
      managerApprovedAt: undefined,
      managerApprovedBy: undefined,
    };
  });

  if (!changed) {
    return current;
  }

  const branchPayrolls = [...affectedDateKeys]
    .map((dateKey) => getMonthKey(new Date(`${dateKey}T12:00:00`)))
    .filter((monthKey, index, values) => values.indexOf(monthKey) === index)
    .reduce(
      (confirmations, monthKey) => invalidateBranchPayroll(confirmations, schedule.branchId, monthKey),
      current.branchPayrolls,
    );

  return { ...current, attendanceSheets, branchPayrolls };
};

const formatCupBalance = (status: CupBalanceStatus, variance: number) => {
  if (status === 'enough') {
    return 'đủ';
  }

  return `${status === 'short' ? 'thiếu' : 'dư'} ${formatNumber(variance)}`;
};

type ExportCard = {
  title: string;
  lines: string[];
  required?: boolean;
};

const escapeSvgText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const wrapSvgText = (value: string, maxLength: number) => {
  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const wrapMultilineText = (value: string, maxLength: number) =>
  value
    .split(/\r?\n/)
    .flatMap((line) => wrapSvgText(line, maxLength));

const formatBalanceReportLine = (report: BalanceReportBase, includeLabel = true) => {
  const hasSavedInput =
    report.openingText !== undefined ||
    report.remainingText !== undefined ||
    report.machineCupsText !== undefined;
  const openingValue = hasSavedInput ? report.openingText ?? '' : formatNumber(report.opening);
  const remainingValue = hasSavedInput ? report.remainingText ?? '' : formatNumber(report.remaining);
  const canShowSold =
    !hasSavedInput ||
    (isNumericText(report.openingText ?? '') && isNumericText(report.remainingText ?? ''));
  const canShowBalance =
    !hasSavedInput ||
    (isNumericText(report.openingText ?? '') &&
      isNumericText(report.remainingText ?? '') &&
      isNumericText(report.machineCupsText ?? ''));
  const soldValue = canShowSold ? formatNumber(report.sold) : '';
  const balanceValue = canShowBalance ? formatCupBalance(report.status, report.variance) : '';
  const labelPrefix = includeLabel ? `${report.label}: ` : '';

  return `${labelPrefix}${openingValue}-${soldValue}(bán)=${remainingValue}(còn)${balanceValue ? ` ${balanceValue}` : ''}`;
};

const hasSavedBalanceInput = (report: BalanceReportBase) =>
  report.openingText !== undefined ||
  report.remainingText !== undefined ||
  report.machineCupsText !== undefined;

const canShowSavedSold = (report: BalanceReportBase) =>
  !hasSavedBalanceInput(report) ||
  (isNumericText(report.openingText ?? '') && isNumericText(report.remainingText ?? ''));

const canShowSavedBalance = (report: BalanceReportBase) =>
  !hasSavedBalanceInput(report) ||
  (isNumericText(report.openingText ?? '') &&
    isNumericText(report.remainingText ?? '') &&
    isNumericText(report.machineCupsText ?? ''));

const formatBalanceHistorySummary = (report: BalanceReportBase) => {
  if (!canShowSavedSold(report)) {
    return `${report.label}: chưa nhập đủ`;
  }

  const soldText = `bán ${formatNumber(report.sold)}`;

  if (!canShowSavedBalance(report)) {
    return `${report.label}: ${soldText}`;
  }

  return `${report.label}: ${soldText}, ${formatCupBalance(report.status, report.variance)}`;
};

const formatLineWithSuffix = (label: string, value: string | undefined, suffix: string) => {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue ? `${label}: ${trimmedValue} ${suffix}` : '';
};

const findTransferValue = (transferMoney: string | undefined, label: string) => {
  const prefix = `${label}:`;
  const line = transferMoney
    ?.split('\n')
    .find((item) => item.trim().toLowerCase().startsWith(prefix.toLowerCase()));

  return line?.trim().slice(prefix.length).trim() ?? '';
};

const findBankTransferExpression = (transferMoney: string | undefined) =>
  findTransferValue(transferMoney, 'CK').split('=')[0]?.trim() ?? '';

const buildClosingExportCards = (report: ShiftCloseReport): ExportCard[] => {
  const cards: ExportCard[] = [];
  const plasticRows = plasticCupTemplates.map(({ key, label }) => {
    return report.plasticCupRows?.find((row) => row.key === key) ?? {
      ...createEmptyBalanceReport(label),
      key,
    };
  });

  cards.push({
    title: 'Ly Nhựa',
    required: true,
    lines: plasticRows.map((row) => formatBalanceReportLine(row)),
  });

  const glassSummary = [
    report.smallBottles?.trim() ? `${report.smallBottles.trim()}M` : '',
    report.largeBottles?.trim() ? `${report.largeBottles.trim()}L` : '',
  ]
    .filter(Boolean)
    .join(' ');

  cards.push({
    title: 'Ly Thủy Tinh',
    required: true,
    lines: [glassSummary],
  });

  cards.push({
    title: 'Sữa Bắp',
    required: true,
    lines: [formatBalanceReportLine(report.cornMilkReport ?? createEmptyBalanceReport('Sữa Bắp'), false)],
  });

  const coffeeLines = [
    report.smallCoffeePacks?.trim() ? `Nhỏ: ${report.smallCoffeePacks.trim()}` : '',
    report.largeCoffeePacks?.trim() ? `Lớn: ${report.largeCoffeePacks.trim()}` : '',
  ].filter(Boolean);

  cards.push({
    title: 'Cà Phê Gói',
    lines: coffeeLines,
  });

  cards.push({
    title: 'Tiền Trên Máy',
    required: true,
    lines: [(report.machineMoney ?? '').trim()],
  });

  cards.push({
    title: 'Tiền Tại Quán',
    required: true,
    lines: [(report.storeMoney ?? '').trim()],
  });

  const shopeeMoney = report.shopeeMoney?.trim() || findTransferValue(report.transferMoney, 'Shopee');
  const bankTransferExpression = report.bankTransferMoney?.trim() || findBankTransferExpression(report.transferMoney);
  const bankTransferTotal = typeof report.bankTransferTotal === 'number' ? report.bankTransferTotal : sumTransferExpression(bankTransferExpression);
  const transferLines = [
    shopeeMoney ? `Shopee: ${shopeeMoney}` : '',
    bankTransferExpression ? `CK: ${bankTransferExpression}=${formatNumber(bankTransferTotal)}` : '',
  ].filter(Boolean);

  cards.push({
    title: 'Tiền Chuyển Khoản',
    lines: transferLines,
  });

  const extraLines = [
    formatLineWithSuffix('Đá', report.iceBags, 'bao'),
    formatLineWithSuffix('Bình nước suối', report.waterBottles, 'bình'),
    report.cardTopupMoney?.trim() ? `Tiền nạp card: ${report.cardTopupMoney.trim()}` : '',
    ...wrapMultilineText(report.note ?? '', 42),
  ].filter(Boolean);

  cards.push({
    title: 'Ghi chú',
    lines: extraLines,
  });

  return cards;
};

const buildClosingReportSvg = (report: ShiftCloseReport) => {
  const cards = buildClosingExportCards(report);
  const canvasWidth = 504;
  const cardWidth = 459;
  const cardX = 22;
  const cardGap = 22;
  const titleY = 52;
  const firstLineY = 86;
  const lineHeight = 32;
  const cardPaddingBottom = 30;

  let body = '';
  let cursorY = 20;

  cards.forEach((card) => {
    const wrappedLines = card.lines.flatMap((line) => {
      const lineParts = wrapSvgText(line, 31);
      return lineParts.length > 0 ? lineParts : [''];
    });
    const cardHeight = firstLineY + wrappedLines.length * lineHeight + cardPaddingBottom;

    body += `
      <g>
        <rect x="${cardX}" y="${cursorY}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#FFF9F1" stroke="#D8C3AE" stroke-width="1.5" />
        <text x="${cardX + 17}" y="${cursorY + titleY}" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#23160F">
          <tspan>${escapeSvgText(card.title)}</tspan>${card.required ? `<tspan fill="#B4483C"> *</tspan>` : ''}
        </text>
        ${wrappedLines
          .map(
            (line, index) =>
              `<text x="${cardX + 17}" y="${cursorY + firstLineY + index * lineHeight}" font-family="Arial, sans-serif" font-size="11" font-weight="500" fill="#23160F">${escapeSvgText(line)}</text>`,
          )
          .join('\n')}
      </g>
    `;

    cursorY += cardHeight + cardGap;
  });

  const canvasHeight = Math.max(cursorY + 12, 120);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <rect width="100%" height="100%" fill="#F5EDE1" />
  ${body}
</svg>`;
};

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

const downloadFile = (url: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const dataUriToFile = async (dataUri: string, fileName: string) => {
  const response = await fetch(dataUri);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'image/png' });
};

const shareText = async (text: string) => {
  if (navigator.share) {
    await navigator.share({ text });
    return;
  }

  await navigator.clipboard?.writeText(text);
  Alert.alert('Đã chuẩn bị nội dung', 'Trình duyệt không hỗ trợ mở share. Nội dung đã được sao chép.');
};

const shareFile = async (file: File, text: string) => {
  const sharePayload = { files: [file], text };
  if (navigator.share && (!navigator.canShare || navigator.canShare(sharePayload))) {
    await navigator.share(sharePayload);
    return;
  }

  const fileUrl = URL.createObjectURL(file);
  downloadFile(fileUrl, file.name);
  setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  await navigator.clipboard?.writeText(text);
  Alert.alert('Đã tạo ảnh báo ca', 'Trình duyệt không hỗ trợ share file. Ảnh đã được tải xuống, nội dung gửi đã được sao chép.');
};

const exportClosingReportImage = async (
  report: ShiftCloseReport,
  exportViewRef: { current: HTMLElement | null },
): Promise<File> => {
  await waitForNextFrame();

  try {
    const fileName = `bao-ca-${report.id}.png`;
    if (!exportViewRef.current) {
      throw new Error('Không tìm thấy nội dung báo ca để xuất ảnh.');
    }

    const { toPng } = await import('html-to-image');
    const dataUri = await toPng(exportViewRef.current, {
      backgroundColor: '#F5EDE1',
      cacheBust: true,
      pixelRatio: 2,
    });
    return dataUriToFile(dataUri, fileName);
  } catch {
    return exportClosingReportSvg(report);
  }
};

const exportClosingReportSvg = async (report: ShiftCloseReport) => {
  const svg = buildClosingReportSvg(report);
  const fileName = `bao-ca-${report.id}.svg`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  return new File([blob], fileName, { type: 'image/svg+xml' });
};

const numericKeyboard: KeyboardTypeOptions = 'number-pad';
const decimalKeyboard: KeyboardTypeOptions = 'decimal-pad';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [page, setPage] = useState<AppPage>({ key: 'main' });
  const [data, setData] = useState<PayrollWorkspace>(initialPayrollWorkspace);
  const [ingredientReports, setIngredientReports] = useState<IngredientReport[]>([]);
  const [closingReports, setClosingReports] = useState<ShiftCloseReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [dataLoadRetryToken, setDataLoadRetryToken] = useState(0);
  const [syncingRemote, setSyncingRemote] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncRetryToken, setSyncRetryToken] = useState(0);
  const [currentRole, setCurrentRole] = useState<UserRole>('employee');
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [selectedMonthKey, setSelectedMonthKey] = useState(getMonthKey());
  const contentScrollRef = useRef<ScrollView>(null);
  const exportCaptureRef = useRef<HTMLDivElement>(null);
  const remoteSnapshotRef = useRef('');
  const latestDataRef = useRef<PayrollWorkspace>(initialPayrollWorkspace);
  const latestProfileRef = useRef<UserProfile | null>(null);
  const remoteRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSignupRef = useRef<PendingSignupDraft | null>(null);

  const [employeeName, setEmployeeName] = useState('');

  const [supplyRows, setSupplyRows] = useState(createSupplyState);
  const [ingredientNote, setIngredientNote] = useState('');
  const [savingIngredientReport, setSavingIngredientReport] = useState(false);

  const [plasticCupRows, setPlasticCupRows] = useState(createPlasticCupState);
  const [cornMilkRow, setCornMilkRow] = useState(createBalanceInputState);
  const [smallBottles, setSmallBottles] = useState('');
  const [largeBottles, setLargeBottles] = useState('');
  const [smallCoffeePacks, setSmallCoffeePacks] = useState('');
  const [largeCoffeePacks, setLargeCoffeePacks] = useState('');
  const [machineMoney, setMachineMoney] = useState('');
  const [storeMoney, setStoreMoney] = useState('');
  const [shopeeMoney, setShopeeMoney] = useState('');
  const [bankTransferMoney, setBankTransferMoney] = useState('');
  const [iceBags, setIceBags] = useState('');
  const [waterBottles, setWaterBottles] = useState('');
  const [cardTopupMoney, setCardTopupMoney] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [closingErrors, setClosingErrors] = useState<string[]>([]);
  const [savingClosingReport, setSavingClosingReport] = useState(false);
  const [pendingClosingExport, setPendingClosingExport] = useState<ShiftCloseReport | null>(null);
  const [scheduleDirty, setScheduleDirty] = useState(false);

  const clearClosingErrors = (...keys: string[]) => {
    if (keys.length === 0) {
      return;
    }

    setClosingErrors((current) => current.filter((key) => !keys.includes(key)));
  };

  const setNumericClosingValue = (setter: (value: string) => void, errorKey: string) => (value: string) => {
    setter(sanitizeDigits(value));
    clearClosingErrors(errorKey);
  };

  const updatePlasticCupRow = (key: PlasticCupKey, patch: Partial<PlasticCupInput>) => {
    setPlasticCupRows((current) => {
      const nextRow = {
        ...current[key],
        ...patch,
      };

      return {
        ...current,
        [key]: {
          ...nextRow,
          ...deriveCupBalance(nextRow),
        },
      };
    });
  };

  const updateCornMilkRow = (patch: Partial<PlasticCupInput>) => {
    setCornMilkRow((current) => {
      const nextRow = {
        ...current,
        ...patch,
      };

      return {
        ...nextRow,
        ...deriveCupBalance(nextRow),
      };
    });
  };

  // A manager can stay signed in while an employee submits their payroll from
  // another device. Keep the visible snapshot fresh without replacing edits
  // that have not been sent to Supabase yet.
  const refreshRemoteData = useCallback(async (scope: 'all' | 'payroll' | 'ingredients' | 'closing' = 'all') => {
    if (!profile || !remoteReady || remoteRefreshInFlightRef.current) {
      return;
    }

    const refreshesPayroll = scope === 'all' || scope === 'payroll';
    const localSnapshot = JSON.stringify(latestDataRef.current);
    if (refreshesPayroll && localSnapshot !== remoteSnapshotRef.current) {
      return;
    }

    const request = (async () => {
      const [remoteData, remoteIngredients, remoteClosings] = await Promise.all([
        refreshesPayroll ? loadAppDataFromSupabase(profile) : Promise.resolve(null),
        scope === 'all' || scope === 'ingredients' ? listIngredientReports(profile) : Promise.resolve(null),
        scope === 'all' || scope === 'closing' ? listShiftCloseReports(profile) : Promise.resolve(null),
      ]);

      const activeProfile = latestProfileRef.current;
      if (
        activeProfile?.id !== profile.id ||
        activeProfile.role !== profile.role ||
        activeProfile.branchId !== profile.branchId
      ) {
        return;
      }

      if (remoteData) {
        // A user may have started editing while the request was in flight.
        // In that case the normal save flow owns the next snapshot.
        if (JSON.stringify(latestDataRef.current) !== localSnapshot) {
          return;
        }
        remoteSnapshotRef.current = JSON.stringify(remoteData);
        latestDataRef.current = remoteData;
        setData(remoteData);
      }
      if (remoteIngredients) setIngredientReports(remoteIngredients);
      if (remoteClosings) setClosingReports(remoteClosings);
      setSyncError(null);
    })();
    remoteRefreshInFlightRef.current = request;

    try {
      await request;
    } catch {
      // This is a background refresh. Saving data has its own retry/error UI,
      // so a transient refresh failure should not be shown as a failed save.
    } finally {
      if (remoteRefreshInFlightRef.current === request) {
        remoteRefreshInFlightRef.current = null;
      }
    }
  }, [profile, remoteReady]);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    const previousProfile = latestProfileRef.current;
    latestProfileRef.current = profile;
    if (
      previousProfile?.id !== profile?.id ||
      previousProfile?.role !== profile?.role ||
      previousProfile?.branchId !== profile?.branchId
    ) {
      remoteRefreshInFlightRef.current = null;
    }
  }, [profile]);

  useEffect(() => {
    if (!authLoaded) {
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      setData(initialPayrollWorkspace);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      setLoaded(false);
      setData(initialPayrollWorkspace);
      try {
        const rawData = await webStorage.getItem(getPayrollWorkspaceStorageKey(userId));
        if (rawData && !cancelled) {
          setData(normalizePayrollWorkspace(JSON.parse(rawData) as Partial<PayrollWorkspace>));
        }
      } catch {
        Alert.alert('Không đọc được dữ liệu', 'App sẽ tiếp tục với dữ liệu trống trên máy này.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoaded(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: authData, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setAuthFeedback({
          tone: 'error',
          title: 'Chưa kết nối được',
          message: getFriendlyErrorMessage(error, 'Không tải được dữ liệu. Vui lòng kiểm tra mạng rồi thử lại.'),
        });
      }

      setSession(authData.session);
      setAuthLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoaded(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !authLoaded || !loaded) {
      return;
    }

    let cancelled = false;
    const user = session?.user;

    const loadProfileAndData = async () => {
      if (!user) {
        setProfile(null);
        setRemoteReady(false);
        setDataLoadError(null);
        setData(initialPayrollWorkspace);
        setIngredientReports([]);
        setClosingReports([]);
        remoteSnapshotRef.current = JSON.stringify(initialPayrollWorkspace);
        return;
      }

      try {
        setRemoteReady(false);
        setDataLoadError(null);
        const nextProfile = await fetchUserProfile(user, pendingSignupRef.current);
        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setCurrentRole(nextProfile.role);
        setEmployeeName(nextProfile.fullName);
        if (nextProfile.branchId) {
          setSelectedBranchId(nextProfile.branchId);
        }

        const [payrollResult, ingredientsResult, closingsResult] = await Promise.allSettled([
          loadAppDataFromSupabase(nextProfile),
          listIngredientReports(nextProfile),
          listShiftCloseReports(nextProfile),
        ]);

        if (cancelled) {
          return;
        }

        if (payrollResult.status === 'rejected') {
          throw payrollResult.reason;
        }

        const remoteData = payrollResult.value;
        remoteSnapshotRef.current = JSON.stringify(remoteData);
        setData(remoteData);
        if (ingredientsResult.status === 'fulfilled') {
          setIngredientReports(ingredientsResult.value);
        }
        if (closingsResult.status === 'fulfilled') {
          setClosingReports(closingsResult.value);
        }
        if (ingredientsResult.status === 'rejected' || closingsResult.status === 'rejected') {
          setAuthFeedback({
            tone: 'info',
            title: 'Một số báo cáo chưa tải được',
            message: 'Bảng công vẫn sẵn sàng. Ứng dụng sẽ tự tải lại báo đồ và báo ca khi kết nối ổn định.',
          });
        }
        setRemoteReady(true);
        setDataLoadError(null);
        pendingSignupRef.current = null;
      } catch (error) {
        if (!cancelled) {
          const message = getFriendlyErrorMessage(error, 'Không tải được dữ liệu. Vui lòng thử lại.');
          setDataLoadError(message);
          pendingSignupRef.current = null;
          setRemoteReady(false);
        }
      }
    };

    void loadProfileAndData();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, dataLoadRetryToken, loaded, session?.user]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!loaded || !userId) {
      return;
    }

    webStorage.setItem(getPayrollWorkspaceStorageKey(userId), JSON.stringify(data)).catch(() => {
      Alert.alert('Không lưu được dữ liệu', 'Vui lòng kiểm tra dung lượng thiết bị.');
    });
  }, [data, loaded, session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile || !remoteReady) {
      return;
    }

    const snapshot = JSON.stringify(data);

    if (snapshot === remoteSnapshotRef.current) {
      setSyncError(null);
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    const runSync = async (attempt = 0) => {
      retryTimeout = undefined;
      if (!navigator.onLine) {
        if (!cancelled) {
          setSyncingRemote(false);
          setSyncError('Điện thoại đang mất mạng. Dữ liệu vẫn được giữ lại và sẽ tự lưu khi có mạng.');
        }
        return;
      }

      setSyncingRemote(true);
      try {
        // Queue writes so an older in-flight request cannot finish after a
        // newer edit and overwrite it. Each queued task re-reads the newest
        // local state when it starts.
        const queuedSync = syncQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            if (cancelled) {
              return;
            }

            const activeProfile = latestProfileRef.current;
            if (
              !activeProfile ||
              activeProfile.id !== profile.id ||
              activeProfile.role !== profile.role ||
              activeProfile.branchId !== profile.branchId
            ) {
              return;
            }

            const currentData = latestDataRef.current;
            const currentSnapshot = JSON.stringify(currentData);
            if (currentSnapshot === remoteSnapshotRef.current) {
              return;
            }

            let remoteSnapshot = initialPayrollWorkspace;
            try {
              remoteSnapshot = normalizePayrollWorkspace(JSON.parse(remoteSnapshotRef.current) as Partial<PayrollWorkspace>);
            } catch {
              // A first local change can happen before a snapshot is available.
            }
            const syncedData = await syncPayrollWorkspace(currentData, activeProfile, remoteSnapshot);

            if (!cancelled && JSON.stringify(latestDataRef.current) === currentSnapshot) {
              const syncedSnapshot = JSON.stringify(syncedData);
              remoteSnapshotRef.current = syncedSnapshot;
              latestDataRef.current = syncedData;
              setData(syncedData);
              setSyncError(null);
              void refreshRemoteData();
            }
          });
        syncQueueRef.current = queuedSync.catch(() => undefined);
        await queuedSync;
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (attempt < 2) {
          retryTimeout = setTimeout(() => void runSync(attempt + 1), 1400 * (attempt + 1));
        } else {
          const message = getFriendlyErrorMessage(error, 'Một số dữ liệu chưa lưu được. Vui lòng thử lại.');
          setSyncError(message);
        }
      } finally {
        if (!cancelled && !retryTimeout) {
          setSyncingRemote(false);
        }
      }
    };

    const timeout = setTimeout(() => void runSync(), 700);
    const retryWhenOnline = () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      void runSync();
    };
    window.addEventListener('online', retryWhenOnline);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      window.removeEventListener('online', retryWhenOnline);
    };
  }, [data, profile, refreshRemoteData, remoteReady, syncRetryToken]);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile || !remoteReady) {
      return;
    }

    let disposed = false;
    const requestRefresh = () => {
      if (!disposed) {
        void refreshRemoteData();
      }
    };
    const attendanceFilter =
      profile.role === 'employee'
        ? `user_id=eq.${profile.id}`
        : profile.role === 'manager' && profile.branchId
          ? `branch_id=eq.${profile.branchId}`
          : undefined;
    const payrollFilter = profile.role === 'manager' && profile.branchId ? `branch_id=eq.${profile.branchId}` : undefined;
    const ingredientFilter = profile.role !== 'owner' && profile.branchId ? `branch_id=eq.${profile.branchId}` : undefined;
    const closingFilter = profile.role !== 'owner' && profile.branchId ? `branch_id=eq.${profile.branchId}` : undefined;
    let channel = supabase.channel(`app-data-refresh-${profile.id}`);

    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_sheets',
        ...(attendanceFilter ? { filter: attendanceFilter } : {}),
      },
      () => void refreshRemoteData('payroll'),
    );

    if (profile.role !== 'employee') {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branch_payroll_confirmations',
          ...(payrollFilter ? { filter: payrollFilter } : {}),
        },
        () => void refreshRemoteData('payroll'),
      );
    }
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ingredient_reports',
        ...(ingredientFilter ? { filter: ingredientFilter } : {}),
      },
      () => void refreshRemoteData('ingredients'),
    );
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shift_close_reports',
        ...(closingFilter ? { filter: closingFilter } : {}),
      },
      () => void refreshRemoteData('closing'),
    );

    channel.subscribe();

    // Realtime must be enabled per table in Supabase. Focus and periodic
    // refresh make payroll delivery reliable on older projects as well.
    const refreshInterval = window.setInterval(() => {
      if (!document.hidden) {
        requestRefresh();
      }
    }, 60_000);
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        requestRefresh();
      }
    };

    window.addEventListener('focus', requestRefresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    requestRefresh();

    return () => {
      disposed = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', requestRefresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [profile, refreshRemoteData, remoteReady]);

  useEffect(() => {
    const availableTabs = getTabItemsForRole(currentRole);

    if (!availableTabs.some((item) => item.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [activeTab, currentRole]);

  useEffect(() => {
    setPage({ key: 'main' });
  }, [activeTab, currentRole, selectedBranchId]);

  const tabItems = getTabItemsForRole(currentRole);
  const activeBranch = getBranchById(selectedBranchId);
  const trimmedEmployeeName = employeeName.trim();
  const signedEmployeeName =
    trimmedEmployeeName || (currentRole === 'manager' ? `Quản lí ${activeBranch.area}` : '');
  const branchSheetsForMonth = data.attendanceSheets.filter(
    (sheet) => sheet.branchId === selectedBranchId && sheet.monthKey === selectedMonthKey,
  );
  const selectedBranchIngredients = ingredientReports.filter(
    (report) => getReportBranchId(report) === selectedBranchId,
  );
  const selectedBranchClosings = closingReports.filter((report) => getReportBranchId(report) === selectedBranchId);
  const employeeSheet = signedEmployeeName
    ? getAttendanceSheet(data.attendanceSheets, selectedBranchId, signedEmployeeName, selectedMonthKey, profile?.id)
    : undefined;

  const updateAttendanceCell = (
    employee: string,
    dayKey: string,
    field: AttendanceInputField,
    value: string,
    targetUserId = profile?.id,
  ) => {
    const trimmedName = employee.trim();

    if (!trimmedName) {
      Alert.alert('Thiếu tên nhân viên', 'Vui lòng nhập tên nhân viên trước khi chấm công.');
      return;
    }

    if (field === 'afternoon' && isSundayAttendanceDayKey(dayKey)) {
      Alert.alert('Ca chiều Chủ Nhật nghỉ', 'Không thể chấm công ca chiều vào Chủ Nhật.');
      return;
    }

    if (isFutureMonth(selectedMonthKey) || (currentRole !== 'manager' && !isCurrentMonth(selectedMonthKey))) {
      Alert.alert(
        isFutureMonth(selectedMonthKey) ? 'Tháng này chưa bắt đầu' : 'Chỉ chấm công tháng hiện tại',
        isFutureMonth(selectedMonthKey)
          ? 'Không thể chấm công trước cho một tháng trong tương lai.'
          : 'Các tháng cũ chỉ dùng để xem lại bảng công đã lưu.',
      );
      return;
    }

    setData((current) => {
      const existingSheet = getAttendanceSheet(current.attendanceSheets, selectedBranchId, employee, selectedMonthKey, targetUserId);

      if (currentRole !== 'manager' && (existingSheet?.employeeConfirmedAt || existingSheet?.managerApprovedAt)) {
        Alert.alert('Bảng lương đã xác nhận', 'Bạn cần bỏ xác nhận trước khi chỉnh sửa bảng công tháng này.');
        return current;
      }

      return {
        ...current,
        attendanceSheets: updateSheetCollection(
          current.attendanceSheets,
          selectedBranchId,
          employee,
          selectedMonthKey,
          targetUserId,
          (sheet) => ({
            ...sheet,
            days: {
              ...sheet.days,
              [dayKey]: {
                morning: sheet.days[dayKey]?.morning ?? '',
                afternoon: sheet.days[dayKey]?.afternoon ?? '',
                opening: field === 'morning' ? '' : sheet.days[dayKey]?.opening ?? '',
                [field]: sanitizeShiftHours(value),
              },
            },
            ...(currentRole === 'manager' ? { managerApprovedAt: undefined, managerApprovedBy: undefined } : {}),
          }),
        ),
        ...(currentRole === 'manager'
          ? { branchPayrolls: invalidateBranchPayroll(current.branchPayrolls, selectedBranchId, selectedMonthKey) }
          : {}),
      };
    });
  };

  const updateAttendanceCells = (
    employee: string,
    updates: Array<{ day: number; field: AttendanceInputField; value: string }>,
    targetUserId = profile?.id,
  ) => {
    const trimmedName = employee.trim();
    if (!trimmedName) {
      Alert.alert('Thiếu tên nhân viên', 'Vui lòng nhập tên nhân viên trước khi chấm công.');
      return;
    }
    if (isFutureMonth(selectedMonthKey) || (currentRole !== 'manager' && !isCurrentMonth(selectedMonthKey))) {
      Alert.alert(
        isFutureMonth(selectedMonthKey) ? 'Tháng này chưa bắt đầu' : 'Chỉ chấm công tháng hiện tại',
        isFutureMonth(selectedMonthKey)
          ? 'Không thể chấm công trước cho một tháng trong tương lai.'
          : 'Các tháng cũ chỉ dùng để xem lại bảng công đã lưu.',
      );
      return;
    }

    const lastDay = getDaysInMonth(selectedMonthKey);
    const validUpdates = updates.filter(
      (update) =>
        update.day >= 1 &&
        update.day <= lastDay &&
        !(update.field === 'afternoon' && isSundayAttendanceDay(selectedMonthKey, update.day)),
    );
    if (validUpdates.length === 0) {
      return;
    }

    setData((current) => {
      const existingSheet = getAttendanceSheet(current.attendanceSheets, selectedBranchId, employee, selectedMonthKey, targetUserId);
      if (currentRole !== 'manager' && (existingSheet?.employeeConfirmedAt || existingSheet?.managerApprovedAt)) {
        Alert.alert('Bảng lương đã xác nhận', 'Bạn cần bỏ xác nhận trước khi chỉnh sửa bảng công tháng này.');
        return current;
      }

      return {
        ...current,
        attendanceSheets: updateSheetCollection(
          current.attendanceSheets,
          selectedBranchId,
          employee,
          selectedMonthKey,
          targetUserId,
          (sheet) => {
            const nextDays = { ...sheet.days };
            validUpdates.forEach(({ day, field, value }) => {
              const dayKey = getAttendanceDayKey(selectedMonthKey, day);
              nextDays[dayKey] = {
                morning: nextDays[dayKey]?.morning ?? '',
                afternoon: nextDays[dayKey]?.afternoon ?? '',
                opening: field === 'morning' ? '' : nextDays[dayKey]?.opening ?? '',
                [field]: sanitizeShiftHours(value),
              };
            });
            return {
              ...sheet,
              days: nextDays,
              ...(currentRole === 'manager' ? { managerApprovedAt: undefined, managerApprovedBy: undefined } : {}),
            };
          },
        ),
        ...(currentRole === 'manager'
          ? { branchPayrolls: invalidateBranchPayroll(current.branchPayrolls, selectedBranchId, selectedMonthKey) }
          : {}),
      };
    });
  };

  const pasteAttendanceGrid = (
    employee: string,
    startDay: number,
    startField: AttendanceInputField,
    pastedText: string,
    targetUserId = profile?.id,
  ) => {
    updateAttendanceCells(
      employee,
      parseAttendanceGrid(pastedText, startField).map((cell) => ({
        day: startDay + cell.dayOffset,
        field: cell.field,
        value: cell.value,
      })),
      targetUserId,
    );
  };

  const confirmEmployeePayroll = (employee: string) => {
    const trimmedName = employee.trim();

    if (!trimmedName) {
      Alert.alert('Thiếu tên nhân viên', 'Vui lòng nhập tên nhân viên trước khi xác nhận bảng lương.');
      return;
    }

    if (!isCurrentMonth(selectedMonthKey)) {
      Alert.alert(
        isFutureMonth(selectedMonthKey) ? 'Tháng này chưa bắt đầu' : 'Không thể xác nhận tháng cũ',
        'Nhân viên chỉ xác nhận bảng lương của tháng hiện tại.',
      );
      return;
    }

    const currentSheet = getAttendanceSheet(data.attendanceSheets, selectedBranchId, trimmedName, selectedMonthKey, profile?.id);
    if (currentSheet?.managerApprovedAt) {
      Alert.alert('Bảng lương đã được duyệt', 'Quản lí cần mở lại bảng lương trước khi có thay đổi mới.');
      return;
    }
    const payroll = calculatePayroll(currentSheet);

    if (payroll.totalHours <= 0) {
      Alert.alert('Chưa có giờ làm', 'Vui lòng nhập bảng công trước khi xác nhận bảng lương.');
      return;
    }

    setData((current) => ({
      ...current,
      attendanceSheets: updateSheetCollection(
        current.attendanceSheets,
        selectedBranchId,
        trimmedName,
        selectedMonthKey,
        profile?.id,
        (sheet) => ({
          ...sheet,
          employeeConfirmedAt: new Date().toISOString(),
        }),
      ),
    }));
  };

  const cancelEmployeePayroll = (employee: string) => {
    const trimmedName = employee.trim();
    if (!trimmedName || !isCurrentMonth(selectedMonthKey)) {
      return;
    }

    const currentSheet = getAttendanceSheet(data.attendanceSheets, selectedBranchId, trimmedName, selectedMonthKey, profile?.id);
    if (currentSheet?.managerApprovedAt) {
      Alert.alert('Bảng lương đã được duyệt', 'Chỉ quản lí mới có thể mở lại bảng công này để chỉnh sửa.');
      return;
    }

    setData((current) => ({
      ...current,
      attendanceSheets: current.attendanceSheets.map((sheet) =>
        sheet.branchId === selectedBranchId &&
        sheet.monthKey === selectedMonthKey &&
        (sheet.userId === profile?.id ||
          (!sheet.userId && sheet.employeeName.trim().toLowerCase() === trimmedName.toLowerCase()))
          ? { ...sheet, employeeConfirmedAt: undefined }
          : sheet,
      ),
    }));
  };

  const approveEmployeePayroll = (employee: string, userId: string) => {
    const trimmedName = employee.trim();
    if (!trimmedName || !userId) {
      return;
    }
    if (isFutureMonth(selectedMonthKey)) {
      Alert.alert('Tháng này chưa bắt đầu', 'Chỉ có thể duyệt bảng lương từ tháng hiện tại trở về trước.');
      return;
    }

    const sheet = getAttendanceSheet(data.attendanceSheets, selectedBranchId, trimmedName, selectedMonthKey, userId);
    if (calculatePayroll(sheet).totalHours <= 0) {
      Alert.alert('Chưa có giờ công', 'Hãy gửi lịch hoặc nhập giờ công trước khi duyệt bảng lương của nhân viên.');
      return;
    }

    setData((current) => ({
      ...current,
      attendanceSheets: updateSheetCollection(
        current.attendanceSheets,
        selectedBranchId,
        trimmedName,
        selectedMonthKey,
        userId,
        (currentSheet) => ({
          ...currentSheet,
          managerApprovedAt: new Date().toISOString(),
          managerApprovedBy: profile?.fullName || 'Quản lí chi nhánh',
        }),
      ),
      branchPayrolls: invalidateBranchPayroll(current.branchPayrolls, selectedBranchId, selectedMonthKey),
    }));
  };

  const reopenEmployeePayroll = (employee: string, userId: string) => {
    const trimmedName = employee.trim();
    if (!trimmedName || !userId) {
      return;
    }

    setData((current) => ({
      ...current,
      attendanceSheets: current.attendanceSheets.map((sheet) =>
        sheet.branchId === selectedBranchId &&
        sheet.monthKey === selectedMonthKey &&
        (sheet.userId === userId ||
          (!sheet.userId && sheet.employeeName.trim().toLocaleLowerCase('vi-VN') === trimmedName.toLocaleLowerCase('vi-VN')))
          ? { ...sheet, managerApprovedAt: undefined, managerApprovedBy: undefined }
          : sheet,
      ),
      branchPayrolls: invalidateBranchPayroll(current.branchPayrolls, selectedBranchId, selectedMonthKey),
    }));
  };

  const publishSchedule = (publishedSchedule: PublishedWorkSchedule) => {
    setData((current) => applyPublishedScheduleToAttendance(current, publishedSchedule));
  };

  const saveIngredientReport = async () => {
    if (savingIngredientReport) {
      return;
    }

    const report: IngredientReport = {
      id: createId(),
      branchId: selectedBranchId,
      note: ingredientNote.trim(),
      reporterName: signedEmployeeName || undefined,
      reporterRole: currentRole,
      timestamp: new Date().toISOString(),
      items: supplyItems.map((item) => ({
        ...item,
        quantity: item.kind === 'quantity' ? supplyRows[item.key]?.quantity.trim() ?? '' : '',
        status: supplyRows[item.key]?.status ?? 'available',
      })),
    };

    setSavingIngredientReport(true);
    try {
      await persistIngredientReport(report);
      setIngredientReports((current) => [report, ...current.filter((item) => item.id !== report.id)].slice(0, 80));
      setSupplyRows(createSupplyState());
      setIngredientNote('');
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'Chưa lưu được báo đồ. Vui lòng thử lại.');
      Alert.alert('Chưa lưu được báo đồ', message);
      return;
    } finally {
      setSavingIngredientReport(false);
    }

    try {
      await shareText(buildSupplyShareText(activeBranch, report));
    } catch {
      // Cancelling the native share sheet does not invalidate the saved report.
    }
  };

  const saveShiftClose = async () => {
    if (savingClosingReport) {
      return;
    }

    setClosingErrors([]);

    const bankTransferExpression = trimTransferExpression(bankTransferMoney);
    const bankTransferTotal = sumTransferExpression(bankTransferMoney);
    const requiredErrors = [
      ...plasticCupTemplates.flatMap(({ key }) => {
        const row = plasticCupRows[key];
        return [
          row.opening.trim() ? '' : `plastic.${key}.opening`,
          row.remaining.trim() ? '' : `plastic.${key}.remaining`,
          row.machineCups.trim() ? '' : `plastic.${key}.machineCups`,
        ];
      }),
      cornMilkRow.opening.trim() ? '' : 'cornMilk.opening',
      cornMilkRow.remaining.trim() ? '' : 'cornMilk.remaining',
      cornMilkRow.machineCups.trim() ? '' : 'cornMilk.machineCups',
      machineMoney.trim() ? '' : 'machineMoney',
      storeMoney.trim() ? '' : 'storeMoney',
      iceBags.trim() ? '' : 'iceBags',
    ].filter(Boolean);

    if (requiredErrors.length > 0) {
      setClosingErrors(requiredErrors);
      Alert.alert('Vui lòng điền đầy đủ các mục có dấu *');
      return;
    }

    const report: ShiftCloseReport = {
      id: createId(),
      branchId: selectedBranchId,
      plasticCupRows: plasticCupTemplates.map(({ key, label }) => {
        const row = plasticCupRows[key];
        const opening = toNumber(row.opening);
        const remaining = toNumber(row.remaining);
        const machineCups = toNumber(row.machineCups);
        const sold = opening - remaining;
        const balance = deriveCupBalance(row);

        return {
          key,
          label,
          opening,
          remaining,
          machineCups,
          sold,
          status: balance.status,
          variance: balance.status === 'enough' ? 0 : toNumber(balance.variance),
          openingText: row.opening.trim(),
          remainingText: row.remaining.trim(),
          machineCupsText: row.machineCups.trim(),
        };
      }),
      cornMilkReport: createStockBalanceReport('Sữa bắp', cornMilkRow),
      smallBottles: smallBottles.trim(),
      largeBottles: largeBottles.trim(),
      smallCoffeePacks: smallCoffeePacks.trim(),
      largeCoffeePacks: largeCoffeePacks.trim(),
      machineMoney: machineMoney.trim(),
      storeMoney: storeMoney.trim(),
      shopeeMoney: shopeeMoney.trim(),
      bankTransferMoney: bankTransferExpression,
      bankTransferTotal,
      transferMoney: [shopeeMoney.trim() ? `Shopee: ${shopeeMoney.trim()}` : '', bankTransferExpression ? `CK: ${bankTransferExpression}=${bankTransferTotal}` : '']
        .filter(Boolean)
        .join('\n'),
      iceBags: iceBags.trim(),
      waterBottles: waterBottles.trim(),
      cardTopupMoney: cardTopupMoney.trim(),
      note: closingNote.trim(),
      timestamp: new Date().toISOString(),
      cashierName: signedEmployeeName || undefined,
    };

    setSavingClosingReport(true);
    try {
      await persistShiftCloseReport(report);
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'Chưa lưu được báo ca. Vui lòng thử lại.');
      Alert.alert('Chưa lưu được báo ca', message);
      return;
    } finally {
      setSavingClosingReport(false);
    }

    setClosingReports((current) => [report, ...current.filter((item) => item.id !== report.id)].slice(0, 40));
    setPlasticCupRows(createPlasticCupState());
    setCornMilkRow(createBalanceInputState());
    setSmallBottles('');
    setLargeBottles('');
    setSmallCoffeePacks('');
    setLargeCoffeePacks('');
    setMachineMoney('');
    setStoreMoney('');
    setShopeeMoney('');
    setBankTransferMoney('');
    setIceBags('');
    setWaterBottles('');
    setCardTopupMoney('');
    setClosingNote('');
    setPendingClosingExport(report);
  };

  const loadShiftCloseReport = (report: ShiftCloseReport) => {
    const restoredPlasticRows = createPlasticCupState();

    plasticCupTemplates.forEach(({ key }) => {
      restoredPlasticRows[key] = restorePlasticCupInput(report.plasticCupRows?.find((row) => row.key === key));
    });

    setPlasticCupRows(restoredPlasticRows);
    setCornMilkRow(restoreStockBalanceInput(report.cornMilkReport));
    setSmallBottles(report.smallBottles ?? '');
    setLargeBottles(report.largeBottles ?? '');
    setSmallCoffeePacks(report.smallCoffeePacks ?? '');
    setLargeCoffeePacks(report.largeCoffeePacks ?? '');
    setMachineMoney(report.machineMoney ?? legacyCurrency(report.revenue));
    setStoreMoney(report.storeMoney ?? legacyCurrency(report.revenue));
    setShopeeMoney(report.shopeeMoney ?? findTransferValue(report.transferMoney, 'Shopee'));
    setBankTransferMoney(report.bankTransferMoney ?? findBankTransferExpression(report.transferMoney));
    setIceBags(report.iceBags ?? '');
    setWaterBottles(report.waterBottles ?? '');
    setCardTopupMoney(report.cardTopupMoney ?? '');
    setClosingNote(report.note ?? '');
    setClosingErrors([]);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  useEffect(() => {
    if (!pendingClosingExport) {
      return;
    }

    let cancelled = false;

    const runExport = async () => {
      try {
        const file = await exportClosingReportImage(pendingClosingExport, exportCaptureRef);
        await shareFile(file, 'Dạ em gửi báo ca ạ');
      } catch {
        if (!cancelled) {
          Alert.alert('Không mở được chia sẻ báo ca', 'Dữ liệu đã được lưu nhưng ảnh báo cáo chưa gửi được.');
        }
      } finally {
        if (!cancelled) {
          setPendingClosingExport(null);
        }
      }
    };

    void runExport();

    return () => {
      cancelled = true;
    };
  }, [pendingClosingExport]);


  const signOut = () => {
    setAccountOpen(false);
    pendingSignupRef.current = null;
    setAuthFeedback(null);
    supabase.auth.signOut().catch((error) => {
      const message = getFriendlyErrorMessage(error, 'Không đăng xuất được. Vui lòng thử lại.');
      Alert.alert('Lỗi đăng xuất', message);
    });
  };

  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
  }

  if (session && dataLoadError && !remoteReady) {
    return (
      <DataLoadErrorScreen
        message={dataLoadError}
        onRetry={() => {
          setDataLoadError(null);
          setDataLoadRetryToken((value) => value + 1);
        }}
        onSignOut={() => void supabase.auth.signOut()}
      />
    );
  }

  if (!loaded || !authLoaded || (session && (!profile || !remoteReady))) {
    return <LoadingScreen text={authFeedback?.message ?? 'Đang tải tài khoản và dữ liệu...'} />;
  }

  if (!session || !profile) {
    return (
      <AuthScreen
        feedback={authFeedback}
        onAuthFeedbackChange={setAuthFeedback}
        onSignupDraftChange={(draft) => {
          pendingSignupRef.current = draft;
        }}
      />
    );
  }

  return (
    <SafeAreaView className="app-frame" style={styles.safeArea}>
      <StatusBar backgroundColor={colors.background} style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
      >
        <View className="app-shell" style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.brandLockup}>
              <View style={styles.brandMark}>
                <Image source={logoImage} style={styles.brandLogo} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.appSubtitle}>{activeBranch.name}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {currentRole === 'owner' ? (
                <Pressable
                  accessibilityLabel="Làm mới dữ liệu hệ thống"
                  accessibilityRole="button"
                  onPress={() => void refreshRemoteData()}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <RefreshCcw color={colors.muted} size={18} />
                </Pressable>
              ) : null}
              <AccountAvatarButton
                onPress={() => setAccountOpen(true)}
                profile={profile}
                syncError={syncError}
                syncing={syncingRemote}
              />
            </View>
          </View>

          <ScrollView
            className="app-scroll-surface"
            ref={contentScrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {authFeedback?.tone === 'success' ? (
              <AuthFeedbackBanner feedback={authFeedback} onDismiss={() => setAuthFeedback(null)} />
            ) : null}

            {page.key === 'main' ? (
              <>
            {activeTab === 'attendance' && (
              currentRole === 'manager' ? (
                <ManagerPayrollScreen
                  branch={activeBranch}
                  managerId={profile.id}
                  monthKey={selectedMonthKey}
                  onOpenEmployeePayroll={(employeeId) => setPage({ key: 'managerPayrollEmployee', employeeId })}
                  onMonthChange={setSelectedMonthKey}
                  sheets={branchSheetsForMonth}
                />
              ) : (
                <EmployeeAttendanceScreen
                  branch={activeBranch}
                  employeeName={employeeName}
                  monthKey={selectedMonthKey}
                  onConfirmPayroll={confirmEmployeePayroll}
                  onCancelPayroll={cancelEmployeePayroll}
                  onMonthChange={setSelectedMonthKey}
                  onNameChange={setEmployeeName}
                  onPasteGrid={pasteAttendanceGrid}
                  onUpdateCell={updateAttendanceCell}
                  sheet={employeeSheet}
                />
              )
            )}

            {activeTab === 'ingredients' && (
              <IngredientScreen
                saving={savingIngredientReport}
                note={ingredientNote}
                onNoteChange={setIngredientNote}
                onSave={saveIngredientReport}
                records={selectedBranchIngredients}
                rows={supplyRows}
                onRowChange={(key, patch) => {
                  setSupplyRows((current) => ({
                    ...current,
                    [key]: {
                      ...current[key],
                      ...patch,
                    },
                  }));
                }}
              />
            )}

            {activeTab === 'closing' && (
              <ClosingScreen
                bankTransferMoney={bankTransferMoney}
                bankTransferTotal={sumTransferExpression(bankTransferMoney)}
                cardTopupMoney={cardTopupMoney}
                errors={closingErrors}
                cornMilkRow={cornMilkRow}
                iceBags={iceBags}
                largeBottles={largeBottles}
                largeCoffeePacks={largeCoffeePacks}
                machineMoney={machineMoney}
                note={closingNote}
                onBankTransferMoneyChange={(value) => {
                  setBankTransferMoney(formatTransferExpression(value));
                }}
                onCardTopupMoneyChange={setNumericClosingValue(setCardTopupMoney, 'cardTopupMoney')}
                onCornMilkChange={(patch) => {
                  updateCornMilkRow(patch);
                  clearClosingErrors(...Object.keys(patch).map((field) => `cornMilk.${field}`));
                }}
                onIceBagsChange={setNumericClosingValue(setIceBags, 'iceBags')}
                onLargeBottlesChange={setNumericClosingValue(setLargeBottles, 'largeBottles')}
                onLargeCoffeePacksChange={setNumericClosingValue(setLargeCoffeePacks, 'largeCoffeePacks')}
                onMachineMoneyChange={setNumericClosingValue(setMachineMoney, 'machineMoney')}
                onNoteChange={setClosingNote}
                onPlasticCupChange={(key, patch) => {
                  updatePlasticCupRow(key, patch);
                  clearClosingErrors(...Object.keys(patch).map((field) => `plastic.${key}.${field}`));
                }}
                onShopeeMoneyChange={setNumericClosingValue(setShopeeMoney, 'shopeeMoney')}
                onSmallBottlesChange={setNumericClosingValue(setSmallBottles, 'smallBottles')}
                onSmallCoffeePacksChange={setNumericClosingValue(setSmallCoffeePacks, 'smallCoffeePacks')}
                onSave={saveShiftClose}
                onSelectReport={loadShiftCloseReport}
                onStoreMoneyChange={setNumericClosingValue(setStoreMoney, 'storeMoney')}
                onWaterBottlesChange={setNumericClosingValue(setWaterBottles, 'waterBottles')}
                plasticCupRows={plasticCupRows}
                records={selectedBranchClosings}
                saving={savingClosingReport}
                shopeeMoney={shopeeMoney}
                smallBottles={smallBottles}
                smallCoffeePacks={smallCoffeePacks}
                storeMoney={storeMoney}
                waterBottles={waterBottles}
              />
            )}

            {activeTab === 'ownerPayroll' && (
              <OwnerPayrollScreen
                branchId={selectedBranchId}
                monthKey={selectedMonthKey}
                onBranchChange={setSelectedBranchId}
                onMonthChange={setSelectedMonthKey}
                sheets={data.attendanceSheets}
              />
            )}

            {activeTab === 'staffManagement' && (currentRole === 'owner' || currentRole === 'manager') ? (
              <Suspense fallback={<Text style={styles.emptyText}>Đang tải quản lý nhân sự...</Text>}>
                <StaffManagementScreen
                  branches={branches}
                  currentProfile={profile}
                  onCurrentProfileChange={(nextProfile) => {
                    setProfile(nextProfile);
                    setCurrentRole(nextProfile.role);
                    if (nextProfile.branchId) {
                      setSelectedBranchId(nextProfile.branchId);
                    }
                  }}
                />
              </Suspense>
            ) : null}

            {activeTab === 'schedule' && currentRole === 'manager' ? (
              <Suspense fallback={<Text style={styles.emptyText}>Đang tải lịch làm việc...</Text>}>
                <WorkScheduleScreen
                  branch={activeBranch}
                  managerId={profile.id}
                  onDirtyChange={setScheduleDirty}
                  onPublish={publishSchedule}
                />
              </Suspense>
            ) : null}
              </>
            ) : page.key === 'managerPayrollEmployee' && currentRole === 'manager' ? (
              <ManagerEmployeePayrollPage
                branch={activeBranch}
                employeeId={page.employeeId}
                managerId={profile.id}
                monthKey={selectedMonthKey}
                onApproveEmployeePayroll={approveEmployeePayroll}
                onBack={() => setPage({ key: 'main' })}
                onMonthChange={setSelectedMonthKey}
                onPasteGrid={pasteAttendanceGrid}
                onReopenEmployeePayroll={reopenEmployeePayroll}
                onUpdateCell={updateAttendanceCell}
                sheets={branchSheetsForMonth}
              />
            ) : null}
          </ScrollView>

          {page.key === 'main' ? (
          <View
            accessibilityLabel="Điều hướng chính"
            accessibilityRole="tablist"
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
              const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
              if (currentIndex < 0 || tabs.length === 0) return;
              event.preventDefault();
              const direction = event.key === 'ArrowRight' ? 1 : -1;
              const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
              nextTab.focus();
              nextTab.click();
            }}
            style={styles.tabs}
          >
            {tabItems.map((item) => {
              const Icon = item.icon;
              const selected = activeTab === item.key;

              return (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={item.key}
                  onPress={() => {
                    if (
                      activeTab === 'schedule' &&
                      item.key !== 'schedule' &&
                      scheduleDirty &&
                      !window.confirm('Lịch làm có thay đổi chưa lưu. Bạn có chắc muốn rời màn hình này?')
                    ) {
                      return;
                    }
                    setScheduleDirty(false);
                    setActiveTab(item.key);
                  }}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.tabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon color={selected ? colors.onDark : colors.muted} size={20} />
                  <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          ) : null}

          {accountOpen ? (
            <AccountPanel
              authEmail={session.user.email ?? profile.email}
              branchId={selectedBranchId}
              onClose={() => setAccountOpen(false)}
              onProfileChange={(nextProfile) => {
                if (nextProfile.fullName !== profile.fullName) {
                  setData((current) => ({
                    ...current,
                    attendanceSheets: current.attendanceSheets.map((sheet) =>
                      sheet.userId === nextProfile.id ||
                      (sheet.branchId === profile.branchId && sheet.employeeName === profile.fullName)
                        ? { ...sheet, employeeName: nextProfile.fullName }
                        : sheet,
                    ),
                  }));
                }
                setProfile(nextProfile);
                setCurrentRole(nextProfile.role);
                setEmployeeName(nextProfile.fullName);
                if (nextProfile.branchId) {
                  setSelectedBranchId(nextProfile.branchId);
                }
              }}
              onRetrySync={() => setSyncRetryToken((value) => value + 1)}
              onSignOut={signOut}
              profile={profile}
              syncError={syncError}
              syncing={syncingRemote}
            />
          ) : null}

          {pendingClosingExport ? (
            <View pointerEvents="none" style={styles.exportStage}>
              <View collapsable={false} ref={exportCaptureRef} style={styles.exportSheet}>
                <ClosingReportExportPreview report={pendingClosingExport} />
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.shell, styles.centerScreen]}>
        <Image source={logoImage} style={styles.loadingLogo} />
        <Text style={styles.loadingText}>{text}</Text>
      </View>
    </SafeAreaView>
  );
}

function SupabaseSetupScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.shell, styles.authContent]} keyboardShouldPersistTaps="handled">
        <View style={styles.authCard}>
          <Image source={logoImage} style={styles.authLogo} />
          <Text style={styles.authTitle}>Ứng dụng chưa sẵn sàng</Text>
          <Text style={styles.authHint}>
            Chưa kết nối được nơi lưu dữ liệu. Vui lòng báo người phụ trách để được hỗ trợ.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DataLoadErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.shell, styles.centerScreen]}>
        <View style={styles.authCard}>
          <CircleAlert color={colors.rose} size={28} />
          <Text style={styles.authTitle}>Chưa tải được dữ liệu</Text>
          <Text style={styles.authHint}>{message}</Text>
          <PrimaryButton icon={RefreshCcw} label="Thử lại" onPress={onRetry} tone="primary" />
          <PrimaryButton icon={X} label="Đăng xuất" onPress={onSignOut} tone="danger" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({
  feedback,
  onAuthFeedbackChange,
  onSignupDraftChange,
}: {
  feedback: AuthFeedback | null;
  onAuthFeedbackChange: (feedback: AuthFeedback | null) => void;
  onSignupDraftChange: (draft: PendingSignupDraft | null) => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleModeChange = (nextMode: 'signIn' | 'signUp') => {
    if (nextMode === 'signUp' && !publicSignupEnabled) {
      return;
    }
    setMode(nextMode);
    setPassword('');
    setShowPassword(false);
    setFullName('');
    onAuthFeedbackChange(null);
    onSignupDraftChange(null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
  };

  const handleFullNameChange = (value: string) => {
    setFullName(value);
  };

  const handleBranchChange = (value: string) => {
    setBranchId(value);
  };

  const submit = async () => {
    if (loading) {
      return;
    }

    if (mode === 'signUp' && !publicSignupEnabled) {
      handleModeChange('signIn');
      onAuthFeedbackChange({
        tone: 'info',
        title: 'Đăng ký đã được khóa',
        message: 'Tài khoản nhân sự do quản lý cấp. Vui lòng liên hệ quản lý cửa hàng.',
      });
      return;
    }

    const normalizedEmail = normalizeEmailAddress(email);
    const trimmedName = fullName.trim();
    const selectedBranchId = branchId;

    if (!isValidEmailAddress(normalizedEmail)) {
      onAuthFeedbackChange({
        tone: 'error',
        title: 'Email không hợp lệ',
        message: 'Vui lòng nhập email hợp lệ, ví dụ ten@congty.com.',
      });
      return;
    }

    if (password.length < minimumPasswordLength) {
      onAuthFeedbackChange({
        tone: 'error',
        title: 'Mật khẩu quá ngắn',
        message: `Vui lòng nhập mật khẩu ít nhất ${minimumPasswordLength} ký tự.`,
      });
      return;
    }

    if (mode === 'signUp' && !trimmedName) {
      onAuthFeedbackChange({
        tone: 'error',
        title: 'Thiếu họ tên',
        message: 'Vui lòng nhập tên để tạo hồ sơ nhân viên.',
      });
      return;
    }

    const signupDraft: PendingSignupDraft | null =
      mode === 'signUp'
        ? {
            email: normalizedEmail,
            fullName: trimmedName,
            role: 'employee',
            branchId: selectedBranchId,
          }
        : null;

    onSignupDraftChange(signupDraft);
    onAuthFeedbackChange({
      tone: 'info',
      title: mode === 'signUp' ? 'Đang tạo tài khoản' : 'Đang đăng nhập',
      message: mode === 'signUp' ? 'Đang tạo tài khoản cho bạn...' : 'Đang kiểm tra thông tin đăng nhập...',
    });
    setLoading(true);

    try {
      if (mode === 'signUp') {
        const { data: signupData, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              fullName: trimmedName,
              role: 'employee',
              branchId: selectedBranchId,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!signupData.session) {
          onSignupDraftChange(null);
          onAuthFeedbackChange({
            tone: 'info',
            title: 'Tài khoản đã được tạo',
            message: 'Hãy mở email và làm theo hướng dẫn xác nhận, sau đó quay lại đăng nhập.',
          });
        } else {
          onAuthFeedbackChange({
            tone: 'success',
            title: 'Tạo tài khoản thành công',
            message: 'Tài khoản đã được tạo. Đang tải dữ liệu...',
          });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      onSignupDraftChange(null);
      const message = getFriendlyErrorMessage(
        error,
        mode === 'signUp' ? 'Không tạo được tài khoản. Vui lòng thử lại.' : 'Không đăng nhập được. Vui lòng thử lại.',
      );
      onAuthFeedbackChange({
        tone: 'error',
        title: mode === 'signUp' ? 'Không tạo được tài khoản' : 'Không đăng nhập được',
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = loading
    ? mode === 'signUp'
      ? 'Đang tạo tài khoản...'
      : 'Đang kiểm tra...'
    : mode === 'signUp'
      ? 'Tạo tài khoản nhân viên'
      : 'Đăng nhập';
  const isSignIn = mode === 'signIn';
  const useCardAuthLayout = viewportWidth >= 560;
  const useWideAuthLayout = viewportWidth >= 1024;

  return (
    <SafeAreaView style={[styles.safeArea, styles.authSafeArea]}>
      <StatusBar backgroundColor="#2D1811" style="light" />
      <KeyboardAvoidingView style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.authScrollContent,
            useCardAuthLayout && styles.authScrollContentCard,
            useWideAuthLayout && styles.authScrollContentWide,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.authViewport,
              useCardAuthLayout && styles.authViewportCard,
              useWideAuthLayout && styles.authViewportWide,
            ]}
          >
            <View style={[styles.authHero, useWideAuthLayout && styles.authHeroWide]}>
              <View style={[styles.authBrandLockup, useWideAuthLayout && styles.authBrandLockupWide]}>
                <View style={[styles.authHeroLogoFrame, useWideAuthLayout && styles.authHeroLogoFrameWide]}>
                  <Image source={logoImage} style={styles.authHeroLogo} />
                </View>
                <View style={styles.authBrandCopy}>
                  <Text style={styles.authBrandName}>Cà phê Đạm</Text>
                  <Text style={styles.authBrandKicker}>QUẢN LÝ VẬN HÀNH</Text>
                </View>
              </View>

              {useWideAuthLayout ? (
                <View style={styles.authHeroMessage}>
                  <Text style={styles.authHeroTitle}>Vận hành gọn gàng.{`\n`}Mỗi ca thật chỉn chu.</Text>
                  <Text style={styles.authHeroDescription}>
                    Một không gian thống nhất để đội ngũ phối hợp công việc mỗi ngày.
                  </Text>
                </View>
              ) : (
                <Text style={styles.authHeroDescriptionMobile}>Không gian làm việc dành cho đội ngũ cửa hàng</Text>
              )}

              {useWideAuthLayout ? (
                <View style={styles.authHeroFeatures}>
                  <View style={styles.authHeroFeature}>
                    <Clock3 color="#F2C66D" size={17} />
                    <Text style={styles.authHeroFeatureText}>Ca làm</Text>
                  </View>
                  <View style={styles.authHeroFeature}>
                    <ClipboardCheck color="#F2C66D" size={17} />
                    <Text style={styles.authHeroFeatureText}>Báo cáo ca</Text>
                  </View>
                  <View style={styles.authHeroFeature}>
                    <UsersRound color="#F2C66D" size={17} />
                    <Text style={styles.authHeroFeatureText}>Nhân sự</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.authSheet, useWideAuthLayout && styles.authSheetWide]}>
              <View style={styles.authForm}>
                <View style={styles.authSheetHeader}>
                  <View style={styles.authSheetCopy}>
                    <Text style={styles.authSheetEyebrow}>{isSignIn ? 'CHÀO MỪNG TRỞ LẠI' : 'TÀI KHOẢN NHÂN VIÊN'}</Text>
                    <Text aria-level={1} accessibilityRole="heading" style={styles.authSheetTitle}>{isSignIn ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>
                    <Text style={styles.authSheetSubtitle}>
                      {isSignIn ? 'Nhập tài khoản nội bộ để tiếp tục.' : 'Điền thông tin để bắt đầu làm việc.'}
                    </Text>
                  </View>
                  <View style={styles.authSheetIcon}>
                    <LockKeyhole color={colors.primary} size={21} />
                  </View>
                </View>

                {feedback ? <AuthFeedbackBanner feedback={feedback} onDismiss={() => onAuthFeedbackChange(null)} /> : null}

                <View style={styles.authFields}>
                  {!isSignIn ? (
                    <AuthFormField
                      autoComplete="name"
                      autoCapitalize="words"
                      autoCorrect={false}
                      icon={UserRound}
                      label="Họ và tên"
                      nativeID="full-name"
                      onChangeText={handleFullNameChange}
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                      placeholder="Tên hiển thị trong bảng công"
                      returnKeyType="next"
                      textContentType="name"
                      value={fullName}
                    />
                  ) : null}

                  <AuthFormField
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    icon={Mail}
                    inputRef={emailInputRef}
                    keyboardType="email-address"
                    label="Email"
                    nativeID="email"
                    onChangeText={handleEmailChange}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    placeholder="ten@congty.com"
                    returnKeyType="next"
                    textContentType="emailAddress"
                    value={email}
                  />

                  <AuthFormField
                    autoComplete={isSignIn ? 'current-password' : 'new-password'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    icon={KeyRound}
                    inputRef={passwordInputRef}
                    label="Mật khẩu"
                    nativeID={isSignIn ? 'current-password' : 'new-password'}
                    onChangeText={setPassword}
                    onSubmitEditing={() => void submit()}
                    placeholder={`Ít nhất ${minimumPasswordLength} ký tự`}
                    returnKeyType="go"
                    secureTextEntry={!showPassword}
                    textContentType={isSignIn ? 'password' : 'newPassword'}
                    trailingAction={{
                      icon: showPassword ? EyeOff : Eye,
                      label: showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu',
                      onPress: () => setShowPassword((visible) => !visible),
                    }}
                    value={password}
                  />
                </View>

                {!isSignIn ? (
                  <View style={styles.authBranchSection}>
                    <View style={styles.authSectionHeading}>
                      <Building2 color={colors.primary} size={18} />
                      <Text style={styles.authSectionTitle}>Chi nhánh làm việc</Text>
                    </View>
                    <BranchPills branchId={branchId} onBranchChange={handleBranchChange} />
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading }}
                  disabled={loading}
                  onPress={() => void submit()}
                  style={({ pressed }) => [
                    styles.authPrimaryButton,
                    loading && styles.authPrimaryButtonDisabled,
                    pressed && styles.authPrimaryButtonPressed,
                  ]}
                >
                  <Text style={styles.authPrimaryButtonText}>{submitLabel}</Text>
                  <View style={styles.authPrimaryButtonIcon}>
                    <ArrowRight color={colors.primary} size={18} strokeWidth={2.6} />
                  </View>
                </Pressable>

                {publicSignupEnabled || !isSignIn ? (
                  <View style={styles.authSwitchRow}>
                    <Text style={styles.authSwitchPrompt}>
                      {isSignIn ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleModeChange(isSignIn ? 'signUp' : 'signIn')}
                      style={({ pressed }) => [styles.authSwitchButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.authSwitchButtonText}>{isSignIn ? 'Tạo tài khoản' : 'Quay lại đăng nhập'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthFormField({
  autoComplete,
  autoCapitalize,
  autoCorrect,
  icon: Icon,
  inputRef,
  keyboardType,
  label,
  nativeID,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  secureTextEntry,
  textContentType,
  trailingAction,
  value,
}: {
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  icon: typeof Clock3;
  inputRef?: Ref<TextInput>;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  nativeID: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  placeholder: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  trailingAction?: {
    icon: typeof Clock3;
    label: string;
    onPress: () => void;
  };
  value: string;
}) {
  const [focused, setFocused] = useState(false);
  const TrailingIcon = trailingAction?.icon;

  return (
    <View style={styles.authField}>
      <Text style={[styles.authFieldLabel, focused && styles.authFieldLabelFocused]}>{label}</Text>
      <View style={[styles.authFieldShell, focused && styles.authFieldShellFocused]}>
        <View style={[styles.authFieldIcon, focused && styles.authFieldIconFocused]}>
          <Icon color={focused ? colors.primary : colors.muted} size={19} />
        </View>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          importantForAutofill="yes"
          keyboardType={keyboardType}
          nativeID={nativeID}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#756154"
          ref={inputRef}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          selectionColor={colors.primary}
          style={styles.authFieldInput}
          textContentType={textContentType}
          value={value}
        />
        {TrailingIcon && trailingAction ? (
          <Pressable
            accessibilityLabel={trailingAction.label}
            accessibilityRole="button"
            hitSlop={4}
            onPress={trailingAction.onPress}
            style={({ pressed }) => [styles.authFieldTrailing, pressed && styles.pressed]}
          >
            <TrailingIcon color={colors.muted} size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function AuthFeedbackBanner({ feedback, onDismiss }: { feedback: AuthFeedback; onDismiss: () => void }) {
  const Icon = feedback.tone === 'success' ? CheckCircle2 : feedback.tone === 'error' ? CircleAlert : ShieldCheck;

  useEffect(() => {
    if (feedback.tone !== 'success') {
      return;
    }
    const timeout = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback, onDismiss]);

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.authFeedback,
        feedback.tone === 'success' && styles.authFeedbackSuccess,
        feedback.tone === 'error' && styles.authFeedbackError,
        feedback.tone === 'info' && styles.authFeedbackInfo,
      ]}
    >
      <Icon
        color={feedback.tone === 'success' ? colors.blue : feedback.tone === 'error' ? colors.rose : colors.amber}
        size={19}
      />
      <View style={styles.flex}>
        <Text style={styles.authFeedbackTitle}>{feedback.title}</Text>
        <Text style={styles.authFeedbackMessage}>{feedback.message}</Text>
      </View>
      <Pressable
        accessibilityLabel="Đóng thông báo"
        accessibilityRole="button"
        onPress={onDismiss}
        style={({ pressed }) => [styles.authFeedbackDismiss, pressed && styles.pressed]}
      >
        <X color={colors.muted} size={17} />
      </Pressable>
    </View>
  );
}

function ProfileAvatar({
  avatarUrl,
  label,
  large,
}: {
  avatarUrl: string;
  label: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [avatarUrl]);

  return (
    <View style={[styles.profileAvatar, large && styles.profileAvatarLarge]}>
      <Image
        accessibilityLabel={`Ảnh đại diện ${label}`}
        onError={() => setFailed(true)}
        source={!failed && avatarUrl ? avatarUrl : logoImage}
        style={styles.profileAvatarImage}
      />
    </View>
  );
}

function AccountAvatarButton({
  onPress,
  profile,
  syncError,
  syncing,
}: {
  onPress: () => void;
  profile: UserProfile;
  syncError: string | null;
  syncing: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel="Mở quản lý tài khoản"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.accountAvatarButton, pressed && styles.pressed]}
    >
      <ProfileAvatar avatarUrl={profile.avatarUrl} label={profile.fullName || profile.email} />
      <View
        style={[
          styles.accountPresenceDot,
          syncing && styles.accountPresenceDotSyncing,
          syncError && styles.accountPresenceDotError,
        ]}
      />
    </Pressable>
  );
}

function ProfileInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.profileInfoRow}>
      <View style={styles.profileInfoIcon}>
        <Icon color={colors.primary} size={18} />
      </View>
      <View style={styles.profileInfoCopy}>
        <Text style={styles.profileInfoLabel}>{label}</Text>
        <Text style={styles.profileInfoValue}>{value}</Text>
      </View>
    </View>
  );
}

function AccountPanel({
  authEmail,
  branchId,
  onClose,
  onProfileChange,
  onRetrySync,
  onSignOut,
  profile,
  syncError,
  syncing,
}: {
  authEmail: string;
  branchId: string;
  onClose: () => void;
  onProfileChange: (profile: UserProfile) => void;
  onRetrySync: () => void;
  onSignOut: () => void;
  profile: UserProfile;
  syncError: string | null;
  syncing: boolean;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleLabel = roleOptions.find((option) => option.key === profile.role)?.label ?? 'Nhân viên';
  const workplace = profile.role === 'owner' ? 'Toàn hệ thống' : getBranchById(profile.branchId ?? branchId).name;
  const employmentLabel = profile.employmentType === 'full_time' ? 'Full time' : 'Part time';

  useEffect(() => {
    setFullName(profile.fullName);
    setPhone(profile.phone);
    setDateOfBirth(profile.dateOfBirth);
    setAvatarPreview(profile.avatarUrl);
    setAvatarFile(null);
  }, [profile]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(
    () => () => {
      if (avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    },
    [avatarPreview],
  );

  const chooseAvatar = (file?: File) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setFeedback({ tone: 'error', title: 'Ảnh chưa dùng được', message: 'Vui lòng chọn một ảnh khác.' });
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setFeedback(null);
  };

  const saveProfile = async () => {
    if (saving) {
      return;
    }

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFeedback({ tone: 'error', title: 'Thiếu họ tên', message: 'Tên hiển thị không được để trống.' });
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'info', title: 'Đang lưu hồ sơ', message: 'Đang cập nhật thông tin tài khoản...' });

    try {
      let nextAvatarUrl = profile.avatarUrl;
      let avatarForDatabase = profile.avatarUrl.startsWith('data:') ? '' : profile.avatarUrl;
      let localAvatarFallback = profile.avatarUrl.startsWith('data:');

      if (avatarFile) {
        const optimizedAvatar = await compressAvatarFile(avatarFile);
        try {
          nextAvatarUrl = await uploadProfileAvatar(profile.id, optimizedAvatar);
          avatarForDatabase = nextAvatarUrl;
        } catch {
          nextAvatarUrl = await blobToDataUrl(optimizedAvatar);
          localAvatarFallback = true;
        }
      }

      const editableProfile = {
        avatarUrl: nextAvatarUrl,
        dateOfBirth: normalizeOptionalProfileDate(dateOfBirth),
        fullName: trimmedName,
        phone: phone.trim(),
      };
      await saveLocalProfileOverride(profile.id, editableProfile);

      const authMetadata = {
        fullName: editableProfile.fullName,
        phone: editableProfile.phone,
        dateOfBirth: editableProfile.dateOfBirth,
        ...(!localAvatarFallback && !nextAvatarUrl.startsWith('data:') ? { avatarUrl: nextAvatarUrl } : {}),
      };
      const { error: authUpdateError } = await supabase.auth.updateUser({ data: authMetadata });
      if (authUpdateError) {
        throw authUpdateError;
      }

      let databaseSynced = true;
      let databaseProfile: UserProfile | null = null;
      try {
        databaseProfile = await saveOwnProfile({
          avatarUrl: avatarForDatabase,
          dateOfBirth: editableProfile.dateOfBirth,
          fullName: editableProfile.fullName,
          phone: editableProfile.phone,
        });
      } catch {
        databaseSynced = false;
      }

      const nextProfile = {
        ...(databaseProfile ?? profile),
        ...editableProfile,
      };
      onProfileChange(nextProfile);
      setAvatarPreview(nextProfile.avatarUrl);
      setAvatarFile(null);
      const changedFields = [
        editableProfile.fullName !== profile.fullName ? 'Họ và tên' : '',
        editableProfile.phone !== profile.phone ? 'Số điện thoại' : '',
        editableProfile.dateOfBirth !== profile.dateOfBirth ? 'Ngày sinh' : '',
        nextProfile.avatarUrl !== profile.avatarUrl ? 'Ảnh đại diện' : '',
      ].filter(Boolean);
      setFeedback({
        tone: 'success',
        title: changedFields.length ? `Đã cập nhật: ${changedFields.join(', ')}` : 'Không có thay đổi mới',
        message: localAvatarFallback
          ? 'Ảnh đang được giữ trên thiết bị này.'
          : databaseSynced
            ? changedFields.join(', ')
            : 'Một số thông tin sẽ được lưu lại khi kết nối ổn định.',
      });
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'Chưa lưu được thông tin cá nhân. Vui lòng thử lại.');
      setFeedback({
        tone: 'error',
        title: 'Không lưu được hồ sơ',
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View accessibilityLabel="Quản lý tài khoản" accessibilityRole="dialog" style={styles.accountOverlay}>
      <Pressable
        accessibilityLabel="Đóng quản lý tài khoản"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.accountBackdrop}
      />
      <View style={styles.accountDrawer}>
        <View style={styles.accountDrawerHeader}>
          <View style={styles.flex}>
            <Text style={styles.accountDrawerEyebrow}>TÀI KHOẢN</Text>
            <Text style={styles.accountDrawerTitle}>Hồ sơ cá nhân</Text>
          </View>
          <Pressable
            accessibilityLabel="Đóng quản lý tài khoản"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.accountCloseButton, pressed && styles.pressed]}
          >
            <X color={colors.ink} size={20} />
          </Pressable>
        </View>

        <ScrollView
          className="app-scroll-surface"
          contentContainerStyle={styles.accountDrawerContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.accountHeroCard}>
            <View style={styles.accountAvatarEditor}>
              <ProfileAvatar avatarUrl={avatarPreview} label={fullName || profile.email} large />
              <Pressable
                accessibilityLabel="Chọn ảnh đại diện mới"
                accessibilityRole="button"
                disabled={saving}
                onPress={() => fileInputRef.current?.click()}
                style={({ pressed }) => [styles.avatarCameraButton, pressed && styles.pressed]}
              >
                <Camera color={colors.onDark} size={17} />
              </Pressable>
              <input
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="account-file-input"
                onChange={(event) => chooseAvatar(event.target.files?.[0])}
                ref={fileInputRef}
                type="file"
              />
            </View>
            <Text style={styles.accountHeroName}>{profile.fullName || profile.email}</Text>
            <Text style={styles.accountHeroEmail}>{profile.email}</Text>
            <View style={styles.accountRolePill}>
              <ShieldCheck color={colors.primary} size={14} />
              <Text style={styles.accountRolePillText}>{roleLabel}</Text>
            </View>
            <Text style={[styles.accountHeroSync, syncError && styles.accountHeroSyncError]}>
              {syncing ? 'Đang lưu dữ liệu...' : syncError ? 'Có dữ liệu chưa lưu' : 'Dữ liệu đã được lưu'}
            </Text>
          </View>

          {syncError ? (
            <View style={styles.syncErrorCard}>
              <CircleAlert color={colors.rose} size={20} />
              <View style={styles.flex}>
                <Text style={styles.syncErrorTitle}>Một số dữ liệu chưa được lưu</Text>
                <Text style={styles.syncErrorText}>{syncError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetrySync}
                  style={({ pressed }) => [styles.syncRetryButton, pressed && styles.pressed]}
                >
                  <RefreshCcw color={colors.onDark} size={15} />
                  <Text style={styles.syncRetryText}>Thử lưu lại</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {feedback ? <AuthFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} /> : null}

          <View style={styles.accountSectionCard}>
            <View style={styles.accountSectionHeading}>
              <UserRound color={colors.primary} size={20} />
              <View style={styles.flex}>
                <Text style={styles.accountSectionTitle}>Thông tin cá nhân</Text>
                <Text style={styles.accountSectionHint}>Bạn có thể sửa tên, số điện thoại và ảnh đại diện.</Text>
              </View>
            </View>
            <FormField
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect={false}
              icon={UserRound}
              label="Họ và tên"
              onChangeText={setFullName}
              placeholder="Tên hiển thị"
              value={fullName}
            />
            <FormField
              autoComplete="tel"
              autoCapitalize="none"
              autoCorrect={false}
              icon={Phone}
              keyboardType="phone-pad"
              label="Số điện thoại"
              onChangeText={setPhone}
              placeholder="Ví dụ: 0901 234 567"
              value={phone}
            />
            <View style={styles.nativeField}>
              <Text style={styles.inputLabel}>Ngày tháng năm sinh</Text>
              <input
                aria-label="Ngày tháng năm sinh"
                className="account-native-field"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDateOfBirth(event.target.value)}
                type="date"
                value={dateOfBirth}
              />
            </View>
            <PrimaryButton
              icon={Save}
              label={saving ? 'Đang lưu hồ sơ...' : 'Lưu thay đổi'}
              onPress={() => void saveProfile()}
              tone="primary"
            />
          </View>

          <View style={styles.accountSectionCard}>
            <View style={styles.accountSectionHeading}>
              <LockKeyhole color={colors.primary} size={20} />
              <View style={styles.flex}>
                <Text style={styles.accountSectionTitle}>Thông tin công việc</Text>
                <Text style={styles.accountSectionHint}>Chỉ Chủ cửa hàng có quyền thay đổi các mục này.</Text>
              </View>
            </View>
            <ProfileInfoRow icon={ShieldCheck} label="Vị trí" value={roleLabel} />
            <ProfileInfoRow icon={Store} label="Nơi làm việc" value={workplace} />
            <ProfileInfoRow icon={Clock3} label="Hình thức làm việc" value={employmentLabel} />
            <ProfileInfoRow icon={WalletCards} label="Lương k/giờ" value={formatCurrency(profile.hourlyRate)} />
            <ProfileInfoRow icon={WalletCards} label="Phụ cấp" value={formatCurrency(profile.allowance)} />
            <ProfileInfoRow icon={WalletCards} label="Tiền ăn sáng" value={`${formatCurrency(profile.breakfastAllowance)} / ca sáng`} />
            <ProfileInfoRow
              icon={CalendarDays}
              label="Thâm niên"
              value={`${formatSeniority(profile.startDate)} • Từ ${formatProfileDate(profile.startDate)}`}
            />
          </View>

          <View style={styles.accountSectionCard}>
            <View style={styles.accountSectionHeading}>
              <LockKeyhole color={colors.primary} size={20} />
              <View style={styles.flex}>
                <Text style={styles.accountSectionTitle}>Bảo mật tài khoản</Text>
                <Text style={styles.accountSectionHint}>Đổi mật khẩu hoặc đăng xuất khỏi thiết bị.</Text>
              </View>
            </View>
            <AccountSecuritySection authEmail={authEmail} onSignOut={onSignOut} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function AccountSecuritySection({
  authEmail,
  onSignOut,
}: {
  authEmail: string;
  onSignOut: () => void;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<AuthFeedback | null>(null);

  const clearPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordFeedback(null);
  };

  const togglePasswordForm = () => {
    if (savingPassword) {
      return;
    }

    clearPasswordForm();
    setShowPasswordForm((visible) => !visible);
  };

  const savePassword = async () => {
    if (savingPassword) {
      return;
    }

    if (!currentPassword) {
      setPasswordFeedback({
        tone: 'error',
        title: 'Thiếu mật khẩu hiện tại',
        message: 'Vui lòng nhập mật khẩu đang dùng để kiểm tra tài khoản.',
      });
      return;
    }

    if (newPassword.length < minimumPasswordLength) {
      setPasswordFeedback({
        tone: 'error',
        title: 'Mật khẩu mới quá ngắn',
        message: `Vui lòng nhập mật khẩu mới ít nhất ${minimumPasswordLength} ký tự.`,
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordFeedback({
        tone: 'error',
        title: 'Mật khẩu chưa thay đổi',
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        tone: 'error',
        title: 'Mật khẩu không khớp',
        message: 'Vui lòng nhập lại chính xác mật khẩu mới.',
      });
      return;
    }

    setSavingPassword(true);
    setPasswordFeedback({
      tone: 'info',
      title: 'Đang lưu mật khẩu',
      message: 'Đang kiểm tra và lưu mật khẩu mới...',
    });

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
      });

      if (verifyError) {
        const isInvalidPassword = verifyError.message.toLowerCase().includes('invalid login credentials');
        throw new Error(
          isInvalidPassword
            ? 'Mật khẩu hiện tại không đúng.'
            : getFriendlyErrorMessage(verifyError, 'Chưa kiểm tra được mật khẩu hiện tại.'),
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        throw updateError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordFeedback({
        tone: 'success',
        title: 'Đã lưu mật khẩu mới',
        message: 'Mật khẩu đã được cập nhật. Bạn có thể tiếp tục dùng phiên đăng nhập hiện tại.',
      });
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'Chưa đổi được mật khẩu. Vui lòng thử lại.');
      setPasswordFeedback({
        tone: 'error',
        title: 'Không đổi được mật khẩu',
        message,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View style={styles.accountSecurity}>
      <View style={styles.accountSecurityActions}>
        <Pressable
          accessibilityRole="button"
          disabled={savingPassword}
          onPress={togglePasswordForm}
          style={({ pressed }) => [
            styles.passwordToggleButton,
            savingPassword && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <KeyRound color={colors.onDark} size={15} />
          <Text style={styles.passwordToggleText}>{showPasswordForm ? 'Đóng đổi mật khẩu' : 'Đổi mật khẩu'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </View>

      {showPasswordForm ? (
        <View style={styles.passwordPanel}>
          <View style={styles.passwordPanelHeader}>
            <View style={styles.flex}>
              <Text style={styles.passwordPanelTitle}>Đổi mật khẩu</Text>
              <Text style={styles.passwordPanelHint}>
                Mật khẩu được lưu an toàn và không hiển thị trong ứng dụng.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Đóng mục đổi mật khẩu"
              accessibilityRole="button"
              onPress={togglePasswordForm}
              style={({ pressed }) => [styles.authFeedbackDismiss, pressed && styles.pressed]}
            >
              <X color={colors.muted} size={18} />
            </Pressable>
          </View>

          {passwordFeedback ? (
            <AuthFeedbackBanner feedback={passwordFeedback} onDismiss={() => setPasswordFeedback(null)} />
          ) : null}

          <FormField
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            icon={KeyRound}
            label="Mật khẩu hiện tại"
            onChangeText={setCurrentPassword}
            placeholder="Nhập mật khẩu đang dùng"
            secureTextEntry={!showCurrentPassword}
            textContentType="password"
            trailingAction={{
              icon: showCurrentPassword ? EyeOff : Eye,
              label: showCurrentPassword ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại',
              onPress: () => setShowCurrentPassword((visible) => !visible),
            }}
            value={currentPassword}
          />

          <FormField
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            icon={KeyRound}
            label="Mật khẩu mới"
            onChangeText={setNewPassword}
            placeholder={`Ít nhất ${minimumPasswordLength} ký tự`}
            secureTextEntry={!showNewPassword}
            textContentType="newPassword"
            trailingAction={{
              icon: showNewPassword ? EyeOff : Eye,
              label: showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới',
              onPress: () => setShowNewPassword((visible) => !visible),
            }}
            value={newPassword}
          />

          <FormField
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            icon={KeyRound}
            label="Nhập lại mật khẩu mới"
            onChangeText={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            secureTextEntry={!showConfirmPassword}
            textContentType="newPassword"
            trailingAction={{
              icon: showConfirmPassword ? EyeOff : Eye,
              label: showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận',
              onPress: () => setShowConfirmPassword((visible) => !visible),
            }}
            value={confirmPassword}
          />

          <View style={styles.passwordActionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={savingPassword}
              onPress={togglePasswordForm}
              style={({ pressed }) => [
                styles.passwordCancelButton,
                savingPassword && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.passwordCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={savingPassword}
              onPress={() => void savePassword()}
              style={({ pressed }) => [
                styles.passwordSaveButton,
                savingPassword && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Save color={colors.onDark} size={17} />
              <Text style={styles.passwordSaveText}>{savingPassword ? 'Đang lưu...' : 'Lưu mật khẩu'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function BranchPills({
  branchId,
  onBranchChange,
}: {
  branchId: string;
  onBranchChange: (value: string) => void;
}) {
  return (
    <View style={styles.branchPills}>
      {branches.map((branch) => {
        const selected = branch.id === branchId;

        return (
          <Pressable
            accessibilityRole="button"
            key={branch.id}
            onPress={() => onBranchChange(branch.id)}
            style={({ pressed }) => [
              styles.branchPill,
              selected && styles.branchPillActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.branchPillName, selected && styles.branchPillNameActive]}>{branch.name}</Text>
            <Text style={[styles.branchPillMeta, selected && styles.branchPillMetaActive]}>{branch.area}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthNavigator({
  monthKey,
  onChange,
}: {
  monthKey: string;
  onChange: (value: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <View style={styles.monthNavigator}>
        <Pressable
          accessibilityLabel="Xem tháng trước"
          accessibilityRole="button"
          onPress={() => onChange(shiftMonthKey(monthKey, -1))}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
        >
          <ChevronLeft color={colors.primary} size={18} />
        </Pressable>
        <Pressable
          accessibilityLabel="Mở bộ chọn tháng và năm"
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.monthCurrent, pressed && styles.monthCurrentPressed]}
        >
          <CalendarDays color={colors.primary} size={18} />
          <View style={styles.monthCurrentCopy}>
            <Text style={styles.monthCurrentText}>{formatMonthKey(monthKey)}</Text>
            <Text style={styles.monthCurrentHint}>Chạm để chọn nhanh</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel="Xem tháng sau"
          accessibilityRole="button"
          onPress={() => onChange(shiftMonthKey(monthKey, 1))}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
        >
          <ChevronRight color={colors.primary} size={18} />
        </Pressable>
      </View>

      {pickerOpen ? (
        <MonthYearPicker
          monthKey={monthKey}
          onChange={(value) => {
            onChange(value);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </>
  );
}

function MonthYearPicker({
  monthKey,
  onChange,
  onClose,
}: {
  monthKey: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const selected = parseMonthKey(monthKey);
  const [displayYear, setDisplayYear] = useState(selected.year);
  const todayKey = getMonthKey();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <View accessibilityLabel="Chọn tháng" accessibilityRole="dialog" style={styles.monthPickerOverlay}>
      <Pressable
        accessibilityLabel="Đóng bộ chọn tháng"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.monthPickerBackdrop}
      />
      <View style={styles.monthPickerSheet}>
        <View style={styles.monthPickerHandle} />
        <View style={styles.monthPickerHeader}>
          <View style={styles.flex}>
            <Text style={styles.monthPickerEyebrow}>CHỌN THỜI GIAN</Text>
            <Text style={styles.monthPickerTitle}>Tháng và năm</Text>
          </View>
          <Pressable
            accessibilityLabel="Đóng bộ chọn tháng"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.accountCloseButton, pressed && styles.pressed]}
          >
            <X color={colors.ink} size={19} />
          </Pressable>
        </View>

        <View style={styles.monthPickerYearRow}>
          <Pressable
            accessibilityLabel="Năm trước"
            accessibilityRole="button"
            onPress={() => setDisplayYear((year) => year - 1)}
            style={({ pressed }) => [styles.monthPickerYearButton, pressed && styles.pressed]}
          >
            <ChevronLeft color={colors.primary} size={20} />
          </Pressable>
          <View style={styles.monthPickerYearDisplay}>
            <Text style={styles.monthPickerYearText}>{displayYear}</Text>
          </View>
          <Pressable
            accessibilityLabel="Năm sau"
            accessibilityRole="button"
            onPress={() => setDisplayYear((year) => year + 1)}
            style={({ pressed }) => [styles.monthPickerYearButton, pressed && styles.pressed]}
          >
            <ChevronRight color={colors.primary} size={20} />
          </Pressable>
        </View>

        <View style={styles.monthPickerGrid}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
            const value = `${displayYear}-${String(month).padStart(2, '0')}`;
            const isSelected = value === monthKey;
            const isCurrent = value === todayKey;
            return (
              <Pressable
                accessibilityRole="button"
                key={value}
                onPress={() => onChange(value)}
                style={({ pressed }) => [
                  styles.monthPickerOption,
                  isCurrent && styles.monthPickerOptionCurrent,
                  isSelected && styles.monthPickerOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.monthPickerOptionText, isSelected && styles.monthPickerOptionTextSelected]}>
                  Tháng {month}
                </Text>
                {isCurrent ? <Text style={[styles.monthPickerNowText, isSelected && styles.monthPickerOptionTextSelected]}>Hiện tại</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(todayKey)}
          style={({ pressed }) => [styles.monthPickerTodayButton, pressed && styles.pressed]}
        >
          <CalendarCheck2 color={colors.primary} size={18} />
          <Text style={styles.monthPickerTodayText}>Về tháng hiện tại</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmployeeAttendanceScreen({
  branch,
  employeeName,
  monthKey,
  onCancelPayroll,
  onConfirmPayroll,
  onMonthChange,
  onNameChange,
  onPasteGrid,
  onUpdateCell,
  sheet,
}: {
  branch: Branch;
  employeeName: string;
  monthKey: string;
  onCancelPayroll: (employeeName: string) => void;
  onConfirmPayroll: (employeeName: string) => void;
  onMonthChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPasteGrid: (employeeName: string, startDay: number, startField: AttendanceInputField, pastedText: string, userId?: string) => void;
  onUpdateCell: (employeeName: string, dayKey: string, field: AttendanceInputField, value: string, userId?: string) => void;
  sheet?: AttendanceSheet;
}) {
  const trimmedName = employeeName.trim();
  const editable = Boolean(trimmedName) && isCurrentMonth(monthKey) && !sheet?.employeeConfirmedAt;
  const payroll = calculatePayroll(sheet);

  return (
    <View style={styles.screen}>
      <SectionTitle icon={Clock3} title="Chấm công" subtitle={`${branch.name} - bảng công theo tháng`} />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />
      <FormField
        icon={UserRound}
        label="Nhân viên"
        onChangeText={onNameChange}
        placeholder="Nhập tên nhân viên"
        value={employeeName}
      />
      <AttendanceSheetTableV2
        editable={editable}
        employeeName={trimmedName}
        monthKey={monthKey}
        onPasteGrid={onPasteGrid}
        onUpdateCell={onUpdateCell}
        sheet={sheet}
      />
      <PayrollSummary payroll={payroll} />
      {sheet?.managerApprovedAt ? (
        <StatusPanel
          icon={CheckCircle2}
          title="Bảng lương đã được duyệt"
          text="Bảng công đã được quản lí chốt; bạn không cần gửi lại."
          tone="success"
        />
      ) : sheet?.employeeConfirmedAt ? (
        <>
          <StatusPanel
            icon={CheckCircle2}
            title="Đã gửi bảng công, chờ quản lí duyệt"
            text={`Quản lí chi nhánh sẽ nhận được bảng công này từ ${formatDateTime(sheet.employeeConfirmedAt)}.`}
            tone="success"
          />
          {isCurrentMonth(monthKey) ? (
            <PrimaryButton
              icon={XCircle}
              label="Mở lại bảng công để chỉnh sửa"
              onPress={() => onCancelPayroll(trimmedName)}
              tone="danger"
            />
          ) : null}
        </>
      ) : (
        <PrimaryButton
          icon={CheckCheck}
          label="Gửi bảng công để quản lí duyệt"
          onPress={() => onConfirmPayroll(trimmedName)}
          tone="primary"
        />
      )}
    </View>
  );
}

function ManagerPayrollScreen({
  branch,
  managerId,
  monthKey,
  onMonthChange,
  onOpenEmployeePayroll,
  sheets,
}: {
  branch: Branch;
  managerId: string;
  monthKey: string;
  onMonthChange: (value: string) => void;
  onOpenEmployeePayroll: (employeeId: string) => void;
  sheets: AttendanceSheet[];
}) {
  const [staff, setStaff] = useState<ManagedStaffProfile[]>([]);
  const [aliases, setAliases] = useState<StaffBranchAlias[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  const refreshStaff = async () => {
    setLoadingStaff(true);
    try {
      const result = await loadStaffManagement();
      setStaff(result.profiles);
      setAliases(result.aliases);
      setStaffError(null);
    } catch (error) {
      setStaffError(getFriendlyErrorMessage(error, 'Chưa tải được danh sách nhân viên.'));
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    void refreshStaff();
  }, [managerId]);

  const branchEmployees = useMemo(
    () =>
      staff
        .filter((person) => person.role === 'employee' && person.branchId === branch.id)
        .sort((first, second) => {
          const firstName = getStaffDisplayName(first, aliases, managerId, branch.id);
          const secondName = getStaffDisplayName(second, aliases, managerId, branch.id);
          return firstName.localeCompare(secondName, 'vi');
        }),
    [aliases, branch.id, managerId, staff],
  );

  return (
    <View style={styles.screen}>
      <SectionTitle icon={WalletCards} title="Duyệt bảng lương" subtitle={`${branch.name} · chọn nhân viên để kiểm tra từng bảng`} />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />
      <StatusPanel
        icon={CalendarCheck2}
        title="Lịch làm tự lên bảng công"
        text="Sau khi gửi lịch, quản lí chỉ cần kiểm tra, chỉnh số giờ khi cần rồi duyệt bảng lương của từng nhân viên. Có thể xem và sửa các tháng trước."
        tone="success"
      />

      <View style={styles.managerPayrollList}>
        <View style={styles.managerPayrollListHeading}>
          <View style={styles.managerPayrollListTitleWrap}>
            <UsersRound color={colors.primary} size={18} />
            <Text style={styles.managerPayrollListTitle}>Danh sách nhân viên</Text>
          </View>
          <Pressable accessibilityLabel="Tải lại danh sách nhân viên" onPress={() => void refreshStaff()} style={styles.managerPayrollRefresh}>
            <RefreshCcw color={colors.primary} size={16} />
          </Pressable>
        </View>
        {loadingStaff ? (
          <Text style={styles.managerPayrollEmpty}>Đang tải danh sách nhân viên...</Text>
        ) : staffError ? (
          <Text style={styles.managerPayrollError}>{staffError}</Text>
        ) : branchEmployees.length === 0 ? (
          <Text style={styles.managerPayrollEmpty}>Chưa có nhân viên nào thuộc chi nhánh này.</Text>
        ) : (
          <View style={styles.managerPayrollEmployeeGrid}>
            {branchEmployees.map((employee) => {
              const sheet = getAttendanceSheet(sheets, branch.id, employee.fullName, monthKey, employee.id);
              const payroll = calculatePayroll(sheet);
              const displayName = getStaffDisplayName(employee, aliases, managerId, branch.id);
              const status = sheet?.managerApprovedAt ? 'Đã duyệt' : payroll.totalHours > 0 ? 'Chờ duyệt' : 'Chưa có lịch';
              return (
                <Pressable
                  accessibilityLabel={`Mở bảng lương ${displayName}`}
                  accessibilityRole="button"
                  key={employee.id}
                  onPress={() => onOpenEmployeePayroll(employee.id)}
                  style={({ pressed }) => [styles.managerPayrollEmployeeCard, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.managerPayrollEmployeeName}>{displayName}</Text>
                    <Text style={styles.managerPayrollEmployeeMeta}>
                      {formatNumber(payroll.totalHours)} giờ · {status}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

    </View>
  );
}

function ManagerEmployeePayrollPage({
  branch,
  employeeId,
  managerId,
  monthKey,
  onApproveEmployeePayroll,
  onBack,
  onMonthChange,
  onPasteGrid,
  onReopenEmployeePayroll,
  onUpdateCell,
  sheets,
}: {
  branch: Branch;
  employeeId: string;
  managerId: string;
  monthKey: string;
  onApproveEmployeePayroll: (employeeName: string, userId: string) => void;
  onBack: () => void;
  onMonthChange: (value: string) => void;
  onPasteGrid: (employeeName: string, startDay: number, startField: AttendanceInputField, pastedText: string, userId?: string) => void;
  onReopenEmployeePayroll: (employeeName: string, userId: string) => void;
  onUpdateCell: (employeeName: string, dayKey: string, field: AttendanceInputField, value: string, userId?: string) => void;
  sheets: AttendanceSheet[];
}) {
  const [staff, setStaff] = useState<ManagedStaffProfile[]>([]);
  const [aliases, setAliases] = useState<StaffBranchAlias[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  const refreshStaff = async () => {
    setLoadingStaff(true);
    try {
      const result = await loadStaffManagement();
      setStaff(result.profiles);
      setAliases(result.aliases);
      setStaffError(null);
    } catch (error) {
      setStaffError(getFriendlyErrorMessage(error, 'Chưa tải được danh sách nhân viên.'));
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    void refreshStaff();
  }, [managerId]);

  const employee = useMemo(
    () => staff.find((person) => person.id === employeeId && person.role === 'employee' && person.branchId === branch.id),
    [branch.id, employeeId, staff],
  );
  const sheet = employee ? getAttendanceSheet(sheets, branch.id, employee.fullName, monthKey, employee.id) : undefined;

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityLabel="Quay lại danh sách nhân viên"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.managerPayrollBackButton, pressed && styles.pressed]}
      >
        <ChevronLeft color={colors.primary} size={18} />
        <Text style={styles.managerPayrollBackText}>Danh sách nhân viên</Text>
      </Pressable>

      <SectionTitle icon={WalletCards} title="Bảng lương nhân viên" subtitle={branch.name} />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />

      {loadingStaff ? (
        <Text style={styles.managerPayrollEmpty}>Đang tải bảng lương nhân viên...</Text>
      ) : staffError ? (
        <Text style={styles.managerPayrollError}>{staffError}</Text>
      ) : employee ? (
        <View style={styles.managerPayrollDetail}>
          <View style={styles.managerPayrollDetailHeading}>
            <View style={styles.flex}>
              <Text style={styles.managerPayrollDetailEyebrow}>BẢNG LƯƠNG NHÂN VIÊN</Text>
              <Text style={styles.managerPayrollDetailName}>{getStaffDisplayName(employee, aliases, managerId, branch.id)}</Text>
              <Text style={styles.managerPayrollDetailHint}>Quản lí có thể sửa trực tiếp giờ công và xem các tháng trước của nhân viên này.</Text>
            </View>
          </View>
          <AttendanceSheetTableV2
            editable={!isFutureMonth(monthKey)}
            employeeName={employee.fullName}
            monthKey={monthKey}
            onPasteGrid={onPasteGrid}
            onUpdateCell={onUpdateCell}
            sheet={sheet}
            targetUserId={employee.id}
          />
          <PayrollSummary payroll={calculatePayroll(sheet)} />
          {sheet?.managerApprovedAt ? (
            <>
              <StatusPanel
                icon={CheckCircle2}
                title="Đã duyệt bảng lương nhân viên"
                text={`${sheet.managerApprovedBy ?? 'Quản lí'} duyệt lúc ${formatDateTime(sheet.managerApprovedAt)}.`}
                tone="success"
              />
              <PrimaryButton
                icon={XCircle}
                label="Mở lại để chỉnh sửa"
                onPress={() => onReopenEmployeePayroll(employee.fullName, employee.id)}
                tone="danger"
              />
            </>
          ) : (
            <PrimaryButton
              icon={CheckCheck}
              label="Duyệt bảng lương nhân viên"
              onPress={() => onApproveEmployeePayroll(employee.fullName, employee.id)}
              tone="primary"
            />
          )}
        </View>
      ) : (
        <StatusPanel
          icon={CircleAlert}
          title="Không tìm thấy nhân viên"
          text="Nhân viên này không còn thuộc chi nhánh hiện tại hoặc tài khoản đã thay đổi."
          tone="neutral"
        />
      )}
    </View>
  );
}

function AttendanceSheetTableV2({
  editable,
  employeeName,
  monthKey,
  onPasteGrid,
  onUpdateCell,
  sheet,
  targetUserId,
}: {
  editable: boolean;
  employeeName: string;
  monthKey: string;
  onPasteGrid: (employeeName: string, startDay: number, startField: AttendanceInputField, pastedText: string, userId?: string) => void;
  onUpdateCell: (employeeName: string, dayKey: string, field: AttendanceInputField, value: string, userId?: string) => void;
  sheet?: AttendanceSheet;
  targetUserId?: string;
}) {
  const days = Array.from({ length: getDaysInMonth(monthKey) }, (_, index) => index + 1);
  const canEdit = editable && Boolean(employeeName.trim());

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    day: number,
    field: AttendanceInputField,
  ) => {
    const pastedText = event.clipboardData.getData('text/plain');
    if (!pastedText.includes('\t') && !pastedText.includes('\n')) {
      return;
    }
    event.preventDefault();
    onPasteGrid(employeeName, day, field, pastedText, targetUserId);
  };

  return (
    <>
      <View style={styles.attendanceTable}>
        <View style={[styles.attendanceRow, styles.attendanceHeaderRow]}>
          <Text style={[styles.attendanceCell, styles.attendanceDateCell]}>Ngày</Text>
          <Text style={[styles.attendanceCell, styles.attendanceWeekdayCell]}>Thứ</Text>
          <Text style={styles.attendanceCell}>Ca sáng</Text>
          <Text style={styles.attendanceCell}>Ca chiều</Text>
        </View>
        {days.map((day) => {
          const dayKey = getAttendanceDayKey(monthKey, day);
          const sunday = isSundayAttendanceDay(monthKey, day);
          const value = sheet?.days[dayKey] ?? { morning: '', afternoon: '', opening: '' };
          const morningValue = formatHoursInput(toNumber(value.morning) + toNumber(value.opening));
          const afternoonEditable = canEdit && !sunday;

          return (
            <View key={dayKey} style={[styles.attendanceRow, sunday && styles.attendanceSundayRow]}>
              <Text style={[styles.attendanceCell, styles.attendanceDateCell]}>{String(day).padStart(2, '0')}</Text>
              <Text style={[styles.attendanceCell, styles.attendanceWeekdayCell]}>{getWeekdayLabel(monthKey, day)}</Text>
              <TextInput
                editable={canEdit}
                keyboardType={decimalKeyboard}
                onChangeText={(inputValue) => onUpdateCell(employeeName, dayKey, 'morning', inputValue, targetUserId)}
                onPaste={(event) => handlePaste(event, day, 'morning')}
                placeholder="0"
                placeholderTextColor="#9A806B"
                style={[styles.attendanceInput, !canEdit && styles.attendanceInputReadonly]}
                value={morningValue}
              />
              <TextInput
                editable={afternoonEditable}
                keyboardType={decimalKeyboard}
                onChangeText={(inputValue) => onUpdateCell(employeeName, dayKey, 'afternoon', inputValue, targetUserId)}
                onPaste={(event) => handlePaste(event, day, 'afternoon')}
                placeholder={sunday ? 'Nghỉ' : '0'}
                placeholderTextColor="#9A806B"
                style={[styles.attendanceInput, !afternoonEditable && styles.attendanceInputReadonly, sunday && styles.attendanceSundayInput]}
                value={value.afternoon}
              />
            </View>
          );
        })}
      </View>
    </>
  );
}

function PayrollSummary({ payroll }: { payroll: ReturnType<typeof calculatePayroll> }) {
  return (
    <View style={styles.payrollSummary}>
      <SummaryLine label="Tổng ca sáng" value={payroll.morningShifts.toString()} />
      <SummaryLine label="Tổng ca chiều" value={payroll.afternoonShifts.toString()} />
      <SummaryLine label="Tổng giờ làm" value={formatNumber(payroll.totalHours)} />
      <SummaryLine label="Tiền ăn sáng" value={formatCurrency(payroll.breakfastMoney)} />
      <SummaryLine label="Phụ cấp" value={formatCurrency(payroll.allowanceMoney)} />
      <SummaryLine label="Thành tiền" strong value={formatCurrency(payroll.totalMoney)} />
    </View>
  );
}

function PayrollAggregateSummary({
  aggregate,
}: {
  aggregate: ReturnType<typeof calculateBranchPayroll>;
}) {
  return (
    <View style={styles.payrollSummary}>
      <SummaryLine label="Nhân viên đã gửi" value={aggregate.employees.toString()} />
      <SummaryLine label="Ca sáng" value={aggregate.morningShifts.toString()} />
      <SummaryLine label="Ca chiều" value={aggregate.afternoonShifts.toString()} />
      <SummaryLine label="Tổng giờ" value={formatNumber(aggregate.totalHours)} />
      <SummaryLine label="Tổng lương" strong value={formatCurrency(aggregate.totalMoney)} />
    </View>
  );
}

function SummaryLine({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <View style={[styles.summaryLine, strong && styles.summaryLineStrong]}>
      <Text style={[styles.summaryLineLabel, strong && styles.summaryLineLabelStrong]}>{label}</Text>
      <Text style={[styles.summaryLineValue, strong && styles.summaryLineValueStrong]}>{value}</Text>
    </View>
  );
}

function StatusPanel({
  icon: Icon,
  text,
  title,
  tone,
}: {
  icon: typeof Clock3;
  text: string;
  title: string;
  tone: 'success' | 'neutral';
}) {
  const success = tone === 'success';

  return (
    <View style={[styles.statusBand, success ? styles.statusIn : styles.statusNeutral]}>
      <View style={styles.statusIcon}>
        <Icon color={success ? colors.primary : colors.muted} size={22} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusText}>{text}</Text>
      </View>
    </View>
  );
}

function OwnerPayrollScreen({
  branchId,
  monthKey,
  onBranchChange,
  onMonthChange,
  sheets,
}: {
  branchId: string;
  monthKey: string;
  onBranchChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  sheets: AttendanceSheet[];
}) {
  const selectedBranch = getBranchById(branchId);
  const confirmedSheets = sheets.filter(
    (sheet) => sheet.branchId === branchId && sheet.monthKey === monthKey && sheet.managerApprovedAt,
  );
  const aggregate = calculateBranchPayroll(confirmedSheets);
  const received = confirmedSheets.length > 0;
  const latestApproval = confirmedSheets.reduce<string | undefined>((latest, sheet) => {
    if (!sheet.managerApprovedAt) return latest;
    return !latest || sheet.managerApprovedAt > latest ? sheet.managerApprovedAt : latest;
  }, undefined);

  return (
    <View style={styles.screen}>
      <SectionTitle icon={WalletCards} title="Bảng lương" subtitle="Chủ cửa hàng xem theo chi nhánh và tháng" />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />
      <OwnerBranchList
        branchId={branchId}
        getMeta={(branch) => {
          const approvedCount = sheets.filter(
            (sheet) => sheet.branchId === branch.id && sheet.monthKey === monthKey && sheet.managerApprovedAt,
          ).length;

          return approvedCount > 0
            ? `Đã nhận ${approvedCount} bảng lương đã duyệt`
            : 'Chưa nhận bảng lương';
        }}
        onBranchChange={onBranchChange}
      />

      <View style={styles.managerPanel}>
        <SectionTitle icon={Store} title={selectedBranch.name} subtitle={selectedBranch.address} />
        {received ? (
          <>
            <StatusPanel
              icon={CheckCircle2}
              title="Đã nhận bảng lương được duyệt"
              text={`Bảng lương mới nhất được quản lí duyệt lúc ${formatDateTime(latestApproval ?? new Date().toISOString())}.`}
              tone="success"
            />
            <PayrollAggregateSummary aggregate={aggregate} />
            <HistoryList emptyText="Chưa có bảng lương nhân viên." icon={History} title="Nhân viên">
              {confirmedSheets.map((sheet) => {
                const payroll = calculatePayroll(sheet);

                return (
                  <HistoryRow
                    key={sheet.id}
                    meta={`${formatNumber(payroll.totalHours)} giờ - ${formatNumber(payroll.morningShifts)} ca sáng`}
                    title={sheet.employeeName}
                    value={formatCurrency(payroll.totalMoney)}
                  />
                );
              })}
            </HistoryList>
          </>
        ) : (
          <StatusPanel
            icon={Clock3}
            title="Chưa nhận bảng lương"
            text="Bảng lương sẽ xuất hiện ngay sau khi quản lí duyệt cho từng nhân viên."
            tone="neutral"
          />
        )}
      </View>
    </View>
  );
}

function OwnerBranchList({
  branchId,
  getMeta,
  onBranchChange,
}: {
  branchId: string;
  getMeta: (branch: Branch) => string;
  onBranchChange: (value: string) => void;
}) {
  return (
    <View style={styles.ownerBranchList}>
      {branches.map((branch) => {
        const selected = branch.id === branchId;

        return (
          <Pressable
            accessibilityRole="button"
            key={branch.id}
            onPress={() => onBranchChange(branch.id)}
            style={({ pressed }) => [
              styles.ownerBranchRow,
              selected && styles.ownerBranchRowActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.ownerBranchIcon}>
              <Building2 color={selected ? colors.onDark : colors.primary} size={19} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.ownerBranchName, selected && styles.ownerBranchNameActive]}>{branch.name}</Text>
              <Text style={[styles.ownerBranchMeta, selected && styles.ownerBranchMetaActive]}>{getMeta(branch)}</Text>
            </View>
            <ChevronRight color={selected ? colors.onDark : colors.muted} size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

const formatSupplyItemValue = (item: SupplyReportItem) => {
  if (item.kind === 'status') {
    return `${item.label}: ${item.status === 'empty' ? 'hết' : 'còn'}`;
  }

  const quantityText = item.quantity.trim();
  const baseText = quantityText ? `${item.label}: ${quantityText} ${item.unit}` : `${item.label}: chưa nhập`;

  return item.status === 'empty' ? `${baseText} - hết` : baseText;
};

const buildSupplyShareText = (branch: Branch, report: IngredientReport) => {
  const itemLines = (report.items ?? [])
    .map((item) => formatSupplyItemValue(item))
    .filter((line) => !line.includes('chưa nhập'));
  const noteLine = report.note.trim() ? `Ghi chú: ${report.note.trim()}` : '';
  const body = [...itemLines, noteLine].filter(Boolean).join('\n') || 'Tất cả còn đủ';

  return `Dạ em báo đồ ${branch.name} ạ:\n${body}`;
};

function ClosingScreen({
  bankTransferMoney,
  bankTransferTotal,
  cardTopupMoney,
  cornMilkRow,
  errors,
  iceBags,
  largeBottles,
  largeCoffeePacks,
  machineMoney,
  note,
  onBankTransferMoneyChange,
  onCardTopupMoneyChange,
  onCornMilkChange,
  onIceBagsChange,
  onLargeBottlesChange,
  onLargeCoffeePacksChange,
  onMachineMoneyChange,
  onNoteChange,
  onPlasticCupChange,
  onShopeeMoneyChange,
  onSmallBottlesChange,
  onSmallCoffeePacksChange,
  onSave,
  onSelectReport,
  onStoreMoneyChange,
  onWaterBottlesChange,
  plasticCupRows,
  records,
  saving,
  shopeeMoney,
  smallBottles,
  smallCoffeePacks,
  storeMoney,
  waterBottles,
}: {
  bankTransferMoney: string;
  bankTransferTotal: number;
  cardTopupMoney: string;
  cornMilkRow: PlasticCupInput;
  errors: string[];
  iceBags: string;
  largeBottles: string;
  largeCoffeePacks: string;
  machineMoney: string;
  note: string;
  onBankTransferMoneyChange: (value: string) => void;
  onCardTopupMoneyChange: (value: string) => void;
  onCornMilkChange: (patch: Partial<PlasticCupInput>) => void;
  onIceBagsChange: (value: string) => void;
  onLargeBottlesChange: (value: string) => void;
  onLargeCoffeePacksChange: (value: string) => void;
  onMachineMoneyChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onPlasticCupChange: (key: PlasticCupKey, patch: Partial<PlasticCupInput>) => void;
  onShopeeMoneyChange: (value: string) => void;
  onSmallBottlesChange: (value: string) => void;
  onSmallCoffeePacksChange: (value: string) => void;
  onSave: () => void;
  onSelectReport: (report: ShiftCloseReport) => void;
  onStoreMoneyChange: (value: string) => void;
  onWaterBottlesChange: (value: string) => void;
  plasticCupRows: Record<PlasticCupKey, PlasticCupInput>;
  records: ShiftCloseReport[];
  saving: boolean;
  shopeeMoney: string;
  smallBottles: string;
  smallCoffeePacks: string;
  storeMoney: string;
  waterBottles: string;
}) {
  const hasError = (key: string) => errors.includes(key);

  return (
    <View style={styles.screen}>
      <SectionTitle icon={DoorClosed} title="Báo ca" />

      <View style={styles.closingForm}>
        <PlasticCupSection errors={errors} onChange={onPlasticCupChange} rows={plasticCupRows} />

        <BalanceSection
          errorPrefix="cornMilk"
          errors={errors}
          machineLabel="Sữa bắp trên máy"
          onChange={onCornMilkChange}
          required
          row={cornMilkRow}
          title="Sữa Bắp"
        />

        <View style={styles.closingSection}>
          <View style={styles.closingSectionHeader}>
            <Text style={styles.closingSectionTitle}>Bình</Text>
          </View>
          <ClosingFormField label="Bình nhỏ" onChangeText={onSmallBottlesChange} value={smallBottles} />
          <ClosingFormField label="Bình lớn" onChangeText={onLargeBottlesChange} value={largeBottles} />
        </View>

        <View style={styles.closingSection}>
          <View style={styles.closingSectionHeader}>
            <Text style={styles.closingSectionTitle}>Cà Phê Gói</Text>
          </View>
          <ClosingFormField label="Gói cà phê nhỏ" onChangeText={onSmallCoffeePacksChange} value={smallCoffeePacks} />
          <ClosingFormField label="Gói cà phê lớn" onChangeText={onLargeCoffeePacksChange} value={largeCoffeePacks} />
        </View>

        <View style={styles.closingSection}>
          <View style={styles.closingSectionHeader}>
            <Text style={styles.closingSectionTitle}>Tiền</Text>
          </View>
          <ClosingFormField error={hasError('machineMoney')} label="Tiền Trên Máy" onChangeText={onMachineMoneyChange} required value={machineMoney} />
          <ClosingFormField error={hasError('storeMoney')} label="Tiền Tại Quán" onChangeText={onStoreMoneyChange} required value={storeMoney} />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldGroupTitle}>Tiền chuyển khoản</Text>
            <ClosingFormField label="Shopee" onChangeText={onShopeeMoneyChange} value={shopeeMoney} />
            <TransferSumField
              label="Chuyển khoản"
              onChangeText={onBankTransferMoneyChange}
              total={bankTransferTotal}
              value={bankTransferMoney}
            />
          </View>
        </View>

        <View style={styles.closingSection}>
          <View style={styles.closingSectionHeader}>
            <Text style={styles.closingSectionTitle}>Ghi chú</Text>
          </View>
          <ClosingFormField error={hasError('iceBags')} label="Đá" onChangeText={onIceBagsChange} required suffix="bao" value={iceBags} />
          <ClosingFormField label="Bình nước suối" onChangeText={onWaterBottlesChange} suffix="bình" value={waterBottles} />
          <ClosingFormField label="Tiền nạp card" onChangeText={onCardTopupMoneyChange} value={cardTopupMoney} />
          <ClosingFormField label="Ghi chú khác" numeric={false} onChangeText={onNoteChange} value={note} />
        </View>
      </View>

      <PrimaryButton disabled={saving} icon={Save} label={saving ? 'Đang gửi...' : 'Gửi báo ca'} onPress={onSave} tone="primary" />

      <HistoryList emptyText="Chưa có bản báo ca." icon={History} title="Báo ca gần đây">
        {records.slice(0, 8).map((report) => {
          const machine = report.machineMoney || legacyCurrency(report.revenue);
          const store = report.storeMoney || legacyCurrency(report.revenue);
          const cupsSummary =
            report.plasticCupRows
              ?.map(formatBalanceHistorySummary)
              .join(' | ') || report.plasticCups || '';
          const cornMilkSummary = report.cornMilkReport
            ? formatBalanceHistorySummary(report.cornMilkReport)
            : report.cornMilk || '';
          const shiftSummary = [cupsSummary, cornMilkSummary].filter(Boolean).join(' - ');

          return (
            <HistoryRow
              key={report.id}
              meta={`Máy: ${machine || 'Chưa nhập'} - Tại quán: ${store || 'Chưa nhập'}`}
              onPress={() => onSelectReport(report)}
              title={formatDateTime(report.timestamp)}
              value={shiftSummary || 'Chưa có chi tiết ly/sữa bắp'}
            />
          );
        })}
      </HistoryList>
    </View>
  );
}

function ClosingReportExportPreview({ report }: { report: ShiftCloseReport }) {
  const cards = buildClosingExportCards(report);

  return (
    <View style={styles.exportPreview}>
      {cards.map((card) => (
        <View key={`${card.title}-${card.lines.join('|')}`} style={styles.exportCard}>
          <Text style={styles.exportCardTitle}>
            {card.title}
            {card.required ? <Text style={styles.exportRequired}> *</Text> : null}
          </Text>
          <View style={styles.exportLines}>
            {card.lines.map((line, index) => (
              <Text key={`${card.title}-${index}`} style={styles.exportLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function PlasticCupSection({
  errors,
  onChange,
  rows,
}: {
  errors: string[];
  onChange: (key: PlasticCupKey, patch: Partial<PlasticCupInput>) => void;
  rows: Record<PlasticCupKey, PlasticCupInput>;
}) {
  return (
    <View style={styles.plasticCupSection}>
      <View style={styles.closingSectionHeader}>
        <View style={styles.flex}>
          <Text style={styles.closingSectionTitle}>
            Ly Nhựa <Text style={styles.requiredMark}>*</Text>
          </Text>
        </View>
      </View>

      {plasticCupTemplates.map(({ key, label }) => {
        const row = rows[key];
        const sold = toNumber(row.opening) - toNumber(row.remaining);

        return (
          <View key={key} style={styles.cupEntry}>
            <View style={styles.cupEquationRow}>
              <Text style={styles.cupName}>{label}:</Text>
              <CupEquationInput
                error={errors.includes(`plastic.${key}.opening`)}
                onChangeText={(value) => onChange(key, { opening: value })}
                value={row.opening}
              />
              <Text style={styles.equationMark}>-</Text>
              <View style={styles.soldEquationValue}>
                <Text style={styles.soldEquationNumber}>{formatNumber(sold)}</Text>
                <Text style={styles.equationUnit}>(bán)</Text>
              </View>
              <Text style={styles.equationMark}>=</Text>
              <CupEquationInput
                error={errors.includes(`plastic.${key}.remaining`)}
                onChangeText={(value) => onChange(key, { remaining: value })}
                value={row.remaining}
              />
              <Text style={styles.equationUnit}>(còn)</Text>
            </View>

            <View style={styles.cupBalanceRow}>
              <View style={styles.machineCupGroup}>
                <Text style={styles.machineCupLabel}>Ly trên máy</Text>
                <CupEquationInput
                  error={errors.includes(`plastic.${key}.machineCups`)}
                  onChangeText={(value) => onChange(key, { machineCups: value })}
                  value={row.machineCups}
                />
              </View>

              <View
                style={[
                  styles.cupBalanceBadge,
                  row.status === 'short' && styles.cupBalanceBadgeShort,
                  row.status === 'over' && styles.cupBalanceBadgeOver,
                ]}
              >
                <Text
                  style={[
                    styles.cupBalanceText,
                    row.status === 'short' && styles.cupBalanceTextShort,
                    row.status === 'over' && styles.cupBalanceTextOver,
                  ]}
                >
                  {formatCupBalance(row.status, toNumber(row.variance))}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function BalanceSection({
  errorPrefix,
  errors,
  machineLabel,
  onChange,
  required,
  row,
  title,
}: {
  errorPrefix: string;
  errors: string[];
  machineLabel: string;
  onChange: (patch: Partial<PlasticCupInput>) => void;
  required?: boolean;
  row: PlasticCupInput;
  title: string;
}) {
  const sold = toNumber(row.opening) - toNumber(row.remaining);

  return (
    <View style={styles.plasticCupSection}>
      <View style={styles.closingSectionHeader}>
        <Text style={styles.closingSectionTitle}>
          {title}
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </Text>
      </View>

      <View style={styles.cupEntry}>
        <View style={styles.cupEquationRow}>
          <Text style={styles.cupName}>{title}:</Text>
          <CupEquationInput
            error={errors.includes(`${errorPrefix}.opening`)}
            onChangeText={(value) => onChange({ opening: value })}
            value={row.opening}
          />
          <Text style={styles.equationMark}>-</Text>
          <View style={styles.soldEquationValue}>
            <Text style={styles.soldEquationNumber}>{formatNumber(sold)}</Text>
            <Text style={styles.equationUnit}>(bán)</Text>
          </View>
          <Text style={styles.equationMark}>=</Text>
          <CupEquationInput
            error={errors.includes(`${errorPrefix}.remaining`)}
            onChangeText={(value) => onChange({ remaining: value })}
            value={row.remaining}
          />
          <Text style={styles.equationUnit}>(còn)</Text>
        </View>

        <View style={styles.cupBalanceRow}>
          <View style={styles.machineCupGroup}>
            <Text style={styles.machineCupLabel}>{machineLabel}</Text>
            <CupEquationInput
              error={errors.includes(`${errorPrefix}.machineCups`)}
              onChangeText={(value) => onChange({ machineCups: value })}
              value={row.machineCups}
            />
          </View>

          <View
            style={[
              styles.cupBalanceBadge,
              row.status === 'short' && styles.cupBalanceBadgeShort,
              row.status === 'over' && styles.cupBalanceBadgeOver,
            ]}
          >
            <Text
              style={[
                styles.cupBalanceText,
                row.status === 'short' && styles.cupBalanceTextShort,
                row.status === 'over' && styles.cupBalanceTextOver,
              ]}
            >
              {formatCupBalance(row.status, toNumber(row.variance))}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CupEquationInput({
  error,
  onChangeText,
  placeholder = '',
  value,
}: {
  error?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <TextInput
      keyboardType={numericKeyboard}
      onChangeText={(inputValue) => onChangeText(sanitizeDigits(inputValue))}
      placeholder={placeholder}
      placeholderTextColor="#9A806B"
      style={[styles.cupEquationInput, error && styles.inputError]}
      value={value}
    />
  );
}
