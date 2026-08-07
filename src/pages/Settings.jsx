import { useState } from "react";
import { useAuth } from "../context/AuthContext";
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

const SECTIONS = ["Account & Profile", "Appearance", "Help & Support"];

// ── Reusable input ────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
      />
    </div>
  );
}

// ── Account & Profile section ───────────────────────────────────
function AccountSection({ user, updateUserProfile, changePassword }) {
  const [name, setName]   = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileMsg, setProfileMsg]   = useState(null); // { type: 'success'|'error', text }
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg]         = useState(null);
  const [pwSaving, setPwSaving]   = useState(false);

  const hasPasswordLogin = !!user?.uid; // only email/password accounts have a Firebase uid stored

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

  return (
    <div className="space-y-5">
      {/* Personal info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold">👤 Personal Info</h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
        </div>
        <Field label="Email" value={user?.email || "—"} disabled />

        {profileMsg && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${
            profileMsg.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}>
            {profileMsg.text}
          </div>
        )}

        <button onClick={handleSaveProfile} disabled={profileSaving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
          {profileSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Password */}
      {hasPasswordLogin ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold">🔑 Change Password</h3>
          <Field label="Current Password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="New Password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 6 characters" />
            <Field label="Confirm New Password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter" />
          </div>

          {pwMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${
              pwMsg.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {pwMsg.text}
            </div>
          )}

          <button onClick={handleChangePassword} disabled={pwSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
            {pwSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-2">🔑 Password</h3>
          <p className="text-gray-500 text-xs">
            Your account signs in via phone OTP, so there's no password to change here.
          </p>
        </div>
      )}

      {/* Role details — read only */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">🪪 Role Details</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Role</p>
            <p className="text-white">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">ID</p>
            <p className="text-white">{user?.usn || user?.id}</p>
          </div>
          {user?.branch && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Branch</p>
              <p className="text-white">{user.branch}</p>
            </div>
          )}
          {user?.year && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Year / Semester</p>
              <p className="text-white">{user.year} · {user.sem}</p>
            </div>
          )}
          {user?.subject && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Subject</p>
              <p className="text-white">{user.subject}</p>
            </div>
          )}
          {user?.dept && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Department</p>
              <p className="text-white">{user.dept}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Appearance section ──────────────────────────────────────────
function AppearanceSection() {
  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold">🎨 Theme</h3>
        <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
          <div>
            <p className="text-white text-sm font-medium">Dark Mode</p>
            <p className="text-gray-500 text-xs mt-0.5">Currently the only supported theme.</p>
          </div>
          <span className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">Active</span>
        </div>
        <p className="text-gray-600 text-xs">
          Light mode is on the roadmap — this app is built dark-first, so it needs a proper pass before it can be
          offered as a real option rather than a half-working toggle.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold">🌐 Language</h3>
        <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
          <p className="text-white text-sm font-medium">English</p>
          <span className="text-xs px-3 py-1.5 bg-gray-700 text-gray-400 rounded-full">Only language available</span>
        </div>
        <p className="text-gray-600 text-xs">
          Additional languages aren't supported yet — this needs proper translation infrastructure first.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold">🔤 Font Size</h3>
        <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
          <p className="text-white text-sm font-medium">Default</p>
          <span className="text-xs px-3 py-1.5 bg-gray-700 text-gray-400 rounded-full">Coming soon</span>
        </div>
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-2">
        <h3 className="text-white font-semibold mb-1">ℹ️ App Info</h3>
        <div className="flex justify-between text-sm py-2 border-b border-gray-800">
          <span className="text-gray-400">Version</span>
          <span className="text-white">{APP_VERSION}</span>
        </div>
        <div className="flex justify-between text-sm py-2">
          <span className="text-gray-400">Build</span>
          <span className="text-white">{BUILD_DATE}</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">❓ Frequently Asked Questions</h3>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer"
              >
                <span className="text-white text-sm font-medium">{f.q}</span>
                <span className="text-gray-500 text-xs">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-gray-400 text-xs leading-relaxed">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-2">📄 Terms & Privacy Policy</h3>
        <p className="text-gray-500 text-xs leading-relaxed">
          This app is an internal academic tool for the CSEAIML department. Data submitted here (notes, marks,
          attendance, complaints) is visible only to authorized users within the department and is used solely
          for academic administration. This is a placeholder notice — a formal privacy policy should be reviewed
          and published before wider rollout.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-2">💬 Need more help?</h3>
        <p className="text-gray-500 text-xs">
          For technical issues, contact your department's admin through the Complaint Box, or reach out to
          whoever manages the LMS on your behalf.
        </p>
      </div>
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────
export default function Settings() {
  const { user, updateUserProfile, changePassword } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Account & Profile");

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Settings" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-2xl p-5 text-white">
            <p className="text-gray-300 text-sm mb-1">⚙️ Settings</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
          </div>

          <div className="flex gap-2 flex-wrap">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeSection === s ? "bg-white text-gray-900" : "bg-gray-800 text-gray-400 hover:text-white"}`}
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
        </main>
      </div>
    </div>
  );
}