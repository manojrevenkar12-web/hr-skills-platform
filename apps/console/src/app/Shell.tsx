import { NavLink, Outlet } from "react-router";

import { useSession } from "../features/auth/session";
import type { Role } from "../shared/api/types";
import { roleName } from "../shared/lib/labels";
import styles from "./Shell.module.css";

const NAV: { to: string; label: string; roles?: Role[] }[] = [
  { to: "/", label: "Run a skill" },
  { to: "/skills", label: "Skills" },
  { to: "/pilot", label: "Pilot", roles: ["people_analytics", "comp_partner", "hr_leadership"] },
  { to: "/audit", label: "Audit trail", roles: ["people_analytics"] },
];

export function Shell() {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <div>
      <a className={styles.skip} href="#main">Skip to content</a>
      <header className={styles.bar}>
        <span className={styles.product}>Skills Workbench</span>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.user}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{roleName[user.role]}</span>
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
