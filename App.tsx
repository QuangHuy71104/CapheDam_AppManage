import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  type KeyboardTypeOptions,
  type TextInputProps,
  useWindowDimensions,
  View,
} from './lib/web-ui';
import {
  ArrowRight,
  Beef,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CircleAlert,
  CheckCircle2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DoorClosed,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Mail,
  PackageCheck,
  RefreshCcw,
  Save,
  ShieldCheck,
  Store,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { type Ref, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { webStorage } from './lib/storage';

type TabKey = 'attendance' | 'ingredients' | 'closing' | 'ownerPayroll' | 'ownerIngredients';
type UserRole = 'owner' | 'manager' | 'employee';
type AuthFeedback = {
  tone: 'success' | 'error' | 'info';
  title: string;
  message: string;
};
type AttendanceType = 'clockIn' | 'clockOut';
type CupBalanceStatus = 'enough' | 'short' | 'over';
type PlasticCupKey = 'small' | 'large' | 'icedTea';

type Branch = {
  id: string;
  name: string;
  area: string;
  address: string;
};

type PlasticCupInput = {
  opening: string;
  remaining: string;
  machineCups: string;
  status: CupBalanceStatus;
  variance: string;
};

type BalanceInputSnapshot = {
  openingText?: string;
  remainingText?: string;
  machineCupsText?: string;
};

type BalanceReportBase = BalanceInputSnapshot & {
  label: string;
  opening: number;
  remaining: number;
  sold: number;
  status: CupBalanceStatus;
  variance: number;
};

type PlasticCupReport = BalanceReportBase & {
  key: PlasticCupKey;
  machineCups?: number;
};

type StockBalanceReport = BalanceReportBase & {
  machineCount?: number;
};

type AttendanceEvent = {
  id: string;
  employeeName: string;
  note: string;
  timestamp: string;
  type: AttendanceType;
};

type AttendanceDayEntry = {
  morning: string;
  afternoon: string;
};

type AttendanceSheet = {
  id: string;
  userId?: string;
  branchId: string;
  employeeName: string;
  monthKey: string;
  days: Record<string, AttendanceDayEntry>;
  employeeConfirmedAt?: string;
};

type BranchPayrollConfirmation = {
  id: string;
  branchId: string;
  monthKey: string;
  managerConfirmedAt?: string;
  managerCancelledAt?: string;
  managerName?: string;
  autoConfirmed?: boolean;
};

type IngredientReport = {
  id: string;
  branchId?: string;
  reporterName?: string;
  reporterRole?: UserRole;
  itemName?: string;
  unit?: string;
  openingStock?: number;
  received?: number;
  used?: number;
  wasted?: number;
  currentStock?: number;
  note: string;
  timestamp: string;
  items?: SupplyReportItem[];
};

type SupplyItemStatus = 'available' | 'empty';
type SupplyItemKind = 'quantity' | 'status';

type SupplyItemConfig = {
  key: string;
  label: string;
  kind: SupplyItemKind;
  unit?: string;
};

type SupplyItemInput = {
  quantity: string;
  status: SupplyItemStatus;
};

type SupplyReportItem = SupplyItemConfig & SupplyItemInput;

type ShiftCloseReport = {
  id: string;
  branchId?: string;
  plasticCups?: string;
  plasticCupRows?: PlasticCupReport[];
  cornMilk?: string;
  cornMilkReport?: StockBalanceReport;
  glassCups?: string;
  smallBottles?: string;
  largeBottles?: string;
  coffeePacks?: string;
  smallCoffeePacks?: string;
  largeCoffeePacks?: string;
  machineMoney: string;
  storeMoney: string;
  transferMoney?: string;
  shopeeMoney?: string;
  bankTransferMoney?: string;
  bankTransferTotal?: number;
  iceBags?: string;
  waterBottles?: string;
  cardTopupMoney?: string;
  note: string;
  timestamp: string;
  cashierName?: string;
  shiftName?: string;
  revenue?: number;
  discrepancy?: number;
};

type AppData = {
  attendance: AttendanceEvent[];
  attendanceSheets: AttendanceSheet[];
  branchPayrolls: BranchPayrollConfirmation[];
  ingredients: IngredientReport[];
  closings: ShiftCloseReport[];
};

type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
};

type PendingSignupDraft = {
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
};

const STORAGE_KEY = 'caphedam-appmanage-v1';
const logoImage = new URL('./assets/logo.jpg', import.meta.url).href;

const initialData: AppData = {
  attendance: [],
  attendanceSheets: [],
  branchPayrolls: [],
  ingredients: [],
  closings: [],
};

const branches: Branch[] = [
  {
    id: 'minh-khai-1',
    name: 'Chi nhánh Minh Khai 1',
    area: 'Nguyễn Thị Minh Khai',
    address: '147A Nguyễn Thị Minh Khai, Phường Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh',
  },
  {
    id: 'minh-khai-2',
    name: 'Chi nhánh Minh Khai 2',
    area: 'Nguyễn Thị Minh Khai',
    address: '123 Nguyễn Thị Minh Khai, Phường Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh',
  },
  {
    id: 'nam-ky-khoi-nghia',
    name: 'Chi nhánh Nam Kỳ Khởi Nghĩa',
    area: 'Nam Kỳ Khởi Nghĩa',
    address: '151C Nam Kỳ Khởi Nghĩa, Phường 6, Xuân Hòa, Hồ Chí Minh',
  },
  {
    id: 'dien-bien-phu',
    name: 'Chi nhánh Điện Biên Phủ',
    area: 'Điện Biên Phủ',
    address: '435 Điện Biên Phủ, Phường 3, Bàn Cờ, Hồ Chí Minh',
  },
  {
    id: 'pham-dinh-ho',
    name: 'Chi nhánh Phạm Đình Hổ',
    area: 'Phạm Đình Hổ',
    address: '49 Phạm Đình Hổ, Phường 2, Bình Tây, Hồ Chí Minh',
  },
  {
    id: 'tung-thien-vuong',
    name: 'Chi nhánh Tùng Thiện Vương',
    area: 'Tùng Thiện Vương',
    address: '415 Tùng Thiện Vương, Phường Xóm Củi, Phú Định, Hồ Chí Minh',
  },
];

const defaultBranchId = branches[0].id;

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
    description: 'Tổng hợp bảng lương nhân viên và xác nhận gửi chủ cửa hàng.',
    icon: UserCog,
  },
  {
    key: 'owner',
    label: 'Chủ cửa hàng',
    description: 'Xem bảng lương và báo đồ của toàn bộ chi nhánh.',
    icon: ShieldCheck,
  },
];

const payrollPolicy = {
  hourlyRate: 24000,
  breakfastPerMorningShift: 27000,
  monthlyAllowance: 200000,
};

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

const supplyItems: SupplyItemConfig[] = [
  { key: 'coffee', label: 'Cà phê', kind: 'quantity', unit: 'bình' },
  { key: 'sugar', label: 'Đường', kind: 'quantity', unit: 'bình' },
  { key: 'yakult', label: 'Yakult', kind: 'quantity', unit: 'lốc' },
  { key: 'cornMilk', label: 'Sữa bắp', kind: 'quantity', unit: 'chai' },
  { key: 'apricotJuice', label: 'Xí muội nước', kind: 'quantity', unit: 'hộp' },
  { key: 'cacao', label: 'Cacao', kind: 'quantity', unit: 'hộp' },
  { key: 'honey', label: 'Mật ong', kind: 'quantity', unit: 'chai' },
  { key: 'tea', label: 'Trà', kind: 'quantity', unit: 'hộp' },
  { key: 'straws', label: 'Ống hút', kind: 'quantity', unit: 'bịch' },
  { key: 'freshMilk', label: 'Sữa tươi', kind: 'quantity', unit: 'thùng' },
  { key: 'condensedMilk', label: 'Sữa đặc', kind: 'quantity', unit: 'thùng' },
  { key: 'largeCoffeePacks', label: 'Gói cà phê lớn', kind: 'quantity', unit: 'gói' },
  { key: 'smallCoffeePacks', label: 'Gói cà phê nhỏ', kind: 'quantity', unit: 'gói' },
  { key: 'cheese', label: 'Phô mai', kind: 'quantity', unit: 'viên' },
  { key: 'baileys', label: 'Baileys', kind: 'status' },
  { key: 'chivas', label: 'Chivas', kind: 'status' },
  { key: 'midori', label: 'Midori', kind: 'status' },
  { key: 'trashBags', label: 'Bao rác', kind: 'status' },
  { key: 'dishSoapYellow', label: 'Nước rửa chén (chai Amway vàng)', kind: 'status' },
  { key: 'amwayGreenBottle', label: 'Chai Amway xanh', kind: 'status' },
  { key: 'cornMilkBags', label: 'Bao sữa bắp', kind: 'status' },
  { key: 'tBags', label: 'Bao chữ T', kind: 'status' },
  { key: 'spoons', label: 'Muỗng', kind: 'status' },
  { key: 'apricotPieces', label: 'Xí muội viên', kind: 'status' },
  { key: 'doubleBags', label: 'Bao đôi', kind: 'status' },
];

const createSupplyState = (): Record<string, SupplyItemInput> =>
  supplyItems.reduce<Record<string, SupplyItemInput>>((state, item) => {
    state[item.key] = { quantity: '', status: 'available' };
    return state;
  }, {});

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
  { key: 'ownerIngredients', label: 'Báo đồ', icon: ClipboardList },
];

const getTabItemsForRole = (role: UserRole) => (role === 'owner' ? ownerTabItems : employeeTabItems);

const colors = {
  background: '#F5EDE1',
  canvasDeep: '#ECDFCD',
  surface: '#FFF9F1',
  surfaceStrong: '#FFFCF7',
  surfaceSoft: '#F3E9DA',
  surfaceTint: '#EEE1CD',
  ink: '#23160F',
  muted: '#6F5847',
  line: 'rgba(93, 61, 39, 0.16)',
  lineStrong: 'rgba(93, 61, 39, 0.25)',
  primary: '#5F3723',
  primarySoft: '#E7D3B8',
  amber: '#B96524',
  amberSoft: '#F6E3C8',
  rose: '#B4483C',
  roseSoft: '#F3DDD8',
  blue: '#617055',
  blueSoft: '#DCE8D7',
  accent: '#B97849',
  accentSoft: '#F1D6BD',
  deep: '#3F2416',
  dark: '#24170F',
  gold: '#E7B640',
  onDark: '#FFF8EE',
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const toNumber = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isNumericText = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  return normalized.length > 0 && Number.isFinite(Number(normalized));
};

const sanitizeDigits = (value: string) => value.replace(/\D/g, '');

const sanitizeShiftHours = (value: string) => {
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [whole, ...decimalParts] = normalized.split(',');
  const decimals = decimalParts.join('');

  return decimalParts.length > 0 ? `${whole},${decimals.slice(0, 2)}` : whole;
};

const formatTransferExpression = (value: string) =>
  value.replace(/[^\d+]/g, '').replace(/\++/g, '+').replace(/^\++/, '');

