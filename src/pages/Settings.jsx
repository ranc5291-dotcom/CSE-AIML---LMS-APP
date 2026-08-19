import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const APP_VERSION = "1.0.0";
const BUILD_DATE  = "August 2026";

const ROLE_LABELS = {
  student: "Student",
  faculty: "Faculty",
  placement: "Placement Officer",
  admin: "Admin",
};

const SECTIONS = ["Account & Profile", "Appearance", "Help & Support", "Danger Zone"];

// ── Reusable input ────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label className="text-[var(--color-text-muted)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm disabled:opacity-50"
      />
    </div>
  );
}

// ── Account & Profile section ───────────────────────────────────
function AccountSection({ user, updateUserProfile, changePassword }) {
  const [name, setName]   = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileMsg, setProfileMsg]   = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg]         = useState(null);
  const [pwSaving, setPwSaving]   = useState(false);

  const hasPasswordLogin = !!user?.uid;

  const handleSaveProfile = async () => {
    setProfileMsg(null);
    if (!name.trim()) { setProfileMsg({ type: "error", text: "Name cannot be empty." }); return; }

    setProfileSaving(true);
    const result = await updateUserProfile(user.id, { name: name.trim(), phone: phone.trim() });
    setProfileSaving(false);

    if (result.success) {
      setProfileMsg({ type: "success", text: "Profile updated." });
    } else {
      setProfileMsg({ type: "error", text: result.error || "Could not update profile." });
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw) { setPwMsg({ type: "error", text: "Fill in both password fields." }); return; }
    if (newPw.length < 6) { setPwMsg({ type: "error", text: "New password must be at least 6 characters." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "New passwords do not match." }); return; }

    setPwSaving(true);
    const result = await changePassword(currentPw, newPw);
    setPwSaving(false);

    if (result.success) {
      setPwMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg({ type: "error", text: result.error || "Could not change password." });
    }
  };

  const msgClass = (type) =>
    type === "success"
      ? "bg-green-500/10 border-green-500/30 text-green-500"
      : "bg-red-500/10 border-red-500/30 text-red-500";

  return (
    <div className="space-y-5">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
        <h3 className="text-[var(--color-text-primary)] font-semibold">👤 Personal Info</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
        </div>
        <Field label="Email" value={user?.email || "—"} disabled />

        {profileMsg && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${msgClass(profileMsg.type)}`}>
            {profileMsg.text}
          </div>
        )}

        <button onClick={handleSaveProfile} disabled={profileSaving}
          className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
          {profileSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {hasPasswordLogin ? (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
          <h3 className="text-[var(--color-text-primary)] font-semibold">🔑 Change Password</h3>
          <Field label="Current Password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="New Password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 6 characters" />
            <Field label="Confirm New Password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter" />
          </div>

          {pwMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${msgClass(pwMsg.type)}`}>
              {pwMsg.text}
            </div>
          )}

          <button onClick={handleChangePassword} disabled={pwSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
            {pwSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      ) : (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
          <h3 className="text-[var(--color-text-primary)] font-semibold mb-2">🔑 Password</h3>
          <p className="text-[var(--color-text-muted)] text-xs">
            Your account signs in via phone OTP, so there's no password to change here.
          </p>
        </div>
      )}

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">🪪 Role Details</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">Role</p>
            <p className="text-[var(--color-text-primary)]">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">ID</p>
            <p className="text-[var(--color-text-primary)]">{user?.usn || user?.id}</p>
          </div>
          {user?.branch && (
            <div>
              <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">Branch</p>
              <p className="text-[var(--color-text-primary)]">{user.branch}</p>
            </div>
          )}
          {user?.year && (
            <div>
              <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">Year / Semester</p>
              <p className="text-[var(--color-text-primary)]">{user.year} · {user.sem}</p>
            </div>
          )}
          {user?.subject && (
            <div>
              <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">Subject</p>
              <p className="text-[var(--color-text-primary)]">{user.subject}</p>
            </div>
          )}
          {user?.dept && (
            <div>
              <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-1">Department</p>
              <p className="text-[var(--color-text-primary)]">{user.dept}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Appearance section ──────────────────────────────────────────
function AppearanceSection() {
  const { isDark, toggleTheme, fontSize, setFontSize } = useTheme();

  const FONT_OPTIONS = [
    { key: "sm",   label: "Small" },
    { key: "base", label: "Default" },
    { key: "lg",   label: "Large" },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
        <h3 className="text-[var(--color-text-primary)] font-semibold">🎨 Theme</h3>
        <div className="flex items-center justify-between bg-[var(--color-bg-surface-alt)] rounded-xl px-4 py-3">
          <div>
            <p className="text-[var(--color-text-primary)] text-sm font-medium">{isDark ? "Dark Mode" : "Light Mode"}</p>
            <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
              {isDark ? "Easier on the eyes in low light." : "Bright, clean look for daytime use."}
            </p>
          </div>

          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer flex-shrink-0
              ${isDark ? "bg-blue-600" : "bg-gradient-to-r from-violet-500 to-pink-500"}`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform
                ${isDark ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
        <h3 className="text-[var(--color-text-primary)] font-semibold">🌐 Language</h3>
        <div className="flex items-center justify-between bg-[var(--color-bg-surface-alt)] rounded-xl px-4 py-3">
          <p className="text-[var(--color-text-primary)] text-sm font-medium">English</p>
          <span className="text-xs px-3 py-1.5 bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] rounded-full">Only language available</span>
        </div>
        <p className="text-[var(--color-text-muted)] text-xs">
          Additional languages aren't supported yet — this needs proper translation infrastructure first.
        </p>
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
        <h3 className="text-[var(--color-text-primary)] font-semibold">🔤 Font Size</h3>
        <div className="flex gap-2">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFontSize(opt.key)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border
                ${fontSize === opt.key
                  ? "bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] border-transparent text-white"
                  : "bg-[var(--color-bg-surface-alt)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[var(--color-text-muted)] text-xs">
          Changes the overall text size across the app. Takes effect immediately.
        </p>
      </div>
    </div>
  );
}

// ── Help & Support section ──────────────────────────────────────
function HelpSection() {
  const [openFaq, setOpenFaq] = useState(null);

  const FAQS = [
    { q: "How do I reset my password?", a: "On the login page, select your role, then click 'Forgot password?' below the password field. Enter your registered email and follow the link sent to your inbox." },
    { q: "Why am I not getting notifications?", a: "Make sure notifications are allowed for this app in your phone's Settings, and that you granted permission when the app asked. Try logging out and back in if it's still not working." },
    { q: "I can't open an old file — what happened?", a: "A small number of files uploaded during a brief technical issue earlier didn't save correctly. If a file won't open, please ask the faculty/officer who uploaded it to re-upload." },
    { q: "How do I contact my department?", a: "Use the Complaint Box for issues that need administrative attention, or reach out to your faculty/placement officer directly through their listed contact info." },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-2">
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-1">ℹ️ App Info</h3>
        <div className="flex justify-between text-sm py-2 border-b border-[var(--color-border)]">
          <span className="text-[var(--color-text-secondary)]">Version</span>
          <span className="text-[var(--color-text-primary)]">{APP_VERSION}</span>
        </div>
        <div className="flex justify-between text-sm py-2">
          <span className="text-[var(--color-text-secondary)]">Build</span>
          <span className="text-[var(--color-text-primary)]">{BUILD_DATE}</span>
        </div>
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-3">❓ Frequently Asked Questions</h3>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer"
              >
                <span className="text-[var(--color-text-primary)] text-sm font-medium">{f.q}</span>
                <span className="text-[var(--color-text-muted)] text-xs">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-[var(--color-text-secondary)] text-xs leading-relaxed">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-2">📄 Terms & Privacy Policy</h3>
        <p className="text-[var(--color-text-muted)] text-xs leading-relaxed">
          This app is an internal academic tool for the CSEAIML department. Data submitted here (notes, marks,
          attendance, complaints) is visible only to authorized users within the department and is used solely
          for academic administration. This is a placeholder notice — a formal privacy policy should be reviewed
          and published before wider rollout.
        </p>
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-2">💬 Need more help?</h3>
        <p className="text-[var(--color-text-muted)] text-xs">
          For technical issues, contact your department's admin through the Complaint Box, or reach out to
          whoever manages the LMS on your behalf.
        </p>
      </div>
    </div>
  );
}

// ── Danger Zone section ─────────────────────────────────────────
function DangerZoneSection({ clearAccountData }) {
  const [showModal, setShowModal]     = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus]           = useState("idle"); // idle | working | success | error

  const canConfirm = confirmText === "CLEAR" && status !== "working";

  const openModal = () => { setConfirmText(""); setStatus("idle"); setShowModal(true); };

  const handleClear = async () => {
    if (!canConfirm) return;
    setStatus("working");
    const result = await clearAccountData();
    setStatus(result.success ? "success" : "error");
  };

  return (
    <>
      <div className="bg-[var(--color-bg-surface)] border border-red-500/30 rounded-2xl p-5 space-y-3">
        <h3 className="text-red-500 font-semibold">⚠️ Danger Zone</h3>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[var(--color-text-primary)] text-sm font-medium">Clear Account Data</p>
            <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
              Permanently remove your application data from this account. This action cannot be undone.
            </p>
          </div>
          <button onClick={openModal}
            className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 rounded-xl text-sm font-semibold cursor-pointer transition-all flex-shrink-0">
            Clear Account Data
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full space-y-4">
            {status === "success" ? (
              <>
                <h3 className="text-[var(--color-text-primary)] font-semibold text-lg">Account Data Cleared</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Your application data has been successfully removed from Firestore and Supabase.
                  Your login account remains active — you'll be signed out now; log back in to see a fresh account.
                </p>
                <button onClick={() => setShowModal(false)}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] text-white rounded-xl text-sm font-semibold cursor-pointer">
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="text-red-500 font-semibold text-lg">Clear Account Data?</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  This will permanently delete your application data from Firestore and Supabase.
                  This action cannot be undone.
                </p>

                {status === "error" && (
                  <div className="rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-500">
                    Some account data could not be cleared. Please try again.
                  </div>
                )}

                <div>
                  <label className="text-[var(--color-text-muted)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
                    Type CLEAR to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={status === "working"}
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] focus:outline-none focus:border-red-500 text-sm"
                    placeholder="CLEAR"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowModal(false)} disabled={status === "working"}
                    className="flex-1 px-4 py-2.5 bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleClear} disabled={!canConfirm}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold cursor-pointer">
                    {status === "working" ? "Clearing Account Data..." : "Clear My Data"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Settings page ────────────────────────────────────────
export default function Settings() {
  const { user, updateUserProfile, changePassword, clearAccountData } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Account & Profile");

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Settings" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] rounded-2xl p-5 text-white">
            <p className="text-white/80 text-sm mb-1">⚙️ Settings</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
          </div>

          <div className="flex gap-2 flex-wrap">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeSection === s
                    ? "bg-[var(--color-text-primary)] text-[var(--color-bg-app)]"
                    : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>

          {activeSection === "Account & Profile" && (
            <AccountSection user={user} updateUserProfile={updateUserProfile} changePassword={changePassword} />
          )}
          {activeSection === "Appearance" && <AppearanceSection />}
          {activeSection === "Help & Support" && <HelpSection />}
          {activeSection === "Danger Zone" && (
            <DangerZoneSection clearAccountData={clearAccountData} />
          )}
        </main>
      </div>
    </div>
  );
}