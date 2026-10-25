import type { ReactNode } from "react";

import styles from "./computed.module.css";

/** The "computed by code" layer: figures the platform attached from the skill's scripts. */
export function ComputedSection({ title, children, tone = "computed" }: { title: string; children: ReactNode; tone?: "computed" | "model" }) {
  return (
    <section className={styles.section} data-tone={tone} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}
