import { AnimatePresence, motion as m } from "framer-motion";
import { Link, useParams } from "react-router";

import { useRun } from "../../shared/api/queries";
import type { Run } from "../../shared/api/types";
import { formatDateTime, formatMs } from "../../shared/lib/format";
import { titleOf } from "../../shared/lib/labels";
import { motion } from "../../shared/theme/motion";
import { QueryView, Skeleton } from "../../shared/ui/states";
import { Status } from "../../shared/ui/Status";
import { ChecksRail } from "./ChecksRail";
import { LevellingDecision } from "./computed/LevellingDecision";
import { MeritFigures } from "./computed/MeritFigures";
import { PayGapFigures } from "./computed/PayGapFigures";
import { FeedbackForm } from "./FeedbackForm";
import { ModelProse, ModelSection } from "./ModelProse";
import styles from "./RunDetailPage.module.css";
import { TraceList } from "./TraceList";

/**
 * One run, in three layers: the checks it passed, what code computed, and what the model wrote.
 */
export function RunDetailPage() {
  const id = useParams().id ?? "";
  const run = useRun(id);
  return (
    <QueryView query={run} what="the run" lines={8}>
      {(r) => <RunView run={r} />}
    </QueryView>
  );
}

function RunView({ run }: { run: Run }) {
  const validators = run.validators;
  const working = run.status === "queued" || run.status === "running";
  const result = run.status === "ok" || run.status === "held";
  const grounded = !run.findings.some((f) => f.validator === "grounded_numbers");

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>Back to skills</Link>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{titleOf(run.skill)}</h1>
          <p className={styles.sub}>
            <span>Version {run.version}</span>
            <span>{run.model ?? "model pending"}</span>
            <span>{formatDateTime(run.createdAt)}</span>
            {run.durationMs !== null && <span>{formatMs(run.durationMs)}</span>}
          </p>
        </div>
        <Status status={run.status} />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {working ? (
          <m.div key="working" className={styles.working} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motion.base }}>
            <p>{run.status === "queued" ? "Waiting for a worker." : "The model is following the skill: running its scripts, then writing."}</p>
            <Skeleton lines={5} label="Running the skill" />
          </m.div>
        ) : !result ? (
          <m.div key="stopped" className={styles.stopped} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motion.base }}>
            <p className={styles.stoppedTitle}>{run.status === "refused" ? "This run was refused" : "This run did not produce a result"}</p>
            <p>{run.error ?? "No reason was recorded."}</p>
            <TraceList trace={run.trace} />
          </m.div>
        ) : (
          <m.div key="result" className={styles.result} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motion.base }}>
            <ChecksRail validators={validators} findings={run.findings} />
            <div className={styles.layers}>
              {run.status === "held" && (
                <p className={styles.heldNote} role="note">Held: at least one check failed, so this result must not be used as it is. The checks say why.</p>
              )}
              <Layers run={run} grounded={grounded} />
              <TraceList trace={run.trace} />
              <FeedbackForm run={run} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Layers({ run, grounded }: { run: Run; grounded: boolean }) {
  const o = run.output ?? {};
  switch (run.skill) {
    case "pay-gap-report":
      return (
        <>
          {"indicators" in o && <PayGapFigures output={o} />}
          <ModelSection title="Written by the model: memo for HR leadership">
            <ModelProse text={String(o.memo ?? "")} grounded={grounded} />
            {Array.isArray(o.caveats) && (o.caveats as string[]).map((c, i) => <ModelProse key={i} text={c} grounded={grounded} />)}
          </ModelSection>
        </>
      );
    case "merit-cycle-check": {
      const notes = (o.notes as { orgUnit: string; note: string }[] | undefined) ?? [];
      return (
        <>
          {"summary" in o && <MeritFigures output={o} />}
          <ModelSection title="Written by the model: notes for managers">
            {notes.length ? notes.map((n) => (
              <div key={n.orgUnit} className={styles.note}>
                <h3 className={styles.noteTitle}>{n.orgUnit}</h3>
                <ModelProse text={n.note} grounded={grounded} />
              </div>
            )) : <p>Nothing blocks sign-off, so there are no notes to send.</p>}
          </ModelSection>
        </>
      );
    }
    case "job-levelling":
      return (
        <>
          <LevellingDecision output={o} />
          <ModelSection title="Written by the model: rationale">
            <ModelProse text={String(o.rationale ?? "")} grounded={grounded} />
          </ModelSection>
        </>
      );
    default:
      return <pre className={styles.raw}>{JSON.stringify(o, null, 2)}</pre>;
  }
}
