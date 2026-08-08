export type CupBalanceStatus = 'enough' | 'short' | 'over';
export type PlasticCupKey = 'small' | 'large' | 'icedTea';

export type PlasticCupInput = {
  opening: string;
  remaining: string;
  machineCups: string;
  status: CupBalanceStatus;
  variance: string;
};

export type BalanceInputSnapshot = {
  openingText?: string;
  remainingText?: string;
  machineCupsText?: string;
};

export type BalanceReportBase = BalanceInputSnapshot & {
  label: string;
  opening: number;
  remaining: number;
  sold: number;
  status: CupBalanceStatus;
  variance: number;
};

export type PlasticCupReport = BalanceReportBase & {
  key: PlasticCupKey;
  machineCups?: number;
};

export type StockBalanceReport = BalanceReportBase & {
  machineCount?: number;
};

export type ShiftCloseReport = {
  id: string;
  branchId?: string;
  plasticCups?: string;
  plasticCupRows?: PlasticCupReport[];
  cornMilk?: string;
  cornMilkReport?: StockBalanceReport;
  glassCups?: string;
  smallBottles?: string;
  largeBottles?: string;
  coffeePacks?: string;
  smallCoffeePacks?: string;
  largeCoffeePacks?: string;
  machineMoney: string;
  storeMoney: string;
  transferMoney?: string;
  shopeeMoney?: string;
  bankTransferMoney?: string;
  bankTransferTotal?: number;
  iceBags?: string;
  waterBottles?: string;
  cardTopupMoney?: string;
  note: string;
  timestamp: string;
  cashierName?: string;
  shiftName?: string;
  revenue?: number;
  discrepancy?: number;
};
