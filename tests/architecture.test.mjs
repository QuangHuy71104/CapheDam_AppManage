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
