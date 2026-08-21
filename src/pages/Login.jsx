import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { setupRecaptcha, sendOTP, verifyOTP } from "../utils/firebase";
import InstallAppButton from "../components/InstallAppButton";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

const ROLE_CONFIG = {
  student:   { label: "Student",           icon: "🎓", color: "from-blue-500 to-cyan-500",    route: "/student" },
  faculty:   { label: "Faculty",           icon: "👨‍🏫", color: "from-violet-500 to-purple-500", route: "/faculty" },
  placement: { label: "Placement Officer", icon: "💼", color: "from-amber-500 to-orange-500",  route: "/placement" },
  admin:     { label: "Admin",             icon: "🛡️", color: "from-rose-500 to-red-500",      route: "/admin" },
};

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEM_MAP = {
  "1st Year": ["Sem 1", "Sem 2"], "2nd Year": ["Sem 3", "Sem 4"],
  "3rd Year": ["Sem 5", "Sem 6"], "4th Year": ["Sem 7", "Sem 8"],
};
const CURRENT_YEAR = new Date().getFullYear();

function isPhone(val) { return /^\+?[0-9\s\-]{8,15}$/.test(val.trim()) && !/[@.]/.test(val); }
function isEmail(val) { return /\S+@\S+\.\S+/.test(val.trim()); }

function normalizePhone(val) {
  const digits = (val || "").replace(/\D/g, "");
  return digits.replace(/^91(?=\d{10}$)/, "");
}

function toE164(val) {
  const bare = normalizePhone(val);
  return "+91" + bare;
}

// ── Reusable input ────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, onKeyDown, required, disabled }) {
  return (
    <div>
      <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onKeyDown={onKeyDown} disabled={disabled}
        className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 text-sm disabled:opacity-60" />
    </div>
  );
}

