import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LoaderCircle,
  RefreshCcw,
  Save,
  Send,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from './web-ui';
import { supabase } from './supabase';
import {
  getStaffDisplayName,
  loadStaffManagement,
  type ManagedStaffProfile,
  type StaffBranchAlias,
} from './staff-management';

import {
  addDays,
  createEmptySchedule,
  createScheduleId,
  formatShortDate,
  formatWeekRange,
  getAssignmentHours,
  getDateKey,
  getLocalDate,
  getMonday,
  getMorningHours,
  getSlotAssignments,
  isMorningEndHour,
  isSunday,
  morningEndOptions,
  normalizeAssignment,
  normalizeSlots,
  palette,
  shifts,
  weekdayLabels,
  type MorningEndHour,
  type PublishedScheduleAssignment,
  type PublishedWorkSchedule,
  type ScheduleAssignment,
  type ScheduleBranch,
  type ScheduleScreenProps,
  type ScheduleShift,
  type ScheduleSlots,
  type WorkSchedule,
} from '../src/features/schedule/core';
export type { PublishedScheduleAssignment, PublishedWorkSchedule } from '../src/features/schedule/core';

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
  if (normalized.includes('sunday') || normalized.includes('chủ nhật')) {
    return 'Không thể xếp ca chiều vào Chủ Nhật.';
  }
  if (normalized.includes('row-level') || normalized.includes('permission')) {
    return 'Bạn không có quyền lưu lịch của chi nhánh này.';
  }
  return message || 'Chưa thực hiện được. Vui lòng thử lại.';
};

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
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

const escapeSvgText = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}[character] ?? character));

