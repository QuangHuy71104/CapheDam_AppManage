import { ChevronDown, ChevronUp, RefreshCcw, Save, ShieldCheck, Store, UserCog, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from '../../../lib/web-ui';
import {
  getStaffDisplayName,
  loadStaffManagement,
  saveManagedWorkProfile,
  saveStaffBranchAlias,
  seedDemoData,
  type DemoSeedResult,
  type EmploymentType,
  type ManagedStaffProfile,
  type StaffBranchAlias,
  type StaffRole,
} from '../../../lib/staff-management';

import { colors } from '../../shared/ui/theme';
export type StaffManagementBranch = {
  id: string;
  name: string;
  area: string;
};

type Feedback = {
  tone: 'error' | 'info' | 'success';
  message: string;
};


const roleLabels: Record<StaffRole, string> = {
  employee: 'Nhân viên',
  manager: 'Quản lí chi nhánh',
  owner: 'Chủ cửa hàng',
};

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('') || 'NV';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Chưa thực hiện được. Vui lòng thử lại.';

export function StaffManagementScreen({
  branches,
  currentProfile,
  onCurrentProfileChange,
}: {
  branches: StaffManagementBranch[];
  currentProfile: ManagedStaffProfile;
  onCurrentProfileChange: (profile: ManagedStaffProfile) => void;
}) {
  const [profiles, setProfiles] = useState<ManagedStaffProfile[]>([]);
  const [aliases, setAliases] = useState<StaffBranchAlias[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [aliasDraft, setAliasDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState<StaffRole>('employee');
  const [workBranchDraft, setWorkBranchDraft] = useState(branches[0]?.id ?? '');
  const [employmentTypeDraft, setEmploymentTypeDraft] = useState<EmploymentType>('part_time');
  const [startDateDraft, setStartDateDraft] = useState(new Date().toISOString().slice(0, 10));
  const [hourlyRateDraft, setHourlyRateDraft] = useState('24000');
  const [allowanceDraft, setAllowanceDraft] = useState('200000');
  const [breakfastAllowanceDraft, setBreakfastAllowanceDraft] = useState('27000');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoSeedResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const isOwner = currentProfile.role === 'owner';
  const isManager = currentProfile.role === 'manager';
  const currentBranchId = currentProfile.branchId;

  const refresh = async () => {
    setLoading(true);
    try {
      const nextData = await loadStaffManagement();
      setProfiles(nextData.profiles);
      setAliases(nextData.aliases);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [currentProfile.id]);

  const scopedProfiles = useMemo(() => {
    const matchingBranch = isManager && currentBranchId
      ? profiles.filter((item) => item.branchId === currentBranchId)
      : profiles;
    const filtered = isOwner && branchFilter !== 'all'
      ? matchingBranch.filter((item) => item.branchId === branchFilter)
      : matchingBranch;

    return [...filtered].sort((first, second) => {
      const roleOrder = { owner: 0, manager: 1, employee: 2 } as Record<StaffRole, number>;
      const roleDifference = roleOrder[first.role] - roleOrder[second.role];
      return roleDifference || first.fullName.localeCompare(second.fullName, 'vi');
    });
  }, [branchFilter, currentBranchId, isManager, isOwner, profiles]);

  const selectedProfile = profiles.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selectedProfile) {
      setAliasDraft('');
      return;
    }

    const savedAlias = aliases.find(
      (item) =>
        item.managerId === currentProfile.id &&
        item.employeeId === selectedProfile.id &&
        item.branchId === currentBranchId,
    );
    setAliasDraft(savedAlias?.displayName ?? '');
    setRoleDraft(selectedProfile.role);
    setWorkBranchDraft(selectedProfile.branchId ?? branches[0]?.id ?? '');
    setEmploymentTypeDraft(selectedProfile.employmentType);
    setStartDateDraft(selectedProfile.startDate);
    setHourlyRateDraft(String(selectedProfile.hourlyRate ?? 24000));
    setAllowanceDraft(String(selectedProfile.allowance ?? 200000));
    setBreakfastAllowanceDraft(String(selectedProfile.breakfastAllowance ?? 27000));
  }, [aliases, branches, currentBranchId, currentProfile.id, selectedProfile]);

  const selectProfile = (nextProfile: ManagedStaffProfile) => {
    setSelectedId((current) => (current === nextProfile.id ? null : nextProfile.id));
    setFeedback(null);
  };

  const saveAlias = async () => {
    if (!selectedProfile || !currentBranchId || saving) {
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'info', message: 'Đang lưu tên dùng trong lịch làm...' });
    try {
      const alias = await saveStaffBranchAlias({
        branchId: currentBranchId,
        displayName: aliasDraft,
        employeeId: selectedProfile.id,
      });
      setAliases((current) => {
        const withoutCurrent = current.filter(
          (item) => !(
            item.managerId === currentProfile.id &&
            item.employeeId === selectedProfile.id &&
            item.branchId === currentBranchId
          ),
        );
        return alias ? [...withoutCurrent, alias] : withoutCurrent;
      });
      setFeedback({
        tone: 'success',
        message: alias ? 'Đã lưu tên hiển thị cho lịch làm.' : 'Đã dùng lại tên tài khoản cho lịch làm.',
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const saveWorkProfile = async () => {
    if (!selectedProfile || saving) {
      return;
    }

    if (roleDraft !== 'owner' && !workBranchDraft) {
      setFeedback({ tone: 'error', message: 'Vui lòng chọn nơi làm việc.' });
      return;
    }

    setSaving(true);
    setFeedback({ tone: 'info', message: 'Đang cập nhật thông tin làm việc...' });
    try {
      const nextProfile = await saveManagedWorkProfile(selectedProfile.id, {
        allowance: Number(allowanceDraft) || 0,
        branchId: roleDraft === 'owner' ? null : workBranchDraft,
        breakfastAllowance: Number(breakfastAllowanceDraft) || 0,
        employmentType: employmentTypeDraft,
        hourlyRate: Number(hourlyRateDraft) || 0,
        role: roleDraft,
        startDate: startDateDraft,
      });
      setProfiles((current) => current.map((item) => (item.id === nextProfile.id ? nextProfile : item)));
      if (nextProfile.id === currentProfile.id) {
        onCurrentProfileChange(nextProfile);
      }
      setFeedback({ tone: 'success', message: 'Đã lưu thông tin làm việc.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const createDemoData = async () => {
    if (seeding) {
      return;
    }

    setSeeding(true);
    setFeedback({ tone: 'info', message: 'Đang tạo tài khoản, bảng công và dữ liệu thử nghiệm...' });
    try {
      const result = await seedDemoData();
      await refresh();
      setDemoResult(result);
      setFeedback({
        tone: 'success',
        message: `Đã chuẩn bị ${result.accounts.length} tài khoản và ${result.seededAttendance} bảng công đã gửi cho tháng ${result.monthKey}.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: getErrorMessage(error) });
    } finally {
      setSeeding(false);
    }
  };

  const requestDemoData = () => {
    if (seeding) {
      return;
    }
    Alert.alert(
      'Tạo dữ liệu thử nghiệm?',
      'Thao tác này tạo hoặc đặt lại 6 tài khoản quản lí, 18 tài khoản nhân viên và bảng công mẫu của tháng hiện tại.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Tạo dữ liệu', style: 'destructive', onPress: () => void createDemoData() },
      ],
    );
  };

  const branchName = (branchId: string | null) =>
    branchId ? branches.find((branch) => branch.id === branchId)?.name ?? 'Chi nhánh chưa xác định' : 'Toàn hệ thống';

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <UsersRound color={colors.primary} size={23} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>NHÂN SỰ</Text>
          <Text style={styles.title}>Quản lí nhân sự</Text>
          <Text style={styles.subtitle}>
            {isManager
              ? `Danh sách nhân sự của ${branchName(currentBranchId)}. Tên đặt ở đây chỉ dùng trong lịch làm.`
              : 'Quản lí vị trí, chi nhánh và hình thức làm việc của toàn bộ nhân sự.'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Làm mới danh sách nhân sự"
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void refresh()}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          <RefreshCcw color={colors.primary} size={18} />
        </Pressable>
      </View>

      {isOwner ? (
        <View style={styles.demoCard}>
          <View style={styles.editorHeading}>
            <UsersRound color={colors.primary} size={19} />
            <View style={styles.flex}>
              <Text style={styles.editorTitle}>Dữ liệu thử nghiệm</Text>
              <Text style={styles.editorHint}>Tạo 6 quản lí, 18 nhân viên và bảng công đã gửi để kiểm tra luồng duyệt lương.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={seeding}
            onPress={requestDemoData}
            style={({ pressed }) => [styles.primaryButton, seeding && styles.disabled, pressed && styles.pressed]}
          >
            <UsersRound color={colors.onDark} size={17} />
            <Text style={styles.primaryButtonText}>{seeding ? 'Đang tạo dữ liệu...' : 'Tạo dữ liệu thử nghiệm'}</Text>
          </Pressable>
          {demoResult ? (
            <View style={styles.demoResult}>
              <Text style={styles.demoResultTitle}>Tài khoản test đã sẵn sàng</Text>
              <Text style={styles.demoCredential}>Mật khẩu chung: {demoResult.password}</Text>
              <Text style={styles.demoHint}>
                {demoResult.createdUsers > 0
                  ? `Đã tạo mới ${demoResult.createdUsers} tài khoản.`
                  : 'Các tài khoản mẫu đã tồn tại và đã được cập nhật lại.'}
              </Text>
              {demoResult.skippedAttendance > 0 ? (
                <Text style={styles.demoHint}>
                  Bỏ qua {demoResult.skippedAttendance} bảng công mẫu vì trùng tên với bảng công có sẵn.
                </Text>
              ) : null}
              <View style={styles.demoAccounts}>
                {demoResult.accounts.map((account) => (
                  <View key={account.email} style={styles.demoAccountRow}>
                    <View style={styles.flex}>
                      <Text style={styles.demoAccountName}>{account.fullName}</Text>
                      <Text style={styles.demoAccountEmail}>{account.email}</Text>
                    </View>
                    <Text style={styles.demoAccountRole}>{roleLabels[account.role]} • {branchName(account.branchId)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {isOwner ? (
        <View style={styles.filterCard}>
          <Store color={colors.primary} size={17} />
          <View style={styles.flex}>
            <Text style={styles.filterLabel}>Lọc theo chi nhánh</Text>
            <select
              aria-label="Lọc nhân sự theo chi nhánh"
              onChange={(event) => setBranchFilter(event.target.value)}
              style={styles.nativeSelect}
              value={branchFilter}
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </View>
        </View>
      ) : null}

      {feedback ? (
        <View style={[
          styles.feedback,
          feedback.tone === 'error' && styles.feedbackError,
          feedback.tone === 'success' && styles.feedbackSuccess,
        ]}>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{loading ? 'Đang tải nhân sự...' : `${scopedProfiles.length} nhân sự`}</Text>
        {isManager ? <Text style={styles.summaryHint}>Đổi tên cục bộ để xếp lịch thuận tiện hơn.</Text> : null}
      </View>

      {loading ? null : scopedProfiles.length === 0 ? (
        <View style={styles.emptyCard}>
          <UsersRound color={colors.muted} size={26} />
          <Text style={styles.emptyTitle}>Chưa có nhân sự phù hợp</Text>
          <Text style={styles.emptyText}>Danh sách sẽ hiện khi tài khoản đã được gán đúng chi nhánh.</Text>
        </View>
      ) : (
        <View style={styles.staffList}>
          {scopedProfiles.map((staffProfile) => {
            const selected = staffProfile.id === selectedId;
            const displayedName = isManager
              ? getStaffDisplayName(staffProfile, aliases, currentProfile.id, currentBranchId)
              : staffProfile.fullName || staffProfile.email;
            const hasAlias = isManager && displayedName !== (staffProfile.fullName || staffProfile.email);

            return (
              <View key={staffProfile.id} style={[styles.staffCard, selected && styles.staffCardSelected]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => selectProfile(staffProfile)}
                  style={({ pressed }) => [styles.staffButton, pressed && styles.pressed]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(displayedName)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.nameRow}>
                      <Text style={styles.staffName}>{displayedName}</Text>
                      {hasAlias ? <Text style={styles.aliasBadge}>Tên xếp lịch</Text> : null}
                    </View>
                    {isManager ? <Text style={styles.originalName}>Tên tài khoản: {staffProfile.fullName || staffProfile.email}</Text> : null}
                    <Text style={styles.staffMeta}>{roleLabels[staffProfile.role]} • {branchName(staffProfile.branchId)}</Text>
                  </View>
                  {selected ? <ChevronUp color={colors.muted} size={18} /> : <ChevronDown color={colors.muted} size={18} />}
                </Pressable>

                {selected && isManager ? (
                  <View style={styles.editor}>
                    <View style={styles.editorHeading}>
                      <UserCog color={colors.primary} size={18} />
                      <View style={styles.flex}>
                        <Text style={styles.editorTitle}>Tên dùng khi xếp lịch</Text>
                        <Text style={styles.editorHint}>Không ảnh hưởng tên tài khoản hay bảng công của nhân viên.</Text>
                      </View>
                    </View>
                    <input
                      aria-label="Tên dùng khi xếp lịch"
                      maxLength={80}
                      onChange={(event) => setAliasDraft(event.target.value)}
                      placeholder={staffProfile.fullName || staffProfile.email}
                      style={styles.nativeInput}
                      value={aliasDraft}
                    />
                    <Text style={styles.originalName}>Tên tài khoản: {staffProfile.fullName || staffProfile.email}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void saveAlias()}
                      style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}
                    >
                      <Save color={colors.onDark} size={17} />
                      <Text style={styles.primaryButtonText}>{saving ? 'Đang lưu...' : aliasDraft.trim() ? 'Lưu tên xếp lịch' : 'Dùng tên tài khoản'}</Text>
                    </Pressable>
                  </View>
                ) : null}

                {selected && (isOwner || isManager) ? (
                  <View style={styles.editor}>
                    <View style={styles.editorHeading}>
                      <ShieldCheck color={colors.primary} size={18} />
                      <View style={styles.flex}>
                        <Text style={styles.editorTitle}>Thông tin làm việc</Text>
                        <Text style={styles.editorHint}>Tên tài khoản do nhân sự tự quản lí trong Hồ sơ cá nhân.</Text>
                      </View>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Vị trí</Text>
                      <select
                        aria-label="Vị trí"
                        disabled={isManager || staffProfile.id === currentProfile.id}
                        onChange={(event) => setRoleDraft(event.target.value as StaffRole)}
                        style={styles.nativeSelect}
                        value={roleDraft}
                      >
                        <option value="employee">Nhân viên</option>
                        <option value="manager">Quản lí chi nhánh</option>
                        <option value="owner">Chủ cửa hàng</option>
                      </select>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Nơi làm việc</Text>
                      <select
                        aria-label="Nơi làm việc"
                        disabled={isManager || roleDraft === 'owner'}
                        onChange={(event) => setWorkBranchDraft(event.target.value)}
                        style={styles.nativeSelect}
                        value={roleDraft === 'owner' ? '' : workBranchDraft}
                      >
                        {roleDraft === 'owner' ? <option value="">Toàn hệ thống</option> : null}
                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </select>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Hình thức làm việc</Text>
                      <select
                        aria-label="Hình thức làm việc"
                        onChange={(event) => setEmploymentTypeDraft(event.target.value as EmploymentType)}
                        style={styles.nativeSelect}
                        value={employmentTypeDraft}
                      >
                        <option value="full_time">Full time</option>
                        <option value="part_time">Part time</option>
                      </select>
                    </View>

                    <View style={styles.moneyGrid}>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Lương k/giờ</Text>
                        <input
                          aria-label="Lương k/giờ"
                          inputMode="numeric"
                          onChange={(event) => setHourlyRateDraft(event.target.value.replace(/\D/g, ''))}
                          style={styles.nativeInput}
                          value={hourlyRateDraft}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Phụ cấp</Text>
                        <input
                          aria-label="Phụ cấp"
                          inputMode="numeric"
                          onChange={(event) => setAllowanceDraft(event.target.value.replace(/\D/g, ''))}
                          style={styles.nativeInput}
                          value={allowanceDraft}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Tiền ăn sáng</Text>
                        <input
                          aria-label="Tiền ăn sáng"
                          inputMode="numeric"
                          onChange={(event) => setBreakfastAllowanceDraft(event.target.value.replace(/\D/g, ''))}
                          style={styles.nativeInput}
                          value={breakfastAllowanceDraft}
                        />
                      </View>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Ngày bắt đầu làm việc</Text>
                      <input
                        aria-label="Ngày bắt đầu làm việc"
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(event) => setStartDateDraft(event.target.value)}
                        style={styles.nativeInput}
                        type="date"
                        value={startDateDraft}
                      />
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void saveWorkProfile()}
                      style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}
                    >
                      <Save color={colors.onDark} size={17} />
                      <Text style={styles.primaryButtonText}>{saving ? 'Đang lưu...' : 'Lưu thông tin làm việc'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aliasBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    color: colors.blue,
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.6,
  },
  demoAccountEmail: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 2,
  },
  demoAccountName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  demoAccountRole: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    maxWidth: '42%',
    textAlign: 'right',
  },
  demoAccountRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 9,
  },
  demoAccounts: {
    gap: 6,
  },
  demoCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    gap: 11,
    padding: 13,
  },
  demoCredential: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  demoHint: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
  },
  demoResult: {
    backgroundColor: colors.blueSoft,
    borderColor: 'rgba(97, 112, 85, 0.28)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
    padding: 10,
  },
  demoResultTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  editor: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 11,
    padding: 12,
  },
  editorHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  editorHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 2,
  },
  editorTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    gap: 7,
    padding: 24,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  feedback: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  feedbackError: {
    backgroundColor: colors.roseSoft,
    borderColor: 'rgba(180, 72, 60, 0.32)',
  },
  feedbackSuccess: {
    backgroundColor: colors.blueSoft,
    borderColor: 'rgba(97, 112, 85, 0.32)',
  },
  feedbackText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  filterCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.line,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  nativeInput: {
    backgroundColor: '#FFFFFF',
    border: `1px solid ${colors.line}`,
    borderRadius: 10,
    color: colors.ink,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: '700',
    minHeight: 40,
    outline: 'none',
    padding: '8px 10px',
    width: '100%',
  },
  nativeSelect: {
    backgroundColor: '#FFFFFF',
    border: `1px solid ${colors.line}`,
    borderRadius: 10,
    color: colors.ink,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: '700',
    minHeight: 38,
    outline: 'none',
    padding: '7px 9px',
    width: '100%',
  },
  moneyGrid: {
    gap: 8,
  },
  originalName: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 13,
  },
  primaryButtonText: {
    color: colors.onDark,
    fontSize: 12,
    fontWeight: '900',
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  screen: {
    gap: 12,
  },
  staffButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 68,
    padding: 10,
  },
  staffCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  staffCardSelected: {
    borderColor: colors.primary,
  },
  staffList: {
    gap: 8,
  },
  staffMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 3,
  },
  staffName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  summary: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  summaryHint: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  summaryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 2,
  },
});
