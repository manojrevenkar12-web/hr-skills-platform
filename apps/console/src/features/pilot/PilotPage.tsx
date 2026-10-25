import { usePilot } from "../../shared/api/queries";
import { formatMs, plural, share } from "../../shared/lib/format";
import { issueName, titleOf } from "../../shared/lib/labels";
import { EmptyState, QueryView } from "../../shared/ui/states";
import styles from "./PilotPage.module.css";

/**
 * What the steering meeting needs: is it used, is it useful, how much time does it save, and why
 * do runs disappoint. Time saved is the users' own estimate and is labelled as such.
 */
export function PilotPage() {
  const pilot = usePilot();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Pilot</h1>
        <p className={styles.lead}>Use and feedback over the last four weeks, per skill.</p>
      </header>
      <QueryView query={pilot} what="the pilot figures" lines={8} isEmpty={(d) => d.skills.length === 0}
        empty={<EmptyState title="No runs in the last four weeks">The figures appear once pilot users run skills.</EmptyState>}>
        {(d) => {
          const maxUsers = Math.max(1, ...d.weekly.map((w) => w.users));
          return (
            <>
              <section className={styles.weekly} aria-labelledby="weekly">
                <h2 id="weekly" className={styles.sectionTitle}>People using it each week</h2>
                <div className={styles.bars} role="img" aria-label={d.weekly.map((w) => `week of ${w.week}: ${w.users} people`).join("; ")}>
                  {d.weekly.map((w) => (
                    <div key={w.week} className={styles.barCol}>
                      <span className={styles.barValue}>{w.users}</span>
                      <span className={styles.bar} style={{ height: `${(w.users / maxUsers) * 100}%` }} />
                      <span className={styles.barLabel}>{w.week.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <ul className={styles.skills}>
                {d.skills.map((s) => (
                  <li key={s.skill} className={styles.skill}>
                    <h2 className={styles.skillTitle}>{titleOf(s.skill)}</h2>
                    <dl className={styles.figures}>
                      <div><dt>Runs</dt><dd>{s.runs}</dd><dd className={styles.small}>{plural(s.users, "person", "people")}</dd></div>
                      <div><dt>Passed checks</dt><dd>{share(s.ok, s.runs)}%</dd><dd className={styles.small}>{s.held} held, {s.failed} failed</dd></div>
                      <div><dt>Rated useful</dt><dd>{s.rated ? `${share(s.useful, s.rated)}%` : "–"}</dd><dd className={styles.small}>{s.rated} of {s.runs} rated</dd></div>
                      <div><dt>Time saved, reported</dt><dd>{Math.round(s.minutesSaved / 60)} h</dd><dd className={styles.small}>median {s.medianMinutesSaved ?? "–"} min per run</dd></div>
                      <div><dt>Slowest runs</dt><dd>{formatMs(s.p95Ms)}</dd><dd className={styles.small}>95th percentile</dd></div>
                    </dl>
                    {s.issues.length > 0 && (
                      <p className={styles.issues}>
                        Reported problems: {s.issues.map((i) => `${issueName[i.issue] ?? i.issue} (${i.n})`).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </QueryView>
    </div>
  );
}
