import { useSkills } from "../../shared/api/queries";
import { roleName, titleOf, validatorName } from "../../shared/lib/labels";
import { EmptyState, QueryView } from "../../shared/ui/states";
import { ReleaseLadder } from "./ReleaseLadder";
import styles from "./SkillsPage.module.css";

/** Every skill, how far it is on the road to release, and who may use it. */
export function SkillsPage() {
  const skills = useSkills();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Skills</h1>
        <p className={styles.lead}>A skill reaches users only after it meets the review standard, passes its golden cases, holds every injected mistake and has been measured on a blind set.</p>
      </header>
      <QueryView query={skills} what="the skills" lines={8} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title="No skills yet">Skills appear here when they are merged into skills/.</EmptyState>}>
        {(d) => (
          <ul className={styles.list}>
            {d.skills.map((s) => (
              <li key={s.name} className={styles.skill}>
                <div className={styles.top}>
                  <div className={styles.name}>
                    <h2 className={styles.skillTitle}>{titleOf(s.name)}</h2>
                    <span className={styles.version}>{s.version}</span>
                  </div>
                  <p className={styles.who}>
                    {s.classification === "aggregate" ? "Group figures only" : "Individual proposals"}, for {s.audience.map((r) => roleName[r]).join(", ")}
                  </p>
                </div>
                <p className={styles.description}>{s.description}</p>
                <ReleaseLadder skill={s} />
                <details className={styles.more}>
                  <summary>Checks every result must pass</summary>
                  <ul className={styles.checks}>
                    {s.validators.map((v) => <li key={v}>{validatorName[v] ?? v}</li>)}
                  </ul>
                </details>
                {s.releaseProblems.length > 0 && <p className={styles.problem}>{s.releaseProblems.join(" ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </div>
  );
}
