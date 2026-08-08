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
