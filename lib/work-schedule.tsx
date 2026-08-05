import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, RefreshCcw, Save, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from './web-ui';
import { supabase } from './supabase';
import {
  getStaffDisplayName,
  loadStaffManagement,
  type ManagedStaffProfile,
  type StaffBranchAlias,
} from './staff-management';

type ScheduleShift = 'morning' | 'afternoon' | 'opening';

type ScheduleSlots = Record<string, Partial<Record<ScheduleShift, string[]>>>;

type WorkSchedule = {
  id: string;
  branchId: string;
  managerId: string;
  weekStart: string;
  slots: ScheduleSlots;
  updatedAt?: string;
};

type ScheduleBranch = {
  id: string;
  name: string;
  area: string;
  address: string;
};

type ScheduleScreenProps = {
  branch: ScheduleBranch;
  managerId: string;
};

const palette = {
  amber: '#B96524',
  amberSoft: '#F6E3C8',
  blue: '#4D7E8C',
  blueSoft: '#D8E8EA',
  canvas: '#F5EDE1',
  deep: '#3F2416',
  ink: '#23160F',
  line: 'rgba(72, 51, 34, 0.22)',
  muted: '#6F5847',
  primary: '#5F3723',
  surface: '#FFF9F1',
  surfaceSoft: '#F3E9DA',
  success: '#60764F',
};

const shifts: ScheduleShift[] = ['morning', 'afternoon', 'opening'];
const weekdayLabels = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDate = (dateKey: string) => new Date(`${dateKey}T12:00:00`);

const getMonday = (date = new Date()) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const shift = copy.getDay() === 0 ? -6 : 1 - copy.getDay();
  copy.setDate(copy.getDate() + shift);
  return copy;
};

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const formatShortDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

const formatWeekRange = (weekStart: string) => {
  const first = getLocalDate(weekStart);
  const last = addDays(first, 6);
  const firstText = formatShortDate(first);
  const lastText = `${formatShortDate(last)}/${last.getFullYear()}`;
  return `${firstText} – ${lastText}`;
};

const createScheduleId = (managerId: string, branchId: string, weekStart: string) =>
  `work-schedule-${managerId}-${branchId}-${weekStart}`;

const createEmptySchedule = (managerId: string, branchId: string, weekStart: string): WorkSchedule => ({
  id: createScheduleId(managerId, branchId, weekStart),
  branchId,
  managerId,
  weekStart,
  slots: {},
});

const normalizeSlots = (value: unknown): ScheduleSlots => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<ScheduleSlots>((result, [dateKey, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return result;
    }

    const normalizedEntry = shifts.reduce<Partial<Record<ScheduleShift, string[]>>>((daySlots, shift) => {
      const rawSlot = (entry as Record<string, unknown>)[shift];
      if (Array.isArray(rawSlot)) {
        daySlots[shift] = rawSlot.filter(
          (employeeId): employeeId is string => typeof employeeId === 'string' && employeeId.length > 0,
        );
      }
      return daySlots;
    }, {});

    if (Object.keys(normalizedEntry).length > 0) {
      result[dateKey] = normalizedEntry;
    }
    return result;
  }, {});
};

const getSlotEmployeeIds = (slots: ScheduleSlots, dateKey: string, shift: ScheduleShift) => slots[dateKey]?.[shift] ?? [];

const readWorkSchedule = async (managerId: string, branchId: string, weekStart: string) => {
  const { data, error } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('manager_id', managerId)
    .eq('branch_id', branchId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return createEmptySchedule(managerId, branchId, weekStart);
  }

  const row = data as Record<string, unknown>;
  return {
    id: typeof row.id === 'string' ? row.id : createScheduleId(managerId, branchId, weekStart),
    branchId,
    managerId,
    weekStart,
    slots: normalizeSlots(row.slots),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  } satisfies WorkSchedule;
};

const getErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (normalized.includes('work_schedules') || normalized.includes('schema') || normalized.includes('relation')) {
    return 'Chưa chuẩn bị được nơi lưu lịch làm. Vui lòng chạy cập nhật cơ sở dữ liệu mới nhất.';
  }
  if (normalized.includes('row-level') || normalized.includes('permission')) {
    return 'Bạn không có quyền lưu lịch của chi nhánh này.';
  }
  return message || 'Chưa thực hiện được. Vui lòng thử lại.';
};

