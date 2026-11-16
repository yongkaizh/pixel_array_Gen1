export function positiveNumber(value: string | number, label: string, integer = false): number {
  const text = String(value).trim();
  const number = text === '' ? NaN : Number(text);
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isSafeInteger(number))) {
    throw new Error(`${label} must be a positive ${integer ? 'safe integer' : 'finite number'}; received "${value}".`);
  }
  return number;
}
