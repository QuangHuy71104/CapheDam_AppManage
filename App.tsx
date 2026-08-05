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
  Camera,
  CircleAlert,
  CheckCircle2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DoorClosed,
  Download,
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
  Smartphone,
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
type EmploymentType = 'full_time' | 'part_time';
type AuthFeedback = {
  tone: 'success' | 'error' | 'info';
  title: string;
  message: string;
};
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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
  phone: string;
  avatarUrl: string;
  employmentType: EmploymentType;
  startDate: string;
};

type PendingSignupDraft = {
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
};

const STORAGE_KEY = 'caphedam-appmanage-v1';
const PROFILE_OVERRIDE_PREFIX = 'caphedam-profile-override-';
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

const getWeekdayLabel = (monthKey: string, day: number) => {
  const { month, year } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
};

const isCurrentMonth = (monthKey: string) => monthKey === getMonthKey();
const isPastMonth = (monthKey: string) => monthKey < getMonthKey();
const isFutureMonth = (monthKey: string) => monthKey > getMonthKey();

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

const normalizeEmploymentType = (value: unknown, role: UserRole): EmploymentType =>
  value === 'full_time' || value === 'part_time' ? value : role === 'owner' ? 'full_time' : 'part_time';

const normalizeProfileDate = (value: unknown, fallback?: unknown) => {
  const candidate = typeof value === 'string' && value ? value : typeof fallback === 'string' ? fallback : '';
  const match = candidate.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
};

type EditableProfileOverride = Pick<UserProfile, 'avatarUrl' | 'fullName' | 'phone'>;

const readLocalProfileOverride = async (userId: string): Promise<Partial<EditableProfileOverride>> => {
  try {
    const rawValue = await webStorage.getItem(`${PROFILE_OVERRIDE_PREFIX}${userId}`);
    if (!rawValue) {
      return {};
    }
    const value = JSON.parse(rawValue) as Record<string, unknown>;
    return {
      avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
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

  return {
    ...profile,
    fullName: localValue.fullName ?? metadataName ?? profile.fullName,
    phone: localValue.phone ?? metadataPhone ?? profile.phone,
    avatarUrl: localValue.avatarUrl ?? metadataAvatar ?? profile.avatarUrl,
  };
};

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
    id: typeof row.id === 'string' && row.id ? row.id : user.id,
    email: normalizedEmail || normalizeEmailAddress(user.email ?? ''),
    fullName: typeof row.full_name === 'string' ? row.full_name : '',
    role,
    branchId,
    phone: typeof row.phone === 'string' ? row.phone : '',
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : '',
    employmentType: normalizeEmploymentType(row.employment_type, role),
    startDate: normalizeProfileDate(row.start_date, row.created_at),
  };
};

const mapManagedProfileRow = (row: Record<string, unknown>): UserProfile => {
  const fallbackUser = {
    id: typeof row.id === 'string' ? row.id : '',
    email: typeof row.email === 'string' ? row.email : '',
  } as User;
  return mapProfileRow(row, fallbackUser);
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
    phone: typeof metadata?.phone === 'string' ? metadata.phone : '',
    avatarUrl: typeof metadata?.avatarUrl === 'string' ? metadata.avatarUrl : '',
    employmentType: normalizeEmploymentType(metadata?.employmentType, fallbackRole),
    startDate: new Date().toISOString().slice(0, 10),
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

  return applySelfProfileOverrides(fallbackProfile, user);
};

const loadManagedProfiles = async () => {
  const { data: rows, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });

  if (error) {
    throw error;
  }

  return (rows ?? []).map((row) => mapManagedProfileRow(row as Record<string, unknown>));
};

const saveOwnProfile = async ({
  avatarUrl,
  fullName,
  phone,
}: {
  avatarUrl: string;
  fullName: string;
  phone: string;
}) => {
  const { data: row, error } = await supabase.rpc('update_own_profile', {
    p_avatar_url: avatarUrl,
    p_full_name: fullName.trim(),
    p_phone: phone.trim(),
  });

  if (error) {
    throw error;
  }

  const profileRow = Array.isArray(row) ? row[0] : row;
  if (!profileRow) {
    throw new Error('Supabase không trả về hồ sơ vừa cập nhật.');
  }

  return mapManagedProfileRow(profileRow as Record<string, unknown>);
};