// ── Phone verification block — still used by SignInForm's phone-OTP login ──
function PhoneVerifyBlock({ phone, verified, onVerified }) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const validPhone = isPhone(phone) && phone.trim().length >= 8;

  const handleSend = async () => {
    setError("");
    if (!validPhone) { setError("Enter a valid phone number first."); return; }
    setLoading(true);
    try {
      setupRecaptcha("recaptcha-container");
      await sendOTP(toE164(phone));
      setOtpSent(true);
    } catch (err) {
      setError("OTP failed: " + (err.message || "Try again"));
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      await verifyOTP(otp);
      onVerified(true);
    } catch (err) {
      setError("Invalid OTP. Try again.");
    }
    setLoading(false);
  };

  if (verified) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 text-green-400 text-xs flex items-center gap-2">
        ✅ Phone number verified
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!otpSent ? (
        <button type="button" onClick={handleSend} disabled={loading || !validPhone}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium cursor-pointer transition-all">
          {loading ? "Sending OTP..." : "📱 Send OTP to Verify Phone"}
        </button>
      ) : (
        <div className="flex gap-2">
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit OTP" maxLength={6}
            className="flex-1 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-center tracking-widest text-sm focus:outline-none focus:border-blue-500" />
          <button type="button" onClick={handleVerify} disabled={loading || !otp}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium cursor-pointer transition-all">
            {loading ? "..." : "Verify"}
          </button>
        </div>
      )}
      {otpSent && (
        <button type="button" onClick={handleSend} className="text-blue-400 text-xs cursor-pointer hover:text-blue-300">
          Resend OTP
        </button>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

// ── Email verification block — used by both register forms ──
function EmailVerifyBlock({ email, verified, onVerified }) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const validEmail = isEmail(email);

  const handleSend = async () => {
    setError("");
    if (!validEmail) { setError("Enter a valid email address first."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/email-otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
      setOtpSent(true);
    } catch (err) {
      setError("OTP failed: " + (err.message || "Try again"));
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/email-otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.detail || "Invalid OTP");
      onVerified(true);
    } catch (err) {
      setError(err.message || "Invalid OTP. Try again.");
    }
    setLoading(false);
  };

  if (verified) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 text-green-400 text-xs flex items-center gap-2">
        ✅ Email verified
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!otpSent ? (
        <button type="button" onClick={handleSend} disabled={loading || !validEmail}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium cursor-pointer transition-all">
          {loading ? "Sending OTP..." : "📧 Send OTP to Verify Email"}
        </button>
      ) : (
        <div className="flex gap-2">
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit OTP" maxLength={6}
            className="flex-1 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-center tracking-widest text-sm focus:outline-none focus:border-blue-500" />
          <button type="button" onClick={handleVerify} disabled={loading || !otp}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium cursor-pointer transition-all">
            {loading ? "..." : "Verify"}
          </button>
        </div>
      )}
      {otpSent && (
        <button type="button" onClick={handleSend} className="text-blue-400 text-xs cursor-pointer hover:text-blue-300">
          Resend OTP
        </button>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

// ── REGISTER FORMS ────────────────────────────────────────────
function StudentRegisterForm({ onBack, onSuccess }) {
  const { registerUser } = useAuth();
  const [form, setForm] = useState({
    name: "", usn: "", email: "", phone: "",
    password: "", confirmPassword: "",
    branch: "CSEAIML", startYear: String(CURRENT_YEAR - 1),
    year: "1st Year", sem: "Sem 1",
  });
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    const val = e.target.value;
    if (key === "year") setForm((p) => ({ ...p, year: val, sem: SEM_MAP[val][0] }));
    else setForm((p) => ({ ...p, [key]: val }));
    if (key === "email" && val !== verifiedEmail) setEmailVerified(false);
  };

  const handleEmailVerified = (ok) => {
    setEmailVerified(ok);
    setVerifiedEmail(form.email);
  };

  const endYear = String(Number(form.startYear) + 4);

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!form.name.trim()) { setError("Full name is required."); return; }
    if (!form.usn.trim())  { setError("USN is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!isEmail(form.email)) { setError("Please enter a valid email address."); return; }
    if (!emailVerified) { setError("Please verify your email with OTP before registering."); return; }
    if (form.phone.trim() && !isPhone(form.phone)) { setError("Please enter a valid phone number."); return; }
    if (!form.password)    { setError("Password is required."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const result = await registerUser({
        usn:      form.usn.toUpperCase(),
        name:     form.name.trim(),
        email:    form.email.trim(),
        phone:    form.phone.trim() ? normalizePhone(form.phone) : null,
        password: form.password,
        branch:   form.branch || "CSEAIML",
        year:     form.year,
        sem:      form.sem,
        startYear: form.startYear,
        endYear:  String(Number(form.startYear) + 4),
        role:     "student",
        status:   "active",
      });

      if (!result.success) {
        setError(result.error || "Registration failed.");
        setLoading(false);
        return;
      }

      setSuccess(`✅ Registered! Sign in with your email: ${form.email.trim()}`);
      setLoading(false);
      setTimeout(() => onSuccess(form.email.trim()), 2000);

    } catch (err) {
      setError("Something went wrong: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[var(--color-text-primary)] font-semibold">📋 Student Registration</h2>
        <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm cursor-pointer">← Back</button>
      </div>

      {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">{success}</div>}
      {error   && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

      <Field label="Full Name" value={form.name} onChange={set("name")} placeholder="e.g. Ravi Kumar" required />

      <Field label="USN (University Seat Number)" value={form.usn} onChange={set("usn")} placeholder="e.g. 1MS22AI045" required />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="name@gmail.com" required disabled={emailVerified} />
        <Field label="Phone (optional)" type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 9876543210" />
      </div>
      <p className="text-[var(--color-text-muted)] text-xs -mt-2">* Email is required and must be verified via OTP. Phone is optional.</p>

      <EmailVerifyBlock email={form.email} verified={emailVerified} onVerified={handleEmailVerified} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Branch" value={form.branch} onChange={set("branch")} placeholder="CSEAIML" required />
        <div>
          <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
            Admission Year <span className="text-red-400">*</span>
          </label>
          <select value={form.startYear} onChange={set("startYear")}
            className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] focus:outline-none text-sm cursor-pointer">
            {[0,1,2,3,4].map((o) => { const y = String(CURRENT_YEAR-o); return <option key={y} value={y}>{y}</option>; })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
            Current Year <span className="text-red-400">*</span>
          </label>
          <select value={form.year} onChange={set("year")}
            className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] focus:outline-none text-sm cursor-pointer">
            {YEAR_OPTIONS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
            Semester <span className="text-red-400">*</span>
          </label>
          <select value={form.sem} onChange={set("sem")}
            className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] focus:outline-none text-sm cursor-pointer">
            {(SEM_MAP[form.year] || []).map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[var(--color-bg-surface-alt)]/50 rounded-xl p-2.5 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)]">
        📌 USN <span className="text-[var(--color-text-primary)] font-medium">{form.usn || "—"}</span> · Sign in with <span className="text-[var(--color-text-primary)] font-medium">{form.email || "your email"}</span> · Batch: <span className="text-blue-400">{form.startYear}–{endYear}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min 6 chars" required />
        <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Re-enter" required />
      </div>

      <button onClick={handleSubmit} disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer shadow-lg">
        {loading ? "Registering..." : "✅ Register & Continue"}
      </button>
    </div>
  );
}

function StaffRegisterForm({ role, onBack, onSuccess }) {
  const { registerUser } = useAuth();
  const config = ROLE_CONFIG[role];
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    branch: "CSEAIML", subject: "", dept: "CSEAIML",
  });
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, [key]: val }));
    if (key === "email" && val !== verifiedEmail) setEmailVerified(false);
  };

  const handleEmailVerified = (ok) => {
    setEmailVerified(ok);
    setVerifiedEmail(form.email);
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!form.name.trim()) { setError("Full name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!isEmail(form.email)) { setError("Please enter a valid email address."); return; }
    if (!emailVerified) { setError("Please verify your email with OTP before registering."); return; }
    if (form.phone.trim() && !isPhone(form.phone)) { setError("Please enter a valid phone number."); return; }
    if (!form.password) { setError("Password is required."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const result = await registerUser({
        role,
        name:     form.name.trim(),
        email:    form.email.trim(),
        phone:    form.phone.trim() ? normalizePhone(form.phone) : null,
        password: form.password,
        branch:   form.branch || "CSEAIML",
        subject:  form.subject,
        dept:     form.dept || "CSEAIML",
        status:   "active",
      });

      if (!result.success) {
        setError(result.error || "Registration failed.");
        setLoading(false);
        return;
      }

      setSuccess(`✅ Registered! Sign in with your email: ${form.email.trim()}`);
      setLoading(false);
      setTimeout(() => onSuccess(form.email.trim()), 2000);

    } catch (err) {
      setError("Something went wrong: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[var(--color-text-primary)] font-semibold">{config.icon} {config.label} Registration</h2>
        <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm cursor-pointer">← Back</button>
      </div>

      {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">{success}</div>}
      {error   && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

      <Field label="Full Name" value={form.name} onChange={set("name")} placeholder="e.g. Dr. Sharma" required />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="name@gmail.com" required disabled={emailVerified} />
        <Field label="Phone (optional)" type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 9876543210" />
      </div>
      <p className="text-[var(--color-text-muted)] text-xs -mt-2">* Email is required and must be verified via OTP. Phone is optional.</p>

      <EmailVerifyBlock email={form.email} verified={emailVerified} onVerified={handleEmailVerified} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Branch / Dept" value={form.branch} onChange={set("branch")} placeholder="CSEAIML" />
        {role === "faculty" && (
          <Field label="Subject Handled" value={form.subject} onChange={set("subject")} placeholder="e.g. Machine Learning" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min 6 chars" required />
        <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Re-enter" required />
      </div>

      <button onClick={handleSubmit} disabled={loading}
        className={`w-full py-3 bg-gradient-to-r ${config.color} hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer shadow-lg`}>
        {loading ? "Registering..." : "✅ Register & Continue"}
      </button>
    </div>
  );
}

// ── FORGOT PASSWORD BLOCK ────────────────────────────────────
function ForgotPasswordBlock({ onBack }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setError(""); setSuccess("");
    if (!isEmail(email)) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    const result = await forgotPassword(email.trim());
    setLoading(false);

    if (result.success) {
      setSuccess("✅ Reset link sent! Check your email inbox (and spam folder).");
    } else {
      setError(result.error || "Could not send reset email. Please try again.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[var(--color-text-primary)] font-semibold text-sm">🔑 Reset Password</h2>
        <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs cursor-pointer">← Back to Sign In</button>
      </div>

      <p className="text-[var(--color-text-muted)] text-xs">
        Enter the email address linked to your account. We'll send you a link to reset your password.
      </p>

      {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">{success}</div>}
      {error   && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

      {!success && (
        <>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="name@gmail.com"
            required
          />
          <button onClick={handleSend} disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer shadow-lg">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </>
      )}
    </div>
  );
}

// ── SIGN IN FORM ──────────────────────────────────────────────
function SignInForm({ role, prefilledId, onRegister }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const config    = ROLE_CONFIG[role];

  const [identifier, setIdentifier] = useState(prefilledId || "");
  const [password, setPassword]     = useState("");
  const [otp, setOtp]               = useState("");
  const [otpSent, setOtpSent]       = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const phoneDetected = isPhone(identifier) && identifier.trim().length >= 8;
  const emailDetected = isEmail(identifier);

  useEffect(() => {
    if (phoneDetected) {
      setTimeout(() => { try { setupRecaptcha("recaptcha-container"); } catch {} }, 300);
    }
  }, [phoneDetected]);

  const handleSendOTP = async () => {
    setOtpLoading(true); setError("");
    try {
      await sendOTP(toE164(identifier));
      setOtpSent(true);
    } catch (err) {
      setError("OTP failed: " + (err.message || "Try again"));
    }
    setOtpLoading(false);
  };

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      let usedPhoneOtp = false;

      if (phoneDetected && otpSent) {
        await verifyOTP(otp);
        usedPhoneOtp = true;
      }

      const result = await login(identifier.trim(), password, role, usedPhoneOtp);
      if (result.success) navigate(config.route);
      else setError(result.error || "Invalid credentials.");
    } catch (err) {
      setError(err.message || "Login failed.");
    }
    setLoading(false);
  };

  if (showForgot) {
    return <ForgotPasswordBlock onBack={() => setShowForgot(false)} />;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">
          Email / Phone / User ID
        </label>
        <input type="text" value={identifier}
          onChange={(e) => { setIdentifier(e.target.value); setOtpSent(false); setOtp(""); setError(""); }}
          placeholder="Email, +91 phone, or ID (e.g. STU001)"
          className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 text-sm" />
        {phoneDetected && !otpSent && <p className="text-blue-400 text-xs mt-1">📱 Phone detected — click Send OTP</p>}
        {emailDetected && <p className="text-violet-400 text-xs mt-1">📧 Email detected</p>}
      </div>

      {!phoneDetected && (
        <div>
          <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter your password"
            className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 text-sm" />
          <button onClick={() => setShowForgot(true)}
            className="text-blue-400 hover:text-blue-300 text-xs mt-1.5 cursor-pointer transition-colors">
            Forgot password?
          </button>
        </div>
      )}

      {phoneDetected && !otpSent && (
        <button onClick={handleSendOTP} disabled={otpLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold cursor-pointer">
          {otpLoading ? "Sending OTP..." : "📱 Send OTP"}
        </button>
      )}

      {phoneDetected && otpSent && (
        <div>
          <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">Enter OTP</label>
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="6-digit OTP" maxLength={6}
            className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] text-center tracking-widest text-lg placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500" />
          <button onClick={handleSendOTP} className="text-blue-400 text-xs mt-1 cursor-pointer hover:text-blue-300">Resend OTP</button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {(!phoneDetected || otpSent) && (
        <button onClick={handleLogin}
          disabled={loading || !identifier || (!phoneDetected && !password) || (phoneDetected && otpSent && !otp)}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all cursor-pointer bg-gradient-to-r ${config.color} hover:opacity-90 disabled:opacity-40 shadow-lg`}>
          {loading ? "Signing in..." : phoneDetected ? "✅ Verify & Sign In" : "Sign In"}
        </button>
      )}

      <div className="pt-2 border-t border-[var(--color-border)] text-center">
        <p className="text-[var(--color-text-muted)] text-xs mb-1">
          {role === "student" ? "New student?" : `New ${ROLE_CONFIG[role].label}?`}
        </p>
        <button onClick={onRegister}
          className="text-blue-400 hover:text-blue-300 text-xs cursor-pointer transition-colors">
          📋 Register here →
        </button>
      </div>
    </div>
  );
}

// ── MAIN LOGIN COMPONENT ──────────────────────────────────────
export default function Login() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [mode, setMode]                 = useState("signin");
  const [prefilledId, setPrefilledId]   = useState("");

  const handleRegisterSuccess = (id) => {
    setPrefilledId(id);
    setMode("signin");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center p-4 relative overflow-hidden">
      <div id="recaptcha-container" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-4 shadow-lg shadow-blue-500/30">
            <span className="text-2xl">🏫</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">CSEAIML LMS</h1>
          <p className="text-[var(--color-text-secondary)] mt-1 text-sm">Learning Management System</p>
          <div className="mt-4">
            <InstallAppButton />
          </div>
        </div>

        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-2xl">

          {!selectedRole ? (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-1">Who are you?</h2>
              <p className="text-[var(--color-text-muted)] text-sm mb-5">Select your role to continue</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <button key={role} onClick={() => { setSelectedRole(role); setMode("signin"); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-text-muted)] bg-[var(--color-bg-surface-alt)]/50 hover:bg-[var(--color-bg-surface-alt)] transition-all duration-200 group cursor-pointer">
                    <span className="text-3xl group-hover:scale-110 transition-transform">{config.icon}</span>
                    <span className="text-[var(--color-text-primary)] text-sm font-medium">{config.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { setSelectedRole(null); setMode("signin"); }}
                className="flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-4 cursor-pointer transition-colors">
                ← Back
              </button>

              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${ROLE_CONFIG[selectedRole].color} mb-5`}>
                <span>{ROLE_CONFIG[selectedRole].icon}</span>
                <span className="text-white text-sm font-semibold">{ROLE_CONFIG[selectedRole].label}</span>
              </div>

              {mode === "signin" ? (
                <SignInForm
                  role={selectedRole}
                  prefilledId={prefilledId}
                  onRegister={() => setMode("register")}
                />
              ) : selectedRole === "student" ? (
                <StudentRegisterForm
                  onBack={() => setMode("signin")}
                  onSuccess={handleRegisterSuccess}
                />
              ) : (
                <StaffRegisterForm
                  role={selectedRole}
                  onBack={() => setMode("signin")}
                  onSuccess={handleRegisterSuccess}
                />
              )}
            </>
          )}
        </div>
        <p className="text-center text-[var(--color-text-muted)] text-xs mt-4">CSEAIML Department · Academic Portal</p>
      </div>
    </div>
  );
}