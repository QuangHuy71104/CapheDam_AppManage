import { isNumericText, toNumber } from '../../shared/lib/numbers';
import type {
  BalanceReportBase,
  CupBalanceStatus,
  PlasticCupInput,
  PlasticCupReport,
  StockBalanceReport,
} from './model';

export const deriveCupBalance = (row: PlasticCupInput): Pick<PlasticCupInput, 'status' | 'variance'> => {
  if (!isNumericText(row.opening) || !isNumericText(row.remaining) || !isNumericText(row.machineCups)) {
    return { status: 'enough', variance: '' };
  }

  const sold = toNumber(row.opening) - toNumber(row.remaining);
  const difference = toNumber(row.machineCups) - sold;

  if (difference > 0) {
    return { status: 'over', variance: String(difference) };
  }

  if (difference < 0) {
    return { status: 'short', variance: String(Math.abs(difference)) };
  }

  return { status: 'enough', variance: '' };
};

export const createStockBalanceReport = (label: string, row: PlasticCupInput): StockBalanceReport => {
  const opening = toNumber(row.opening);
  const remaining = toNumber(row.remaining);
  const machineCount = toNumber(row.machineCups);
  const sold = opening - remaining;
  const balance = deriveCupBalance(row);
  return {
    label,
    opening,
    remaining,
    machineCount,
    sold,
    status: balance.status,
    variance: balance.status === 'enough' ? 0 : toNumber(balance.variance),
    openingText: row.opening.trim(),
    remainingText: row.remaining.trim(),
    machineCupsText: row.machineCups.trim(),
  };
};

export const createEmptyBalanceReport = (label: string): BalanceReportBase => ({
  label,
  opening: 0,
  remaining: 0,
  sold: 0,
  status: 'enough',
  variance: 0,
  openingText: '',
  remainingText: '',
  machineCupsText: '',
});

const savedNumberToInput = (textValue: string | undefined, numericValue?: number) => {
  if (textValue !== undefined) {
    return textValue;
  }

  if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
    return String(numericValue);
  }

  return '';
};

export const restorePlasticCupInput = (row?: PlasticCupReport): PlasticCupInput => {
  const restored = {
    opening: savedNumberToInput(row?.openingText, row?.opening),
    remaining: savedNumberToInput(row?.remainingText, row?.remaining),
    machineCups: savedNumberToInput(row?.machineCupsText, row?.machineCups),
    status: 'enough' as CupBalanceStatus,
    variance: '',
  };

  return {
    ...restored,
    ...deriveCupBalance(restored),
  };
};

export const restoreStockBalanceInput = (row?: StockBalanceReport): PlasticCupInput => {
  const restored = {
    opening: savedNumberToInput(row?.openingText, row?.opening),
    remaining: savedNumberToInput(row?.remainingText, row?.remaining),
    machineCups: savedNumberToInput(row?.machineCupsText, row?.machineCount),
    status: 'enough' as CupBalanceStatus,
    variance: '',
  };

  return {
    ...restored,
    ...deriveCupBalance(restored),
  };
};
