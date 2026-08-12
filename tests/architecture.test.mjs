import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const workSchedule = readFileSync(
  new URL('../src/features/schedule/WorkScheduleScreen.tsx', import.meta.url),
  'utf8',
);

test('owner refresh is not wired to destructive reset', () => {
  assert.doesNotMatch(app, /onPress=\{clearAllData\}/);
  assert.doesNotMatch(app, /clearRemoteAppData/);
  assert.match(app, /refreshRemoteData/);
});

test('major business domains are outside App.tsx', () => {
  const expected = [
    'src/features/attendance/model.ts',
    'src/features/payroll/domain.ts',
    'src/features/inventory/catalog.ts',
    'src/features/closing/balance.ts',
    'src/features/schedule/core.ts',
    'src/features/staff/StaffManagementScreen.tsx',
    'src/shared/api/account-client.ts',
    'src/features/payroll/workspace.ts',
  ];
  for (const path of expected) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `missing ${path}`);
  }
});

test('legacy AppData boundary is retired', () => {
  assert.equal(existsSync(new URL('../src/app/legacy-app-data.ts', import.meta.url)), false);
  const workspace = readFileSync(
    new URL('../src/features/payroll/workspace.ts', import.meta.url),
    'utf8',
  );
  assert.match(workspace, /export type PayrollWorkspace/);
  assert.doesNotMatch(workspace, /ingredients/);
  assert.doesNotMatch(workspace, /closings/);
});

test('database migration baseline exists', () => {
  assert.equal(
    existsSync(new URL('../supabase/migrations/202608080000_baseline.sql', import.meta.url)),
    true,
  );
});


test('inventory persistence bypasses aggregate snapshot sync', () => {
  assert.doesNotMatch(app, /const syncAppDataToSupabase/);
  assert.match(app, /persistIngredientReport\(report\)/);

  const repository = readFileSync(
    new URL('../src/features/inventory/repository.ts', import.meta.url),
    'utf8',
  );

  assert.match(repository, /from\('ingredient_reports'\)\.upsert/);
  assert.match(repository, /listIngredientReports/);
});


test('closing persistence bypasses aggregate snapshot sync', () => {
  assert.doesNotMatch(app, /const syncAppDataToSupabase/);
  assert.match(app, /persistShiftCloseReport\(report\)/);

  const repository = readFileSync(
    new URL('../src/features/closing/repository.ts', import.meta.url),
    'utf8',
  );

  assert.match(repository, /from\('shift_close_reports'\)\.upsert/);
  assert.match(repository, /listShiftCloseReports/);
});


test('report caches are outside payroll workspace', () => {
  const workspace = readFileSync(
    new URL('../src/features/payroll/workspace.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(workspace, /ingredients:/);
  assert.doesNotMatch(workspace, /closings:/);
  assert.match(app, /useState<IngredientReport\[\]>\(\[\]\)/);
  assert.match(app, /useState<ShiftCloseReport\[\]>\(\[\]\)/);
});


test('attendance persistence is feature-owned', () => {
  assert.doesNotMatch(app, /\.from\('attendance_sheets'\)/);
  const repository = readFileSync(
    new URL('../src/features/attendance/repository.ts', import.meta.url),
    'utf8',
  );
  assert.match(repository, /listAttendanceSheets/);
  assert.match(repository, /rpc\('save_attendance_sheet_cas'/);
  assert.doesNotMatch(repository, /from\('attendance_sheets'\)\.upsert/);
});


test('payroll confirmation persistence is feature-owned', () => {
  assert.doesNotMatch(app, /\.from\('branch_payroll_confirmations'\)/);
  const repository = readFileSync(
    new URL('../src/features/payroll/repository.ts', import.meta.url),
    'utf8',
  );
  assert.match(repository, /listBranchPayrollConfirmations/);
  assert.match(repository, /from\('branch_payroll_confirmations'\)/);
  assert.match(repository, /rpc\('save_branch_payroll_cas'/);
  assert.doesNotMatch(repository, /from\('branch_payroll_confirmations'\)[\s\S]*\.upsert/);
});


test('payroll workspace sync is outside App', () => {
  assert.doesNotMatch(app, /const syncAppDataToSupabase/);
  assert.match(app, /syncPayrollWorkspace\(currentData, activeProfile, remoteSnapshot\)/);
  const sync = readFileSync(
    new URL('../src/features/payroll/workspace-sync.ts', import.meta.url),
    'utf8',
  );
  assert.match(sync, /saveAttendanceSheets/);
  assert.match(sync, /saveBranchPayrollConfirmations/);
});


test('concurrency metadata is represented in payroll models', () => {
  const model = readFileSync(
    new URL('../src/features/attendance/model.ts', import.meta.url),
    'utf8',
  );
  assert.match(model, /version\?: number/);
  assert.match(model, /updatedAt\?: string/);

  const attendanceRepository = readFileSync(
    new URL('../src/features/attendance/repository.ts', import.meta.url),
    'utf8',
  );
  const payrollRepository = readFileSync(
    new URL('../src/features/payroll/repository.ts', import.meta.url),
    'utf8',
  );
  assert.match(attendanceRepository, /row\.version/);
  assert.match(payrollRepository, /row\.version/);
});

test('sensitive payroll writes use compare-and-swap database functions', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/202608091930_security_cas.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /save_attendance_sheet_cas/);
  assert.match(migration, /save_branch_payroll_cas/);
  assert.match(migration, /where id = p_id and version = p_expected_version/);
  assert.match(migration, /Employees cannot change manager approval/);
  assert.match(migration, /revoke execute on function public\.append_audit_log/);
  assert.match(migration, /auto_confirm_due_payrolls/);
  assert.match(migration, /current_date/);
});

test('profile compensation fields are repaired before payroll snapshots use them', () => {
  const repairMigration = readFileSync(
    new URL('../supabase/migrations/202608091900_profiles_pay_fields.sql', import.meta.url),
    'utf8',
  );

  assert.match(repairMigration, /add column if not exists hourly_rate integer not null default 24000/);
  assert.match(repairMigration, /add column if not exists allowance integer not null default 200000/);
  assert.match(repairMigration, /add column if not exists breakfast_allowance integer not null default 27000/);
  assert.ok('202608082306' < '202608091900');
  assert.ok('202608091900' < '202608091930');
});

test('operational reads are bounded and support scoped filters', () => {
  for (const path of [
    'src/features/inventory/repository.ts',
    'src/features/closing/repository.ts',
    'src/features/attendance/repository.ts',
    'src/features/payroll/repository.ts',
  ]) {
    const repository = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(repository, /\.range\(offset, offset \+ limit - 1\)/, `${path} must paginate reads`);
  }
});

test('self-service profile creation is disabled by default', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/202608091930_security_cas.sql', import.meta.url),
    'utf8',
  );
  const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(migration, /drop policy if exists "profiles_insert_own_employee"/);
  assert.match(envExample, /VITE_ENABLE_PUBLIC_SIGNUP=false/);
});

