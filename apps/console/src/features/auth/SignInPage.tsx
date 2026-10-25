import { useQuery } from "@tanstack/react-query";
import { motion as m } from "framer-motion";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { api, ApiError } from "../../shared/api/client";
import { roleName } from "../../shared/lib/labels";
import { motion } from "../../shared/theme/motion";
import { EmptyState, QueryView } from "../../shared/ui/states";
import { useSession } from "./session";
import styles from "./SignInPage.module.css";

/**
 * The demo sign-in: pick one of the invented people. A client deployment signs in through the
 * client's identity provider instead, and this page is not served.
 */
export function SignInPage() {
  const { user, signIn } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const users = useQuery({ queryKey: ["demo-users"], queryFn: api.demoUsers, retry: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={from} replace />;

  async function pick(email: string) {
    setBusy(email);
    setError(null);
    try {
      await signIn(email);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className={styles.page}>
      <m.section className={styles.panel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motion.slow, ease: motion.ease }} aria-labelledby="title">
        <h1 id="title" className={styles.title}>Skills Workbench</h1>
        <p className={styles.lead}>Run the HR team's AI skills, see what code computed and what the model wrote, and tell the platform team how it went.</p>
        <QueryView
          query={users}
          what="the demo people"
          lines={5}
          isEmpty={(d) => d.users.length === 0}
          empty={<EmptyState title="No demo people">This deployment signs in through your company account.</EmptyState>}
        >
          {(d) => (
            <ul className={styles.people} aria-label="Sign in as">
              {d.users.map((u) => (
                <li key={u.id}>
                  <button type="button" className={styles.person} disabled={busy !== null} aria-busy={busy === u.email || undefined} onClick={() => void pick(u.email)}>
                    <span className={styles.name}>{u.name}</span>
                    <span className={styles.role}>{roleName[u.role]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <p className={styles.note}>Demo company, people and pay are invented.</p>
      </m.section>
    </main>
  );
}
