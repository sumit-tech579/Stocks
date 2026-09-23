/**
 * Formats numbers into Indian Currency format (en-IN)
 * e.g., 100000 -> "₹1,00,000.00"
 */
export function formatINR(val: number, options?: { decimals?: number; showSign?: boolean; showSymbol?: boolean }): string {
  const decimals = options?.decimals ?? 2;
  const showSign = options?.showSign ?? false;
  const showSymbol = options?.showSymbol ?? true;

  const isNegative = val < 0;
  const absVal = Math.abs(val);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(absVal);

  const symbol = showSymbol ? '₹' : '';
  const sign = isNegative ? '-' : (showSign && val > 0 ? '+' : '');

  return `${sign}${symbol}${formatted}`;
}

/**
 * Formats percentage with sign
 * e.g., 1.25 -> "+1.25%", -0.5 -> "-0.50%"
 */
export function formatPercent(val: number, showSign = true): string {
  const sign = val > 0 ? (showSign ? '+' : '') : '';
  return `${sign}${val.toFixed(2)}%`;
}

/**
 * Formats large volume numbers into Lakhs or Crores
 */
export function formatVolume(val: number): string {
  if (val >= 10000000) {
    return `${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `${(val / 100000).toFixed(2)} L`;
  }
  if (val >= 1000) {
    return `${(val / 1000).toFixed(1)} K`;
  }
  return val.toString();
}

/**
 * Formats market cap in ₹ Crores
 */
export function formatMarketCap(crores: number): string {
  if (crores >= 100000) {
    return `₹${(crores / 100000).toFixed(2)} Lakh Cr`;
  }
  return `₹${crores.toLocaleString('en-IN')} Cr`;
}

/**
 * Formats timestamp into local time (e.g., "14:35:10")
 */
export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return isoString;
  }
}

/**
 * Formats date (e.g., "23 Sep 2026")
 */
export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoString;
  }
}

/**
 * Formats date and time
 */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoString;
  }
}
