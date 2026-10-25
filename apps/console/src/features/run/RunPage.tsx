import { AnimatePresence, motion as m } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useSkills, useStartRun } from "../../shared/api/queries";
import type { SkillSummary } from "../../shared/api/types";
import { titleOf } from "../../shared/lib/labels";
import { motion } from "../../shared/theme/motion";
import { EmptyState, QueryView } from "../../shared/ui/states";
import { RecentRuns } from "../runs/RecentRuns";
import styles from "./RunPage.module.css";
import { SkillForm } from "./SkillForm";

/** Pick a skill your role may run, fill in its inputs, run it. */
export function RunPage() {
  const skills = useSkills();
  const [chosen, setChosen] = useState<string | null>(null);
  const start = useStartRun();
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Run a skill</h1>
        <p className={styles.lead}>Code computes the figures, the model explains them, and checks stop anything that does not hold up before you read it.</p>
      </header>
      <QueryView query={skills} what="the skills" lines={6} isEmpty={(d) => d.skills.filter((s) => s.canRun).length === 0}
        empty={<EmptyState title="No skills for your role yet">Ask the platform team which skills are planned for your role.</EmptyState>}>
        {(d) => {
          const mine = d.skills.filter((s) => s.canRun);
          const skill = mine.find((s) => s.name === chosen) ?? mine[0]!;
          return (
            <div className={styles.columns}>
              <ul className={styles.picker} aria-label="Skills you can run">
                {mine.map((s) => (
                  <li key={s.name}>
                    <button type="button" className={styles.option} aria-pressed={s.name === skill.name} onClick={() => setChosen(s.name)}>
                      <span className={styles.optionTitle}>{titleOf(s.name)}</span>
                      <span className={styles.optionMeta}>
                        {s.version}, {s.classification === "aggregate" ? "group figures only" : "individual proposals"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <section className={styles.formBox} aria-labelledby="form-title">
                <AnimatePresence mode="wait" initial={false}>
                  <m.div key={skill.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: motion.base, ease: motion.ease }}>
                    <SkillIntro skill={skill} model={d.model} />
                    <SkillForm schema={skill.inputs} busy={start.isPending} onSubmit={(input) => start.mutate({ skill: skill.name, input }, { onSuccess: (run) => navigate(`/runs/${run.id}`) })} />
                    {start.isError && <p className={styles.error} role="alert">{start.error.message}</p>}
                  </m.div>
                </AnimatePresence>
              </section>
            </div>
          );
        }}
      </QueryView>
      <RecentRuns />
    </div>
  );
}

function SkillIntro({ skill, model }: { skill: SkillSummary; model: string }) {
  return (
    <div className={styles.intro}>
      <h2 id="form-title" className={styles.skillTitle}>{titleOf(skill.name)}</h2>
      <p className={styles.description}>{skill.description}</p>
      {model.startsWith("simulated") && (
        <p className={styles.notice}>This deployment runs the simulated model: figures and checks are real, the wording is a template.</p>
      )}
    </div>
  );
}
