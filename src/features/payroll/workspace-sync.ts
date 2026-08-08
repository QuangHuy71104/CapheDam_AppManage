import type { UserProfile } from '../../shared/domain';
import type { AttendanceSheet, BranchPayrollConfirmation } from '../attendance/model';
import { saveAttendanceSheets } from '../attendance/repository';
import { saveBranchPayrollConfirmations } from './repository';

export type PayrollWorkspaceShape = {
  attendanceSheets: AttendanceSheet[];
  branchPayrolls: BranchPayrollConfirmation[];
};

const deduplicateAttendanceSheets = (sheets: AttendanceSheet[]) => {
  const uniqueSheets = new Map<string, AttendanceSheet>();

  sheets.forEach((sheet) => {
    const employeeName = sheet.employeeName.trim();
    if (!employeeName || !/^\d{4}-\d{2}$/.test(sheet.monthKey)) {
      return;
    }

    const key = `${sheet.branchId}|${sheet.monthKey}|${
      sheet.userId ? `user:${sheet.userId}` : `name:${employeeName.toLocaleLowerCase('vi-VN')}`
    }`;

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
      managerApprovedAt: preferred.managerApprovedAt ?? secondary.managerApprovedAt,
      managerApprovedBy: preferred.managerApprovedBy ?? secondary.managerApprovedBy,
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

const changedSinceSnapshot = <T extends { id: string }>(current: T[], snapshot: T[]) => {
  const snapshotById = new Map(snapshot.map((item) => [item.id, item]));
  return current.filter((item) => JSON.stringify(item) !== JSON.stringify(snapshotById.get(item.id)));
};

export const syncPayrollWorkspace = async (
  current: PayrollWorkspaceShape,
  profile: UserProfile,
  snapshot: PayrollWorkspaceShape,
) => {
  const scopedAttendance = deduplicateAttendanceSheets(current.attendanceSheets).filter((sheet) =>
    profile.role === 'owner'
      ? true
      : profile.role === 'manager'
        ? sheet.branchId === profile.branchId
        : sheet.userId === profile.id ||
          (sheet.branchId === profile.branchId &&
            sheet.employeeName.trim().toLowerCase() === profile.fullName.trim().toLowerCase()),
  );

  const snapshotAttendance = deduplicateAttendanceSheets(snapshot.attendanceSheets).filter((sheet) =>
    profile.role === 'owner'
      ? true
      : profile.role === 'manager'
        ? sheet.branchId === profile.branchId
        : sheet.userId === profile.id ||
          (sheet.branchId === profile.branchId &&
            sheet.employeeName.trim().toLowerCase() === profile.fullName.trim().toLowerCase()),
  );

  const scopedPayrolls = deduplicateBranchPayrolls(current.branchPayrolls).filter((confirmation) =>
    profile.role === 'owner'
      ? true
      : profile.role === 'manager' && confirmation.branchId === profile.branchId,
  );

  const snapshotPayrolls = deduplicateBranchPayrolls(snapshot.branchPayrolls).filter((confirmation) =>
    profile.role === 'owner'
      ? true
      : profile.role === 'manager' && confirmation.branchId === profile.branchId,
  );

  // Only send rows changed since the last remote snapshot. This preserves the
  // existing offline behavior while persistence ownership lives in features.
  const changedAttendance = changedSinceSnapshot(scopedAttendance, snapshotAttendance);
  const changedPayrolls = changedSinceSnapshot(scopedPayrolls, snapshotPayrolls);

  const results = await Promise.allSettled([
    saveAttendanceSheets(changedAttendance, profile),
    saveBranchPayrollConfirmations(changedPayrolls),
  ]);

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason instanceof Error ? result.reason.message : 'Chưa lưu được dữ liệu.'));

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
};
