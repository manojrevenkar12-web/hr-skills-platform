import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../api/client";
import styles from "./states.module.css";

export function Skeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.bar} data-short={i % 3 === 2 || undefined} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, what }: { error: unknown; onRetry?: () => void; what: string }) {
  const status = error instanceof ApiError ? error.status : undefined;
  const detail = error instanceof Error ? error.message : String(error);
  const hint = hintFor(status);
  return (
    <div className={styles.error} role="alert">
      <p className={styles.title}>Could not load {what}</p>
      <p className={styles.detail}>{detail}</p>
      <p className={styles.hint}>{hint}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function hintFor(status: number | undefined): string {
  switch (status) {
    case 0:
      return "The server did not answer. Check your connection, then try again.";
    case 401:
      return "Your session has ended. Sign in again.";
    case 403:
      return "Your role cannot open this. Ask the platform team if you need it.";
    case 404:
      return "It does not exist any more. Pick another from the list.";
    default:
      return "Try again. If it keeps failing, tell the platform team.";
  }
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.detail}>{children}</div>}
    </div>
  );
}

/** One place that decides loading, error and empty for a query. */
export function QueryView<T>({
  query,
  what,
  isEmpty,
  empty,
  lines,
  children,
}: {
  query: UseQueryResult<T>;
  what: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  lines?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Skeleton lines={lines} label={`Loading ${what}`} />;
  if (query.isError) return <ErrorState error={query.error} what={what} onRetry={() => void query.refetch()} />;
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState title={`No ${what} yet`} />}</>;
  return <>{children(query.data)}</>;
}
