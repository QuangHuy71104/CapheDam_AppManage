/**
 * Pure schedule model and rules.
 * No Supabase calls and no React state live in this module.
 */
export type ScheduleShift = 'morning' | 'afternoon' | 'opening';
export type MorningEndHour = 9 | 10 | 11 | 12;

export type ScheduleAssignment = {
  employeeId: string;
  morningEndHour?: MorningEndHour;
};

export type ScheduleSlots = Record<string, Partial<Record<ScheduleShift, ScheduleAssignment[]>>>;

export type WorkSchedule = {
  id: string;
  branchId: string;
  managerId: string;
  weekStart: string;
  slots: ScheduleSlots;
  updatedAt?: string;
};

export type PublishedScheduleAssignment = {
  allowance: number;
  breakfastAllowance: number;
  dateKey: string;
  employeeId: string;
  employeeName: string;
  hours: number;
  hourlyRate: number;
  shift: ScheduleShift;
};

export type PublishedWorkSchedule = {
  assignments: PublishedScheduleAssignment[];
  branchId: string;
  weekStart: string;
};

export type ScheduleBranch = {
  id: string;
  name: string;
  area: string;
  address: string;
};

export type ScheduleScreenProps = {
  branch: ScheduleBranch;
  managerId: string;
  onDirtyChange?: (dirty: boolean) => void;
  onPublish?: (schedule: PublishedWorkSchedule) => void | Promise<void>;
};

export const palette = {
  amber: '#B96524',
  amberSoft: '#F6E3C8',
  blue: '#617055',
  blueSoft: '#DCE8D7',
  canvas: '#F5EDE1',
  deep: '#3F2416',
  ink: '#23160F',
  line: 'rgba(93, 61, 39, 0.16)',
  lineStrong: 'rgba(93, 61, 39, 0.25)',
  muted: '#6F5847',
  onDark: '#FFF8EE',
  primary: '#5F3723',
  primarySoft: '#E7D3B8',
  rose: '#B4483C',
  surface: '#FFF9F1',
  surfaceSoft: '#F3E9DA',
  surfaceStrong: '#FFFCF7',
  success: '#617055',
};

export const shifts: ScheduleShift[] = ['morning', 'afternoon', 'opening'];
export const weekdayLabels = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
export const morningEndOptions: Array<{ endHour: MorningEndHour; hours: number; label: string }> = [
  { endHour: 9, hours: 3, label: '9h · 3 giờ' },
  { endHour: 10, hours: 4, label: '10h · 4 giờ' },
  { endHour: 11, hours: 5, label: '11h · 5 giờ' },
  { endHour: 12, hours: 6, label: 'Đủ ca · 6 giờ' },
];

export const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalDate = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

export const getMonday = (date = new Date()) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const shift = copy.getDay() === 0 ? -6 : 1 - copy.getDay();
  copy.setDate(copy.getDate() + shift);
  return copy;
};

export const addDays = (date: Date, amount: number) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

export const formatShortDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

export const formatWeekRange = (weekStart: string) => {
  const first = getLocalDate(weekStart);
  const last = addDays(first, 6);
  return `${formatShortDate(first)} – ${formatShortDate(last)}/${last.getFullYear()}`;
};

export const createScheduleId = (managerId: string, branchId: string, weekStart: string) =>
  `work-schedule-${managerId}-${branchId}-${weekStart}`;

export const createEmptySchedule = (managerId: string, branchId: string, weekStart: string): WorkSchedule => ({
  id: createScheduleId(managerId, branchId, weekStart),
  branchId,
  managerId,
  weekStart,
  slots: {},
});

export const isMorningEndHour = (value: unknown): value is MorningEndHour =>
  value === 9 || value === 10 || value === 11 || value === 12;

export const normalizeAssignment = (value: unknown): ScheduleAssignment | null => {
  // Schedules created by the previous version stored a plain employee ID.
  // Keep them readable and save them in the richer object shape from now on.
  if (typeof value === 'string' && value.trim()) {
    return { employeeId: value };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (typeof row.employeeId !== 'string' || !row.employeeId.trim()) {
    return null;
  }

  return {
    employeeId: row.employeeId,
    ...(isMorningEndHour(row.morningEndHour) ? { morningEndHour: row.morningEndHour } : {}),
  };
};

export const normalizeSlots = (value: unknown): ScheduleSlots => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<ScheduleSlots>((result, [dateKey, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return result;
    }

    const normalizedEntry = shifts.reduce<Partial<Record<ScheduleShift, ScheduleAssignment[]>>>((daySlots, shift) => {
      const rawSlot = (entry as Record<string, unknown>)[shift];
      if (Array.isArray(rawSlot)) {
        const assignments = rawSlot
          .map(normalizeAssignment)
          .filter((assignment): assignment is ScheduleAssignment => Boolean(assignment));
        if (assignments.length > 0) {
          daySlots[shift] = assignments;
        }
      }
      return daySlots;
    }, {});

    if (Object.keys(normalizedEntry).length > 0) {
      result[dateKey] = normalizedEntry;
    }
    return result;
  }, {});
};

export const getSlotAssignments = (slots: ScheduleSlots, dateKey: string, shift: ScheduleShift) =>
  slots[dateKey]?.[shift] ?? [];

export const getMorningHours = (endHour: MorningEndHour | undefined) => (endHour ?? 12) - 6;

export const getAssignmentHours = (assignment: ScheduleAssignment, shift: ScheduleShift) => {
  if (shift === 'morning') {
    return getMorningHours(assignment.morningEndHour);
  }
  return shift === 'afternoon' ? 5 : 0.5;
};

export const isSunday = (dateKey: string) => getLocalDate(dateKey).getDay() === 0;
