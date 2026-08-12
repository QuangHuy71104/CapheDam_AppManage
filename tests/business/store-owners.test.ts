import { describe, expect, it } from 'vitest';
import { isStoreOwnerName, storeOwners } from '../../src/shared/domain';

describe('store owner identities', () => {
  it('contains exactly anh Đạm and chị Gấu', () => {
    expect(storeOwners).toEqual([
      { fullName: 'Nguyễn Thanh Đạm', familiarName: 'anh Đạm' },
      { fullName: 'Trương Thanh Thảo', familiarName: 'chị Gấu' },
    ]);
  });

  it('matches owner names consistently and rejects other people', () => {
    expect(isStoreOwnerName('  NGUYỄN   THANH ĐẠM ')).toBe(true);
    expect(isStoreOwnerName('Trương Thanh Thảo')).toBe(true);
    expect(isStoreOwnerName('Nguyễn Văn Khác')).toBe(false);
  });
});
