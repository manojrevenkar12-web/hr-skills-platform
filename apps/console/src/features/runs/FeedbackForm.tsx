import { AnimatePresence, motion as m } from "framer-motion";
import { useState, type FormEvent } from "react";

import { useFeedback, useProposeCase } from "../../shared/api/queries";
import type { Run } from "../../shared/api/types";
import { issueName } from "../../shared/lib/labels";
import { motion } from "../../shared/theme/motion";
import { Button } from "../../shared/ui/Button";
import styles from "./FeedbackForm.module.css";

const RATINGS = [
  { id: "useful", label: "Useful as it is" },
  { id: "partly", label: "Useful with changes" },
  { id: "not_useful", label: "Not useful" },
] as const;

/** Pilot feedback: the platform team reads this, so it must not contain anyone's personal data. */
export function FeedbackForm({ run }: { run: Run }) {
  const save = useFeedback(run.id);
  const propose = useProposeCase(run.id);
  const [rating, setRating] = useState<string>(run.feedback?.rating ?? "");
  const [minutes, setMinutes] = useState(run.feedback?.minutesSaved?.toString() ?? "");
  const [issues, setIssues] = useState<string[]>(run.feedback?.issues ?? []);
  const [comment, setComment] = useState(run.feedback?.comment ?? "");
  const [note, setNote] = useState("");
  const [proposing, setProposing] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return;
    save.mutate({ rating: rating as NonNullable<Run["feedback"]>["rating"], minutesSaved: minutes ? Number(minutes) : undefined, issues, comment });
  }

  return (
    <section className={styles.box} aria-labelledby="feedback">
      <h2 id="feedback" className={styles.title}>How did this run go?</h2>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.ratings}>
          <legend className="visually-hidden">Rating</legend>
          {RATINGS.map((r) => (
            <label key={r.id} className={styles.rating} data-checked={rating === r.id}>
              <input type="radio" name="rating" value={r.id} checked={rating === r.id} onChange={() => setRating(r.id)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className={styles.field}>
          <span>Minutes it saved you (your estimate)</span>
          <input type="number" min={0} max={600} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <fieldset className={styles.issues}>
          <legend>What was wrong, if anything</legend>
          {Object.entries(issueName).map(([id, label]) => (
            <label key={id} className={styles.issue} data-checked={issues.includes(id)}>
              <input type="checkbox" checked={issues.includes(id)} onChange={(e) => setIssues((xs) => (e.target.checked ? [...xs, id] : xs.filter((x) => x !== id)))} />
              {label}
            </label>
          ))}
        </fieldset>
        <label className={styles.field} data-wide>
          <span>Comment for the platform team (no names, ids or personal data)</span>
          <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={!rating} busy={save.isPending}>{run.feedback ? "Update feedback" : "Send feedback"}</Button>
          <Button onClick={() => setProposing((p) => !p)}>Propose as a test case</Button>
          <AnimatePresence>
            {save.isSuccess && !save.isPending && (
              <m.span className={styles.saved} role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motion.base }}>Feedback sent</m.span>
            )}
          </AnimatePresence>
        </div>
        {save.isError && <p className={styles.error} role="alert">{save.error.message}</p>}
      </form>
      <AnimatePresence initial={false}>
        {proposing && (
          <m.form
            className={styles.propose}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: motion.base, ease: motion.ease }}
            onSubmit={(e) => {
              e.preventDefault();
              propose.mutate({ expectedStatus: "ok", note });
            }}
          >
            <label className={styles.field} data-wide>
              <span>What should a correct run do here?</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} minLength={10} maxLength={300} placeholder="For example: the equity gap in this unit must be found" />
            </label>
            <Button type="submit" disabled={note.trim().length < 10} busy={propose.isPending}>Propose</Button>
            {propose.isSuccess && <p className={styles.saved} role="status">Proposed. The platform team reviews it before it joins the golden cases.</p>}
            {propose.isError && <p className={styles.error} role="alert">{propose.error.message}</p>}
          </m.form>
        )}
      </AnimatePresence>
    </section>
  );
}
