export const toNumber = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isNumericText = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  return normalized.length > 0 && Number.isFinite(Number(normalized));
};

export const sanitizeDigits = (value: string) => value.replace(/\D/g, '');

export const sanitizeShiftHours = (value: string) => {
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [whole, ...decimalParts] = normalized.split(',');
  const decimals = decimalParts.join('');
  return decimalParts.length > 0 ? `${whole},${decimals.slice(0, 2)}` : whole;
};

export const formatTransferExpression = (value: string) =>
  value.replace(/[^\d+]/g, '').replace(/\++/g, '+').replace(/^\++/, '');

export const trimTransferExpression = (value: string) => value.replace(/\++$/g, '');

export const sumTransferExpression = (value: string) =>
  trimTransferExpression(value)
    .split('+')
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part))
    .reduce((total, part) => total + part, 0);
