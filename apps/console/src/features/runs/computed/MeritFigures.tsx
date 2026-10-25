import { formatEur, formatPct } from "../../../shared/lib/format";
import styles from "./computed.module.css";
import { Findings } from "./PayGapFigures";
import { ComputedSection } from "./Section";

interface Out {
  summary: { orgUnit: string; proposals: number; costEUR: number; budgetEUR: number; utilisationPct: number; blocking: number; warnings: number }[];
  findings: { id: string; message: string; severity: string; orgUnit: string }[];
}

export function MeritFigures({ output }: { output: Record<string, unknown> }) {
  const o = output as unknown as Out;
  return (
    <ComputedSection title="Computed by code (guideline checks)">
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="visually-hidden">Merit budget by org unit</caption>
          <thead>
            <tr><th>Org unit</th><th className="num">Proposals</th><th className="num">Cost</th><th className="num">Budget</th><th>Budget used</th><th className="num">Blocking</th><th className="num">To confirm</th></tr>
          </thead>
          <tbody>
            {o.summary.map((s) => (
              <tr key={s.orgUnit} data-flag={s.blocking > 0}>
                <td>{s.orgUnit}</td>
                <td className="num">{s.proposals}</td>
                <td className="num">{formatEur(s.costEUR)}</td>
                <td className="num">{formatEur(s.budgetEUR)}</td>
                <td>
                  <div className={styles.util}>
                    <div className={styles.utilBar} role="img" aria-label={`${s.utilisationPct}% of budget`}>
                      <div className={styles.utilFill} data-over={s.utilisationPct > 100} style={{ width: `${Math.min(s.utilisationPct, 100)}%` }} />
                    </div>
                    <span>{formatPct(s.utilisationPct)}</span>
                  </div>
                </td>
                <td className="num">{s.blocking}</td>
                <td className="num">{s.warnings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Findings findings={o.findings.filter((f) => f.severity === "blocking")} />
      {o.findings.some((f) => f.severity !== "blocking") && (
        <details className={styles.more}>
          <summary>{o.findings.filter((f) => f.severity !== "blocking").length} proposals to confirm (warnings)</summary>
          <Findings findings={o.findings.filter((f) => f.severity !== "blocking")} />
        </details>
      )}
    </ComputedSection>
  );
}
