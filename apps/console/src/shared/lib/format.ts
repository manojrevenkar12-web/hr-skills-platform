const dt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const num = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatDateTime = (iso: string) => dt.format(new Date(iso));
export const formatNumber = (n: number | null | undefined) => (n === null || n === undefined ? "–" : num.format(n));
export const formatPct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${num.format(n)}%`);
export const formatEur = (n: number) => eur.format(n);
export const formatMs = (ms: number | null) => (ms === null ? "–" : ms < 1000 ? `${ms} ms` : `${num.format(ms / 1000)} s`);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const share = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