const trimTransferExpression = (value: string) => value.replace(/\++$/g, '');

const sumTransferExpression = (value: string) =>
  trimTransferExpression(value)
    .split('+')
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part))
    .reduce((total, part) => total + part, 0);

const deriveCupBalance = (row: PlasticCupInput): Pick<PlasticCupInput, 'status' | 'variance'> => {
  if (!isNumericText(row.opening) || !isNumericText(row.remaining) || !isNumericText(row.machineCups)) {
    return { status: 'enough', variance: '' };
  }

  const sold = toNumber(row.opening) - toNumber(row.remaining);
  const difference = toNumber(row.machineCups) - sold;

  if (difference > 0) {
    return { status: 'over', variance: String(difference) };
  }

  if (difference < 0) {
    return { status: 'short', variance: String(Math.abs(difference)) };
  }

  return { status: 'enough', variance: '' };
};

const createStockBalanceReport = (label: string, row: PlasticCupInput): StockBalanceReport => {
  const opening = toNumber(row.opening);
  const remaining = toNumber(row.remaining);
  const machineCount = toNumber(row.machineCups);
  const sold = opening - remaining;
  const balance = deriveCupBalance(row);

  return {
    label,
    opening,
    remaining,
    machineCount,
    sold,
    status: balance.status,
    variance: balance.status === 'enough' ? 0 : toNumber(balance.variance),
    openingText: row.opening.trim(),
    remainingText: row.remaining.trim(),
    machineCupsText: row.machineCups.trim(),
  };
};

const createEmptyBalanceReport = (label: string): BalanceReportBase => ({
  label,
  opening: 0,
  remaining: 0,
  sold: 0,
  status: 'enough',
  variance: 0,
  openingText: '',
  remainingText: '',
  machineCupsText: '',
});

const savedNumberToInput = (textValue: string | undefined, numericValue?: number) => {
  if (textValue !== undefined) {
    return textValue;
  }

  if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
    return String(numericValue);
  }

  return '';
};

const restorePlasticCupInput = (row?: PlasticCupReport): PlasticCupInput => {
  const restored = {
    opening: savedNumberToInput(row?.openingText, row?.opening),
    remaining: savedNumberToInput(row?.remainingText, row?.remaining),
    machineCups: savedNumberToInput(row?.machineCupsText, row?.machineCups),
    status: 'enough' as CupBalanceStatus,
    variance: '',
  };

  return {
    ...restored,
    ...deriveCupBalance(restored),
  };
};

const restoreStockBalanceInput = (row?: StockBalanceReport): PlasticCupInput => {
  const restored = {
    opening: savedNumberToInput(row?.openingText, row?.opening),
    remaining: savedNumberToInput(row?.remainingText, row?.remaining),
    machineCups: savedNumberToInput(row?.machineCupsText, row?.machineCount),
    status: 'enough' as CupBalanceStatus,
    variance: '',
  };

  return {
    ...restored,
    ...deriveCupBalance(restored),
  };
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

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

const getWeekdayLabel = (monthKey: string, day: number) => {
  const { month, year } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
};

const isCurrentMonth = (monthKey: string) => monthKey === getMonthKey();

const getMonthCutoffDate = (monthKey: string, dayOffsetFromEnd: number) => {
  const { month, year } = parseMonthKey(monthKey);
  const lastDay = new Date(year, month, 0).getDate();

  return new Date(year, month - 1, lastDay - dayOffsetFromEnd);
};

const isManagerCancelLocked = (monthKey: string, now = new Date()) => now >= getMonthCutoffDate(monthKey, 0);

const shouldAutoConfirmPayroll = (monthKey: string, now = new Date()) => now >= getMonthCutoffDate(monthKey, 1);

const getBranchById = (branchId: string) => branches.find((branch) => branch.id === branchId) ?? branches[0];

const getReportBranchId = (report: { branchId?: string }) => report.branchId ?? defaultBranchId;

const isReportInMonth = (timestamp: string, monthKey: string) => getMonthKey(new Date(timestamp)) === monthKey;

const createEmptyAttendanceSheet = (
  branchId: string,
  employeeName: string,
  monthKey: string,
  userId?: string,
): AttendanceSheet => ({
  id: createId(),
  userId,
  branchId,
  employeeName,
  monthKey,
  days: {},
});

const getAttendanceSheet = (
  sheets: AttendanceSheet[],
  branchId: string,
  employeeName: string,
  monthKey: string,
) =>
  sheets.find(
    (sheet) =>
      sheet.branchId === branchId &&
      sheet.monthKey === monthKey &&
      sheet.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase(),
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
      sheet.employeeName.trim().toLowerCase() === employeeName.trim().toLowerCase(),
  );
  const baseSheet = index >= 0 ? sheets[index] : createEmptyAttendanceSheet(branchId, employeeName, monthKey, userId);
  const nextSheet = updater(baseSheet);

  if (index < 0) {
    return [nextSheet, ...sheets];
  }

  return sheets.map((sheet, sheetIndex) => (sheetIndex === index ? nextSheet : sheet));
};

const calculatePayroll = (sheet?: AttendanceSheet) => {
  const days = Object.values(sheet?.days ?? {});
  const morningHours = days.reduce((total, day) => total + toNumber(day.morning), 0);
  const afternoonHours = days.reduce((total, day) => total + toNumber(day.afternoon), 0);
  const morningShifts = days.filter((day) => toNumber(day.morning) > 0).length;
  const afternoonShifts = days.filter((day) => toNumber(day.afternoon) > 0).length;
  const totalHours = morningHours + afternoonHours;
  const breakfastMoney = morningShifts * payrollPolicy.breakfastPerMorningShift;
  const allowanceMoney = totalHours > 0 ? payrollPolicy.monthlyAllowance : 0;
  const wageMoney = Math.round(totalHours * payrollPolicy.hourlyRate);
  const totalMoney = wageMoney + breakfastMoney + allowanceMoney;

  return {
    allowanceMoney,
    afternoonHours,
    afternoonShifts,
    breakfastMoney,
    morningHours,
    morningShifts,
    totalHours,
    totalMoney,
    wageMoney,
  };
};

const calculateBranchPayroll = (sheets: AttendanceSheet[]) =>
  sheets.reduce(
    (total, sheet) => {
      const payroll = calculatePayroll(sheet);

      return {
        employees: total.employees + 1,
        totalHours: total.totalHours + payroll.totalHours,
        totalMoney: total.totalMoney + payroll.totalMoney,
        morningShifts: total.morningShifts + payroll.morningShifts,
        afternoonShifts: total.afternoonShifts + payroll.afternoonShifts,
      };
    },
    { employees: 0, totalHours: 0, totalMoney: 0, morningShifts: 0, afternoonShifts: 0 },
  );

const getBranchPayrollConfirmation = (
  confirmations: BranchPayrollConfirmation[],
  branchId: string,
  monthKey: string,
) => confirmations.find((confirmation) => confirmation.branchId === branchId && confirmation.monthKey === monthKey);

const normalizeAppData = (value: Partial<AppData> | null | undefined): AppData => ({
  attendance: Array.isArray(value?.attendance) ? value.attendance : [],
  attendanceSheets: Array.isArray(value?.attendanceSheets) ? value.attendanceSheets : [],
  branchPayrolls: Array.isArray(value?.branchPayrolls) ? value.branchPayrolls : [],
  ingredients: Array.isArray(value?.ingredients) ? value.ingredients : [],
  closings: Array.isArray(value?.closings) ? value.closings : [],
});

const normalizeRole = (value: unknown): UserRole =>
  value === 'owner' || value === 'manager' || value === 'employee' ? value : 'employee';

const normalizeBranchId = (role: UserRole, value: unknown) => {
  if (role === 'owner') {
    return null;
  }

  return typeof value === 'string' && branches.some((branch) => branch.id === value) ? value : defaultBranchId;
};

const normalizeEmailAddress = (value: string) => value.trim().toLowerCase();

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const minimumPasswordLength = 6;

const normalizeAttendanceDays = (value: unknown): Record<string, AttendanceDayEntry> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, Partial<AttendanceDayEntry>>).reduce<Record<string, AttendanceDayEntry>>(
    (days, [key, entry]) => {
      days[key] = {
        morning: typeof entry.morning === 'string' ? entry.morning : '',
        afternoon: typeof entry.afternoon === 'string' ? entry.afternoon : '',
      };
      return days;
    },
    {},
  );
};

const mapProfileRow = (row: Record<string, unknown>, user: User): UserProfile => {
  const role = normalizeRole(row.role);
  const branchId = normalizeBranchId(role, row.branch_id);
  const normalizedEmail = typeof row.email === 'string' && row.email ? normalizeEmailAddress(row.email) : '';

  return {
    id: user.id,
    email: normalizedEmail || normalizeEmailAddress(user.email ?? ''),
    fullName: typeof row.full_name === 'string' ? row.full_name : '',
    role,
    branchId,
  };
};

const fetchUserProfile = async (user: User, signupDraft?: PendingSignupDraft | null): Promise<UserProfile> => {
  const { data: row, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,branch_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (row) {
    return mapProfileRow(row as Record<string, unknown>, user);
  }

  const normalizedUserEmail = normalizeEmailAddress(user.email ?? '');
  const draftMatchesUser = signupDraft?.email === normalizedUserEmail;
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const metadataRole = normalizeRole(metadata?.role);
  const fallbackRole = draftMatchesUser ? signupDraft.role : metadataRole;
  const fallbackEmail = normalizedUserEmail || signupDraft?.email || '';

  if (!fallbackEmail) {
    throw new Error('Không lấy được email từ Supabase Auth.');
  }

  const fallbackProfile: UserProfile = {
    id: user.id,
    email: fallbackEmail,
    fullName:
      draftMatchesUser
        ? signupDraft.fullName
        : typeof metadata?.fullName === 'string'
          ? metadata.fullName
          : '',
    role: fallbackRole,
    branchId: draftMatchesUser
      ? signupDraft.branchId
      : normalizeBranchId(fallbackRole, metadata?.branchId),
  };

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      id: fallbackProfile.id,
      email: fallbackProfile.email,
      full_name: fallbackProfile.fullName,
      role: fallbackProfile.role,
      branch_id: fallbackProfile.branchId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    throw upsertError;
  }

  return fallbackProfile;
};

const applyAttendanceScope = (profile: UserProfile) => {
  let request = supabase.from('attendance_sheets').select('*');

  if (profile.role === 'manager' && profile.branchId) {
    request = request.eq('branch_id', profile.branchId);
  } else if (profile.role === 'employee') {
    request = request.eq('user_id', profile.id);
  }

  return request.order('month_key', { ascending: false });
};

const applyBranchScope = (tableName: 'ingredient_reports' | 'shift_close_reports' | 'branch_payroll_confirmations', profile: UserProfile) => {
  let request = supabase.from(tableName).select('*');

  if (profile.role !== 'owner' && profile.branchId) {
    request = request.eq('branch_id', profile.branchId);
  }

  return request;
};

