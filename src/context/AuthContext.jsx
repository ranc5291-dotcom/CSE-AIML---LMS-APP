import { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  firebaseLogin,
  firebaseRegister,
  firebaseForgotPassword,
  firebaseChangePassword,
  firebaseLogout,
  onAuthChange,
} from "../utils/firebase";
import { supabase, logLogin, clearSupabaseUserData, getUserRoles, setUserRoles } from "../utils/supabase";
import { removeFCMToken } from "../utils/firebaseMessaging";
import { clearFirestoreUserData } from "../utils/clearAccountData";


const AuthContext = createContext(null);

const SESSION_KEY = "csaimn_user";

function isEmail(val) {
  return /\S+@\S+\.\S+/.test((val || "").trim());
}

const SEM_SEQUENCE = [
  { year: "1st Year", sem: "Sem 1" }, { year: "1st Year", sem: "Sem 2" },
  { year: "2nd Year", sem: "Sem 3" }, { year: "2nd Year", sem: "Sem 4" },
  { year: "3rd Year", sem: "Sem 5" }, { year: "3rd Year", sem: "Sem 6" },
  { year: "4th Year", sem: "Sem 7" }, { year: "4th Year", sem: "Sem 8" },
];

// ── SUPABASE PROFILE HELPERS ────────────────────────────────────
// A person can type their email, USN, or a generic ID into the
// identifier field — this looks it up against whichever column matches.
async function findProfileByIdentifier(identifier, role) {
  const id = identifier.trim();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", role)
    .or(`usn.eq.${id},id.eq.${id},email.eq.${id}`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findProfileByPhone(phone, role) {
  const cleanPhone = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", role)
    .eq("phone", cleanPhone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchProfileById(uid) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── MULTI-ROLE HELPERS ───────────────────────────────────────────
// Merges the user's primary profiles.role with any extra roles granted
// via the user_roles table (deduplicated).
async function resolveRoles(primaryRole, userId) {
  try {
    const extra = await getUserRoles(userId);
    return Array.from(new Set([primaryRole, ...extra].filter(Boolean)));
  } catch (err) {
    console.warn("resolveRoles failed, falling back to primary role only", err);
    return [primaryRole].filter(Boolean);
  }
}

// ── PUBLIC GETTERS (used in dashboards) ──────────────────────────
export async function getAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) { console.warn("getAllProfiles failed", error); return []; }
  return data || [];
}

export async function getAllStudents() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "student");
  if (error) { console.warn("getAllStudents failed", error); return []; }
  return data || [];
}

export async function getAllFaculty() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "faculty");
  if (error) { console.warn("getAllFaculty failed", error); return []; }
  return data || [];
}

export async function getAllPlacement() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "placement");
  if (error) { console.warn("getAllPlacement failed", error); return []; }
  return data || [];
}

export async function getAllAdmins() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "admin");
  if (error) { console.warn("getAllAdmins failed", error); return []; }
  return data || [];
}

