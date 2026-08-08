import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

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
    'src/app/legacy-app-data.ts',
  ];
  for (const path of expected) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `missing ${path}`);
  }
});

test('legacy aggregate data is explicitly isolated', () => {
  const legacy = readFileSync(new URL('../src/app/legacy-app-data.ts', import.meta.url), 'utf8');
  assert.match(legacy, /Transitional aggregate snapshot/);
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


test('report caches are outside legacy AppData', () => {
  const legacy = readFileSync(new URL('../src/app/legacy-app-data.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(legacy, /ingredients:/);
  assert.doesNotMatch(legacy, /closings:/);
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
  assert.match(repository, /from\('attendance_sheets'\)\.upsert/);
});


test('payroll confirmation persistence is feature-owned', () => {
  assert.doesNotMatch(app, /\.from\('branch_payroll_confirmations'\)/);
  const repository = readFileSync(
    new URL('../src/features/payroll/repository.ts', import.meta.url),
    'utf8',
  );
  assert.match(repository, /listBranchPayrollConfirmations/);
  assert.match(repository, /from\('branch_payroll_confirmations'\)/);
  assert.match(repository, /\.upsert/);
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
