import type { SkillSummary } from "../../shared/api/types";
import { formatPct } from "../../shared/lib/format";
import styles from "./ReleaseLadder.module.css";

/**
 * The road from a draft skill to one people may use, as five rungs: the review standard, the
 * golden cases, the injected mistakes, a blind held-out set, and the recorded release. A rung is
 * lit only when it is met; the label under it says what was measured.
 */
type Rung = { label: string; state: "met" | "open" | "warn"; detail: string };

export function rungs(s: SkillSummary): Rung[] {
  const errors = s.lint.filter((l) => l.severity === "error").length;
  const ev = s.evaluation;
  const held = s.heldout[0];
  const metric = held?.firstRun && Object.entries(held.firstRun.metrics)[0];
  return [
    { label: "Review standard", state: errors ? "warn" : "met", detail: errors ? `${errors} problems` : "passes" },
    { label: "Golden cases", state: !ev ? "open" : ev.passed === ev.cases ? "met" : "warn", detail: ev ? `${ev.passed} of ${ev.cases}` : "not run" },
    { label: "Injected mistakes", state: !ev || !ev.faults ? "open" : ev.faultsCaught === ev.faults ? "met" : "warn", detail: ev?.faults ? `${ev.faultsCaught} of ${ev.faults} held` : "none" },
    {
      label: "Blind held-out",
      state: !held?.firstRun ? "open" : held.firstRun.passed === held.firstRun.cases && !metric ? "met" : "warn",
      detail: !held ? "no set yet" : !held.firstRun ? "not run" : metric ? `${metric[0].replace(/_/g, " ")} ${formatPct(metric[1] * 100)}` : `${held.firstRun.passed} of ${held.firstRun.cases}`,
    },
    {
      label: "Released",
      state: s.released && s.releaseStatus === "unchanged" ? "met" : s.releaseStatus === "blocked" ? "warn" : "open",
      detail: s.released ? `${s.released.version}${s.releaseStatus === "unchanged" ? "" : ", changed since"}` : "not yet",
    },
  ];
}

export function ReleaseLadder({ skill }: { skill: SkillSummary }) {
  return (
    <ol className={styles.ladder} aria-label={`Release path of ${skill.name}`}>
      {rungs(skill).map((r) => (
        <li key={r.label} className={styles.rung} data-state={r.state}>
          <span className={styles.step} aria-hidden="true" />
          <span className={styles.label}>{r.label}</span>
          <span className={styles.detail}>
            {r.detail}
            <span className="visually-hidden">{r.state === "met" ? " (met)" : r.state === "warn" ? " (needs attention)" : " (not yet)"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
