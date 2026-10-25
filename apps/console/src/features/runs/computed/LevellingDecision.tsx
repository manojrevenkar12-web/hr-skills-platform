import styles from "./computed.module.css";
import { ComputedSection } from "./Section";

interface Out {
  family: string;
  level: string;
  alternativeLevel?: string | null;
  confidence: string;
  needsReview: boolean;
  evidence: { criterion: string; quote: string; pointsTo: string }[];
}
const LEVELS = ["L1", "L2", "L3", "L4", "L5", "L6"];

/** The model's proposal, checked: the level exists, every quote is in the description. */
export function LevellingDecision({ output }: { output: Record<string, unknown> }) {
  const o = output as unknown as Out;
  return (
    <ComputedSection tone="model" title={`Proposed by the model: ${o.family}, ${o.level}`}>
      <div className={styles.ladder} role="img" aria-label={`Level ${o.level}${o.alternativeLevel ? `, alternative ${o.alternativeLevel}` : ""}`}>
        {LEVELS.map((l) => (
          <span key={l} className={styles.rung} data-chosen={l === o.level} data-alt={l === o.alternativeLevel}>{l}</span>
        ))}
      </div>
      <p>
        Confidence <strong>{o.confidence}</strong>. {o.needsReview ? "A compensation partner must review this before it is used." : "Review is still advised before a band is attached."}
      </p>
      <ul className={styles.evidence} aria-label="Evidence from the job description">
        {o.evidence.map((e, i) => (
          <li key={i}>
            <span className={styles.criterion}>{e.criterion}</span>
            <span className={styles.quote}>“{e.quote}”</span>
            <span>{e.pointsTo}</span>
          </li>
        ))}
      </ul>
    </ComputedSection>
  );
}
