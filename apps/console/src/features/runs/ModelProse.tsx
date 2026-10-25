import type { ReactNode } from "react";

import styles from "./ModelProse.module.css";

// figures, not digits inside ids like PG-001 or codes like L3
const NUMBER = /(?<![\w.-])(\d+(?:\.\d+)?-\d+(?:\.\d+)?%|-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?%?)(?![\w-])/g;

/**
 * Text the model wrote, set in the serif "model voice". Figures in it are marked: the checks have
 * already confirmed each one comes from the computed data (or the run would be held).
 */
export function ModelProse({ text, grounded }: { text: string; grounded: boolean }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      <span key={i} className={grounded ? styles.figure : styles.unchecked} title={grounded ? "From the computed figures" : "Not confirmed by the checks"}>
        {m[0]}
      </span>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className={styles.prose}>{parts}</p>;
}

export function ModelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}
