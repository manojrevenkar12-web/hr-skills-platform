import type { RunStatus } from "../api/types";
import { statusName } from "../lib/labels";
import styles from "./Status.module.css";

/** A run's status as a word with its colour; the word carries the meaning, not the colour. */
export function Status({ status }: { status: RunStatus }) {
  return (
    <span className={styles.status} data-status={status}>
      <span className={styles.dot} aria-hidden="true" />
      {statusName[status]}
    </span>
  );
}
