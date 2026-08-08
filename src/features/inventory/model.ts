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
