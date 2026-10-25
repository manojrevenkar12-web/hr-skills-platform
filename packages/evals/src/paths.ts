/**
 * Reads values out of a result for the golden checks: "a.b", "a[].b" (the field of every item),
 * "a.length". Returns undefined when the path does not exist.
 */
export function get(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const part of path.split(".")) {
    if (cur === undefined || cur === null) return undefined;
    if (part === "length" && Array.isArray(cur)) {
      cur = cur.length;
      continue;
    }
    const m = part.match(/^([^[]+)(\[\])?$/);
    if (!m) return undefined;
    const [, key, each] = m;
    if (Array.isArray(cur)) cur = cur.map((x) => (x as Record<string, unknown>)?.[key!]);
    else cur = (cur as Record<string, unknown>)[key!];
    if (each && !Array.isArray(cur)) return undefined;
  }
  return cur;
}

export function same(a: unknown, b: unknown, tolerance = 0.05): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= tolerance;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i], tolerance));
  return JSON.stringify(a) === JSON.stringify(b);
}
