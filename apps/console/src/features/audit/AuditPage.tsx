import { useAudit } from "../../shared/api/queries";
import { formatDateTime } from "../../shared/lib/format";
import { EmptyState, QueryView } from "../../shared/ui/states";
import styles from "./AuditPage.module.css";

/** Who did what: sign-ins, runs, refusals, MCP calls and feedback. Never the HR data itself. */
export function AuditPage() {
  const audit = useAudit();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Audit trail</h1>
        <p className={styles.lead}>Append-only: the database refuses to change or delete an entry.</p>
      </header>
      <QueryView query={audit} what="the audit trail" lines={8} isEmpty={(d) => d.events.length === 0} empty={<EmptyState title="Nothing recorded yet" />}>
        {(d) => (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className="visually-hidden">Latest 200 audit events</caption>
              <thead><tr><th>When</th><th>Who</th><th>Role</th><th>What</th><th>On</th><th>Outcome</th></tr></thead>
              <tbody>
                {d.events.map((e) => (
                  <tr key={e.id} data-ok={e.ok}>
                    <td>{formatDateTime(e.at)}</td>
                    <td>{e.actor ?? "System"}</td>
                    <td>{e.role ?? ""}</td>
                    <td>{e.action.replace(/[._]/g, " ")}</td>
                    <td>{e.subject ?? ""}</td>
                    <td>{e.ok ? "ok" : "refused or failed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </div>
  );
}
