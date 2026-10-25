import type { TraceStep } from "../../shared/api/types";
import { formatMs } from "../../shared/lib/format";
import styles from "./TraceList.module.css";

/** What the model did, step by step: for anyone asking why a run came out the way it did. */
export function TraceList({ trace }: { trace: TraceStep[] }) {
  if (!trace.length) return null;
  return (
    <details className={styles.details}>
      <summary>What the model did ({trace.length} steps)</summary>
      <ol className={styles.list}>
        {trace.map((t, i) => (
          <li key={i} data-ok={t.ok !== false}>
            <span className={styles.turn}>Turn {t.turn}</span>
            <span>{t.kind === "model" ? `Model chose: ${t.detail ?? "text"}` : `Tool ${t.name}${t.ok === false ? " failed" : ""}`}</span>
            <span className={styles.ms}>{formatMs(t.ms)}</span>
            {t.ok === false && t.detail && <span className={styles.detail}>{t.detail}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}