const saveManagedProfile = async (
  id: string,
  patch: Pick<UserProfile, 'branchId' | 'employmentType' | 'role' | 'startDate'>,
) => {
  const branchId = patch.role === 'owner' ? null : patch.branchId || defaultBranchId;
  const { data: row, error } = await supabase
    .from('profiles')
    .update({
      branch_id: branchId,
      employment_type: patch.employmentType,
      role: patch.role,
      start_date: patch.startDate,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapManagedProfileRow(row as Record<string, unknown>);
};

const compressAvatarFile = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp ảnh JPG, PNG hoặc WebP.');
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
  const path = `${profileId}/avatar.webp`;
  const { error } = await supabase.storage.from('avatars').upload(path, image, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
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

const syncTableLabels: Record<string, string> = {
  attendance_sheets: 'bảng chấm công',
  branch_payroll_confirmations: 'xác nhận bảng lương',
  ingredient_reports: 'báo đồ',
  shift_close_reports: 'báo ca',
};

const formatSupabaseError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : 'Lỗi không xác định';
  }
  const value = error as { code?: string; details?: string; hint?: string; message?: string };
  return [value.message, value.details, value.hint, value.code ? `Mã ${value.code}` : ''].filter(Boolean).join(' • ');
};

const upsertSupabaseRows = async (tableName: string, rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 50;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });

    if (!error) {
      continue;
    }

    // A single legacy/invalid record must not prevent every valid row in the
    // same table from syncing. Retry rows individually to isolate the cause.
    const failedRows: string[] = [];
    let firstError: unknown = error;
    for (const row of chunk) {
      const { error: rowError } = await supabase.from(tableName).upsert(row, { onConflict: 'id' });
      if (rowError) {
        firstError = rowError;
        failedRows.push(typeof row.id === 'string' ? row.id : 'không có mã');
      }
    }

    if (failedRows.length > 0) {
      throw new Error(
        `${syncTableLabels[tableName] ?? tableName}: ${formatSupabaseError(firstError)} ` +
          `(bản ghi: ${failedRows.slice(0, 3).join(', ')}${failedRows.length > 3 ? ', ...' : ''})`,
      );
    }
  }
};

const deduplicateAttendanceSheets = (sheets: AttendanceSheet[]) => {
  const uniqueSheets = new Map<string, AttendanceSheet>();

  sheets.forEach((sheet) => {
    const employeeName = sheet.employeeName.trim();
    if (!employeeName || !/^\d{4}-\d{2}$/.test(sheet.monthKey)) {
      return;
    }
    const key = `${sheet.branchId}|${sheet.monthKey}|${employeeName.toLocaleLowerCase('vi-VN')}`;
    const existing = uniqueSheets.get(key);
    if (!existing) {
      uniqueSheets.set(key, { ...sheet, employeeName });
      return;
    }

    const preferred = sheet.userId && !existing.userId ? sheet : existing;
    const secondary = preferred === sheet ? existing : sheet;
    uniqueSheets.set(key, {
      ...preferred,
      days: { ...secondary.days, ...preferred.days },
      employeeConfirmedAt: preferred.employeeConfirmedAt ?? secondary.employeeConfirmedAt,
      userId: preferred.userId ?? secondary.userId,
    });
  });

  return [...uniqueSheets.values()];
};

const deduplicateBranchPayrolls = (confirmations: BranchPayrollConfirmation[]) => {
  const uniqueConfirmations = new Map<string, BranchPayrollConfirmation>();
  confirmations.forEach((confirmation) => {
    if (!/^\d{4}-\d{2}$/.test(confirmation.monthKey)) {
      return;
    }
    const key = `${confirmation.branchId}|${confirmation.monthKey}`;
    const existing = uniqueConfirmations.get(key);
    if (!existing || (!existing.managerConfirmedAt && confirmation.managerConfirmedAt)) {
      uniqueConfirmations.set(key, confirmation);
    }
  });
  return [...uniqueConfirmations.values()];
};

