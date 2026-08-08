import type { SupplyItemConfig, SupplyItemInput } from './model';

export const supplyItems: SupplyItemConfig[] = [
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

export const createSupplyState = (): Record<string, SupplyItemInput> =>
  supplyItems.reduce<Record<string, SupplyItemInput>>((state, item) => {
    state[item.key] = { quantity: '', status: 'available' };
    return state;
  }, {});