test('login stays compact without overlapping decoration or persistent guidance', () => {
  assert.doesNotMatch(app, /authHeroOrb/);
  assert.doesNotMatch(app, /InstallAppBanner/);
  assert.doesNotMatch(app, /Hệ thống đang hoạt động/);
  assert.doesNotMatch(app, /Phiên đăng nhập được ghi nhớ/);
  assert.match(app, /styles\.authSheetTitle.*Đăng nhập/);
  assert.match(app, /label="Email"/);
  assert.match(app, /label="Mật khẩu"/);
});

test('customer-facing brand copy consistently uses Cà phê Đạm', () => {
  const brandedScreens = `${app}\n${workSchedule}`;
  assert.doesNotMatch(brandedScreens, /Cà phê Đ\u1eadm|CÀ PHÊ Đ\u1eacM/);
  assert.match(app, />Cà phê Đạm</);
  assert.match(workSchedule, /Lịch làm · Cà phê Đạm/);
});

test('offline payroll workspace is isolated per authenticated user', () => {
  assert.match(app, /getPayrollWorkspaceStorageKey\(userId\)/);
  assert.match(app, /caphedam-payroll-workspace-v3:/);
  assert.doesNotMatch(app, /PAYROLL_WORKSPACE_STORAGE_KEY/);
});

test('legacy staff and schedule modules are compatibility facades', () => {
  const staffFacade = readFileSync(new URL('../lib/staff-management.ts', import.meta.url), 'utf8');
  const scheduleFacade = readFileSync(new URL('../lib/work-schedule.tsx', import.meta.url), 'utf8');
  assert.match(staffFacade, /^export \* from/);
  assert.match(scheduleFacade, /^export \* from/);
  assert.equal(existsSync(new URL('../src/features/staff/repository.ts', import.meta.url)), true);
  assert.equal(existsSync(new URL('../src/features/schedule/WorkScheduleScreen.tsx', import.meta.url)), true);
});

test('role dashboards follow the compact payroll approval flow', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/app/styles.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(app, /<MetricTile/);
  assert.doesNotMatch(app, /ownerIngredients/);
  assert.doesNotMatch(app, /Tổng hợp gửi chủ cửa hàng/);
  assert.match(app, /Bảng lương sẽ xuất hiện ngay sau khi quản lí duyệt cho từng nhân viên/);
  assert.match(app, /Duyệt và gửi Chủ cửa hàng/);
  assert.match(app, /approved \? styles\.managerPayrollEmployeeCardApproved : styles\.managerPayrollEmployeeCardPending/);
  assert.match(styles, /managerPayrollEmployeeGrid:\s*{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(styles, /managerPayrollEmployeeCard:\s*{[\s\S]*?width: 'calc\(50% - 4px\)'/);
  assert.match(styles, /managerPayrollEmployeeCardPending:\s*{[\s\S]*?backgroundColor: '#E6E3DF'/);
  assert.match(styles, /managerPayrollEmployeeCardApproved:\s*{[\s\S]*?backgroundColor: colors\.blue/);
});

test('serverless staff APIs remain self-contained at runtime', () => {
  const accountApi = readFileSync(new URL('../api/account.ts', import.meta.url), 'utf8');
  const demoSeedApi = readFileSync(new URL('../api/demo-seed.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(accountApi, /from ['"]\.\.\/src\//);
  assert.doesNotMatch(demoSeedApi, /from ['"]\.\.\/src\//);
  assert.match(accountApi, /requester\.role !== 'owner' && requester\.role !== 'manager'/);
});
