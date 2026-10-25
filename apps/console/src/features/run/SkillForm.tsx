import { useState, type FormEvent } from "react";

import type { JsonSchema } from "../../shared/api/types";
import { fieldLabel } from "../../shared/lib/labels";
import { Button } from "../../shared/ui/Button";
import styles from "./SkillForm.module.css";

/** Demo defaults and suggestions; the form itself is generated from the skill's input schema. */
const DEFAULTS: Record<string, string> = { entity: "nordwerk-de", year: "2026", cycle: "2026" };
const SUGGEST: Record<string, string[]> = { entity: ["nordwerk-de", "nordwerk-pt"], orgUnit: ["DE-OPS-1", "DE-OPS-2", "DE-ENG-1", "DE-SAL-1"] };

export function SkillForm({ schema, busy, onSubmit }: { schema: JsonSchema; busy: boolean; onSubmit: (input: Record<string, unknown>) => void }) {
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(props.map(([k]) => [k, DEFAULTS[k] ?? ""])));
  const [touched, setTouched] = useState(false);
  const missing = props.filter(([k]) => required.has(k) && !values[k]?.trim()).map(([k]) => k);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (missing.length) return;
    const input: Record<string, unknown> = {};
    for (const [k, p] of props) {
      const v = values[k]?.trim() ?? "";
      if (!v) continue;
      input[k] = p.type === "integer" || p.type === "number" ? Number(v) : v;
    }
    onSubmit(input);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {props.map(([k, p]) => {
        const id = `field-${k}`;
        const long = k === "jobDescription" || (p.maxLength ?? 0) > 1000;
        const invalid = touched && missing.includes(k);
        const set = (v: string) => setValues((s) => ({ ...s, [k]: v }));
        return (
          <div key={k} className={styles.field} data-wide={long || undefined}>
            <label htmlFor={id}>
              {fieldLabel[k] ?? k}
              {required.has(k) && <span className="visually-hidden"> (required)</span>}
            </label>
            {p.enum ? (
              <select id={id} value={values[k]} onChange={(e) => set(e.target.value)} aria-invalid={invalid || undefined}>
                <option value="">{required.has(k) ? "Choose" : "Any"}</option>
                {p.enum.filter((x) => x !== null).map((x) => (
                  <option key={String(x)} value={String(x)}>{String(x)}</option>
                ))}
              </select>
            ) : long ? (
              <textarea id={id} rows={8} value={values[k]} onChange={(e) => set(e.target.value)} aria-invalid={invalid || undefined} placeholder="Paste the job description as it would be published." />
            ) : (
              <>
                <input id={id} inputMode={p.type === "integer" ? "numeric" : undefined} value={values[k]} onChange={(e) => set(e.target.value)} list={SUGGEST[k] ? `${id}-list` : undefined} aria-invalid={invalid || undefined} />
                {SUGGEST[k] && (
                  <datalist id={`${id}-list`}>
                    {SUGGEST[k]!.map((s) => <option key={s} value={s} />)}
                  </datalist>
                )}
              </>
            )}
            {invalid && <span className={styles.problem}>Required</span>}
          </div>
        );
      })}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" busy={busy}>{busy ? "Starting" : "Run skill"}</Button>
      </div>
    </form>
  );
}
