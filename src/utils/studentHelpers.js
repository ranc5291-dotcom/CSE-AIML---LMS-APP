// Helpers for student entry type and last login.

export function isLateralStudent(s) {
  return String(s?.entry_type || "").toLowerCase() === "lateral";
}

// Returns the most recent login time (ISO string) for a student, or null.
// Uses profiles.last_login_at first, then falls back to the login log.
export function lastLoginOf(s, loginLog) {
  if (!s) return null;
  let best = s.last_login_at ? new Date(s.last_login_at).getTime() : 0;

  const entries = Array.isArray(loginLog)
    ? loginLog
    : loginLog && typeof loginLog === "object"
      ? Object.values(loginLog).flat()
      : [];

  for (const e of entries) {
    if (!e) continue;
    const uid = e.user_id ?? e.uid ?? e.id;
    if (uid !== s.id && uid !== s.uid) continue;
    const t = new Date(e.created_at ?? e.logged_in_at ?? e.timestamp ?? e.time ?? 0).getTime();
    if (t > best) best = t;
  }
  return best ? new Date(best).toISOString() : null;
}
