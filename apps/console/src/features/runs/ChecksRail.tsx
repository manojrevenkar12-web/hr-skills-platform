import { motion as m, useReducedMotion } from "framer-motion";

import { validatorName } from "../../shared/lib/labels";
import { motion } from "../../shared/theme/motion";
import styles from "./ChecksRail.module.css";

/**
 * The checks a result passed or failed, in the order the platform ran them. When a run finishes,
 * they tick in one after another: the one moment of motion on this page, and it says what
 * happened (each check ran, and this is its verdict).
 */
export function ChecksRail({ validators, findings }: { validators: string[]; findings: { validator: string; message: string }[] }) {
  const reduce = useReducedMotion();
  return (
    <section className={styles.rail} aria-labelledby="checks">
      <h2 id="checks" className={styles.title}>Checks</h2>
      <ol className={styles.list}>
        {validators.map((v, i) => {
          const failed = findings.filter((f) => f.validator === v);
          return (
            <m.li key={v} className={styles.check} data-ok={failed.length === 0} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * motion.stagger * 2, duration: motion.base, ease: motion.ease }}>
              <span className={styles.mark} aria-hidden="true">{failed.length ? "!" : "✓"}</span>
              <span className={styles.name}>
                {validatorName[v] ?? v}
                <span className="visually-hidden">{failed.length ? ": failed" : ": passed"}</span>
              </span>
              {failed.length > 0 && (
                <ul className={styles.problems}>
                  {failed.map((f, k) => <li key={k}>{f.message}</li>)}
                </ul>
              )}
            </m.li>
          );
        })}
      </ol>
    </section>
  );
}