const loadAppDataFromSupabase = async (profile: UserProfile): Promise<AppData> => {
  const attendanceResult = await applyAttendanceScope(profile);
  const payrollResult =
    profile.role === 'employee'
      ? { data: [], error: null }
      : await applyBranchScope('branch_payroll_confirmations', profile).order('month_key', { ascending: false });
  const ingredientsResult = await applyBranchScope('ingredient_reports', profile).order('reported_at', { ascending: false });
  const closingsResult = await applyBranchScope('shift_close_reports', profile).order('reported_at', { ascending: false });

  const remoteError =
    attendanceResult.error ?? payrollResult.error ?? ingredientsResult.error ?? closingsResult.error;

  if (remoteError) {
    throw remoteError;
  }

  const attendanceSheets: AttendanceSheet[] = (attendanceResult.data ?? []).map((item) => {
    const row = item as Record<string, unknown>;

    return {
      id: String(row.id),
      userId: typeof row.user_id === 'string' ? row.user_id : undefined,
      branchId: String(row.branch_id),
      employeeName: String(row.employee_name),
      monthKey: String(row.month_key),
      days: normalizeAttendanceDays(row.days),
      employeeConfirmedAt: typeof row.employee_confirmed_at === 'string' ? row.employee_confirmed_at : undefined,
    };
  });

  const branchPayrolls: BranchPayrollConfirmation[] = (payrollResult.data ?? []).map((item) => {
    const row = item as Record<string, unknown>;

    return {
      id: String(row.id),
      branchId: String(row.branch_id),
      monthKey: String(row.month_key),
      managerConfirmedAt: typeof row.manager_confirmed_at === 'string' ? row.manager_confirmed_at : undefined,
      managerCancelledAt: typeof row.manager_cancelled_at === 'string' ? row.manager_cancelled_at : undefined,
      managerName: typeof row.manager_name === 'string' ? row.manager_name : undefined,
      autoConfirmed: Boolean(row.auto_confirmed),
    };
  });

  const ingredients: IngredientReport[] = (ingredientsResult.data ?? []).map((item) => {
    const row = item as Record<string, unknown>;

    return {
      id: String(row.id),
      branchId: String(row.branch_id),
      note: typeof row.note === 'string' ? row.note : '',
      reporterName: typeof row.reporter_name === 'string' ? row.reporter_name : undefined,
      reporterRole: normalizeRole(row.reporter_role),
      timestamp: String(row.reported_at),
      items: Array.isArray(row.items) ? (row.items as SupplyReportItem[]) : [],
    };
  });

  const closings: ShiftCloseReport[] = (closingsResult.data ?? []).map((item) => {
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
      branchId: String(row.branch_id),
    };
  });

  return normalizeAppData({
    attendance: [],
    attendanceSheets,
    branchPayrolls,
    ingredients,
    closings,
  });
};

const upsertSupabaseRows = async (tableName: string, rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }
};

const syncAppDataToSupabase = async (current: AppData) => {
  const updatedAt = new Date().toISOString();
  const attendanceRows = current.attendanceSheets.map((sheet) => ({
    id: sheet.id,
    user_id: sheet.userId ?? null,
    branch_id: sheet.branchId,
    employee_name: sheet.employeeName,
    month_key: sheet.monthKey,
    days: sheet.days,
    employee_confirmed_at: sheet.employeeConfirmedAt ?? null,
    updated_at: updatedAt,
  }));
  const payrollRows = current.branchPayrolls.map((confirmation) => ({
    id: confirmation.id,
    branch_id: confirmation.branchId,
    month_key: confirmation.monthKey,
    manager_confirmed_at: confirmation.managerConfirmedAt ?? null,
    manager_cancelled_at: confirmation.managerCancelledAt ?? null,
    manager_name: confirmation.managerName ?? null,
    auto_confirmed: Boolean(confirmation.autoConfirmed),
    updated_at: updatedAt,
  }));
  const ingredientRows = current.ingredients.map((report) => ({
    id: report.id,
    branch_id: getReportBranchId(report),
    reporter_name: report.reporterName ?? null,
    reporter_role: report.reporterRole ?? null,
    note: report.note,
    reported_at: report.timestamp,
    items: report.items ?? [],
    updated_at: updatedAt,
  }));
  const closingRows = current.closings.map((report) => ({
    id: report.id,
    branch_id: getReportBranchId(report),
    reported_at: report.timestamp,
    payload: report,
    updated_at: updatedAt,
  }));

  await Promise.all([
    upsertSupabaseRows('attendance_sheets', attendanceRows),
    upsertSupabaseRows('branch_payroll_confirmations', payrollRows),
    upsertSupabaseRows('ingredient_reports', ingredientRows),
    upsertSupabaseRows('shift_close_reports', closingRows),
  ]);
};

const clearRemoteAppData = async () => {
  const tableNames = ['shift_close_reports', 'ingredient_reports', 'branch_payroll_confirmations', 'attendance_sheets'];

  await Promise.all(
    tableNames.map(async (tableName) => {
      const { error } = await supabase.from(tableName).delete().neq('id', '__never__');

      if (error) {
        throw error;
      }
    }),
  );
};

const autoConfirmEligiblePayrolls = (current: AppData, now = new Date()) => {
  const nextConfirmations = [...current.branchPayrolls];
  let changed = false;

  branches.forEach((branch) => {
    const monthKeys = Array.from(
      new Set(
        current.attendanceSheets
          .filter((sheet) => sheet.branchId === branch.id && sheet.employeeConfirmedAt)
          .map((sheet) => sheet.monthKey),
      ),
    );

    monthKeys.forEach((monthKey) => {
      const existingIndex = nextConfirmations.findIndex(
        (confirmation) => confirmation.branchId === branch.id && confirmation.monthKey === monthKey,
      );
      const existing = existingIndex >= 0 ? nextConfirmations[existingIndex] : undefined;

      if (existing?.managerConfirmedAt || existing?.managerCancelledAt || !shouldAutoConfirmPayroll(monthKey, now)) {
        return;
      }

      const nextConfirmation: BranchPayrollConfirmation = {
        id: existing?.id ?? createId(),
        branchId: branch.id,
        monthKey,
        managerConfirmedAt: now.toISOString(),
        managerName: 'Hệ thống',
        autoConfirmed: true,
      };

      if (existingIndex >= 0) {
        nextConfirmations[existingIndex] = nextConfirmation;
      } else {
        nextConfirmations.push(nextConfirmation);
      }
      changed = true;
    });
  });

  return changed ? { ...current, branchPayrolls: nextConfirmations } : current;
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

const exportClosingReportImage = async (
  report: ShiftCloseReport,
  exportViewRef: { current: HTMLElement | null },
) => {
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
    downloadFile(dataUri, fileName);
  } catch {
    await exportClosingReportSvg(report);
  }
};

const exportClosingReportSvg = async (report: ShiftCloseReport) => {
  const svg = buildClosingReportSvg(report);
  const fileName = `bao-ca-${report.id}.svg`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const fileUrl = URL.createObjectURL(blob);
  downloadFile(fileUrl, fileName);
  setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
};

