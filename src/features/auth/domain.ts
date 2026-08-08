export const normalizeEmailAddress = (value: string) => value.trim().toLowerCase();
export const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const minimumPasswordLength = 6;
