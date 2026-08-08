import type { UserRole } from '../../shared/domain';

export type SupplyItemStatus = 'available' | 'empty';
export type SupplyItemKind = 'quantity' | 'status';

export type SupplyItemConfig = {
  key: string;
  label: string;
  kind: SupplyItemKind;
  unit?: string;
};

export type SupplyItemInput = {
  quantity: string;
  status: SupplyItemStatus;
};

export type SupplyReportItem = SupplyItemConfig & SupplyItemInput;

export type IngredientReport = {
  id: string;
  branchId?: string;
  reporterName?: string;
  reporterRole?: UserRole;
  itemName?: string;
  unit?: string;
  openingStock?: number;
  received?: number;
  used?: number;
  wasted?: number;
  currentStock?: number;
  note: string;
  timestamp: string;
  items?: SupplyReportItem[];
};
