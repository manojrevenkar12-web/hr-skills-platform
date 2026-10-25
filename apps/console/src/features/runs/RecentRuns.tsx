import { Link } from "react-router";

import { useRuns } from "../../shared/api/queries";
import { formatDateTime, formatMs } from "../../shared/lib/format";
import { titleOf } from "../../shared/lib/labels";
import { EmptyState, QueryView } from "../../shared/ui/states";
import { Status } from "../../shared/ui/Status";
import styles from "./RecentRuns.module.css";

export function RecentRuns() {
  const runs = useRuns();
  return (
    <section className={styles.section} aria-labelledby="recent">
      <h2 id="recent" className={styles.title}>Your recent runs</h2>
      <QueryView query={runs} what="your runs" lines={4} isEmpty={(d) => d.runs.length === 0} empty={<EmptyState title="No runs yet">Your runs appear here, with their checks and your feedback.</EmptyState>}>
        {(d) => (
          <ol className={styles.list}>
            {d.runs.map((r) => (
              <li key={r.id} className={styles.row}>
                <Link to={`/runs/${r.id}`} className={styles.link}>{titleOf(r.skill)}</Link>
                <span className={styles.input}>{summarise(r.input)}</span>
                <Status status={r.status} />
                <span className={styles.meta}>{formatDateTime(r.createdAt)}</span>
                <span className={styles.meta}>{formatMs(r.durationMs)}</span>
                <span className={styles.meta}>{r.feedback ? "Rated" : r.status === "ok" || r.status === "held" ? "Not rated yet" : ""}</span>
              </li>
            ))}
          </ol>
        )}
      </QueryView>
    </section>
  );
}

/** A short reminder of what was asked: the input's values except long text. */
function summarise(input: Record<string, unknown>): string {
  return Object.entries(input)
    .filter(([, v]) => typeof v !== "string" || v.length < 40)
    .map(([, v]) => String(v))
    .join(", ");
}
