import { formatPct } from "../../../shared/lib/format";
import styles from "./computed.module.css";
import { ComputedSection } from "./Section";

interface Category { category: string; women: number; men: number; suppressed: boolean; basicMeanGapPct: number | null; totalMeanGapPct: number | null; adjustedBasicGapPct: number | null; flagged: boolean }
interface Out {
  indicators: { meanGapPct: number; medianGapPct: number; variableMeanGapPct: number | null; variableMedianGapPct: number | null; receivingVariable: { womenPct: number; menPct: number }; quartiles: { quartile: number; women: number; men: number; womenPct: number; menPct: number }[] };
  categories: Category[];
  findings: { id: string; message: string }[];
  population: { women: number; men: number; diverseNotInGap: number };
}

export function PayGapFigures({ output }: { output: Record<string, unknown> }) {
  const o = output as unknown as Out;
  const i = o.indicators;
  return (
    <ComputedSection title="Computed by code (Art. 9 indicators)">
      <dl className={styles.headline}>
        <div><dt>Mean gap, hourly pay</dt><dd>{formatPct(i.meanGapPct)}</dd></div>
        <div><dt>Median gap</dt><dd>{formatPct(i.medianGapPct)}</dd></div>
        <div><dt>Gap in variable pay</dt><dd>{formatPct(i.variableMeanGapPct)}</dd></div>
        <div><dt>Receiving variable pay</dt><dd>{formatPct(i.receivingVariable.womenPct)} women, {formatPct(i.receivingVariable.menPct)} men</dd></div>
      </dl>
      <div className={styles.quartiles} role="group" aria-label="Women and men in each quartile pay band">
        {i.quartiles.map((q) => (
          <div key={q.quartile} className={styles.quartile}>
            <span>{q.quartile === 1 ? "Lowest quartile" : q.quartile === 4 ? "Highest quartile" : `Quartile ${q.quartile}`}</span>
            <div className={styles.bar} role="img" aria-label={`${q.womenPct}% women, ${q.menPct}% men`}>
              <span className={styles.women} style={{ width: `${q.womenPct}%` }} />
              <span className={styles.men} style={{ width: `${q.menPct}%` }} />
            </div>
          </div>
        ))}
        <div className={styles.legend}>
          <span><span className={`${styles.key} ${styles.women}`} />Women</span>
          <span><span className={`${styles.key} ${styles.men}`} />Men</span>
        </div>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="visually-hidden">Gap by category of workers</caption>
          <thead>
            <tr><th>Category</th><th className="num">Women</th><th className="num">Men</th><th className="num">Basic pay gap</th><th className="num">Total pay gap</th><th className="num">After tenure and location</th></tr>
          </thead>
          <tbody>
            {o.categories.map((c) => (
              <tr key={c.category} data-flag={c.flagged}>
                <td>{c.category}</td>
                <td className="num">{c.women}</td>
                <td className="num">{c.men}</td>
                {c.suppressed ? (
                  <td colSpan={3} className={styles.muted}>Not reported: fewer than six women or six men</td>
                ) : (
                  <>
                    <td className="num">{formatPct(c.basicMeanGapPct)}</td>
                    <td className="num">{formatPct(c.totalMeanGapPct)}</td>
                    <td className="num">{formatPct(c.adjustedBasicGapPct)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Findings findings={o.findings} />
    </ComputedSection>
  );
}

export function Findings({ findings }: { findings: { id: string; message: string; severity?: string }[] }) {
  if (!findings.length) return <p className={styles.muted}>No findings.</p>;
  return (
    <ul className={styles.findings} aria-label="Findings">
      {findings.map((f) => (
        <li key={f.id} className={styles.finding} data-severity={f.severity ?? "blocking"}>
          <span className={styles.findingId}>{f.id}</span>
          <span>{f.message}</span>
        </li>
      ))}
    </ul>
  );
}