export function WorkScheduleScreen({ branch, managerId }: ScheduleScreenProps) {
  const [weekStart, setWeekStart] = useState(() => getDateKey(getMonday()));
  const [schedule, setSchedule] = useState<WorkSchedule>(() => createEmptySchedule(managerId, branch.id, getDateKey(getMonday())));
  const [staff, setStaff] = useState<ManagedStaffProfile[]>([]);
  const [aliases, setAliases] = useState<StaffBranchAlias[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const loadSequenceRef = useRef(0);

  const branchStaff = useMemo(
    () =>
      staff
        .filter((profile) => profile.branchId === branch.id && profile.role !== 'owner')
        .sort((first, second) => {
          const firstName = getStaffDisplayName(first, aliases, managerId, branch.id);
          const secondName = getStaffDisplayName(second, aliases, managerId, branch.id);
          return firstName.localeCompare(secondName, 'vi');
        }),
    [aliases, branch.id, managerId, staff],
  );

  const staffById = useMemo(() => new Map(branchStaff.map((profile) => [profile.id, profile])), [branchStaff]);
  const weekDates = useMemo(() => {
    const monday = getLocalDate(weekStart);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [weekStart]);

  const load = async () => {
    const requestId = loadSequenceRef.current + 1;
    loadSequenceRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const [staffData, workSchedule] = await Promise.all([
        loadStaffManagement(),
        readWorkSchedule(managerId, branch.id, weekStart),
      ]);
      if (requestId !== loadSequenceRef.current) {
        return;
      }
      setStaff(staffData.profiles);
      setAliases(staffData.aliases);
      setSchedule(workSchedule);
      setHasChanges(false);
      setSavedAt(workSchedule.updatedAt ?? null);
    } catch (loadError) {
      if (requestId !== loadSequenceRef.current) {
        return;
      }
      setError(getErrorMessage(loadError));
      setSchedule(createEmptySchedule(managerId, branch.id, weekStart));
      setStaff([]);
      setAliases([]);
    } finally {
      if (requestId === loadSequenceRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load();
    // Loading intentionally follows the selected branch/week. `load` is kept
    // local so staff aliases are also refreshed whenever this tab is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch.id, managerId, weekStart]);

  const updateSlots = (updater: (current: ScheduleSlots) => ScheduleSlots) => {
    setSchedule((current) => ({ ...current, slots: updater(current.slots) }));
    setHasChanges(true);
    setSavedAt(null);
  };

  const addEmployee = (employeeId: string, dateKey: string, shift: ScheduleShift) => {
    if (!staffById.has(employeeId)) {
      return;
    }

    updateSlots((current) => {
      const currentIds = getSlotEmployeeIds(current, dateKey, shift);
      if (currentIds.includes(employeeId)) {
        return current;
      }
      return {
        ...current,
        [dateKey]: {
          ...current[dateKey],
          [shift]: [...currentIds, employeeId],
        },
      };
    });
  };

  const removeEmployee = (employeeId: string, dateKey: string, shift: ScheduleShift) => {
    updateSlots((current) => {
      const nextIds = getSlotEmployeeIds(current, dateKey, shift).filter((id) => id !== employeeId);
      const nextDay = { ...current[dateKey], [shift]: nextIds };
      return { ...current, [dateKey]: nextDay };
    });
  };

  const clearWeek = () => {
    if (!hasChanges && Object.keys(schedule.slots).length === 0) {
      return;
    }
    Alert.alert('Xóa lịch tuần này?', 'Các ca sẽ bị xóa sau khi bạn bấm Lưu lịch.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setSchedule((current) => ({ ...current, slots: {} }));
          setHasChanges(true);
          setSavedAt(null);
        },
      },
    ]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updatedAt = new Date().toISOString();
      const { error: saveError } = await supabase.from('work_schedules').upsert(
        {
          // The primary key is deterministic for a manager/branch/week. Do
          // not trust an older async load here: saving W2 must never reuse W1's
          // record id even if responses arrive out of order.
          id: createScheduleId(managerId, branch.id, weekStart),
          branch_id: branch.id,
          manager_id: managerId,
          slots: schedule.slots,
          updated_at: updatedAt,
          week_start: weekStart,
        },
        { onConflict: 'manager_id,branch_id,week_start' },
      );
      if (saveError) {
        throw saveError;
      }
      setSchedule((current) => ({
        ...current,
        id: createScheduleId(managerId, branch.id, weekStart),
        updatedAt,
      }));
      setHasChanges(false);
      setSavedAt(updatedAt);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (amount: number) => {
    const nextWeek = getDateKey(addDays(getLocalDate(weekStart), amount * 7));
    if (hasChanges) {
      Alert.alert(
        'Lịch chưa lưu',
        'Bạn đang có thay đổi chưa lưu. Hãy lưu lịch trước khi chuyển tuần để tránh mất dữ liệu.',
      );
      return;
    }
    setSelectedEmployeeId(null);
    setWeekStart(nextWeek);
  };

  const resolveName = (employeeId: string) => {
    const employee = staffById.get(employeeId);
    return employee ? getStaffDisplayName(employee, aliases, managerId, branch.id) : 'Nhân sự đã rời chi nhánh';
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><CalendarDays color="#FFF8EE" size={22} /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Xếp lịch làm</Text>
          <Text style={styles.heroSubtitle}>{branch.name}</Text>
        </View>
        <Pressable accessibilityLabel="Tải lại nhân sự và lịch" onPress={() => void load()} style={styles.refreshButton}>
          {loading ? <LoaderCircle color={palette.primary} size={18} /> : <RefreshCcw color={palette.primary} size={18} />}
        </Pressable>
      </View>

      <View style={styles.weekCard}>
        <Pressable disabled={loading || saving} accessibilityLabel="Tuần trước" onPress={() => changeWeek(-1)} style={styles.weekArrow}>
          <ChevronLeft color={palette.primary} size={21} />
        </Pressable>
        <View style={styles.weekCopy}>
          <Text style={styles.weekEyebrow}>Tuần làm việc</Text>
          <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>
        </View>
        <Pressable disabled={loading || saving} accessibilityLabel="Tuần sau" onPress={() => changeWeek(1)} style={styles.weekArrow}>
          <ChevronRight color={palette.primary} size={21} />
        </Pressable>
      </View>

      <View style={styles.rosterCard}>
        <View style={styles.rosterTitleRow}>
          <View style={styles.rosterTitleCopy}>
            <UsersRound color={palette.primary} size={19} />
            <Text style={styles.rosterTitle}>Nhân sự chi nhánh</Text>
          </View>
          <Text style={styles.rosterCount}>{branchStaff.length} người</Text>
        </View>
        <Text style={styles.rosterHint}>
          Kéo thẻ vào ô ca làm. Trên điện thoại, chạm chọn một người rồi chạm ô ca cần xếp.
        </Text>
        {loading ? (
          <View style={styles.rosterLoading}><LoaderCircle color={palette.muted} size={18} /><Text style={styles.rosterEmpty}>Đang tải nhân sự...</Text></View>
        ) : branchStaff.length === 0 ? (
          <Text style={styles.rosterEmpty}>Chưa có nhân sự nào thuộc chi nhánh này.</Text>
        ) : (
          <View style={styles.staffWrap}>
            {branchStaff.map((employee) => {
              const displayName = getStaffDisplayName(employee, aliases, managerId, branch.id);
              const customName = displayName !== employee.fullName;
              const selected = selectedEmployeeId === employee.id;
              return (
                <View
                  accessibilityLabel={`Chọn ${displayName}`}
                  accessibilityRole="button"
                  draggable
                  key={employee.id}
                  onClick={() => setSelectedEmployeeId((current) => current === employee.id ? null : employee.id)}
                  onDragEnd={() => setSelectedEmployeeId(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/plain', employee.id);
                    setSelectedEmployeeId(employee.id);
                  }}
                  style={[styles.staffChip, selected && styles.staffChipSelected]}
                  title="Kéo vào ô ca làm hoặc chạm để chọn"
                >
                  <Text style={[styles.staffChipName, selected && styles.staffChipNameSelected]}>{displayName}</Text>
                  {customName ? <Text style={[styles.staffChipOriginal, selected && styles.staffChipOriginalSelected]}>{employee.fullName}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.scheduleCard}>
        <View style={styles.sheetTitle}><Text style={styles.sheetTitleText}>{branch.name.toLocaleUpperCase('vi-VN')}</Text></View>
        <View style={styles.sheetScroll}>
          <View style={styles.sheet}>
            <View style={[styles.sheetRow, styles.sheetHeader]}>
              <Text style={[styles.headerCell, styles.dateColumn]}>Ngày</Text>
              <Text style={[styles.headerCell, styles.weekdayColumn]}>Thứ</Text>
              <Text style={[styles.headerCell, styles.morningColumn]}>Sáng</Text>
              <Text style={[styles.headerCell, styles.afternoonColumn]}>Chiều</Text>
              <Text style={[styles.headerCell, styles.openingColumn]}>Mở cửa</Text>
            </View>
            {weekDates.map((date) => {
              const dateKey = getDateKey(date);
              return (
                <View key={dateKey} style={styles.sheetRow}>
                  <Text style={[styles.dateCell, styles.dateColumn]}>{formatShortDate(date)}</Text>
                  <Text style={[styles.weekdayCell, styles.weekdayColumn]}>{weekdayLabels[date.getDay()]}</Text>
                  {shifts.map((shift) => (
                    <ScheduleSlot
                      dateKey={dateKey}
                      employeeIds={getSlotEmployeeIds(schedule.slots, dateKey, shift)}
                      key={shift}
                      onAdd={(employeeId) => addEmployee(employeeId, dateKey, shift)}
                      onRemove={(employeeId) => removeEmployee(employeeId, dateKey, shift)}
                      resolveName={resolveName}
                      selectedEmployeeId={selectedEmployeeId}
                      shift={shift}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </View>
        <Text style={styles.sheetHint}>Mỗi tên được lưu theo nhân sự gốc; nếu bạn đổi tên trong Quản lí nhân sự, lịch sẽ tự hiển thị tên mới.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable disabled={saving || Object.keys(schedule.slots).length === 0} onPress={clearWeek} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
          <Text style={styles.clearButtonText}>Xóa toàn bộ tuần</Text>
        </Pressable>
        <Pressable disabled={saving || loading || !hasChanges} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (saving || loading || !hasChanges) && styles.saveButtonDisabled]}>
          {saving ? <LoaderCircle color="#FFF8EE" size={18} /> : <Save color="#FFF8EE" size={18} />}
          <Text style={styles.saveButtonText}>{saving ? 'Đang lưu...' : 'Lưu lịch'}</Text>
        </Pressable>
      </View>
      {hasChanges ? <Text style={styles.changeHint}>Bạn đang có thay đổi chưa lưu.</Text> : savedAt ? <Text style={styles.savedHint}>Đã lưu lịch làm.</Text> : null}
    </View>
  );
}

function ScheduleSlot({
  dateKey,
  employeeIds,
  onAdd,
  onRemove,
  resolveName,
  selectedEmployeeId,
  shift,
}: {
  dateKey: string;
  employeeIds: string[];
  onAdd: (employeeId: string) => void;
  onRemove: (employeeId: string) => void;
  resolveName: (employeeId: string) => string;
  selectedEmployeeId: string | null;
  shift: ScheduleShift;
}) {
  const columnStyle = shift === 'morning' ? styles.morningColumn : shift === 'afternoon' ? styles.afternoonColumn : styles.openingColumn;
  const emptyText = selectedEmployeeId ? 'Chạm để xếp' : 'Kéo thả vào đây';

  return (
    <View
      accessibilityLabel={`${shift === 'morning' ? 'Ca sáng' : shift === 'afternoon' ? 'Ca chiều' : 'Mở cửa'} ngày ${dateKey}`}
      accessibilityRole="button"
      onClick={() => {
        if (selectedEmployeeId) onAdd(selectedEmployeeId);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const employeeId = event.dataTransfer.getData('text/plain');
        if (employeeId) onAdd(employeeId);
      }}
      style={[styles.slot, columnStyle]}
    >
      {employeeIds.length === 0 ? <Text style={styles.emptySlot}>{emptyText}</Text> : null}
      {employeeIds.map((employeeId) => (
        <View key={employeeId} style={styles.assignmentChip}>
          <Text numberOfLines={1} style={styles.assignmentName}>{resolveName(employeeId)}</Text>
          <View
            accessibilityLabel={`Bỏ ${resolveName(employeeId)} khỏi ca`}
            accessibilityRole="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(employeeId);
            }}
            style={styles.removeAssignment}
          >
            <X color={palette.muted} size={13} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = {
  actions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  afternoonColumn: {
    flex: 1.15,
  },
  assignmentChip: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(72, 51, 34, 0.16)',
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'space-between',
    maxWidth: '100%',
    paddingBottom: 3,
    paddingLeft: 5,
    paddingRight: 3,
    paddingTop: 3,
  },
  assignmentName: {
    color: palette.ink,
    flex: 1,
    fontSize: 11,
    fontWeight: '750',
    lineHeight: 14,
  },
  changeHint: {
    color: palette.amber,
    fontSize: 12,
    fontWeight: '750',
    textAlign: 'center',
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 47,
    paddingHorizontal: 10,
  },
  clearButtonText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  dateCell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#E8F0F0',
    borderColor: palette.line,
    borderRightWidth: 1,
    color: palette.ink,
    display: 'flex',
    fontSize: 12,
    fontWeight: '800',
    justifyContent: 'center',
    paddingHorizontal: 5,
    textAlign: 'center',
  },
  dateColumn: {
    flex: 0.63,
  },
  emptySlot: {
    color: '#937D6B',
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 13,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#F7DED9',
    borderColor: 'rgba(180, 72, 60, 0.3)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    color: '#92392F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  headerCell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(44, 68, 75, 0.48)',
    borderRightWidth: 1,
    color: '#132E35',
    display: 'flex',
    fontSize: 12,
    fontWeight: '900',
    justifyContent: 'center',
    paddingHorizontal: 5,
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    backgroundColor: palette.deep,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 11,
    padding: 15,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 248, 238, 0.16)',
    borderColor: 'rgba(255, 248, 238, 0.18)',
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroSubtitle: {
    color: 'rgba(255, 248, 238, 0.7)',
    fontSize: 12,
    fontWeight: '650',
  },
  heroTitle: {
    color: '#FFF8EE',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  morningColumn: {
    flex: 2.7,
  },
  openingColumn: {
    flex: 1.05,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#FFF8EE',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  removeAssignment: {
    alignItems: 'center',
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
    height: 17,
    justifyContent: 'center',
    width: 17,
  },
  rosterCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 15,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  rosterCount: {
    backgroundColor: palette.amberSoft,
    borderRadius: 999,
    color: palette.primary,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rosterEmpty: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '650',
  },
  rosterHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  rosterLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  rosterTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  rosterTitleCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  rosterTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 12,
    flex: 1.14,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 47,
    paddingHorizontal: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#A78D7A',
  },
  saveButtonText: {
    color: '#FFF8EE',
    fontSize: 14,
    fontWeight: '900',
  },
  savedHint: {
    color: palette.success,
    fontSize: 12,
    fontWeight: '750',
    textAlign: 'center',
  },
  scheduleCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  screen: {
    gap: 14,
  },
  sheet: {
    minWidth: 670,
    overflow: 'hidden',
  },
  sheetHeader: {
    backgroundColor: '#8DB5C0',
    minHeight: 30,
  },
  sheetHint: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetRow: {
    alignItems: 'stretch',
    backgroundColor: '#E8F0F0',
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 43,
  },
  sheetScroll: {
    maxWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  sheetTitle: {
    alignItems: 'center',
    backgroundColor: palette.amber,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 10,
  },
  sheetTitleText: {
    color: '#251508',
    fontSize: 13,
    fontWeight: '950',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  slot: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    backgroundColor: '#EDF3F2',
    borderColor: palette.line,
    borderRightWidth: 1,
    cursor: 'copy',
    gap: 3,
    justifyContent: 'center',
    minHeight: 42,
    padding: 4,
  },
  staffChip: {
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.line,
    borderRadius: 10,
    borderWidth: 1,
    cursor: 'grab',
    gap: 1,
    minWidth: 78,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  staffChipName: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '850',
    lineHeight: 15,
  },
  staffChipNameSelected: {
    color: '#FFF8EE',
  },
  staffChipOriginal: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '650',
    lineHeight: 13,
  },
  staffChipOriginalSelected: {
    color: 'rgba(255, 248, 238, 0.72)',
  },
  staffChipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  staffWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  weekArrow: {
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.line,
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  weekCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 10,
  },
  weekCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
  },
  weekEyebrow: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  weekRange: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  weekdayCell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#E8F0F0',
    borderColor: palette.line,
    borderRightWidth: 1,
    color: palette.ink,
    display: 'flex',
    fontSize: 12,
    fontWeight: '800',
    justifyContent: 'center',
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  weekdayColumn: {
    flex: 0.75,
  },
};