const syncAppDataToSupabase = async (current: AppData, profile: UserProfile) => {
  const updatedAt = new Date().toISOString();
  const scopedAttendance = deduplicateAttendanceSheets(current.attendanceSheets).filter((sheet) =>
    profile.role === 'owner'
      ? true
      : profile.role === 'manager'
        ? sheet.branchId === profile.branchId
        : sheet.userId === profile.id ||
          (sheet.branchId === profile.branchId && sheet.employeeName.trim().toLowerCase() === profile.fullName.trim().toLowerCase()),
  );
  const scopedPayrolls = deduplicateBranchPayrolls(current.branchPayrolls).filter((confirmation) =>
    profile.role === 'owner' ? true : profile.role === 'manager' && confirmation.branchId === profile.branchId,
  );
  const scopedIngredients = current.ingredients.filter((report) =>
    profile.role === 'owner' ? true : getReportBranchId(report) === profile.branchId,
  );
  const scopedClosings = current.closings.filter((report) =>
    profile.role === 'owner' ? true : getReportBranchId(report) === profile.branchId,
  );

  const attendanceRows = scopedAttendance.map((sheet) => ({
    id: sheet.id,
    user_id: sheet.userId ?? (profile.role === 'employee' ? profile.id : null),
    branch_id: sheet.branchId,
    employee_name: sheet.employeeName,
    month_key: sheet.monthKey,
    days: sheet.days,
    employee_confirmed_at: sheet.employeeConfirmedAt ?? null,
    updated_at: updatedAt,
  }));
  const payrollRows = scopedPayrolls.map((confirmation) => ({
    id: confirmation.id,
    branch_id: confirmation.branchId,
    month_key: confirmation.monthKey,
    manager_confirmed_at: confirmation.managerConfirmedAt ?? null,
    manager_cancelled_at: confirmation.managerCancelledAt ?? null,
    manager_name: confirmation.managerName ?? null,
    auto_confirmed: Boolean(confirmation.autoConfirmed),
    updated_at: updatedAt,
  }));
  const ingredientRows = scopedIngredients.map((report) => ({
    id: report.id,
    branch_id: getReportBranchId(report),
    reporter_name: report.reporterName ?? null,
    reporter_role: report.reporterRole ?? null,
    note: report.note,
    reported_at: report.timestamp,
    items: report.items ?? [],
    updated_at: updatedAt,
  }));
  const closingRows = scopedClosings.map((report) => ({
    id: report.id,
    branch_id: getReportBranchId(report),
    reported_at: report.timestamp,
    payload: report,
    updated_at: updatedAt,
  }));

  const results = await Promise.allSettled([
    upsertSupabaseRows('attendance_sheets', attendanceRows),
    upsertSupabaseRows('branch_payroll_confirmations', payrollRows),
    upsertSupabaseRows('ingredient_reports', ingredientRows),
    upsertSupabaseRows('shift_close_reports', closingRows),
  ]);

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason instanceof Error ? result.reason.message : formatSupabaseError(result.reason)));

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);
  const [syncingRemote, setSyncingRemote] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncRetryToken, setSyncRetryToken] = useState(0);
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
          setSyncError('Thiết bị đang mất mạng. Dữ liệu vẫn được giữ trên máy và sẽ tự đồng bộ khi có kết nối.');
        }
        return;
      }

      setSyncingRemote(true);
      try {
        await syncAppDataToSupabase(data, profile);
        if (!cancelled) {
          remoteSnapshotRef.current = snapshot;
          setSyncError(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (attempt < 2) {
          retryTimeout = setTimeout(() => void runSync(attempt + 1), 1400 * (attempt + 1));
        } else {
          const message = error instanceof Error ? error.message : 'Không đồng bộ được dữ liệu lên Supabase.';
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
  }, [data, profile, remoteReady, syncRetryToken]);

  useEffect(() => {
    const availableTabs = getTabItemsForRole(currentRole);

    if (!availableTabs.some((item) => item.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [activeTab, currentRole]);

  useEffect(() => {
    if (!loaded || currentRole === 'employee') {
      return;
    }

    setData((current) => autoConfirmEligiblePayrolls(current));
  }, [currentRole, data.attendanceSheets, loaded]);

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
      Alert.alert(
        isFutureMonth(selectedMonthKey) ? 'Tháng này chưa bắt đầu' : 'Chỉ chấm công tháng hiện tại',
        isFutureMonth(selectedMonthKey)
          ? 'Không thể chấm công trước cho một tháng trong tương lai.'
          : 'Các tháng cũ chỉ dùng để xem lại bảng công đã lưu.',
      );
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
      Alert.alert(
        isFutureMonth(selectedMonthKey) ? 'Tháng này chưa bắt đầu' : 'Không thể xác nhận tháng cũ',
        'Nhân viên chỉ xác nhận bảng lương của tháng hiện tại.',
      );
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

  const cancelEmployeePayroll = (employee: string) => {
    const trimmedName = employee.trim();
    if (!trimmedName || !isCurrentMonth(selectedMonthKey)) {
      return;
    }

    if (branchPayrollConfirmation?.managerConfirmedAt) {
      Alert.alert(
        'Bảng lương chi nhánh đã gửi',
        'Quản lí cần hủy xác nhận gửi Chủ cửa hàng trước khi bạn có thể mở lại bảng công.',
      );
      return;
    }

    setData((current) => ({
      ...current,
      attendanceSheets: current.attendanceSheets.map((sheet) =>
        sheet.branchId === selectedBranchId &&
        sheet.monthKey === selectedMonthKey &&
        sheet.employeeName.trim().toLowerCase() === trimmedName.toLowerCase()
          ? { ...sheet, employeeConfirmedAt: undefined }
          : sheet,
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
    setAccountOpen(false);
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
                <Text style={styles.brandScript}>Cà phê</Text>
                <Text style={styles.appName}>ĐẠM</Text>
                <Text style={styles.appSubtitle}>{activeBranch.name}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {currentRole === 'owner' ? (
                <Pressable
                  accessibilityLabel="Làm mới dữ liệu hệ thống"
                  accessibilityRole="button"
                  onPress={clearAllData}
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
            <InstallAppBanner />

            {authFeedback?.tone === 'success' ? (
              <AuthFeedbackBanner feedback={authFeedback} onDismiss={() => setAuthFeedback(null)} />
            ) : null}

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

            {activeTab === 'attendance' && (
              currentRole === 'manager' ? (
                <ManagerAttendanceScreen
                  branch={activeBranch}
                  branchPayroll={branchPayrollConfirmation}
                  confirmedSheets={confirmedBranchSheets}
                  employeeName={signedEmployeeName}
                  monthKey={selectedMonthKey}
                  onCancelBranchPayroll={cancelBranchPayroll}
                  onCancelEmployeePayroll={cancelEmployeePayroll}
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
                  onCancelPayroll={cancelEmployeePayroll}
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

          <View accessibilityRole="tablist" style={styles.tabs}>
            {tabItems.map((item) => {
              const Icon = item.icon;
              const selected = activeTab === item.key;

              return (
                <Pressable
                  accessibilityLabel={item.label}
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
                  <Icon color={selected ? colors.onDark : colors.muted} size={20} />
                  <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

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

              <InstallAppBanner />

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

function InstallAppBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
  });
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem('caphedam-install-dismissed') === '1';
    } catch {
      return false;
    }
  });
  const isIos =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const handleDisplayModeChange = () => setInstalled(displayMode.matches);

    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  if (installed || dismissed || (!installPrompt && !isIos)) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem('caphedam-install-dismissed', '1');
    } catch {
      // Private browsing may not expose storage; dismissing still works for the current render.
    }
  };

  const requestInstall = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
  };

  return (
    <View className="app-install-card" style={styles.installCard}>
      <View style={styles.installIcon}>
        <Smartphone color={colors.primary} size={21} />
      </View>
      <View style={styles.installCopy}>
        <Text style={styles.installTitle}>Cài Cà phê Đạm</Text>
        <Text style={styles.installText}>
          {installPrompt
            ? 'Thêm vào màn hình chính để mở toàn màn hình như một ứng dụng.'
            : 'Trên iPhone/iPad: nhấn Chia sẻ, rồi chọn “Thêm vào MH chính”.'}
        </Text>
        {installPrompt ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestInstall()}
            style={({ pressed }) => [styles.installButton, pressed && styles.pressed]}
          >
            <Download color={colors.onDark} size={16} />
            <Text style={styles.installButtonText}>Cài ứng dụng</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Ẩn hướng dẫn cài ứng dụng"
        accessibilityRole="button"
        onPress={dismiss}
        style={({ pressed }) => [styles.installDismiss, pressed && styles.pressed]}
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
      setFeedback({ tone: 'error', title: 'Tệp không hợp lệ', message: 'Vui lòng chọn một tệp ảnh.' });
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

      const editableProfile = { avatarUrl: nextAvatarUrl, fullName: trimmedName, phone: phone.trim() };
      await saveLocalProfileOverride(profile.id, editableProfile);

      const authMetadata = {
        fullName: editableProfile.fullName,
        phone: editableProfile.phone,
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
      setFeedback({
        tone: 'success',
        title: 'Đã lưu hồ sơ',
        message: localAvatarFallback
          ? 'Tên và số điện thoại đã lưu vào tài khoản; ảnh đã lưu trên thiết bị này vì Storage chưa được cấu hình.'
          : databaseSynced
            ? 'Tên, số điện thoại và ảnh đại diện đã được cập nhật.'
            : 'Tên và số điện thoại đã lưu vào tài khoản. Chạy schema mới để đồng bộ thêm với bảng hồ sơ.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không cập nhật được hồ sơ.';
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
    <View accessibilityRole="dialog" style={styles.accountOverlay}>
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
              {syncing ? 'Đang đồng bộ...' : syncError ? 'Đồng bộ cần kiểm tra' : 'Đã đồng bộ Supabase'}
            </Text>
          </View>

          {syncError ? (
            <View style={styles.syncErrorCard}>
              <CircleAlert color={colors.rose} size={20} />
              <View style={styles.flex}>
                <Text style={styles.syncErrorTitle}>Dữ liệu chưa đồng bộ hoàn toàn</Text>
                <Text style={styles.syncErrorText}>{syncError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetrySync}
                  style={({ pressed }) => [styles.syncRetryButton, pressed && styles.pressed]}
                >
                  <RefreshCcw color={colors.onDark} size={15} />
                  <Text style={styles.syncRetryText}>Thử đồng bộ lại</Text>
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
            <PrimaryButton
              icon={Save}
              label={saving ? 'Đang lưu hồ sơ...' : 'Lưu thay đổi'}
              onPress={() => void saveProfile()}
              tone="primary"
            />
          </View>

          <View style={styles.accountSectionCard}>
            <View style={styles.accountSectionHeading}>
              <ShieldCheck color={colors.primary} size={20} />
              <View style={styles.flex}>
                <Text style={styles.accountSectionTitle}>Thông tin công việc</Text>
                <Text style={styles.accountSectionHint}>Chỉ Chủ cửa hàng có quyền thay đổi các mục này.</Text>
              </View>
            </View>
            <ProfileInfoRow icon={ShieldCheck} label="Vị trí" value={roleLabel} />
            <ProfileInfoRow icon={Store} label="Nơi làm việc" value={workplace} />
            <ProfileInfoRow icon={Clock3} label="Hình thức làm việc" value={employmentLabel} />
            <ProfileInfoRow
              icon={CalendarDays}
              label="Thâm niên"
              value={`${formatSeniority(profile.startDate)} • Từ ${formatProfileDate(profile.startDate)}`}
            />
          </View>

          {profile.role === 'owner' ? (
            <OwnerStaffManager currentProfile={profile} onCurrentProfileChange={onProfileChange} />
          ) : null}

          <View style={styles.accountSectionCard}>
            <View style={styles.accountSectionHeading}>
              <KeyRound color={colors.primary} size={20} />
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

function OwnerStaffManager({
  currentProfile,
  onCurrentProfileChange,
}: {
  currentProfile: UserProfile;
  onCurrentProfileChange: (profile: UserProfile) => void;
}) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('employee');
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [employmentType, setEmploymentType] = useState<EmploymentType>('part_time');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const selectedProfile = profiles.find((item) => item.id === selectedId);

  useEffect(() => {
    let cancelled = false;
    loadManagedProfiles()
      .then((nextProfiles) => {
        if (!cancelled) {
          setProfiles(nextProfiles);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedback({
            tone: 'error',
            title: 'Không tải được danh sách nhân sự',
            message: error instanceof Error ? error.message : 'Vui lòng thử lại.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectProfile = (nextProfile: UserProfile) => {
    setSelectedId((current) => (current === nextProfile.id ? null : nextProfile.id));
    setRole(nextProfile.role);
    setBranchId(nextProfile.branchId ?? defaultBranchId);
    setEmploymentType(nextProfile.employmentType);
    setStartDate(nextProfile.startDate);
    setFeedback(null);
  };

  const saveWorkProfile = async () => {
    if (!selectedProfile || saving) {
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'info', title: 'Đang cập nhật nhân sự', message: 'Đang lưu phân quyền và thông tin làm việc...' });
    try {
      const nextProfile = await saveManagedProfile(selectedProfile.id, {
        branchId: role === 'owner' ? null : branchId,
        employmentType,
        role,
        startDate,
      });
      setProfiles((current) => current.map((item) => (item.id === nextProfile.id ? nextProfile : item)));
      if (nextProfile.id === currentProfile.id) {
        onCurrentProfileChange(nextProfile);
      }
      setFeedback({ tone: 'success', title: 'Đã cập nhật', message: `Đã lưu thông tin làm việc của ${nextProfile.fullName || nextProfile.email}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không cập nhật được hồ sơ nhân sự.';
      setFeedback({
        tone: 'error',
        title: 'Không cập nhật được',
        message: message.includes('employment_type') || message.includes('start_date')
          ? 'Cơ sở dữ liệu chưa được nâng cấp. Hãy chạy lại database/supabase-schema.sql rồi thử lại.'
          : message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.accountSectionCard}>
      <View style={styles.accountSectionHeading}>
        <UsersRound color={colors.primary} size={21} />
        <View style={styles.flex}>
          <Text style={styles.accountSectionTitle}>Quản lý nhân sự</Text>
          <Text style={styles.accountSectionHint}>Chọn một tài khoản để phân quyền và cập nhật thông tin làm việc.</Text>
        </View>
      </View>

      {feedback ? <AuthFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} /> : null}
      {loading ? <Text style={styles.accountLoadingText}>Đang tải danh sách nhân sự...</Text> : null}

      <View style={styles.staffList}>
        {profiles.map((staffProfile) => {
          const staffRole = roleOptions.find((option) => option.key === staffProfile.role)?.label ?? 'Nhân viên';
          const selected = selectedId === staffProfile.id;
          const staffBranch = staffProfile.role === 'owner'
            ? 'Toàn hệ thống'
            : getBranchById(staffProfile.branchId ?? defaultBranchId).name;

          return (
            <View key={staffProfile.id} style={[styles.staffCard, selected && styles.staffCardActive]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectProfile(staffProfile)}
                style={({ pressed }) => [styles.staffCardButton, pressed && styles.pressed]}
              >
                <ProfileAvatar avatarUrl={staffProfile.avatarUrl} label={staffProfile.fullName || staffProfile.email} />
                <View style={styles.staffCardCopy}>
                  <Text style={styles.staffCardName}>{staffProfile.fullName || staffProfile.email}</Text>
                  <Text style={styles.staffCardMeta}>{staffRole} • {staffBranch}</Text>
                  <Text style={styles.staffCardPhone}>{staffProfile.phone || 'Chưa có số điện thoại'}</Text>
                </View>
                <ChevronRight
                  color={colors.muted}
                  size={18}
                  style={{ transform: selected ? 'rotate(90deg)' : 'none' }}
                />
              </Pressable>

              {selected ? (
                <View style={styles.staffEditor}>
                  <View style={styles.nativeField}>
                    <Text style={styles.inputLabel}>Vị trí</Text>
                    <select
                      className="account-native-field"
                      disabled={staffProfile.id === currentProfile.id}
                      onChange={(event) => {
                        const nextRole = event.target.value as UserRole;
                        setRole(nextRole);
                        if (nextRole !== 'owner' && !branchId) {
                          setBranchId(defaultBranchId);
                        }
                      }}
                      value={role}
                    >
                      {roleOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                    {staffProfile.id === currentProfile.id ? (
                      <Text style={styles.nativeFieldHint}>Không thể tự hạ quyền Chủ cửa hàng.</Text>
                    ) : null}
                  </View>

                  <View style={styles.nativeField}>
                    <Text style={styles.inputLabel}>Nơi làm việc</Text>
                    <select
                      className="account-native-field"
                      disabled={role === 'owner'}
                      onChange={(event) => setBranchId(event.target.value)}
                      value={role === 'owner' ? '' : branchId}
                    >
                      {role === 'owner' ? <option value="">Toàn hệ thống</option> : null}
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </View>

                  <View style={styles.nativeField}>
                    <Text style={styles.inputLabel}>Hình thức làm việc</Text>
                    <select
                      className="account-native-field"
                      onChange={(event) => setEmploymentType(event.target.value as EmploymentType)}
                      value={employmentType}
                    >
                      <option value="full_time">Full time</option>
                      <option value="part_time">Part time</option>
                    </select>
                  </View>

                  <View style={styles.nativeField}>
                    <Text style={styles.inputLabel}>Ngày bắt đầu làm việc</Text>
                    <input
                      className="account-native-field"
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => setStartDate(event.target.value)}
                      type="date"
                      value={startDate}
                    />
                    <Text style={styles.nativeFieldHint}>Thâm niên hiện tại: {formatSeniority(startDate)}</Text>
                  </View>

                  <PrimaryButton
                    icon={Save}
                    label={saving ? 'Đang lưu...' : 'Lưu thông tin làm việc'}
                    onPress={() => void saveWorkProfile()}
                    tone="primary"
                  />
                </View>
              ) : null}
            </View>
          );
        })}
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
    <View accessibilityRole="dialog" style={styles.monthPickerOverlay}>
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
        <>
          <StatusPanel
            icon={CheckCircle2}
            title="Đã xác nhận bảng lương"
            text={`Quản lí chi nhánh sẽ nhìn thấy bảng lương này từ ${formatDateTime(sheet.employeeConfirmedAt)}.`}
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
  onCancelEmployeePayroll,
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
  onCancelEmployeePayroll: (employeeName: string) => void;
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
      {sheet?.employeeConfirmedAt ? (
        isCurrentMonth(monthKey) ? (
          <PrimaryButton
            icon={XCircle}
            label="Mở lại bảng công quản lí"
            onPress={() => onCancelEmployeePayroll(employeeName)}
            tone="danger"
          />
        ) : null
      ) : (
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
  if (isFutureMonth(monthKey)) {
    return (
      <StatusPanel
        icon={CalendarDays}
        title="Tháng này chưa bắt đầu"
        text="Bạn có thể xem trước lịch nhưng chỉ được chấm công khi tháng này bắt đầu."
        tone="neutral"
      />
    );
  }

  if (isPastMonth(monthKey)) {
    return (
      <StatusPanel
        icon={History}
        title="Chế độ xem lại"
        text="Đây là dữ liệu của tháng đã qua. Bảng công được khóa để bảo toàn lịch sử."
        tone="neutral"
      />
    );
  }

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
      <View style={styles.sectionCopy}>
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
    backgroundColor: colors.canvasDeep,
  },
  authSafeArea: {
    backgroundColor: '#2D160F',
  },
  keyboardView: {
    flex: 1,
  },
  shell: {
    alignSelf: 'center',
    flex: 1,
    backgroundColor: colors.background,
    maxWidth: 760,
    minWidth: 0,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 8,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 28,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 252, 247, 0.94)',
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    borderRadius: 13,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    width: 46,
  },
  brandLogo: {
    borderRadius: 10,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 13,
  },
  appName: {
    color: colors.gold,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  appSubtitle: {
    color: colors.muted,
    fontSize: 11,
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
    height: 44,
    justifyContent: 'center',
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    width: 44,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 7,
  },
  accountAvatarButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    padding: 2,
    width: 46,
  },
  profileAvatar: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    overflow: 'hidden',
    width: 38,
  },
  profileAvatarLarge: {
    borderColor: 'rgba(255, 248, 238, 0.52)',
    borderWidth: 3,
    height: 92,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: 92,
  },
  profileAvatarImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  accountPresenceDot: {
    backgroundColor: '#78A85B',
    borderColor: colors.surfaceStrong,
    borderRadius: 999,
    borderWidth: 2,
    bottom: -1,
    height: 12,
    position: 'absolute',
    right: -1,
    width: 12,
  },
  accountPresenceDotSyncing: {
    backgroundColor: colors.gold,
  },
  accountPresenceDotError: {
    backgroundColor: colors.rose,
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
    right: 0,
    top: -118,
    width: 280,
  },
  authHeroOrbSmall: {
    backgroundColor: 'rgba(185, 120, 73, 0.22)',
    borderRadius: 72,
    bottom: 24,
    height: 144,
    position: 'absolute',
    right: 10,
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
    backgroundColor: '#F3E4D0',
    borderColor: '#CDB49A',
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 9,
  },
  authFieldShellFocused: {
    backgroundColor: '#F8ECDD',
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
  installCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.blueSoft,
    borderColor: 'rgba(97, 112, 85, 0.25)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  installIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  installCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  installTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  installText: {
    color: '#485641',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  installButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 5,
    minHeight: 40,
    paddingHorizontal: 13,
  },
  installButtonText: {
    color: colors.onDark,
    fontSize: 12,
    fontWeight: '900',
  },
  installDismiss: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginRight: -7,
    marginTop: -7,
    width: 36,
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
  accountOverlay: {
    bottom: 0,
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  accountBackdrop: {
    backgroundColor: 'rgba(35, 22, 15, 0.58)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  },
  accountDrawer: {
    alignSelf: 'flex-end',
    backgroundColor: colors.background,
    borderLeftColor: colors.lineStrong,
    borderLeftWidth: 1,
    flex: 1,
    height: '100%',
    maxWidth: 430,
    minWidth: 0,
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingTop: 'env(safe-area-inset-top)',
    shadowColor: colors.deep,
    shadowOffset: { width: -16, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 36,
    width: '100%',
    zIndex: 1,
  },
  accountDrawerHeader: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  accountDrawerEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  accountDrawerTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  accountCloseButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  accountDrawerContent: {
    gap: 12,
    paddingBottom: 28,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  accountHeroCard: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 22,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  accountAvatarEditor: {
    alignItems: 'center',
    marginBottom: 11,
    position: 'relative',
  },
  avatarCameraButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.onDark,
    borderRadius: 999,
    borderWidth: 2,
    bottom: -3,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    width: 36,
  },
  accountHeroName: {
    color: colors.onDark,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  accountHeroEmail: {
    color: 'rgba(255, 248, 238, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  accountHeroSync: {
    color: 'rgba(255, 248, 238, 0.72)',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
  },
  accountHeroSyncError: {
    color: '#FFD2CA',
  },
  accountRolePill: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    minHeight: 30,
    paddingHorizontal: 11,
  },
  accountRolePillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  accountSectionCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 13,
    padding: 13,
  },
  syncErrorCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.roseSoft,
    borderColor: 'rgba(180, 72, 60, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  syncErrorTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  syncErrorText: {
    color: colors.rose,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  syncRetryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.rose,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 40,
    paddingHorizontal: 13,
  },
  syncRetryText: {
    color: colors.onDark,
    fontSize: 12,
    fontWeight: '900',
  },
  accountSectionHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },
  accountSectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  accountSectionHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 2,
  },
  profileInfoRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 60,
    padding: 10,
  },
  profileInfoIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  profileInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileInfoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  profileInfoValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  accountSecurity: {
    gap: 10,
  },
  accountSecurityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountLoadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 8,
    textAlign: 'center',
  },
  staffList: {
    gap: 8,
  },
  staffCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  staffCardActive: {
    borderColor: colors.primary,
  },
  staffCardButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 70,
    padding: 10,
    textAlign: 'left',
  },
  staffCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  staffCardName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  staffCardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  staffCardPhone: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  staffEditor: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 12,
    padding: 11,
  },
  nativeField: {
    gap: 6,
  },
  nativeFieldHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  accountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accountDetails: {
    flex: 1,
    minWidth: 0,
  },
  accountActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
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
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 'calc(50% - 4px)',
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
    minWidth: 0,
  },
  metricTile: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
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
    borderRadius: 10,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  tabs: {
    backgroundColor: 'rgba(255, 252, 247, 0.97)',
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    marginTop: 8,
    padding: 5,
    shadowColor: colors.deep,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 15,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 0,
    paddingHorizontal: 5,
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tabTextActive: {
    color: colors.onDark,
  },
  content: {
    gap: 12,
    paddingBottom: 16,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 14,
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
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineStrong,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    height: 44,
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
    backgroundColor: '#F6E8D6',
    borderColor: colors.lineStrong,
    borderRadius: 14,
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
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  closingInputError: {
    borderColor: colors.rose,
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
  sectionCopy: {
    flex: 1,
    minWidth: 0,
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
    borderRadius: 16,
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
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineStrong,
    borderRadius: 14,
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
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineStrong,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 7,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthCurrent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 6,
  },
  monthCurrentPressed: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
  },
  monthCurrentCopy: {
    minWidth: 0,
  },
  monthCurrentText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  monthCurrentHint: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  monthPickerOverlay: {
    bottom: 0,
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 1200,
  },
  monthPickerBackdrop: {
    backgroundColor: 'rgba(35, 22, 15, 0.58)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  },
  monthPickerSheet: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderColor: colors.lineStrong,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    bottom: 0,
    gap: 14,
    maxWidth: 430,
    paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
    paddingHorizontal: 14,
    paddingTop: 9,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  monthPickerHandle: {
    alignSelf: 'center',
    backgroundColor: colors.lineStrong,
    borderRadius: 999,
    height: 4,
    width: 44,
  },
  monthPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  monthPickerEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  monthPickerTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  monthPickerYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  monthPickerYearButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineStrong,
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 48,
  },
  monthPickerYearDisplay: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  monthPickerYearText: {
    color: colors.onDark,
    fontSize: 19,
    fontWeight: '900',
  },
  monthPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  monthPickerOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceTint,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 4,
    width: 'calc(25% - 6px)',
  },
  monthPickerOptionCurrent: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  monthPickerOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthPickerOptionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  monthPickerOptionTextSelected: {
    color: colors.onDark,
  },
  monthPickerNowText: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
  },
  monthPickerTodayButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15,
  },
  monthPickerTodayText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  attendanceTable: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 16,
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
    backgroundColor: '#F1DFC7',
    borderColor: '#C9A989',
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    marginHorizontal: 5,
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 0,
    textAlign: 'center',
  },
  attendanceInputReadonly: {
    backgroundColor: '#E6D9C8',
    borderColor: colors.line,
    color: colors.muted,
  },
  payrollSummary: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 14,
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
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineStrong,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    minHeight: 48,
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
    borderRadius: 16,
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