const numericKeyboard: KeyboardTypeOptions = 'number-pad';
const decimalKeyboard: KeyboardTypeOptions = 'decimal-pad';
const transferKeyboard: KeyboardTypeOptions = 'default';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [data, setData] = useState<AppData>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);
  const [syncingRemote, setSyncingRemote] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('employee');
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [selectedMonthKey, setSelectedMonthKey] = useState(getMonthKey());
  const contentScrollRef = useRef<ScrollView>(null);
  const exportCaptureRef = useRef<HTMLDivElement>(null);
  const remoteSnapshotRef = useRef('');
  const pendingSignupRef = useRef<PendingSignupDraft | null>(null);

  const [employeeName, setEmployeeName] = useState('');

  const [supplyRows, setSupplyRows] = useState(createSupplyState);
  const [ingredientNote, setIngredientNote] = useState('');

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
  const [pendingClosingExport, setPendingClosingExport] = useState<ShiftCloseReport | null>(null);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const rawData = await webStorage.getItem(STORAGE_KEY);
        if (rawData) {
          setData(normalizeAppData(JSON.parse(rawData) as Partial<AppData>));
        }
      } catch {
        Alert.alert('Không đọc được dữ liệu', 'App sẽ tiếp tục với dữ liệu trống trên máy này.');
      } finally {
        setLoaded(true);
      }
    };

    loadData();
  }, []);

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
          title: 'Không kết nối được Supabase',
          message: error.message,
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
    if (!isSupabaseConfigured || !authLoaded) {
      return;
    }

    let cancelled = false;
    const user = session?.user;

    const loadProfileAndData = async () => {
      if (!user) {
        setProfile(null);
        setRemoteReady(false);
        setData(initialData);
        remoteSnapshotRef.current = JSON.stringify(initialData);
        return;
      }

      try {
        setRemoteReady(false);
        const nextProfile = await fetchUserProfile(user, pendingSignupRef.current);
        const remoteData = await loadAppDataFromSupabase(nextProfile);

        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setCurrentRole(nextProfile.role);
        setEmployeeName(nextProfile.fullName);

        if (nextProfile.branchId) {
          setSelectedBranchId(nextProfile.branchId);
        }

        remoteSnapshotRef.current = JSON.stringify(remoteData);
        setData(remoteData);
        setRemoteReady(true);
        pendingSignupRef.current = null;
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Không tải được dữ liệu Supabase.';
          setAuthFeedback({
            tone: 'error',
            title: 'Không vào được ứng dụng',
            message,
          });
          pendingSignupRef.current = null;
          setProfile(null);
          setRemoteReady(true);
          setSession(null);
          void supabase.auth.signOut();
        }
      }
    };

    void loadProfileAndData();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, session?.user?.id]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    webStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {
      Alert.alert('Không lưu được dữ liệu', 'Vui lòng kiểm tra dung lượng thiết bị.');
    });
  }, [data, loaded]);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile || !remoteReady) {
      return;
    }

    const snapshot = JSON.stringify(data);

    if (snapshot === remoteSnapshotRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      setSyncingRemote(true);
      syncAppDataToSupabase(data)
        .then(() => {
          remoteSnapshotRef.current = snapshot;
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Không đồng bộ được dữ liệu lên Supabase.';
          Alert.alert('Lỗi đồng bộ', message);
        })
        .finally(() => setSyncingRemote(false));
    }, 700);

    return () => clearTimeout(timeout);
  }, [data, profile, remoteReady]);

  useEffect(() => {
    const availableTabs = getTabItemsForRole(currentRole);

    if (!availableTabs.some((item) => item.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [activeTab, currentRole]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    setData((current) => autoConfirmEligiblePayrolls(current));
  }, [data.attendanceSheets, loaded]);

  const tabItems = getTabItemsForRole(currentRole);
  const activeBranch = getBranchById(selectedBranchId);
  const trimmedEmployeeName = employeeName.trim();
  const signedEmployeeName =
    trimmedEmployeeName || (currentRole === 'manager' ? `Quản lí ${activeBranch.area}` : '');
  const branchSheetsForMonth = data.attendanceSheets.filter(
    (sheet) => sheet.branchId === selectedBranchId && sheet.monthKey === selectedMonthKey,
  );
  const confirmedBranchSheets = branchSheetsForMonth.filter((sheet) => sheet.employeeConfirmedAt);
  const branchPayrollConfirmation = getBranchPayrollConfirmation(
    data.branchPayrolls,
    selectedBranchId,
    selectedMonthKey,
  );
  const selectedBranchIngredients = data.ingredients.filter(
    (report) => getReportBranchId(report) === selectedBranchId,
  );
  const selectedBranchClosings = data.closings.filter((report) => getReportBranchId(report) === selectedBranchId);
  const selectedBranchIngredientsThisMonth = selectedBranchIngredients.filter((report) =>
    isReportInMonth(report.timestamp, selectedMonthKey),
  );
  const selectedBranchClosingsThisMonth = selectedBranchClosings.filter((report) =>
    isReportInMonth(report.timestamp, selectedMonthKey),
  );
  const confirmedOwnerBranches = branches.filter((branch) =>
    getBranchPayrollConfirmation(data.branchPayrolls, branch.id, selectedMonthKey)?.managerConfirmedAt,
  ).length;
  const employeeSheet = signedEmployeeName
    ? getAttendanceSheet(data.attendanceSheets, selectedBranchId, signedEmployeeName, selectedMonthKey)
    : undefined;
  const employeePayroll = calculatePayroll(employeeSheet);
  const attendanceMetric =
    currentRole === 'owner'
      ? confirmedOwnerBranches
      : currentRole === 'manager'
        ? confirmedBranchSheets.length
        : employeePayroll.totalHours;
  const ingredientMetric =
    currentRole === 'owner'
      ? selectedBranchIngredientsThisMonth.length
      : selectedBranchIngredients.filter((report) => isToday(report.timestamp)).length;
  const closingMetric =
    currentRole === 'owner'
      ? branches.length
      : selectedBranchClosings.filter((report) => isToday(report.timestamp)).length;

  const updateAttendanceCell = (employee: string, dayKey: string, field: keyof AttendanceDayEntry, value: string) => {
    const trimmedName = employee.trim();

    if (!trimmedName) {
      Alert.alert('Thiếu tên nhân viên', 'Vui lòng nhập tên nhân viên trước khi chấm công.');
      return;
    }

    if (!isCurrentMonth(selectedMonthKey)) {
      Alert.alert('Chỉ chấm công tháng hiện tại', 'Các tháng cũ chỉ dùng để xem lại bảng công đã lưu.');
      return;
    }

    setData((current) => {
      const existingSheet = getAttendanceSheet(current.attendanceSheets, selectedBranchId, employee, selectedMonthKey);

      if (existingSheet?.employeeConfirmedAt) {
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
          profile?.id,
          (sheet) => ({
            ...sheet,
            days: {
              ...sheet.days,
              [dayKey]: {
                morning: sheet.days[dayKey]?.morning ?? '',
                afternoon: sheet.days[dayKey]?.afternoon ?? '',
                [field]: sanitizeShiftHours(value),
              },
            },
          }),
        ),
      };
    });
  };

  const confirmEmployeePayroll = (employee: string) => {
    const trimmedName = employee.trim();

    if (!trimmedName) {
      Alert.alert('Thiếu tên nhân viên', 'Vui lòng nhập tên nhân viên trước khi xác nhận bảng lương.');
      return;
    }

    if (!isCurrentMonth(selectedMonthKey)) {
      Alert.alert('Không thể xác nhận tháng cũ', 'Nhân viên chỉ xác nhận bảng lương của tháng hiện tại.');
      return;
    }

    const currentSheet = getAttendanceSheet(data.attendanceSheets, selectedBranchId, trimmedName, selectedMonthKey);
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

  const confirmBranchPayroll = () => {
    if (confirmedBranchSheets.length === 0) {
      Alert.alert('Chưa có bảng lương nhân viên', 'Quản lí chỉ xác nhận được khi có nhân viên đã xác nhận bảng lương.');
      return;
    }

    setData((current) => {
      const existingIndex = current.branchPayrolls.findIndex(
        (confirmation) => confirmation.branchId === selectedBranchId && confirmation.monthKey === selectedMonthKey,
      );
      const nextConfirmation: BranchPayrollConfirmation = {
        id: existingIndex >= 0 ? current.branchPayrolls[existingIndex].id : createId(),
        branchId: selectedBranchId,
        monthKey: selectedMonthKey,
        managerConfirmedAt: new Date().toISOString(),
        managerName: signedEmployeeName || 'Quản lí chi nhánh',
        autoConfirmed: false,
      };
      const branchPayrolls =
        existingIndex >= 0
          ? current.branchPayrolls.map((confirmation, index) =>
              index === existingIndex ? nextConfirmation : confirmation,
            )
          : [nextConfirmation, ...current.branchPayrolls];

      return {
        ...current,
        branchPayrolls,
      };
    });
  };

  const cancelBranchPayroll = () => {
    if (isManagerCancelLocked(selectedMonthKey)) {
      Alert.alert('Không thể hủy xác nhận', 'Từ ngày cuối cùng của tháng, bảng lương chi nhánh đã khóa gửi chủ cửa hàng.');
      return;
    }

    setData((current) => ({
      ...current,
      branchPayrolls: current.branchPayrolls.map((confirmation) =>
        confirmation.branchId === selectedBranchId && confirmation.monthKey === selectedMonthKey
          ? {
              ...confirmation,
              managerConfirmedAt: undefined,
              managerCancelledAt: new Date().toISOString(),
              autoConfirmed: false,
            }
          : confirmation,
      ),
    }));
  };

  const saveIngredientReport = () => {
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

    setData((current) => ({
      ...current,
      ingredients: [report, ...current.ingredients].slice(0, 80),
    }));
    setSupplyRows(createSupplyState());
    setIngredientNote('');
  };

  const saveShiftClose = () => {
    setClosingErrors([]);

    const bankTransferExpression = trimTransferExpression(bankTransferMoney);
    const bankTransferTotal = sumTransferExpression(bankTransferMoney);

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

    setData((current) => ({
      ...current,
      closings: [report, ...current.closings].slice(0, 40),
    }));
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
        await exportClosingReportImage(pendingClosingExport, exportCaptureRef);
      } catch {
        if (!cancelled) {
          Alert.alert('Không xuất được ảnh báo ca', 'Dữ liệu đã được lưu nhưng ảnh báo cáo chưa tạo được.');
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

  const clearAllData = () => {
    Alert.alert('Xóa dữ liệu?', 'Thao tác này xóa dữ liệu trong phạm vi tài khoản hiện tại trên máy và Supabase.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setData(initialData);
          remoteSnapshotRef.current = JSON.stringify(initialData);
          clearRemoteAppData().catch((error) => {
            const message = error instanceof Error ? error.message : 'Không xóa được dữ liệu Supabase.';
            Alert.alert('Lỗi Supabase', message);
          });
        },
      },
    ]);
  };

  const signOut = () => {
    pendingSignupRef.current = null;
    setAuthFeedback(null);
    supabase.auth.signOut().catch((error) => {
      const message = error instanceof Error ? error.message : 'Không đăng xuất được.';
      Alert.alert('Lỗi đăng xuất', message);
    });
  };

  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={colors.background} style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
      >
        <View style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.brandLockup}>
              <View style={styles.brandMark}>
                <Image source={logoImage} style={styles.brandLogo} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandScript}>Cà phê</Text>
                <Text style={styles.appName}>ĐẠM</Text>
                <Text style={styles.appSubtitle}>{activeBranch.name}</Text>
              </View>
            </View>
            {currentRole === 'owner' ? (
              <Pressable
                accessibilityRole="button"
                onPress={clearAllData}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <RefreshCcw color={colors.muted} size={19} />
              </Pressable>
            ) : null}
          </View>

          {authFeedback?.tone === 'success' ? (
            <AuthFeedbackBanner feedback={authFeedback} onDismiss={() => setAuthFeedback(null)} />
          ) : null}

          <AccountContextBar
            authEmail={session.user.email ?? profile.email}
            branchId={selectedBranchId}
            profile={profile}
            syncing={syncingRemote}
            onSignOut={signOut}
          />

          <View style={styles.metricsRow}>
            <MetricTile
              icon={CalendarCheck2}
              label={currentRole === 'owner' ? 'Đã nhận lương' : currentRole === 'manager' ? 'NV đã gửi' : 'Giờ tháng'}
              value={formatNumber(attendanceMetric)}
              tone="teal"
            />
            <MetricTile icon={Beef} label="Báo đồ" value={ingredientMetric.toString()} tone="amber" />
            <MetricTile
              icon={currentRole === 'owner' ? Building2 : WalletCards}
              label={currentRole === 'owner' ? 'Chi nhánh' : 'Báo ca'}
              value={closingMetric.toString()}
              tone="blue"
            />
          </View>

          <View style={styles.tabs}>
            {tabItems.map((item) => {
              const Icon = item.icon;
              const selected = activeTab === item.key;

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={item.key}
                  onPress={() => setActiveTab(item.key)}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.tabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon color={selected ? colors.onDark : colors.muted} size={18} />
                  <Text style={[styles.tabText, selected && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            ref={contentScrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'attendance' && (
              currentRole === 'manager' ? (
                <ManagerAttendanceScreen
                  branch={activeBranch}
                  branchPayroll={branchPayrollConfirmation}
                  confirmedSheets={confirmedBranchSheets}
                  employeeName={signedEmployeeName}
                  monthKey={selectedMonthKey}
                  onCancelBranchPayroll={cancelBranchPayroll}
                  onConfirmBranchPayroll={confirmBranchPayroll}
                  onConfirmEmployeePayroll={confirmEmployeePayroll}
                  onMonthChange={setSelectedMonthKey}
                  onNameChange={setEmployeeName}
                  onUpdateCell={updateAttendanceCell}
                  pendingSheets={branchSheetsForMonth.filter((sheet) => !sheet.employeeConfirmedAt)}
                  sheet={employeeSheet}
                />
              ) : (
                <EmployeeAttendanceScreen
                  branch={activeBranch}
                  employeeName={employeeName}
                  monthKey={selectedMonthKey}
                  onConfirmPayroll={confirmEmployeePayroll}
                  onMonthChange={setSelectedMonthKey}
                  onNameChange={setEmployeeName}
                  onUpdateCell={updateAttendanceCell}
                  sheet={employeeSheet}
                />
              )
            )}

            {activeTab === 'ingredients' && (
              <IngredientScreen
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
                branchPayrolls={data.branchPayrolls}
                monthKey={selectedMonthKey}
                onBranchChange={setSelectedBranchId}
                onMonthChange={setSelectedMonthKey}
                sheets={data.attendanceSheets}
              />
            )}

            {activeTab === 'ownerIngredients' && (
              <OwnerIngredientReportsScreen
                branchId={selectedBranchId}
                monthKey={selectedMonthKey}
                onBranchChange={setSelectedBranchId}
                onMonthChange={setSelectedMonthKey}
                records={data.ingredients}
              />
            )}
          </ScrollView>

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
        <Text style={styles.loadingTitle}>Cà phê Đạm</Text>
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
          <Text style={styles.authTitle}>Cần cấu hình Supabase</Text>
          <Text style={styles.authHint}>
            Tạo file .env từ .env.example rồi điền các biến VITE_SUPABASE_* từ Supabase project settings.
          </Text>
          <Text style={styles.codeText}>database/supabase-schema.sql</Text>
          <Text style={styles.authHint}>
            Bật Email provider. Với app nội bộ không gửi email, tắt Confirm email rồi chạy SQL này trong Supabase SQL Editor.
          </Text>
        </View>
      </ScrollView>
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
      message: mode === 'signUp' ? 'Đang xác thực thông tin tài khoản...' : 'Đang kiểm tra thông tin đăng nhập...',
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
            message: 'Supabase đang yêu cầu xác nhận email trước khi đăng nhập. Để dùng nội bộ không gửi email, hãy tắt Confirm email trong Supabase Auth.',
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

      onAuthFeedbackChange({
        tone: 'success',
        title: 'Đăng nhập thành công',
        message: 'Đăng nhập thành công. Đang tải dữ liệu...',
      });
    } catch (error) {
      onSignupDraftChange(null);
      const message = error instanceof Error ? error.message : 'Không đăng nhập được.';
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
      : 'Đang xác thực...'
    : mode === 'signUp'
      ? 'Tạo tài khoản nhân viên'
      : 'Đăng nhập';
  const isSignIn = mode === 'signIn';

  return (
    <SafeAreaView style={[styles.safeArea, styles.authSafeArea]}>
      <StatusBar backgroundColor={colors.primary} style="light" />
      <KeyboardAvoidingView style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.authScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.authViewport, viewportWidth >= 560 && styles.authViewportWide]}>
            <View style={styles.authHero}>
              <View pointerEvents="none" style={styles.authHeroOrbLarge} />
              <View pointerEvents="none" style={styles.authHeroOrbSmall} />

              <View style={styles.authBrandRow}>
                <View style={styles.authHeroLogoFrame}>
                  <Image source={logoImage} style={styles.authHeroLogo} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.authHeroBrandName}>CÀ PHÊ ĐẠM</Text>
                  <Text style={styles.authHeroBrandMeta}>Ứng dụng vận hành nội bộ</Text>
                </View>
              </View>

              <View style={styles.authHeroCopy}>
                <View style={styles.authSystemPill}>
                  <View style={styles.authSystemDot} />
                  <Text style={styles.authSystemText}>Hệ thống đang hoạt động</Text>
                </View>
                <Text style={styles.authHeroTitle}>
                  {isSignIn ? 'Chào bạn,\nsẵn sàng vào ca?' : 'Bắt đầu cùng\nCà phê Đạm'}
                </Text>
                <Text style={styles.authHeroSubtitle}>
                  {isSignIn
                    ? 'Đăng nhập để chấm công, báo đồ và hoàn tất công việc trong ca.'
                    : 'Tạo tài khoản nhân viên và chọn đúng chi nhánh đang làm việc.'}
                </Text>
              </View>
            </View>

            <View style={styles.authSheet}>
              <View style={styles.authSheetHandle} />

              <View style={styles.authSheetHeader}>
                <View style={styles.flex}>
                  <Text style={styles.authSheetEyebrow}>{isSignIn ? 'ĐĂNG NHẬP NHANH' : 'TÀI KHOẢN MỚI'}</Text>
                  <Text style={styles.authSheetTitle}>{isSignIn ? 'Vào hệ thống' : 'Tạo tài khoản'}</Text>
                  <Text style={styles.authSheetHint}>
                    {isSignIn ? 'Dùng tài khoản được quán cấp.' : 'Chỉ dành cho nhân viên của quán.'}
                  </Text>
                </View>
                <View style={styles.authSheetIcon}>
                  <DoorClosed color={colors.primary} size={22} />
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
                  <Text style={styles.authSectionHint}>Chọn đúng chi nhánh để nhận dữ liệu ca làm việc.</Text>
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

              {isSignIn ? (
                <View style={styles.authSessionNote}>
                  <ShieldCheck color={colors.blue} size={18} />
                  <Text style={styles.authSessionNoteText}>
                    Phiên đăng nhập được ghi nhớ trên thiết bị này. Mật khẩu không được lưu dạng đọc được.
                  </Text>
                </View>
              ) : (
                <Text style={styles.authSignupNote}>
                  Tài khoản mới luôn có quyền Nhân viên. Quyền quản lí được cấp riêng sau đó.
                </Text>
              )}

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
            </View>

            <Text style={styles.authFooter}>Cà phê Đạm • Chỉ dành cho nhân sự được cấp quyền</Text>
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
          placeholderTextColor="#9B897C"
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

function AccountContextBar({
  authEmail,
  branchId,
  onSignOut,
  profile,
  syncing,
}: {
  authEmail: string;
  branchId: string;
  onSignOut: () => void;
  profile: UserProfile;
  syncing: boolean;
}) {
  const roleLabel = roleOptions.find((option) => option.key === profile.role)?.label ?? 'Nhân viên';
  const branch = profile.branchId ? getBranchById(profile.branchId) : getBranchById(branchId);
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
        message: 'Vui lòng nhập mật khẩu đang dùng để xác thực tài khoản.',
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
      message: 'Đang xác thực và cập nhật mật khẩu trên Supabase...',
    });

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
      });

      if (verifyError) {
        const isInvalidPassword = verifyError.message.toLowerCase().includes('invalid login credentials');
        throw new Error(isInvalidPassword ? 'Mật khẩu hiện tại không đúng.' : verifyError.message);
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
      const message = error instanceof Error ? error.message : 'Không cập nhật được mật khẩu.';
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
    <View style={styles.contextPanel}>
      <View style={styles.accountRow}>
        <View style={styles.accountIcon}>
          <ShieldCheck color={colors.primary} size={20} />
        </View>
        <View style={styles.accountDetails}>
          <Text style={styles.accountName}>{profile.fullName || profile.email}</Text>
          <Text style={styles.accountMeta}>
            {roleLabel}
            {profile.role !== 'owner' ? ` - ${branch.name}` : ' - Toàn hệ thống'}
          </Text>
          <Text style={styles.accountSync}>{syncing ? 'Đang đồng bộ Supabase...' : 'Đã kết nối Supabase'}</Text>
        </View>
        <View style={styles.accountActions}>
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
            <Text style={styles.passwordToggleText}>{showPasswordForm ? 'Đóng' : 'Đổi mật khẩu'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Đăng xuất</Text>
          </Pressable>
        </View>
      </View>

      {showPasswordForm ? (
        <View style={styles.passwordPanel}>
          <View style={styles.passwordPanelHeader}>
            <View style={styles.flex}>
              <Text style={styles.passwordPanelTitle}>Đổi mật khẩu</Text>
              <Text style={styles.passwordPanelHint}>
                Mật khẩu được cập nhật trên Supabase và không được lưu dạng đọc được trong ứng dụng.
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
  return (
    <View style={styles.monthNavigator}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(shiftMonthKey(monthKey, -1))}
        style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
      >
        <ChevronLeft color={colors.primary} size={18} />
      </Pressable>
      <View style={styles.monthCurrent}>
        <CalendarDays color={colors.primary} size={18} />
        <Text style={styles.monthCurrentText}>{formatMonthKey(monthKey)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(shiftMonthKey(monthKey, 1))}
        style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
      >
        <ChevronRight color={colors.primary} size={18} />
      </Pressable>
    </View>
  );
}

function EmployeeAttendanceScreen({
  branch,
  employeeName,
  monthKey,
  onConfirmPayroll,
  onMonthChange,
  onNameChange,
  onUpdateCell,
  sheet,
}: {
  branch: Branch;
  employeeName: string;
  monthKey: string;
  onConfirmPayroll: (employeeName: string) => void;
  onMonthChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onUpdateCell: (employeeName: string, dayKey: string, field: keyof AttendanceDayEntry, value: string) => void;
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
      <AttendanceNotice editable={editable} monthKey={monthKey} sheet={sheet} />
      <AttendanceSheetTable
        editable={editable}
        employeeName={trimmedName}
        monthKey={monthKey}
        onUpdateCell={onUpdateCell}
        sheet={sheet}
      />
      <PayrollSummary payroll={payroll} />
      {sheet?.employeeConfirmedAt ? (
        <StatusPanel
          icon={CheckCircle2}
          title="Đã xác nhận bảng lương"
          text={`Quản lí chi nhánh sẽ nhìn thấy bảng lương này từ ${formatDateTime(sheet.employeeConfirmedAt)}.`}
          tone="success"
        />
      ) : (
        <PrimaryButton
          icon={CheckCheck}
          label="Xác nhận bảng lương"
          onPress={() => onConfirmPayroll(trimmedName)}
          tone="primary"
        />
      )}
    </View>
  );
}

function ManagerAttendanceScreen({
  branch,
  branchPayroll,
  confirmedSheets,
  employeeName,
  monthKey,
  onCancelBranchPayroll,
  onConfirmBranchPayroll,
  onConfirmEmployeePayroll,
  onMonthChange,
  onNameChange,
  onUpdateCell,
  pendingSheets,
  sheet,
}: {
  branch: Branch;
  branchPayroll?: BranchPayrollConfirmation;
  confirmedSheets: AttendanceSheet[];
  employeeName: string;
  monthKey: string;
  onCancelBranchPayroll: () => void;
  onConfirmBranchPayroll: () => void;
  onConfirmEmployeePayroll: (employeeName: string) => void;
  onMonthChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onUpdateCell: (employeeName: string, dayKey: string, field: keyof AttendanceDayEntry, value: string) => void;
  pendingSheets: AttendanceSheet[];
  sheet?: AttendanceSheet;
}) {
  const editable = isCurrentMonth(monthKey) && !sheet?.employeeConfirmedAt;
  const branchPayrollTotal = calculateBranchPayroll(confirmedSheets);
  const locked = isManagerCancelLocked(monthKey);

  return (
    <View style={styles.screen}>
      <SectionTitle icon={UsersRound} title="Chấm công quản lí" subtitle={branch.name} />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />
      <FormField
        icon={UserCog}
        label="Tên quản lí"
        onChangeText={onNameChange}
        placeholder={`Quản lí ${branch.area}`}
        value={employeeName.startsWith('Quản lí ') ? '' : employeeName}
      />
      <AttendanceNotice editable={editable} monthKey={monthKey} sheet={sheet} />
      <AttendanceSheetTable
        editable={editable}
        employeeName={employeeName}
        monthKey={monthKey}
        onUpdateCell={onUpdateCell}
        sheet={sheet}
      />
      <PayrollSummary payroll={calculatePayroll(sheet)} />
      {sheet?.employeeConfirmedAt ? null : (
        <PrimaryButton
          icon={CheckCheck}
          label="Xác nhận lương quản lí"
          onPress={() => onConfirmEmployeePayroll(employeeName)}
          tone="primary"
        />
      )}

      <View style={styles.managerPanel}>
        <SectionTitle icon={ClipboardCheck} title="Tổng hợp nhân viên" subtitle="Chỉ hiện bảng lương nhân viên đã xác nhận" />
        <PayrollAggregateSummary aggregate={branchPayrollTotal} />

        <HistoryList emptyText="Chưa có nhân viên xác nhận bảng lương." icon={History} title="Bảng lương đã nhận">
          {confirmedSheets.map((confirmedSheet) => {
            const payroll = calculatePayroll(confirmedSheet);

            return (
              <HistoryRow
                key={confirmedSheet.id}
                meta={`Đã xác nhận: ${formatDateTime(confirmedSheet.employeeConfirmedAt ?? confirmedSheet.id)}`}
                title={confirmedSheet.employeeName}
                value={`${formatNumber(payroll.totalHours)} giờ - ${formatCurrency(payroll.totalMoney)}`}
              />
            );
          })}
        </HistoryList>

        {pendingSheets.length > 0 ? (
          <Text style={styles.pendingText}>
            {pendingSheets.length} bảng công chưa được gửi vì nhân viên chưa xác nhận bảng lương.
          </Text>
        ) : null}

        {branchPayroll?.managerConfirmedAt ? (
          <>
            <StatusPanel
              icon={branchPayroll.autoConfirmed ? CalendarCheck2 : CheckCircle2}
              title={branchPayroll.autoConfirmed ? 'Hệ thống đã tự xác nhận' : 'Đã gửi chủ cửa hàng'}
              text={`${branchPayroll.managerName ?? 'Quản lí'} xác nhận lúc ${formatDateTime(branchPayroll.managerConfirmedAt)}.`}
              tone="success"
            />
            <PrimaryButton
              icon={XCircle}
              label={locked ? 'Đã khóa hủy xác nhận' : 'Hủy xác nhận để chỉnh sửa'}
              onPress={onCancelBranchPayroll}
              tone="danger"
            />
          </>
        ) : (
          <PrimaryButton
            icon={ShieldCheck}
            label="Xác nhận gửi chủ cửa hàng"
            onPress={onConfirmBranchPayroll}
            tone="primary"
          />
        )}
      </View>
    </View>
  );
}

function AttendanceNotice({
  editable,
  monthKey,
  sheet,
}: {
  editable: boolean;
  monthKey: string;
  sheet?: AttendanceSheet;
}) {
  if (sheet?.employeeConfirmedAt) {
    return (
      <StatusPanel
        icon={CheckCircle2}
        title="Bảng lương đã khóa ở nhân viên"
        text="Sau khi xác nhận, dữ liệu được gửi lên màn hình tổng hợp của quản lí chi nhánh."
        tone="success"
      />
    );
  }

  if (!isCurrentMonth(monthKey)) {
    return (
      <StatusPanel
        icon={CalendarDays}
        title="Chế độ xem lại"
        text="Nhân viên chỉ chấm công trong tháng hiện tại; các tháng khác chỉ dùng để xem dữ liệu đã lưu."
        tone="neutral"
      />
    );
  }

  return (
    <StatusPanel
      icon={editable ? Clock3 : UserRound}
      title={editable ? 'Đang mở chấm công' : 'Cần nhập tên nhân viên'}
      text={editable ? 'Nhập số giờ theo từng ngày, ca sáng và ca chiều.' : 'Tên nhân viên là khóa để lưu bảng công theo tháng.'}
      tone={editable ? 'success' : 'neutral'}
    />
  );
}

function AttendanceSheetTable({
  editable,
  employeeName,
  monthKey,
  onUpdateCell,
  sheet,
}: {
  editable: boolean;
  employeeName: string;
  monthKey: string;
  onUpdateCell: (employeeName: string, dayKey: string, field: keyof AttendanceDayEntry, value: string) => void;
  sheet?: AttendanceSheet;
}) {
  const days = Array.from({ length: getDaysInMonth(monthKey) }, (_, index) => index + 1);

  return (
    <View style={styles.attendanceTable}>
      <View style={[styles.attendanceRow, styles.attendanceHeaderRow]}>
        <Text style={[styles.attendanceCell, styles.attendanceDateCell]}>Ngày</Text>
        <Text style={[styles.attendanceCell, styles.attendanceWeekdayCell]}>Thứ</Text>
        <Text style={styles.attendanceCell}>Ca sáng</Text>
        <Text style={styles.attendanceCell}>Ca chiều</Text>
      </View>
      {days.map((day) => {
        const dayKey = getAttendanceDayKey(monthKey, day);
        const value = sheet?.days[dayKey] ?? { morning: '', afternoon: '' };

        return (
          <View key={dayKey} style={styles.attendanceRow}>
            <Text style={[styles.attendanceCell, styles.attendanceDateCell]}>{String(day).padStart(2, '0')}</Text>
            <Text style={[styles.attendanceCell, styles.attendanceWeekdayCell]}>{getWeekdayLabel(monthKey, day)}</Text>
            <TextInput
              editable={editable}
              keyboardType={decimalKeyboard}
              onChangeText={(inputValue) => onUpdateCell(employeeName, dayKey, 'morning', inputValue)}
              placeholder="0"
              placeholderTextColor="#9A806B"
              style={[styles.attendanceInput, !editable && styles.attendanceInputReadonly]}
              value={value.morning}
            />
            <TextInput
              editable={editable}
              keyboardType={decimalKeyboard}
              onChangeText={(inputValue) => onUpdateCell(employeeName, dayKey, 'afternoon', inputValue)}
              placeholder="0"
              placeholderTextColor="#9A806B"
              style={[styles.attendanceInput, !editable && styles.attendanceInputReadonly]}
              value={value.afternoon}
            />
          </View>
        );
      })}
    </View>
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
  branchPayrolls,
  monthKey,
  onBranchChange,
  onMonthChange,
  sheets,
}: {
  branchId: string;
  branchPayrolls: BranchPayrollConfirmation[];
  monthKey: string;
  onBranchChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  sheets: AttendanceSheet[];
}) {
  const selectedBranch = getBranchById(branchId);
  const branchPayroll = getBranchPayrollConfirmation(branchPayrolls, branchId, monthKey);
  const confirmedSheets = sheets.filter(
    (sheet) => sheet.branchId === branchId && sheet.monthKey === monthKey && sheet.employeeConfirmedAt,
  );
  const aggregate = calculateBranchPayroll(confirmedSheets);
  const received = Boolean(branchPayroll?.managerConfirmedAt);

  return (
    <View style={styles.screen}>
      <SectionTitle icon={WalletCards} title="Bảng lương" subtitle="Chủ cửa hàng xem theo chi nhánh và tháng" />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />
      <OwnerBranchList
        branchId={branchId}
        getMeta={(branch) => {
          const confirmation = getBranchPayrollConfirmation(branchPayrolls, branch.id, monthKey);

          return confirmation?.managerConfirmedAt
            ? `Đã nhận ${confirmation.autoConfirmed ? 'tự động' : 'từ quản lí'}`
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
              title="Bảng lương đã sẵn sàng"
              text={`Nhận lúc ${formatDateTime(branchPayroll?.managerConfirmedAt ?? new Date().toISOString())}.`}
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
            text="Chủ cửa hàng chỉ thấy bảng lương sau khi quản lí chi nhánh xác nhận hoặc hệ thống tự xác nhận trước ngày cuối tháng một ngày."
            tone="neutral"
          />
        )}
      </View>
    </View>
  );
}

function OwnerIngredientReportsScreen({
  branchId,
  monthKey,
  onBranchChange,
  onMonthChange,
  records,
}: {
  branchId: string;
  monthKey: string;
  onBranchChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  records: IngredientReport[];
}) {
  const selectedBranch = getBranchById(branchId);
  const branchRecords = records.filter(
    (report) => getReportBranchId(report) === branchId && isReportInMonth(report.timestamp, monthKey),
  );

  return (
    <View style={styles.screen}>
      <SectionTitle icon={ClipboardList} title="Báo đồ chi nhánh" subtitle="Chủ cửa hàng xem báo đồ theo chi nhánh" />
      <MonthNavigator monthKey={monthKey} onChange={onMonthChange} />
      <OwnerBranchList
        branchId={branchId}
        getMeta={(branch) => {
          const count = records.filter(
            (report) => getReportBranchId(report) === branch.id && isReportInMonth(report.timestamp, monthKey),
          ).length;

          return `${count} báo đồ trong tháng`;
        }}
        onBranchChange={onBranchChange}
      />

      <HistoryList emptyText="Chi nhánh này chưa có báo đồ trong tháng đã chọn." icon={ClipboardList} title={selectedBranch.name}>
        {branchRecords.slice(0, 20).map((report) => (
          <HistoryRow
            key={report.id}
            meta={`${formatDateTime(report.timestamp)}${report.reporterName ? ` - ${report.reporterName}` : ''}`}
            title={report.items?.length ? 'Báo đồ' : report.itemName ?? 'Báo đồ'}
            value={formatSupplyReportSummary(report)}
          />
        ))}
      </HistoryList>
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

const formatSupplyReportSummary = (report: IngredientReport) => {
  if (report.items?.length) {
    const filledItems = report.items.filter((item) => item.status === 'empty' || item.quantity.trim());

    if (filledItems.length === 0) {
      return 'Chưa nhập số lượng, tất cả trạng thái còn';
    }

    const summary = filledItems.slice(0, 4).map(formatSupplyItemValue).join(' - ');
    const remainingCount = filledItems.length - 4;

    return remainingCount > 0 ? `${summary} - thêm ${remainingCount} món` : summary;
  }

  return `Dùng ${formatNumber(report.used ?? 0)} ${report.unit ?? ''} - tồn ${formatNumber(report.currentStock ?? 0)} ${report.unit ?? ''}`;
};

function IngredientScreen({
  note,
  onNoteChange,
  onRowChange,
  onSave,
  records,
  rows,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onRowChange: (key: string, patch: Partial<SupplyItemInput>) => void;
  onSave: () => void;
  records: IngredientReport[];
  rows: Record<string, SupplyItemInput>;
}) {
  const quantityItems = supplyItems.filter((item) => item.kind === 'quantity');
  const statusItems = supplyItems.filter((item) => item.kind === 'status');

  return (
    <View style={styles.screen}>
      <SectionTitle icon={PackageCheck} title="Báo đồ" subtitle="Số lượng và tình trạng còn/hết" />

      <View style={styles.supplySection}>
        <Text style={styles.supplySectionTitle}>Có số lượng</Text>
        {quantityItems.map((item) => (
          <SupplyItemRow
            item={item}
            key={item.key}
            onChange={(patch) => onRowChange(item.key, patch)}
            value={rows[item.key] ?? { quantity: '', status: 'available' }}
          />
        ))}
      </View>

      <View style={styles.supplySection}>
        <Text style={styles.supplySectionTitle}>Chỉ trạng thái</Text>
        {statusItems.map((item) => (
          <SupplyItemRow
            item={item}
            key={item.key}
            onChange={(patch) => onRowChange(item.key, patch)}
            value={rows[item.key] ?? { quantity: '', status: 'available' }}
          />
        ))}
      </View>

      <FormField
        label="Ghi chú"
        multiline
        onChangeText={onNoteChange}
        placeholder="Ví dụ: hàng sắp hết, nguyên liệu lỗi, cần nhập thêm..."
        value={note}
      />

      <PrimaryButton icon={Save} label="Lưu báo đồ" onPress={onSave} tone="primary" />

      <HistoryList
        emptyText="Chưa có báo đồ."
        icon={ClipboardList}
        title="Báo đồ gần đây"
      >
        {records.slice(0, 8).map((report) => (
          <HistoryRow
            key={report.id}
            meta={formatDateTime(report.timestamp)}
            title={report.items?.length ? 'Báo đồ' : report.itemName ?? 'Báo đồ'}
            value={formatSupplyReportSummary(report)}
          />
        ))}
      </HistoryList>
    </View>
  );
}

function SupplyItemRow({
  item,
  onChange,
  value,
}: {
  item: SupplyItemConfig;
  onChange: (patch: Partial<SupplyItemInput>) => void;
  value: SupplyItemInput;
}) {
  const isEmpty = value.status === 'empty';

  return (
    <View style={styles.supplyItemRow}>
      <View style={styles.supplyItemHeader}>
        <View style={styles.flex}>
          <Text style={styles.supplyItemName}>{item.label}</Text>
          {item.unit ? <Text style={styles.supplyItemUnit}>Đơn vị: {item.unit}</Text> : null}
        </View>

        {item.kind === 'quantity' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange({ status: isEmpty ? 'available' : 'empty' })}
            style={({ pressed }) => [
              styles.supplyStatusButton,
              isEmpty && styles.supplyStatusButtonEmpty,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.supplyStatusButtonText, isEmpty && styles.supplyStatusButtonTextEmpty]}>Hết</Text>
          </Pressable>
        ) : (
          <SupplyStatusSwitch status={value.status} onChange={(status) => onChange({ status })} />
        )}
      </View>

      {item.kind === 'quantity' ? (
        <View style={styles.supplyQuantityRow}>
          <TextInput
            keyboardType={numericKeyboard}
            onChangeText={(inputValue) => onChange({ quantity: sanitizeDigits(inputValue) })}
            placeholder="0"
            placeholderTextColor="#9A806B"
            style={styles.supplyQuantityInput}
            value={value.quantity}
          />
          <Text style={styles.supplyQuantityUnit}>{item.unit}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SupplyStatusSwitch({
  onChange,
  status,
}: {
  onChange: (status: SupplyItemStatus) => void;
  status: SupplyItemStatus;
}) {
  return (
    <View style={styles.supplyStatusSwitch}>
      {(['available', 'empty'] as SupplyItemStatus[]).map((itemStatus) => {
        const active = status === itemStatus;

        return (
          <Pressable
            accessibilityRole="button"
            key={itemStatus}
            onPress={() => onChange(itemStatus)}
            style={({ pressed }) => [
              styles.supplyStatusOption,
              active && styles.supplyStatusOptionActive,
              itemStatus === 'empty' && active && styles.supplyStatusOptionEmpty,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.supplyStatusOptionText,
                active && styles.supplyStatusOptionTextActive,
                itemStatus === 'empty' && active && styles.supplyStatusOptionTextEmpty,
              ]}
            >
              {itemStatus === 'available' ? 'Còn' : 'Hết'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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

      <View style={styles.requiredNotice}>
        <Text style={styles.requiredNoticeText}>Lưu ý: Ô có dấu * là thông tin chính, có thể để trống nếu chưa có dữ liệu.</Text>
      </View>

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

      <PrimaryButton icon={Save} label="Gửi báo ca" onPress={onSave} tone="primary" />

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

function MetricTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  tone: 'teal' | 'amber' | 'blue';
  value: string;
}) {
  const toneStyle = {
    teal: { backgroundColor: colors.primarySoft, borderColor: colors.lineStrong, color: colors.primary },
    amber: { backgroundColor: colors.amberSoft, borderColor: '#E2B889', color: colors.amber },
    blue: { backgroundColor: colors.blueSoft, borderColor: '#B8C7AE', color: colors.blue },
  }[tone];

  return (
    <View style={[styles.metricTile, { borderColor: toneStyle.borderColor }]}>
      <View style={[styles.metricAccent, { backgroundColor: toneStyle.color }]} />
      <View style={[styles.metricIcon, { backgroundColor: toneStyle.backgroundColor }]}>
        <Icon color={toneStyle.color} size={18} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({
  icon: Icon,
  subtitle,
  title,
}: {
  icon: typeof Clock3;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Icon color={colors.primary} size={21} />
      </View>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function FormField({
  icon: Icon,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  keyboardType,
  label,
  multiline,
  onChangeText,
  placeholder,
  secureTextEntry,
  textContentType,
  trailingAction,
  value,
}: {
  icon?: typeof Clock3;
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  trailingAction?: {
    icon: typeof Clock3;
    label: string;
    onPress: () => void;
  };
  value: string;
}) {
  const TrailingIcon = trailingAction?.icon;

  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputShell, multiline && styles.inputShellMultiline]}>
        {Icon ? <Icon color={colors.muted} size={18} /> : null}
        <TextInput
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9A806B"
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.inputMultiline]}
          textContentType={textContentType}
          value={value}
        />
        {TrailingIcon && trailingAction ? (
          <Pressable
            accessibilityLabel={trailingAction.label}
            accessibilityRole="button"
            onPress={trailingAction.onPress}
            style={({ pressed }) => [styles.inputTrailingButton, pressed && styles.pressed]}
          >
            <TrailingIcon color={colors.muted} size={18} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ClosingFormField({
  error,
  label,
  numeric = true,
  onChangeText,
  required,
  suffix,
  value,
}: {
  error?: boolean;
  label: string;
  numeric?: boolean;
  onChangeText: (value: string) => void;
  required?: boolean;
  suffix?: string;
  value: string;
}) {
  return (
    <View style={[styles.closingCard, error && styles.closingCardError]}>
      <Text style={styles.closingLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <TextInput
        keyboardType={numeric ? numericKeyboard : 'default'}
        multiline
        onChangeText={(inputValue) => onChangeText(numeric ? sanitizeDigits(inputValue) : inputValue)}
        placeholderTextColor="#9A806B"
        style={[styles.closingInput, error && styles.closingInputError]}
        textAlignVertical="top"
        value={value}
      />
      {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
    </View>
  );
}

function TransferSumField({
  label,
  onChangeText,
  total,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  total: number;
  value: string;
}) {
  return (
    <View style={styles.closingCard}>
      <Text style={styles.closingLabel}>{label}</Text>
      <TextInput
        keyboardType={transferKeyboard}
        onChangeText={onChangeText}
        placeholderTextColor="#9A806B"
        style={styles.closingInput}
        value={value}
      />
      <Text style={styles.transferTotal}>Tổng: {formatNumber(total)}</Text>
    </View>
  );
}

function PrimaryButton({
  icon: Icon,
  label,
  onPress,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  onPress: () => void;
  tone: 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        tone === 'danger' && styles.dangerButton,
        pressed && styles.pressed,
      ]}
    >
      <Icon color={colors.onDark} size={19} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function ChipGroup({
  compact,
  items,
  onSelect,
  selected,
}: {
  compact?: boolean;
  items: string[];
  onSelect: (value: string) => void;
  selected: string;
}) {
  return (
    <View style={[styles.chipGroup, compact && styles.chipGroupCompact]}>
      {items.map((item) => {
        const active = selected === item;

        return (
          <Pressable
            accessibilityRole="button"
            key={item}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.chip,
              compact && styles.chipCompact,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HistoryList({
  children,
  emptyText,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  emptyText: string;
  icon: typeof Clock3;
  title: string;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <View style={styles.history}>
      <View style={styles.historyHeader}>
        <Icon color={colors.ink} size={18} />
        <Text style={styles.historyTitle}>{title}</Text>
      </View>
      {hasChildren ? children : <Text style={styles.emptyText}>{emptyText}</Text>}
    </View>
  );
}

function HistoryRow({
  meta,
  onPress,
  title,
  value,
}: {
  meta?: string;
  onPress?: () => void;
  title: string;
  value: string;
}) {
  const content = (
    <>
      <View style={styles.flex}>
        <Text style={styles.historyRowTitle}>{title}</Text>
        {meta ? <Text style={styles.historyRowMeta}>{meta}</Text> : null}
        <Text style={styles.historyRowValue}>{value}</Text>
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.historyRow}>
      {content}
    </View>
  );
}

function isToday(value: string) {
  const inputDate = new Date(value);
  const today = new Date();

  return (
    inputDate.getFullYear() === today.getFullYear() &&
    inputDate.getMonth() === today.getMonth() &&
    inputDate.getDate() === today.getDate()
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authSafeArea: {
    backgroundColor: '#2D160F',
  },
  keyboardView: {
    flex: 1,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 252, 247, 0.94)',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  brandLockup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.lineStrong,
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    width: 56,
  },
  brandLogo: {
    borderRadius: 6,
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandScript: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 15,
  },
  appName: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  appSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    width: 42,
  },
  pressed: {
    opacity: 0.72,
  },
  centerScreen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    borderRadius: 8,
    height: 72,
    marginBottom: 14,
    width: 72,
  },
  loadingTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 8,
    textAlign: 'center',
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
  },
  authScrollContent: {
    flexGrow: 1,
    backgroundColor: '#2D160F',
  },
  authViewport: {
    flexGrow: 1,
    backgroundColor: '#2D160F',
    width: '100%',
  },
  authViewportWide: {
    alignSelf: 'center',
    shadowColor: '#160A06',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 36,
    width: 480,
  },
  authHero: {
    backgroundColor: '#4B281B',
    minHeight: 312,
    overflow: 'hidden',
    paddingBottom: 64,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  authHeroOrbLarge: {
    backgroundColor: 'rgba(231, 182, 64, 0.12)',
    borderColor: 'rgba(255, 248, 238, 0.09)',
    borderRadius: 140,
    borderWidth: 1,
    height: 280,
    position: 'absolute',
    right: -116,
    top: -118,
    width: 280,
  },
  authHeroOrbSmall: {
    backgroundColor: 'rgba(185, 120, 73, 0.22)',
    borderRadius: 72,
    bottom: 24,
    height: 144,
    position: 'absolute',
    right: -50,
    width: 144,
  },
  authBrandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  authHeroLogoFrame: {
    backgroundColor: colors.surfaceStrong,
    borderColor: 'rgba(255, 248, 238, 0.42)',
    borderRadius: 17,
    borderWidth: 1,
    height: 58,
    overflow: 'hidden',
    padding: 3,
    shadowColor: '#180B07',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    width: 58,
  },
  authHeroLogo: {
    borderRadius: 14,
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  authHeroBrandName: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
    lineHeight: 19,
  },
  authHeroBrandMeta: {
    color: 'rgba(255, 248, 238, 0.68)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  authHeroCopy: {
    marginTop: 38,
    maxWidth: 340,
  },
  authSystemPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 248, 238, 0.1)',
    borderColor: 'rgba(255, 248, 238, 0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 11,
  },
  authSystemDot: {
    backgroundColor: '#A9D18E',
    borderRadius: 999,
    height: 7,
    shadowColor: '#A9D18E',
    shadowOpacity: 0.7,
    shadowRadius: 5,
    width: 7,
  },
  authSystemText: {
    color: colors.onDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  authHeroTitle: {
    color: colors.onDark,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 39,
    marginTop: 14,
  },
  authHeroSubtitle: {
    color: 'rgba(255, 248, 238, 0.72)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 330,
  },
  authSheet: {
    backgroundColor: colors.surfaceStrong,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    gap: 18,
    marginTop: -32,
    minHeight: 500,
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  authSheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.lineStrong,
    borderRadius: 999,
    height: 4,
    marginBottom: 2,
    width: 42,
  },
  authSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  authSheetEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  authSheetTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginTop: 2,
  },
  authSheetHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  authSheetIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 15,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  authFields: {
    gap: 15,
  },
  authField: {
    gap: 7,
  },
  authFieldLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  authFieldLabelFocused: {
    color: colors.primary,
  },
  authFieldShell: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: colors.lineStrong,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 9,
  },
  authFieldShellFocused: {
    backgroundColor: '#FFFEFB',
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 9,
  },
  authFieldIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  authFieldIconFocused: {
    backgroundColor: colors.primarySoft,
  },
  authFieldInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  authFieldTrailing: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  authBranchSection: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  authSectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  authSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  authSectionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 3,
  },
  authPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingLeft: 20,
    paddingRight: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  authPrimaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  authPrimaryButtonDisabled: {
    opacity: 0.58,
  },
  authPrimaryButtonText: {
    color: colors.onDark,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  authPrimaryButtonIcon: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  authSessionNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.blueSoft,
    borderColor: 'rgba(97, 112, 85, 0.18)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
  authSessionNoteText: {
    color: '#485641',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  authSignupNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  authSwitchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    minHeight: 44,
  },
  authSwitchPrompt: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  authSwitchButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 7,
  },
  authSwitchButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  authFeedback: {
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  authFeedbackSuccess: {
    backgroundColor: colors.blueSoft,
    borderColor: 'rgba(72, 104, 69, 0.26)',
  },
  authFeedbackError: {
    backgroundColor: colors.roseSoft,
    borderColor: 'rgba(180, 72, 60, 0.28)',
  },
  authFeedbackInfo: {
    backgroundColor: colors.amberSoft,
    borderColor: 'rgba(185, 101, 36, 0.28)',
  },
  authFeedbackTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  authFeedbackMessage: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  authFeedbackDismiss: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginTop: -4,
    width: 26,
  },
  authFooter: {
    color: 'rgba(255, 248, 238, 0.58)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 17,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 4,
  },
  authLogo: {
    alignSelf: 'center',
    borderRadius: 8,
    height: 74,
    width: 74,
  },
  authTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  authHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
    textAlign: 'center',
  },
  codeText: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    textAlign: 'center',
  },
  accountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accountDetails: {
    flex: 1,
    minWidth: 170,
  },
  accountActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  accountIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  accountName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  accountMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  accountSync: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 3,
  },
  passwordToggleButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  passwordToggleText: {
    color: colors.onDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  signOutText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  passwordPanel: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 12,
    marginTop: 2,
    paddingTop: 12,
  },
  passwordPanelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  passwordPanelTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  passwordPanelHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 3,
  },
  passwordActionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  passwordCancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  passwordCancelText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  passwordSaveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  passwordSaveText: {
    color: colors.onDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  contextPanel: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  contextLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  roleGrid: {
    gap: 8,
  },
  roleOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  roleOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleOptionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  roleOptionTitleActive: {
    color: colors.onDark,
  },
  roleOptionText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
  roleOptionTextActive: {
    color: colors.onDark,
  },
  branchPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  branchPill: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '48%',
  },
  branchPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  branchPillName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  branchPillNameActive: {
    color: colors.onDark,
  },
  branchPillMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  branchPillMetaActive: {
    color: colors.onDark,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricTile: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    overflow: 'hidden',
    padding: 10,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  metricAccent: {
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  metricIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    marginBottom: 8,
    width: 32,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  tabs: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tabTextActive: {
    color: colors.onDark,
  },
  content: {
    paddingBottom: 28,
  },
  screen: {
    gap: 14,
  },
  closingForm: {
    gap: 12,
  },
  closingSection: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldGroupTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2,
  },
  plasticCupSection: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  closingSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  closingSectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cupEntry: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  cupEquationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  cupName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    minWidth: 50,
  },
  cupEquationInput: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 7,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    height: 38,
    letterSpacing: 0,
    paddingHorizontal: 6,
    paddingVertical: 0,
    textAlign: 'center',
    width: 54,
  },
  inputError: {
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
  },
  equationMark: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  soldEquationValue: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 7,
    flexDirection: 'row',
    gap: 3,
    minHeight: 38,
    paddingHorizontal: 7,
  },
  soldEquationNumber: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  equationUnit: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cupBalanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  machineCupGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  machineCupLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cupBalanceBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.lineStrong,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 92,
    paddingHorizontal: 10,
  },
  cupBalanceBadgeShort: {
    backgroundColor: colors.roseSoft,
    borderColor: '#D79A91',
  },
  cupBalanceBadgeOver: {
    backgroundColor: colors.amberSoft,
    borderColor: '#E2B889',
  },
  cupBalanceText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cupBalanceTextShort: {
    color: colors.rose,
  },
  cupBalanceTextOver: {
    color: colors.amber,
  },
  closingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  closingCardError: {
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
  },
  requiredNotice: {
    alignItems: 'center',
    backgroundColor: colors.amberSoft,
    borderColor: '#E2B889',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requiredNoticeText: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  closingLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  requiredMark: {
    color: colors.rose,
  },
  closingInput: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 44,
    paddingBottom: 5,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  closingInputError: {
    borderBottomColor: colors.rose,
  },
  inputSuffix: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -6,
  },
  transferTotal: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: -4,
  },
  exportStage: {
    left: -5000,
    position: 'absolute',
    top: 0,
    width: 252,
  },
  exportSheet: {
    backgroundColor: colors.background,
    paddingBottom: 18,
    paddingHorizontal: 11,
    paddingTop: 14,
    width: 252,
  },
  exportPreview: {
    gap: 11,
  },
  exportCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 16,
  },
  exportCardTitle: {
    color: colors.ink,
    fontSize: 11.2,
    fontWeight: '800',
    letterSpacing: 0,
  },
  exportRequired: {
    color: colors.rose,
  },
  exportLines: {
    gap: 2,
  },
  exportLine: {
    color: colors.ink,
    fontSize: 8.8,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 17,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    borderColor: colors.line,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 1,
  },
  statusBand: {
    alignItems: 'center',
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  statusIn: {
    backgroundColor: colors.primarySoft,
  },
  statusOut: {
    backgroundColor: colors.roseSoft,
  },
  statusNeutral: {
    backgroundColor: colors.surfaceStrong,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  statusTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
  flex: {
    flex: 1,
  },
  field: {
    gap: 7,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputShellMultiline: {
    alignItems: 'flex-start',
    minHeight: 88,
    paddingTop: 11,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    paddingVertical: 0,
  },
  inputTrailingButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthNavigator: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 8,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 42,
  },
  monthCurrent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  monthCurrentText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  attendanceTable: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  attendanceRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
  },
  attendanceHeaderRow: {
    backgroundColor: colors.amberSoft,
  },
  attendanceCell: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  attendanceDateCell: {
    flex: 0.7,
  },
  attendanceWeekdayCell: {
    flex: 0.9,
  },
  attendanceInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 7,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    marginHorizontal: 5,
    minHeight: 34,
    paddingHorizontal: 7,
    paddingVertical: 0,
    textAlign: 'center',
  },
  attendanceInputReadonly: {
    backgroundColor: colors.surfaceSoft,
    color: colors.muted,
  },
  payrollSummary: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryLine: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  summaryLineStrong: {
    backgroundColor: colors.gold,
  },
  summaryLineLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  summaryLineLabelStrong: {
    color: colors.dark,
    fontWeight: '900',
  },
  summaryLineValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  summaryLineValueStrong: {
    color: colors.dark,
  },
  managerPanel: {
    gap: 12,
    marginTop: 8,
  },
  pendingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  ownerBranchList: {
    gap: 8,
  },
  ownerBranchRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ownerBranchRowActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ownerBranchIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  ownerBranchName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  ownerBranchNameActive: {
    color: colors.onDark,
  },
  ownerBranchMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  ownerBranchMetaActive: {
    color: colors.onDark,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  dangerButton: {
    backgroundColor: colors.rose,
  },
  primaryButtonText: {
    color: colors.onDark,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipGroupCompact: {
    marginTop: -4,
  },
  chip: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipCompact: {
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  chipTextActive: {
    color: colors.onDark,
  },
  supplySection: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  supplySectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  supplyItemRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 10,
  },
  supplyItemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  supplyItemName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  supplyItemUnit: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  supplyQuantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  supplyQuantityInput: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 7,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  supplyQuantityUnit: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    minWidth: 48,
  },
  supplyStatusButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    minWidth: 64,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  supplyStatusButtonEmpty: {
    backgroundColor: colors.roseSoft,
    borderColor: '#D79A91',
  },
  supplyStatusButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  supplyStatusButtonTextEmpty: {
    color: colors.rose,
  },
  supplyStatusSwitch: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  supplyStatusOption: {
    alignItems: 'center',
    borderRadius: 999,
    minHeight: 30,
    minWidth: 52,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  supplyStatusOptionActive: {
    backgroundColor: colors.primary,
  },
  supplyStatusOptionEmpty: {
    backgroundColor: colors.rose,
  },
  supplyStatusOptionText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  supplyStatusOptionTextActive: {
    color: colors.onDark,
  },
  supplyStatusOptionTextEmpty: {
    color: colors.onDark,
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  calculationBox: {
    alignItems: 'center',
    backgroundColor: colors.amberSoft,
    borderColor: '#E2B889',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  calculationLabel: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  calculationValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  closeSummary: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  summaryDivider: {
    backgroundColor: colors.line,
    height: 42,
    width: 1,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  history: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    overflow: 'hidden',
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  historyHeader: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 8,
    padding: 13,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 13,
  },
  historyRowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  historyRowMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  historyRowValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 4,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    padding: 14,
  },
});