// ── AUTH PROVIDER ────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [enrolledVersion, setEnrolledVersion] = useState(0);

  const bump = () => setEnrolledVersion((v) => v + 1);

  // Keep the session synced with Firebase's own auth state (handles page
  // refresh / token expiry). Only applies to email/password sessions —
  // phone-OTP sessions are matched by phone number, not Firebase uid, so
  // they aren't rehydrated here (localStorage SESSION_KEY covers reloads).
  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      if (!fbUser) { setAuthLoading(false); return; }
      try {
        const profile = await fetchProfileById(fbUser.uid);
        if (profile) {
          const roles = await resolveRoles(profile.role, profile.id);
          // Preserve whichever dashboard they were on, if still authorized.
          let prevActiveRole;
          try {
            const prevSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
            prevActiveRole = prevSession?.activeRole;
          } catch {}
          const activeRole = roles.includes(prevActiveRole) ? prevActiveRole : profile.role;

          const sessionUser = { ...profile, uid: fbUser.uid, roles, activeRole };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
          setUser(sessionUser);
        }
      } catch (err) {
        console.warn("Failed to refresh profile from Supabase", err);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Refresh roles on session start (covers phone-OTP users, who aren't
  // rehydrated by the Firebase listener above) and picks up any role
  // changes an admin made since the last login. Keyed on user id so it
  // only re-runs when the logged-in user actually changes.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const roles = await resolveRoles(user.role, user.id);
        const activeRole = roles.includes(user.activeRole) ? user.activeRole : user.role;
        const rolesChanged = JSON.stringify([...roles].sort()) !== JSON.stringify([...(user.roles || [])].sort());
        if (rolesChanged || activeRole !== user.activeRole) {
          const updated = { ...user, roles, activeRole };
          localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
          setUser(updated);
        }
      } catch (err) {
        console.warn("Failed to refresh roles", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── LOGIN ────────────────────────────────────────────────────
  // usedPhoneOtp: pass true when this call follows a successful
  // verifyOTP() — the OTP itself is the proof of identity, so we skip
  // Firebase email/password and look the profile up by phone instead.
  const login = useCallback(async (identifier, password, role, usedPhoneOtp = false) => {
    try {
      let sessionUser;

      if (usedPhoneOtp) {
        const profile = await findProfileByPhone(identifier, role);
        if (!profile) {
          return { success: false, error: "No account found for this phone number." };
        }
        if (profile.role === "student" && profile.status === "dropout") {
          return { success: false, error: "Your account has been deactivated. Please contact the admin." };
        }
        sessionUser = { ...profile };
      } else {
        // Resolve whatever was typed (email, USN, or ID) to an email Firebase understands
        let email = identifier.trim();
        if (!isEmail(email)) {
          const profileByIdentifier = await findProfileByIdentifier(identifier, role);
          if (!profileByIdentifier) {
            return { success: false, error: "Invalid credentials. Check your ID/email and password." };
          }
          email = profileByIdentifier.email;
        }

        const { user: fbUser } = await firebaseLogin(email, password);
        const profile = await fetchProfileById(fbUser.uid);

        if (!profile) {
          return { success: false, error: "Account exists but no profile was found. Contact the admin." };
        }
        if (profile.role !== role) {
          return { success: false, error: `This account is not registered as ${role}.` };
        }
        if (profile.role === "student" && profile.status === "dropout") {
          return { success: false, error: "Your account has been deactivated. Please contact the admin." };
        }

        sessionUser = { ...profile, uid: fbUser.uid };
      }

      // Merge in any extra roles granted via user_roles, default active
      // dashboard is the role they logged in through.
      const roles = await resolveRoles(sessionUser.role, sessionUser.id);
      sessionUser = { ...sessionUser, roles, activeRole: sessionUser.role };

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      bump();
      logLogin(sessionUser); // fire-and-forget, logs into Supabase "login_logs"
      return { success: true, user: sessionUser };

    } catch (err) {
      const code = err?.code || "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        return { success: false, error: "Invalid credentials. Check your ID/email and password." };
      }
      if (code.includes("user-not-found")) {
        return { success: false, error: "No account found. Please register first." };
      }
      if (code.includes("too-many-requests")) {
        return { success: false, error: "Too many attempts. Please try again later." };
      }
      return { success: false, error: err.message || "Login failed." };
    }
  }, []);

  // ── LOGOUT ───────────────────────────────────────────────────
  // Also removes this user's FCM token from Firestore so a signed-out
  // device stops being targetable for push notifications.
  const logout = useCallback(async () => {
    if (user?.id) {
      try { await removeFCMToken(user.id); } catch (err) { console.warn("removeFCMToken failed", err); }
    }
    try { await firebaseLogout(); } catch (err) { console.warn("firebaseLogout failed", err); }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, [user]);

  // ── FORGOT PASSWORD ─────────────────────────────────────────
  const forgotPassword = useCallback(async (email) => {
    try {
      await firebaseForgotPassword(email);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || "Could not send reset email." };
    }
  }, []);

  // ── CHANGE PASSWORD (in-app, requires current password) ────────
  // Only works for accounts that have a real Firebase email/password
  // login (i.e. user.uid is set). Phone-OTP accounts don't have a
  // password at all, so the Settings page hides this option for them.
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await firebaseChangePassword(currentPassword, newPassword);
      return { success: true };
    } catch (err) {
      const code = err?.code || "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        return { success: false, error: "Current password is incorrect." };
      }
      if (code.includes("weak-password")) {
        return { success: false, error: "New password must be at least 6 characters." };
      }
      return { success: false, error: err.message || "Could not change password." };
    }
  }, []);

  // ── REGISTER USER (students + staff) — email always required ──
  const registerUser = useCallback(async (userData) => {
    try {
      if (!userData.email) {
        return { success: false, error: "Email is required to register." };
      }

      // Check duplicates in Supabase BEFORE creating the Firebase account,
      // so we don't create orphaned Firebase users on a rejected registration.
      const orFilters = [`email.eq.${userData.email}`];
      if (userData.usn) orFilters.push(`usn.eq.${userData.usn}`);
      const { data: dup, error: dupErr } = await supabase
        .from("profiles")
        .select("id")
        .or(orFilters.join(","))
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (dup) {
        return { success: false, error: "This email or USN is already registered. Please login instead." };
      }

      const { user: fbUser } = await firebaseRegister(userData.email, userData.password);

      const newProfile = {
        id:         fbUser.uid,
        role:       userData.role,
        name:       userData.name,
        usn:        userData.usn ? userData.usn.toUpperCase() : null,
        email:      userData.email,
        phone:      userData.phone || null,
        branch:     userData.branch || "CSEAIML",
        dept:       userData.dept || null,
        subject:    userData.subject || null,
        year:       userData.year || null,
        sem:        userData.sem || null,
        start_year: userData.startYear || null,
        end_year:   userData.endYear || null,
        status:     userData.status || "active",
      };

      const { error: insertErr } = await supabase.from("profiles").insert(newProfile);
      if (insertErr) {
        // The Firebase account now exists but has no matching profile row.
        // Surface this clearly rather than silently losing the data.
        return { success: false, error: "Account created but saving your profile failed: " + insertErr.message };
      }

      return { success: true, user: { ...newProfile, uid: fbUser.uid } };

    } catch (err) {
      const code = err?.code || "";
      if (code.includes("email-already-in-use")) {
        return { success: false, error: "This email is already registered." };
      }
      if (code.includes("weak-password")) {
        return { success: false, error: "Password must be at least 6 characters." };
      }
      return { success: false, error: "Registration error: " + err.message };
    }
  }, []);

  // ── STUDENT STATUS MANAGEMENT (admin only) ────────────────────
  const updateStudentStatus = useCallback(async (studentId, status, extraData = {}) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status, ...extraData })
        .eq("id", studentId);
      if (error) throw error;
      bump();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const promoteStudent = useCallback(async (studentId) => {
    const { data: student, error } = await supabase
      .from("profiles").select("*").eq("id", studentId).maybeSingle();
    if (error || !student) return { success: false, error: "Student not found." };

    const currentIdx = SEM_SEQUENCE.findIndex((s) => s.sem === student.sem && s.year === student.year);
    if (currentIdx === -1 || currentIdx >= SEM_SEQUENCE.length - 1) {
      return { success: false, error: "Student is already in final semester." };
    }
    const next = SEM_SEQUENCE[currentIdx + 1];
    return updateStudentStatus(studentId, "active", { year: next.year, sem: next.sem });
  }, [updateStudentStatus]);

  const detainStudent = useCallback(
    (studentId) => updateStudentStatus(studentId, "detained"),
    [updateStudentStatus]
  );

  // ── REMOVE STUDENT ─────────────────────────────────────────────
  // This deletes the Supabase profile row only. It does NOT delete the
  // underlying Firebase Auth account — deleting a Firebase user requires
  // the Admin SDK from a backend, which this client-side app doesn't have.
  // The person could still technically sign in to Firebase, but with no
  // profile row they'll hit "Account exists but no profile was found."
  const removeStudent = useCallback(async (studentId) => {
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", studentId);
      if (error) throw error;
      bump();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ── LOGIN LOG (for admin dashboard) ────────────────────────────
  const getLoginLog = useCallback(async () => {
    const { data, error } = await supabase
      .from("login_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.warn("getLoginLog failed", error); return []; }
    return data || [];
  }, []);

  // ── UPDATE USER PROFILE ─────────────────────────────────────────
  const updateUserProfile = useCallback(async (userId, updates) => {
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;

      if (user && user.id === userId) {
        const updated = { ...user, ...updates };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        setUser(updated);
      }
      bump();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [user]);

  // ── CLEAR ACCOUNT DATA (wipes Firestore + Supabase data for this user) ──
  const clearAccountData = useCallback(async () => {
    if (!user?.id) return { success: false, error: "No authenticated user." };
    const uid = user.id, role = user.role;
    const result = { firestore: { ok: true }, supabase: { ok: true } };

    try { await clearFirestoreUserData(uid); }
    catch (err) { result.firestore = { ok: false, error: err.message }; }

    try { await clearSupabaseUserData(uid, role); }
    catch (err) { result.supabase = { ok: false, error: err.message }; }

    const success = result.firestore.ok && result.supabase.ok;
    if (success) { try { await logout(); } catch {} } // force a clean reload
    return { success, details: result };
  }, [user, logout]);

  // ══════════════════════════════════════════════════════════
  // MULTI-ROLE ACCESS
  // ══════════════════════════════════════════════════════════

  // Switch the active dashboard for a user who holds multiple roles.
  // Does NOT touch their authorized role list — only which one is "active".
  const setActiveRole = useCallback((role) => {
    if (!user) return;
    if (!user.roles?.includes(role)) {
      console.warn(`Cannot switch to role "${role}": not authorized for this account.`);
      return;
    }
    const updated = { ...user, activeRole: role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setUser(updated);
  }, [user]);

  const hasRole = useCallback((role) => !!user?.roles?.includes(role), [user]);
  const hasAnyRole = useCallback((rolesToCheck = []) => !!user?.roles?.some((r) => rolesToCheck.includes(r)), [user]);
  const hasAllRoles = useCallback((rolesToCheck = []) => rolesToCheck.every((r) => !!user?.roles?.includes(r)), [user]);

  // Admin-only: fully syncs a target user's role set. `roles` should be
  // the complete desired list (their primary role is always re-added
  // even if omitted, so it can never accidentally be dropped this way).
  const manageUserRoles = useCallback(async (targetUserId, roles, targetPrimaryRole) => {
    const actingRole = user?.activeRole || user?.role;
    if (actingRole !== "admin") {
      return { success: false, error: "Only admins can manage roles." };
    }
    const finalRoles = Array.from(new Set([targetPrimaryRole, ...roles].filter(Boolean)));
    const result = await setUserRoles(targetUserId, finalRoles);
    if (result.success) bump();
    return result;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      authLoading,
      login,
      logout,
      forgotPassword,
      changePassword,
      registerUser,
      updateStudentStatus,
      promoteStudent,
      detainStudent,
      removeStudent,
      getLoginLog,
      updateUserProfile,
      clearAccountData,
      enrolledVersion,
      // multi-role
      setActiveRole,
      hasRole,
      hasAnyRole,
      hasAllRoles,
      manageUserRoles,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}