const buildScheduleSvg = ({
  branch,
  schedule,
  resolveName,
}: {
  branch: ScheduleBranch;
  schedule: WorkSchedule;
  resolveName: (employeeId: string) => string;
}) => {
  const width = 1280;
  const columns = [120, 140, 620, 250, 150];
  const rowHeight = 56;
  const headerHeight = 38;
  const titleHeight = 42;
  const first = getLocalDate(schedule.weekStart);
  let output = `<rect width="${width}" height="100%" fill="#F5EDE1" />`;
  output += `<rect x="0" y="0" width="${width}" height="${titleHeight}" fill="#B96524" />`;
  output += `<text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="#23160F">${escapeSvgText(branch.name.toLocaleUpperCase('vi-VN'))}</text>`;

  const headerY = titleHeight;
  const labels = ['Ngày', 'Thứ', 'Sáng', 'Chiều', 'Mở cửa'];
  let cursorX = 0;
  labels.forEach((label, index) => {
    output += `<rect x="${cursorX}" y="${headerY}" width="${columns[index]}" height="${headerHeight}" fill="#DCE8D7" stroke="#8B6A50" stroke-width="1" />`;
    output += `<text x="${cursorX + columns[index] / 2}" y="${headerY + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#23160F">${label}</text>`;
    cursorX += columns[index];
  });

  const cellText = (dateKey: string, shift: ScheduleShift) =>
    getSlotAssignments(schedule.slots, dateKey, shift)
      .map((assignment) => {
        const name = resolveName(assignment.employeeId);
        return shift === 'morning' && assignment.morningEndHour && assignment.morningEndHour < 12
          ? `${name} (${assignment.morningEndHour}h)`
          : name;
      })
      .join(' + ');

  Array.from({ length: 7 }, (_, index) => addDays(first, index)).forEach((date, index) => {
    const dateKey = getDateKey(date);
    const rowY = titleHeight + headerHeight + index * rowHeight;
    const values = [
      formatShortDate(date),
      weekdayLabels[date.getDay()],
      cellText(dateKey, 'morning'),
      isSunday(dateKey) ? 'Nghỉ' : cellText(dateKey, 'afternoon'),
      cellText(dateKey, 'opening'),
    ];
    cursorX = 0;
    values.forEach((value, columnIndex) => {
      const background = columnIndex < 2 ? '#F3E9DA' : '#FFFCF7';
      output += `<rect x="${cursorX}" y="${rowY}" width="${columns[columnIndex]}" height="${rowHeight}" fill="${background}" stroke="#8B6A50" stroke-width="1" />`;
      output += `<text x="${cursorX + columns[columnIndex] / 2}" y="${rowY + 34}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="${columnIndex < 2 ? 700 : 500}" fill="#23160F">${escapeSvgText(value || '—')}</text>`;
      cursorX += columns[columnIndex];
    });
  });

  const height = titleHeight + headerHeight + rowHeight * 7;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${output}</svg>`;
};

const exportScheduleImage = async (
  exportView: HTMLElement | null,
  branch: ScheduleBranch,
  schedule: WorkSchedule,
  resolveName: (employeeId: string) => string,
) => {
  const baseName = `lich-lam-${branch.id}-${schedule.weekStart}`;
  await waitForNextFrame();

  try {
    if (!exportView) {
      throw new Error('Không tìm thấy bảng lịch để xuất ảnh.');
    }
    const { toPng } = await import('html-to-image');
    const dataUri = await toPng(exportView, {
      backgroundColor: palette.canvas,
      cacheBust: true,
      pixelRatio: 2,
    });
    downloadFile(dataUri, `${baseName}.png`);
  } catch {
    const svg = buildScheduleSvg({ branch, schedule, resolveName });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, `${baseName}.svg`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

export function WorkScheduleScreen({ branch, managerId, onPublish }: ScheduleScreenProps) {
  const [weekStart, setWeekStart] = useState(() => getDateKey(getMonday()));
  const [schedule, setSchedule] = useState<WorkSchedule>(() => createEmptySchedule(managerId, branch.id, getDateKey(getMonday())));
  const [staff, setStaff] = useState<ManagedStaffProfile[]>([]);
  const [aliases, setAliases] = useState<StaffBranchAlias[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [nextMorningEndHour, setNextMorningEndHour] = useState<MorningEndHour>(12);
  const [editingMorning, setEditingMorning] = useState<{ dateKey: string; employeeId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const loadSequenceRef = useRef(0);
  const exportViewRef = useRef<HTMLDivElement>(null);

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
      setPublishedAt(null);
      setSelectedEmployeeId(null);
      setEditingMorning(null);
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
    setPublishedAt(null);
  };

  const addEmployee = (employeeId: string, dateKey: string, shift: ScheduleShift) => {
    if (!staffById.has(employeeId)) {
      return;
    }
    if (shift === 'afternoon' && isSunday(dateKey)) {
      Alert.alert('Ca chiều Chủ Nhật nghỉ', 'Bảng công không cho phép chấm ca chiều Chủ Nhật.');
      return;
    }

    updateSlots((current) => {
      const currentAssignments = getSlotAssignments(current, dateKey, shift);
      if (currentAssignments.some((assignment) => assignment.employeeId === employeeId)) {
        return current;
      }
      const nextAssignment: ScheduleAssignment = {
        employeeId,
        ...(shift === 'morning' ? { morningEndHour: nextMorningEndHour } : {}),
      };
      return {
        ...current,
        [dateKey]: {
          ...current[dateKey],
          [shift]: [...currentAssignments, nextAssignment],
        },
      };
    });
  };

  const removeEmployee = (employeeId: string, dateKey: string, shift: ScheduleShift) => {
    updateSlots((current) => {
      const nextAssignments = getSlotAssignments(current, dateKey, shift).filter(
        (assignment) => assignment.employeeId !== employeeId,
      );
      return {
        ...current,
        [dateKey]: {
          ...current[dateKey],
          [shift]: nextAssignments,
        },
      };
    });
    setEditingMorning((current) =>
      current?.dateKey === dateKey && current.employeeId === employeeId ? null : current,
    );
  };

  const setMorningEndHour = (dateKey: string, employeeId: string, morningEndHour: MorningEndHour) => {
    updateSlots((current) => ({
      ...current,
      [dateKey]: {
        ...current[dateKey],
        morning: getSlotAssignments(current, dateKey, 'morning').map((assignment) =>
          assignment.employeeId === employeeId ? { ...assignment, morningEndHour } : assignment,
        ),
      },
    }));
    setEditingMorning(null);
  };

  const clearWeek = () => {
    if (!hasChanges && Object.keys(schedule.slots).length === 0) {
      return;
    }
    Alert.alert('Xóa lịch tuần này?', 'Các ca sẽ bị xóa sau khi bạn bấm Lưu nháp.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          setSchedule((current) => ({ ...current, slots: {} }));
          setHasChanges(true);
          setSavedAt(null);
          setPublishedAt(null);
          setEditingMorning(null);
        },
      },
    ]);
  };

  const buildPublishedSchedule = (): PublishedWorkSchedule => ({
    branchId: branch.id,
    weekStart,
    assignments: Object.entries(schedule.slots).flatMap(([dateKey, daySlots]) =>
      shifts.flatMap((shift) =>
        getSlotAssignments({ [dateKey]: daySlots }, dateKey, shift).flatMap((assignment) => {
          const employee = staffById.get(assignment.employeeId);
          if (!employee || (shift === 'afternoon' && isSunday(dateKey))) {
            return [];
          }
          return [{
            dateKey,
            employeeId: employee.id,
            employeeName: employee.fullName.trim() || employee.email,
            hours: getAssignmentHours(assignment, shift),
            shift,
          } satisfies PublishedScheduleAssignment];
        }),
      ),
    ),
  });

  const save = async (publish: boolean) => {
    if (saving || loading) {
      return;
    }
    if (publish && Object.keys(schedule.slots).length === 0 && !hasChanges) {
      Alert.alert('Chưa có ca làm', 'Hãy xếp ít nhất một ca trước khi gửi lịch.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updatedAt = new Date().toISOString();
      const { error: saveError } = await supabase.from('work_schedules').upsert(
        {
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

      const savedSchedule = {
        ...schedule,
        id: createScheduleId(managerId, branch.id, weekStart),
        updatedAt,
      } satisfies WorkSchedule;
      setSchedule(savedSchedule);
      setHasChanges(false);
      setSavedAt(updatedAt);

      if (publish) {
        await onPublish?.(buildPublishedSchedule());
        await exportScheduleImage(exportViewRef.current, branch, savedSchedule, resolveName);
        setPublishedAt(updatedAt);
      }
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
    setWeekStart(nextWeek);
  };

  const resolveName = (employeeId: string) => {
    const employee = staffById.get(employeeId);
    return employee ? getStaffDisplayName(employee, aliases, managerId, branch.id) : 'Nhân sự đã rời chi nhánh';
  };

  const editingAssignment = editingMorning
    ? getSlotAssignments(schedule.slots, editingMorning.dateKey, 'morning').find(
        (assignment) => assignment.employeeId === editingMorning.employeeId,
      )
    : undefined;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><CalendarDays color={palette.onDark} size={22} /></View>
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
          Mỗi người là một thẻ vừa với tên. Chạm chọn một thẻ rồi chạm vào ô ca, hoặc kéo thẻ vào ca cần xếp.
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

      <View style={styles.morningGuide}>
        <View style={styles.morningGuideCopy}>
          <Clock3 color={palette.primary} size={18} />
          <View style={styles.flex}>
            <Text style={styles.morningGuideTitle}>Ca sáng cho lượt xếp tiếp theo</Text>
            <Text style={styles.morningGuideHint}>Mặc định đủ ca 6 giờ từ 6h. Có thể chọn giờ về sớm cho từng bạn.</Text>
          </View>
        </View>
        <View style={styles.morningOptionWrap}>
          {morningEndOptions.map((option) => {
            const selected = nextMorningEndHour === option.endHour;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.endHour}
                onPress={() => setNextMorningEndHour(option.endHour)}
                style={({ pressed }) => [styles.morningOption, selected && styles.morningOptionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.morningOptionText, selected && styles.morningOptionTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
              const sunday = isSunday(dateKey);
              return (
                <View key={dateKey} style={[styles.sheetRow, sunday && styles.sundayRow]}>
                  <Text style={[styles.dateCell, styles.dateColumn]}>{formatShortDate(date)}</Text>
                  <Text style={[styles.weekdayCell, styles.weekdayColumn]}>{weekdayLabels[date.getDay()]}</Text>
                  {shifts.map((shift) => (
                    <ScheduleSlot
                      dateKey={dateKey}
                      disabled={shift === 'afternoon' && sunday}
                      employeeIds={getSlotAssignments(schedule.slots, dateKey, shift)}
                      key={shift}
                      onAdd={(employeeId) => addEmployee(employeeId, dateKey, shift)}
                      onEditMorning={(employeeId) => setEditingMorning({ dateKey, employeeId })}
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
        <Text style={styles.sheetHint}>
          Tên trong lịch dùng tên hiển thị của chi nhánh. Ca chiều Chủ Nhật được khóa. Mở cửa từ 5h30 tự tính 0,5 giờ; ca chiều 5 giờ.
        </Text>
      </View>

      {editingMorning && editingAssignment ? (
        <View style={styles.editMorningCard}>
          <View style={styles.editMorningHeading}>
            <View style={styles.flex}>
              <Text style={styles.editMorningTitle}>Chỉnh giờ về ca sáng</Text>
              <Text style={styles.editMorningHint}>
                {resolveName(editingMorning.employeeId)} · {formatShortDate(getLocalDate(editingMorning.dateKey))}
              </Text>
            </View>
            <Pressable accessibilityLabel="Đóng chỉnh giờ" onPress={() => setEditingMorning(null)} style={styles.editCloseButton}>
              <X color={palette.muted} size={17} />
            </Pressable>
          </View>
          <View style={styles.morningOptionWrap}>
            {morningEndOptions.map((option) => {
              const selected = (editingAssignment.morningEndHour ?? 12) === option.endHour;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.endHour}
                  onPress={() => setMorningEndHour(editingMorning.dateKey, editingMorning.employeeId, option.endHour)}
                  style={({ pressed }) => [styles.morningOption, selected && styles.morningOptionSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.morningOptionText, selected && styles.morningOptionTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable disabled={saving || Object.keys(schedule.slots).length === 0} onPress={clearWeek} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
          <Text style={styles.clearButtonText}>Xóa tuần</Text>
        </Pressable>
        <Pressable disabled={saving || loading || !hasChanges} onPress={() => void save(false)} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (saving || loading || !hasChanges) && styles.saveButtonDisabled]}>
          {saving ? <LoaderCircle color={palette.onDark} size={18} /> : <Save color={palette.onDark} size={18} />}
          <Text style={styles.saveButtonText}>{saving ? 'Đang lưu...' : 'Lưu nháp'}</Text>
        </Pressable>
        <Pressable disabled={saving || loading || (Object.keys(schedule.slots).length === 0 && !hasChanges)} onPress={() => void save(true)} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed, (saving || loading || (Object.keys(schedule.slots).length === 0 && !hasChanges)) && styles.sendButtonDisabled]}>
          {saving ? <LoaderCircle color={palette.onDark} size={18} /> : <Send color={palette.onDark} size={18} />}
          <Text style={styles.sendButtonText}>Gửi lịch</Text>
        </Pressable>
      </View>
      {hasChanges ? <Text style={styles.changeHint}>Bạn đang có thay đổi chưa lưu.</Text> : publishedAt ? <Text style={styles.publishedHint}>Đã gửi lịch, tự cập nhật bảng công và tải ảnh lịch.</Text> : savedAt ? <Text style={styles.savedHint}>Đã lưu nháp lịch làm.</Text> : null}

      <View pointerEvents="none" style={styles.exportStage}>
        <View collapsable={false} ref={exportViewRef} style={styles.exportSheet}>
          <ScheduleExportPreview branch={branch} schedule={schedule} resolveName={resolveName} weekDates={weekDates} />
        </View>
      </View>
    </View>
  );
}

function ScheduleSlot({
  dateKey,
  disabled,
  employeeIds,
  onAdd,
  onEditMorning,
  onRemove,
  resolveName,
  selectedEmployeeId,
  shift,
}: {
  dateKey: string;
  disabled: boolean;
  employeeIds: ScheduleAssignment[];
  onAdd: (employeeId: string) => void;
  onEditMorning: (employeeId: string) => void;
  onRemove: (employeeId: string) => void;
  resolveName: (employeeId: string) => string;
  selectedEmployeeId: string | null;
  shift: ScheduleShift;
}) {
  const columnStyle = shift === 'morning' ? styles.morningColumn : shift === 'afternoon' ? styles.afternoonColumn : styles.openingColumn;
  const emptyText = disabled ? 'Nghỉ Chủ Nhật' : selectedEmployeeId ? 'Chạm để xếp' : 'Kéo thẻ vào đây';

  return (
    <View
      accessibilityLabel={`${shift === 'morning' ? 'Ca sáng' : shift === 'afternoon' ? 'Ca chiều' : 'Mở cửa'} ngày ${dateKey}`}
      accessibilityRole="button"
      onClick={() => {
        if (selectedEmployeeId && !disabled) onAdd(selectedEmployeeId);
      }}
      onDragOver={(event) => {
        if (!disabled) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        const employeeId = event.dataTransfer.getData('text/plain');
        if (employeeId) onAdd(employeeId);
      }}
      style={[styles.slot, columnStyle, disabled && styles.slotDisabled]}
    >
      {employeeIds.length === 0 ? <Text style={[styles.emptySlot, disabled && styles.emptySlotDisabled]}>{emptyText}</Text> : null}
      <View style={styles.assignmentWrap}>
        {employeeIds.map((assignment) => {
          const endHour = assignment.morningEndHour ?? 12;
          const hours = getAssignmentHours(assignment, shift);
          return (
            <View
              key={assignment.employeeId}
              onClick={(event) => {
                event.stopPropagation();
                if (shift === 'morning') {
                  onEditMorning(assignment.employeeId);
                }
              }}
              style={[styles.assignmentChip, shift === 'morning' && styles.assignmentChipEditable]}
              title={shift === 'morning' ? 'Chạm để chỉnh giờ về' : undefined}
            >
              <Text numberOfLines={1} style={styles.assignmentName}>{resolveName(assignment.employeeId)}</Text>
              <Text style={styles.assignmentHours}>
                {shift === 'morning' ? `${endHour}h` : `${hours}g`}
              </Text>
              <View
                accessibilityLabel={`Bỏ ${resolveName(assignment.employeeId)} khỏi ca`}
                accessibilityRole="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(assignment.employeeId);
                }}
                style={styles.removeAssignment}
              >
                <X color={palette.muted} size={13} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ScheduleExportPreview({
  branch,
  resolveName,
  schedule,
  weekDates,
}: {
  branch: ScheduleBranch;
  resolveName: (employeeId: string) => string;
  schedule: WorkSchedule;
  weekDates: Date[];
}) {
  const namesFor = (dateKey: string, shift: ScheduleShift) => {
    if (shift === 'afternoon' && isSunday(dateKey)) {
      return 'Nghỉ';
    }
    const values = getSlotAssignments(schedule.slots, dateKey, shift).map((assignment) => {
      const name = resolveName(assignment.employeeId);
      return shift === 'morning' && assignment.morningEndHour && assignment.morningEndHour < 12
        ? `${name} (${assignment.morningEndHour}h)`
        : name;
    });
    return values.join(' + ') || '—';
  };

  return (
    <View style={styles.exportPreview}>
      <View style={styles.exportTitle}><Text style={styles.exportTitleText}>{branch.name.toLocaleUpperCase('vi-VN')}</Text></View>
      <View style={[styles.exportRow, styles.exportHeader]}>
        <Text style={[styles.exportCell, styles.exportDateColumn, styles.exportHeaderText]}>Ngày</Text>
        <Text style={[styles.exportCell, styles.exportWeekdayColumn, styles.exportHeaderText]}>Thứ</Text>
        <Text style={[styles.exportCell, styles.exportMorningColumn, styles.exportHeaderText]}>Sáng</Text>
        <Text style={[styles.exportCell, styles.exportAfternoonColumn, styles.exportHeaderText]}>Chiều</Text>
        <Text style={[styles.exportCell, styles.exportOpeningColumn, styles.exportHeaderText]}>Mở cửa</Text>
      </View>
      {weekDates.map((date) => {
        const dateKey = getDateKey(date);
        return (
          <View key={dateKey} style={styles.exportRow}>
            <Text style={[styles.exportCell, styles.exportDateColumn, styles.exportDateText]}>{formatShortDate(date)}</Text>
            <Text style={[styles.exportCell, styles.exportWeekdayColumn, styles.exportDateText]}>{weekdayLabels[date.getDay()]}</Text>
            <Text style={[styles.exportCell, styles.exportMorningColumn]}>{namesFor(dateKey, 'morning')}</Text>
            <Text style={[styles.exportCell, styles.exportAfternoonColumn]}>{namesFor(dateKey, 'afternoon')}</Text>
            <Text style={[styles.exportCell, styles.exportOpeningColumn]}>{namesFor(dateKey, 'opening')}</Text>
          </View>
        );
      })}
      <View style={styles.exportFooter}>
        <Download color={palette.muted} size={13} />
        <Text style={styles.exportFooterText}>Lịch làm · Cà phê Đậm</Text>
      </View>
    </View>
  );
}

const styles = {
  actions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  afternoonColumn: {
    flex: 1.2,
  },
  assignmentChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.surfaceStrong,
    borderColor: palette.lineStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 1,
    gap: 3,
    maxWidth: '100%',
    paddingBottom: 3,
    paddingLeft: 7,
    paddingRight: 3,
    paddingTop: 3,
  },
  assignmentChipEditable: {
    borderColor: 'rgba(95, 55, 35, 0.42)',
    cursor: 'pointer',
  },
  assignmentHours: {
    backgroundColor: palette.amberSoft,
    borderRadius: 999,
    color: palette.primary,
    flexShrink: 0,
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  assignmentName: {
    color: palette.ink,
    flexGrow: 0,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  assignmentWrap: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
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
    flex: 0.85,
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
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.lineStrong,
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
    flex: 0.62,
  },
  editCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  editMorningCard: {
    backgroundColor: palette.amberSoft,
    borderColor: 'rgba(185, 101, 36, 0.35)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  editMorningHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  editMorningHint: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  editMorningTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  emptySlot: {
    color: '#937D6B',
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 13,
    textAlign: 'center',
  },
  emptySlotDisabled: {
    color: palette.rose,
    fontWeight: '700',
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
  exportAfternoonColumn: {
    flex: 1.25,
  },
  exportCell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: palette.surfaceStrong,
    borderColor: '#8B6A50',
    borderRightWidth: 1,
    color: palette.ink,
    display: 'flex',
    fontSize: 14,
    justifyContent: 'center',
    lineHeight: 19,
    paddingHorizontal: 7,
    paddingVertical: 8,
    textAlign: 'center',
  },
  exportDateColumn: {
    flex: 0.62,
  },
  exportDateText: {
    backgroundColor: palette.surfaceSoft,
    fontWeight: '800',
  },
  exportFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  exportFooterText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  exportHeader: {
    backgroundColor: palette.blueSoft,
    minHeight: 36,
  },
  exportHeaderText: {
    backgroundColor: palette.blueSoft,
    fontWeight: '900',
  },
  exportMorningColumn: {
    flex: 3.1,
  },
  exportOpeningColumn: {
    flex: 1.15,
  },
  exportPreview: {
    backgroundColor: palette.canvas,
  },
  exportRow: {
    alignItems: 'stretch',
    borderBottomColor: '#8B6A50',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
  },
  exportSheet: {
    backgroundColor: palette.canvas,
    padding: 16,
    width: 1080,
  },
  exportStage: {
    left: -6000,
    position: 'absolute',
    top: 0,
    width: 1080,
  },
  exportTitle: {
    alignItems: 'center',
    backgroundColor: palette.amber,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  exportTitleText: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '950',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  exportWeekdayColumn: {
    flex: 0.86,
  },
  flex: {
    flex: 1,
  },
  headerCell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(64, 81, 59, 0.38)',
    borderRightWidth: 1,
    color: palette.ink,
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
    color: palette.onDark,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  morningColumn: {
    flex: 2.7,
  },
  morningGuide: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 15,
    borderWidth: 1,
    gap: 11,
    padding: 13,
  },
  morningGuideCopy: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  morningGuideHint: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  morningGuideTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  morningOption: {
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 0,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  morningOptionSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  morningOptionText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '850',
  },
  morningOptionTextSelected: {
    color: palette.onDark,
  },
  morningOptionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  openingColumn: {
    flex: 1.08,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  publishedHint: {
    color: palette.success,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: palette.onDark,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  removeAssignment: {
    alignItems: 'center',
    borderRadius: 999,
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
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 47,
    paddingHorizontal: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#A78D7A',
  },
  saveButtonText: {
    color: palette.onDark,
    fontSize: 13,
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
  sendButton: {
    alignItems: 'center',
    backgroundColor: palette.amber,
    borderRadius: 12,
    flex: 1.14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 47,
    paddingHorizontal: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#C9A989',
  },
  sendButtonText: {
    color: palette.onDark,
    fontSize: 13,
    fontWeight: '900',
  },
  sheet: {
    minWidth: 720,
    overflow: 'hidden',
  },
  sheetHeader: {
    backgroundColor: palette.blueSoft,
    minHeight: 31,
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
    backgroundColor: palette.surfaceStrong,
    borderBottomColor: palette.lineStrong,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 49,
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
    minHeight: 32,
    paddingHorizontal: 10,
  },
  sheetTitleText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '950',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  slot: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    backgroundColor: palette.surfaceStrong,
    borderColor: palette.lineStrong,
    borderRightWidth: 1,
    cursor: 'copy',
    gap: 3,
    justifyContent: 'center',
    minHeight: 48,
    padding: 5,
  },
  slotDisabled: {
    backgroundColor: '#F4E4DF',
    cursor: 'not-allowed',
  },
  staffChip: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.lineStrong,
    borderRadius: 999,
    borderWidth: 1,
    cursor: 'grab',
    flexGrow: 0,
    gap: 1,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  staffChipName: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '850',
    lineHeight: 15,
  },
  staffChipNameSelected: {
    color: palette.onDark,
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  sundayRow: {
    backgroundColor: '#FAF2EB',
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
    backgroundColor: palette.surfaceSoft,
    borderColor: palette.lineStrong,
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
