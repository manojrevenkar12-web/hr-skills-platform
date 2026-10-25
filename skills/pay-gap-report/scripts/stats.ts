/** Small, dependency-free statistics for the indicators. */
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The pay gap as the Directive defines it: men's minus women's level, as % of men's. */
export function gapPct(women: number, men: number): number | null {
  if (!Number.isFinite(women) || !Number.isFinite(men) || men === 0) return null;
  return round1(((men - women) / men) * 100);
}

export const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Ordinary least squares by the normal equations (fine for a handful of regressors).
 * Returns the coefficients, or null if the design matrix is singular.
 */
export function ols(X: number[][], y: number[]): number[] | null {
  const k = X[0]?.length ?? 0;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k + 1 }, (__, j) => (j < k ? X.reduce((s, r) => s + r[i]! * r[j]!, 0) : X.reduce((s, r, n) => s + r[i]! * y[n]!, 0))));
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    if (Math.abs(A[p]![c]!) < 1e-10) return null;
    [A[c], A[p]] = [A[p]!, A[c]!];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r]![c]! / A[c]![c]!;
      for (let j = c; j <= k; j++) A[r]![j]! -= f * A[c]![j]!;
    }
  }
  return A.map((row, i) => row[k]! / row[i]!);
}
