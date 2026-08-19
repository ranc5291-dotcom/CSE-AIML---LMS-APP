import { useState, useEffect } from "react";
import { useAuth, getAllStudents, getAllFaculty, getAllPlacement, getAllAdmins } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { getAllUserRoles } from "../utils/supabase";

const TABS = ["Overview", "Student Management", "Faculty", "Placement & Admin", "Roles & Access", "Complaints", "Announcements", "Notice Board", "Gallery"];
const ALL_ROLES = ["student", "faculty", "admin", "placement"];
const ROLE_LABELS_MAP = { student: "Student", faculty: "Faculty", admin: "Admin", placement: "Placement" };
const SEM_SEQUENCE = [
  { year: "1st Year", sem: "Sem 1" }, { year: "1st Year", sem: "Sem 2" },
  { year: "2nd Year", sem: "Sem 3" }, { year: "2nd Year", sem: "Sem 4" },
  { year: "3rd Year", sem: "Sem 5" }, { year: "3rd Year", sem: "Sem 6" },
  { year: "4th Year", sem: "Sem 7" }, { year: "4th Year", sem: "Sem 8" },
];

const STATUS_COLORS = {
  active: "bg-green-500/20 text-green-400",
  detained: "bg-amber-500/20 text-amber-400",
  dropout: "bg-red-500/20 text-red-400",
  transferred: "bg-blue-500/20 text-blue-400",
};
const STATUS_LABELS = { active: "Active", detained: "Detained", dropout: "Dropout", transferred: "Transferred" };

const TAG_OPTIONS = ["Exam", "Event", "Assignment", "Notice", "Holiday"];

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "usn",  label: "USN" },
  { key: "sem",  label: "Semester" },
  { key: "status", label: "Status" },
];

export default function AdminDashboard() {
  const { user, updateStudentStatus, promoteStudent, detainStudent, removeStudent, getLoginLog, enrolledVersion, manageUserRoles } = useAuth();
  const {
    complaints, updateComplaintStatus, removeComplaint,
    announcements, addAnnouncement, removeAnnouncement,
    notices, addNotice, removeNotice,
    gallery, addGalleryPhoto, removeGalleryPhoto,
    addPromotion,
  } = useLMS();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState("Overview");
  const [annTitle, setAnnTitle]     = useState("");
  const [annTag, setAnnTag]         = useState("Notice");
  const [searchStudent, setSearchStudent] = useState("");
  const [filterYear, setFilterYear]       = useState("All");
  const [filterSem, setFilterSem]         = useState("All");
  const [filterStatus, setFilterStatus]   = useState("All");
  const [confirmAction, setConfirmAction] = useState(null);
  const [userRolesMap, setUserRolesMap] = useState({});
  const [pendingRoles, setPendingRoles] = useState({});
  const [roleSearch, setRoleSearch] = useState("");
  const [savingRoles, setSavingRoles] = useState(null);

  // Sorting — Student Management
  const [sortBy, setSortBy]   = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  };

  // Notice board
  const [noticeTitle, setNoticeTitle]     = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeTag, setNoticeTag]         = useState("Notice");

  // Gallery
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryFile, setGalleryFile]       = useState(null);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [students, setStudents]   = useState([]);
  const [faculty, setFaculty]     = useState([]);
  const [placement, setPlacement] = useState([]);
  const [admins, setAdmins]       = useState([]);
  const [loginLog, setLoginLog]   = useState([]);

  useEffect(() => {
    getAllStudents().then(setStudents);
    getAllFaculty().then(setFaculty);
    getAllPlacement().then(setPlacement);
    getAllAdmins().then(setAdmins);
    getLoginLog().then(setLoginLog);
    getAllUserRoles().then((rows) => {
      const map = {};
      rows.forEach((r) => {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r.role);
      });
      setUserRolesMap(map);
    });
  }, [enrolledVersion]);

  const filteredStudents = students.filter((s) => {
    const matchSearch = searchStudent === "" ||
      s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      (s.usn || s.id).toLowerCase().includes(searchStudent.toLowerCase());
    const matchYear   = filterYear   === "All" || s.year   === filterYear;
    const matchSem    = filterSem    === "All" || s.sem    === filterSem;
    const matchStatus = filterStatus === "All" || (s.status || "active") === filterStatus;
    return matchSearch && matchYear && matchSem && matchStatus;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let av, bv;
    switch (sortBy) {
      case "usn":    av = (a.usn || a.id) || ""; bv = (b.usn || b.id) || ""; break;
      case "sem":    av = a.sem || ""; bv = b.sem || ""; break;
      case "status": av = a.status || "active"; bv = b.status || "active"; break;
      default:       av = a.name || ""; bv = b.name || "";
    }
    const cmp = String(av).trim().toLowerCase().localeCompare(
      String(bv).trim().toLowerCase(), undefined, { numeric: true }
    );
    return sortDir === "asc" ? cmp : -cmp;
  });

  const activeStudents   = students.filter((s) => (s.status || "active") === "active").length;
  const dropoutStudents  = students.filter((s) => s.status === "dropout").length;
  const detainedStudents = students.filter((s) => s.status === "detained").length;
  const openComplaints   = complaints.filter((c) => c.status === "Pending").length;

  const handleAction = (studentId, action) => {
    const labels = {
      promote: "Promote to next semester",
      detain: "Mark as Detained (repeat semester)",
      dropout: "Mark as Dropout (disable login)",
      active: "Restore to Active",
      transfer: "Mark as Transferred",
      remove: "Permanently Remove",
    };
    setConfirmAction({ studentId, action, label: labels[action] });
  };

  const executeAction = () => {
    if (!confirmAction) return;
    const { studentId, action } = confirmAction;
    switch (action) {
      case "promote": {
        // Capture current position BEFORE promoting so we know what to notify
        const student = students.find((s) => s.id === studentId);
        const currentIdx = SEM_SEQUENCE.findIndex(
          (s) => s.sem === student?.sem && s.year === student?.year
        );
        const next = currentIdx !== -1 && currentIdx < SEM_SEQUENCE.length - 1
          ? SEM_SEQUENCE[currentIdx + 1]
          : null;

        promoteStudent(studentId);

        // Marks/attendance are keyed by studentId + subject, so they are
        // never touched by this — only year/sem change, records stay intact.
        if (student && next) {
          addPromotion({
            studentId,
            studentName: student.name,
            fromYear: student.year,
            fromSem: student.sem,
            toYear: next.year,
            toSem: next.sem,
          });
        }
        break;
      }
      case "detain": detainStudent(studentId); break;
      case "dropout": updateStudentStatus(studentId, "dropout"); break;
      case "active": updateStudentStatus(studentId, "active"); break;
      case "transfer": updateStudentStatus(studentId, "transferred"); break;
      case "remove": removeStudent(studentId); break;
    }
    setConfirmAction(null);
  };

  const handlePostNotice = () => {
    if (!noticeTitle.trim()) return;
    addNotice({
      title: noticeTitle,
      content: noticeContent,
      tag: noticeTag,
      postedBy: user?.name,
      postedRole: "admin",
    });
    setNoticeTitle("");
    setNoticeContent("");
    setNoticeTag("Notice");
  };

  const handleUploadGalleryPhoto = async () => {
    if (!galleryCaption.trim() || !galleryFile) {
      alert("Please add a caption and select a photo.");
      return;
    }
    setGalleryUploading(true);
    try {
      await addGalleryPhoto({ caption: galleryCaption, uploadedBy: user?.name, category: "Admin" }, galleryFile);
      setGalleryCaption("");
      setGalleryFile(null);
    } catch (err) {
      // Photo still shows locally via the fallback list in LMSContext even
      // when this rejects (e.g. Firestore rules) — just let the admin know.
      console.warn("Gallery sync warning:", err.message);
    }
    setGalleryUploading(false);
  };

  const allUsers = [...students, ...faculty, ...placement, ...admins];

  const getRolesFor = (u) => {
    if (pendingRoles[u.id]) return pendingRoles[u.id];
    return Array.from(new Set([u.role, ...(userRolesMap[u.id] || [])]));
  };

  const toggleRole = (u, role) => {
    if (role === u.role) return; // primary role can't be unchecked here
    const current = getRolesFor(u);
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setPendingRoles((prev) => ({ ...prev, [u.id]: next }));
  };

  const savePermissions = async (u) => {
    const roles = getRolesFor(u);
    setSavingRoles(u.id);
    const result = await manageUserRoles(u.id, roles, u.role);
    setSavingRoles(null);
    if (result.success) {
      setUserRolesMap((prev) => ({ ...prev, [u.id]: roles }));
      setPendingRoles((prev) => { const p = { ...prev }; delete p[u.id]; return p; });
    } else {
      alert("Failed to save roles: " + result.error);
    }
  };

  // ── EXPORT TO EXCEL (CSV) ─────────────────────────────────────
  const exportToExcel = () => {
    const rows = [];
    rows.push(["CSEAIML LMS — Login & Student Records", "", "", "", "", "", "", "", ""]);
    rows.push([`Generated: ${new Date().toLocaleString()}`]);
    rows.push([]);

    rows.push(["=== STUDENTS (grouped by Year & Semester) ==="]);
    rows.push(["USN/ID", "Name", "Branch", "Year", "Semester", "Email", "Phone", "Status", "Last Login"]);

    // Group students by year+sem for easy record-keeping
    SEM_SEQUENCE.forEach(({ year, sem }) => {
      const group = students.filter((s) => s.year === year && s.sem === sem);
      if (group.length === 0) return;
      rows.push([`--- ${year} / ${sem} ---`]);
      group.forEach((s) => {
        const log = loginLog.find((l) => l.id === s.id);
        rows.push([
          s.usn || s.id, s.name, s.branch || "CSEAIML",
          s.year, s.sem, s.email || "", s.phone || "",
          s.status || "active",
          log ? new Date(log.loginTime).toLocaleString() : "Never",
        ]);
      });
    });

    rows.push([]);
    rows.push(["=== FACULTY ==="]);
    rows.push(["ID", "Name", "Branch", "Subject", "Email", "Phone", "Last Login"]);
    faculty.forEach((f) => {
      const log = loginLog.find((l) => l.id === f.id);
      rows.push([
        f.id, f.name, f.branch || "CSEAIML", f.subject || "",
        f.email || "", f.phone || "",
        log ? new Date(log.loginTime).toLocaleString() : "Never",
      ]);
    });

    rows.push([]);
    rows.push(["=== PLACEMENT OFFICERS ==="]);
    rows.push(["ID", "Name", "Dept", "Email", "Phone", "Last Login"]);
    placement.forEach((p) => {
      const log = loginLog.find((l) => l.id === p.id);
      rows.push([
        p.id, p.name, p.dept || "CSEAIML",
        p.email || "", p.phone || "",
        log ? new Date(log.loginTime).toLocaleString() : "Never",
      ]);
    });

    rows.push([]);
    rows.push(["=== ADMINS ==="]);
    rows.push(["ID", "Name", "Dept", "Email", "Phone", "Last Login"]);
    admins.forEach((a) => {
      const log = loginLog.find((l) => l.id === a.id);
      rows.push([
        a.id, a.name, a.dept || "CSEAIML",
        a.email || "", a.phone || "",
        log ? new Date(log.loginTime).toLocaleString() : "Never",
      ]);
    });

    rows.push([]);
    rows.push(["=== ALL LOGIN LOG (most recent first) ==="]);
    rows.push(["ID", "Name", "Role", "Branch/Dept", "Email", "Phone", "Login Time"]);
    loginLog.forEach((l) => {
      rows.push([l.id, l.name, l.role, l.branch, l.email, l.phone, new Date(l.loginTime).toLocaleString()]);
    });

    const csv = rows.map((r) =>
      r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `CSEAIML_LMS_Records_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Admin Panel" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          {/* Header */}
          <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] rounded-2xl p-5 text-white">
            <p className="text-white/80 text-sm mb-1">Admin Panel 🛡️</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-white/80 text-sm mt-1">CSEAIML · Full Access · {user?.id}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab
                    ? "bg-[var(--color-accent-solid)] text-white"
                    : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "Overview" && (
            <div className="space-y-5">

              {/* Export button */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold text-lg">📊 Overview</h3>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium cursor-pointer flex items-center gap-2 transition-all">
                  📥 Export Records to Excel
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Active Students",    value: activeStudents,       icon: "🎓", color: "from-blue-500 to-cyan-500" },
                  { label: "Faculty Members",    value: faculty.length,       icon: "👨‍🏫", color: "from-violet-500 to-purple-500" },
                  { label: "Open Complaints",    value: openComplaints,       icon: "📬", color: "from-rose-500 to-pink-500" },
                  { label: "Announcements",      value: announcements.length, icon: "📢", color: "from-amber-500 to-orange-500" },
                  { label: "Detained",           value: detainedStudents,     icon: "⚠️", color: "from-amber-500 to-yellow-500" },
                  { label: "Dropouts",           value: dropoutStudents,      icon: "🚫", color: "from-red-500 to-rose-500" },
                  { label: "Placement Officers", value: placement.length,     icon: "💼", color: "from-emerald-500 to-teal-500" },
                  { label: "Total Students",     value: students.length,      icon: "👥", color: "from-indigo-500 to-blue-500" },
                ].map((s) => (
                  <div key={s.label} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-lg mb-3`}>
                      {s.icon}
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{s.value}</p>
                    <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Students per sem */}
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">📊 Active Students per Semester</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {SEM_SEQUENCE.map(({ year, sem }) => {
                    const count = students.filter((s) => s.sem === sem && s.year === year && (s.status || "active") === "active").length;
                    return (
                      <div key={sem} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[var(--color-text-secondary)] text-xs font-medium">{sem}</p>
                          <p className="text-[var(--color-text-muted)] text-xs">{year}</p>
                        </div>
                        <span className="text-[var(--color-text-primary)] font-bold text-lg">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent logins */}
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">🔐 Recent Logins</h3>
                <div className="space-y-2">
                  {loginLog.slice(0, 8).map((l, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[var(--color-bg-surface-alt)] rounded-xl">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0
                        ${l.role === "student" ? "bg-blue-500/20" : l.role === "faculty" ? "bg-violet-500/20" : l.role === "placement" ? "bg-amber-500/20" : "bg-rose-500/20"}`}>
                        {l.role === "student" ? "🎓" : l.role === "faculty" ? "👨‍🏫" : l.role === "placement" ? "💼" : "🛡️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{l.name}</p>
                        <p className="text-[var(--color-text-muted)] text-xs">{l.email || l.phone} · {l.branch}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize
                          ${l.role === "student" ? "bg-blue-500/20 text-blue-400" :
                            l.role === "faculty" ? "bg-violet-500/20 text-violet-400" :
                            l.role === "placement" ? "bg-amber-500/20 text-amber-400" :
                            "bg-rose-500/20 text-rose-400"}`}>
                          {l.role}
                        </span>
                        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                          {l.loginTime ? new Date(l.loginTime).toLocaleTimeString() : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {loginLog.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No logins recorded yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── STUDENT MANAGEMENT ── */}
          {activeTab === "Student Management" && (
            <div className="space-y-5">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    placeholder="🔍 Search by name or USN..."
                    className="flex-1 min-w-48 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)]"
                  />
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer">
                    <option value="All">All Status</option>
                    <option value="active">Active</option>
                    <option value="detained">Detained</option>
                    <option value="dropout">Dropout</option>
                    <option value="transferred">Transferred</option>
                  </select>
                  <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                    className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer">
                    <option value="All">All Years</option>
                    {["1st Year","2nd Year","3rd Year","4th Year"].map((y) => <option key={y}>{y}</option>)}
                  </select>
                  <select value={filterSem} onChange={(e) => setFilterSem(e.target.value)}
                    className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer">
                    <option value="All">All Sems</option>
                    {["Sem 1","Sem 2","Sem 3","Sem 4","Sem 5","Sem 6","Sem 7","Sem 8"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Sort controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[var(--color-text-muted)] text-xs font-medium mr-1">Sort by:</span>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => toggleSort(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1
                        ${sortBy === opt.key
                          ? "bg-[var(--color-accent-solid)] text-white"
                          : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>
                      {opt.label}
                      {sortBy === opt.key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  ))}
                </div>

                <p className="text-[var(--color-text-muted)] text-xs">Showing {sortedStudents.length} of {students.length} students</p>
              </div>

              <div className="space-y-3">
                {sortedStudents.length === 0 && (
                  <div className="text-center py-10 text-[var(--color-text-muted)]">
                    <p className="text-4xl mb-2">🔍</p>
                    <p className="text-sm">No students found.</p>
                  </div>
                )}
                {sortedStudents.map((s) => {
                  const status = s.status || "active";
                  return (
                    <div key={s.id} className={`bg-[var(--color-bg-surface)] border rounded-2xl p-4
                      ${status === "dropout" ? "border-red-500/30" :
                        status === "detained" ? "border-amber-500/30" :
                        status === "transferred" ? "border-blue-500/30" :
                        "border-[var(--color-border)]"}`}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-[var(--color-text-primary)] font-semibold text-sm">{s.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || STATUS_COLORS.active}`}>
                              {STATUS_LABELS[status] || "Active"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                            <span>🪪 {s.usn || s.id}</span>
                            <span>📚 {s.year} · {s.sem}</span>
                            <span>🏛️ {s.branch || "CSEAIML"}</span>
                            {s.email && <span>📧 {s.email}</span>}
                            {s.phone && <span>📱 {s.phone}</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          {status !== "dropout" && status !== "transferred" && (
                            <button onClick={() => handleAction(s.id, "promote")}
                              className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium cursor-pointer transition-all">
                              ⬆️ Promote
                            </button>
                          )}
                          {status === "active" && (
                            <button onClick={() => handleAction(s.id, "detain")}
                              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-xs font-medium cursor-pointer transition-all">
                              🔁 Detain
                            </button>
                          )}
                          {status !== "dropout" && (
                            <button onClick={() => handleAction(s.id, "dropout")}
                              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium cursor-pointer transition-all">
                              🚫 Dropout
                            </button>
                          )}
                          {status !== "active" && (
                            <button onClick={() => handleAction(s.id, "active")}
                              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium cursor-pointer transition-all">
                              ✅ Restore
                            </button>
                          )}
                          {status !== "transferred" && (
                            <button onClick={() => handleAction(s.id, "transfer")}
                              className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg text-xs font-medium cursor-pointer transition-all">
                              🔀 Transfer
                            </button>
                          )}
                          <button onClick={() => handleAction(s.id, "remove")}
                            className="px-3 py-1.5 bg-[var(--color-bg-surface-alt)] hover:bg-red-900/30 text-[var(--color-text-secondary)] hover:text-red-400 rounded-lg text-xs font-medium cursor-pointer transition-all">
                            🗑️ Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── FACULTY ── */}
          {activeTab === "Faculty" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">👨‍🏫 Faculty Members ({faculty.length})</h3>
                <div className="space-y-3">
                  {faculty.map((f) => {
                    const logEntry = loginLog.find((l) => l.id === f.id);
                    return (
                      <div key={f.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {f.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--color-text-primary)] font-semibold text-sm">{f.name}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)] mt-1">
                              <span>🪪 {f.id}</span>
                              <span>📚 {f.subject || "—"}</span>
                              <span>🏛️ {f.branch || "CSEAIML"}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                              {f.email && <span>📧 {f.email}</span>}
                              {f.phone && <span>📱 {f.phone}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {logEntry ? (
                              <>
                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">🟢 Logged in</span>
                                <p className="text-[var(--color-text-muted)] text-xs mt-1">{new Date(logEntry.loginTime).toLocaleString()}</p>
                              </>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] rounded-full">Never logged in</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {faculty.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No faculty registered yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── PLACEMENT & ADMIN ── */}
          {activeTab === "Placement & Admin" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">💼 Placement Officers ({placement.length})</h3>
                <div className="space-y-3">
                  {placement.map((p) => {
                    const logEntry = loginLog.find((l) => l.id === p.id);
                    return (
                      <div key={p.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--color-text-primary)] font-semibold text-sm">{p.name}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)] mt-1">
                              <span>🪪 {p.id}</span>
                              <span>🏛️ {p.dept || p.branch || "CSEAIML"}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                              {p.email && <span>📧 {p.email}</span>}
                              {p.phone && <span>📱 {p.phone}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {logEntry ? (
                              <>
                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">🟢 Logged in</span>
                                <p className="text-[var(--color-text-muted)] text-xs mt-1">{new Date(logEntry.loginTime).toLocaleString()}</p>
                              </>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] rounded-full">Never logged in</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {placement.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No placement officers registered.</p>}
                </div>
              </div>

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">🛡️ Admins ({admins.length})</h3>
                <div className="space-y-3">
                  {admins.map((a) => {
                    const logEntry = loginLog.find((l) => l.id === a.id);
                    return (
                      <div key={a.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {a.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--color-text-primary)] font-semibold text-sm">{a.name}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)] mt-1">
                              <span>🪪 {a.id}</span>
                              <span>🏛️ {a.dept || "CSEAIML"}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                              {a.email && <span>📧 {a.email}</span>}
                              {a.phone && <span>📱 {a.phone}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {logEntry ? (
                              <>
                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">🟢 Logged in</span>
                                <p className="text-[var(--color-text-muted)] text-xs mt-1">{new Date(logEntry.loginTime).toLocaleString()}</p>
                              </>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] rounded-full">Never logged in</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── ROLES & ACCESS ── */}
          {activeTab === "Roles & Access" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4">
                <input
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="🔍 Search by name, email, or ID..."
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)]"
                />
                <p className="text-[var(--color-text-muted)] text-xs mt-2">
                  Assign extra dashboard access to specific users. Their primary role (shown locked) can't be removed here.
                </p>
              </div>

              <div className="space-y-3">
                {allUsers
                  .filter((u) => {
                    const q = roleSearch.toLowerCase();
                    return !q ||
                      u.name?.toLowerCase().includes(q) ||
                      u.email?.toLowerCase().includes(q) ||
                      (u.usn || u.id)?.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const roles = getRolesFor(u);
                    const isDirty = !!pendingRoles[u.id];
                    return (
                      <div key={u.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                          <div>
                            <p className="text-[var(--color-text-primary)] font-semibold text-sm">{u.name}</p>
                            <p className="text-[var(--color-text-muted)] text-xs">
                              {u.email || u.usn || u.id} · Primary role: <span className="capitalize">{u.role}</span>
                            </p>
                          </div>
                          {isDirty && (
                            <button
                              onClick={() => savePermissions(u)}
                              disabled={savingRoles === u.id}
                              className="px-3 py-1.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer"
                            >
                              {savingRoles === u.id ? "Saving..." : "💾 Save Permissions"}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {ALL_ROLES.map((r) => {
                            const checked = roles.includes(r);
                            const isPrimary = r === u.role;
                            return (
                              <label
                                key={r}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                                  ${checked ? "bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)]" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}
                                  ${isPrimary ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isPrimary}
                                  onChange={() => toggleRole(u, r)}
                                  className={isPrimary ? "cursor-not-allowed" : "cursor-pointer"}
                                />
                                {ROLE_LABELS_MAP[r]}{isPrimary ? " (primary)" : ""}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {allUsers.length === 0 && (
                  <p className="text-[var(--color-text-muted)] text-sm text-center py-10">No users found.</p>
                )}
              </div>
            </div>
          )}

          {/* ── COMPLAINTS ── */}
          {activeTab === "Complaints" && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
              <h3 className="text-[var(--color-text-primary)] font-semibold">📬 All Complaints ({complaints.length})</h3>
              {complaints.length === 0 && (
                <div className="text-center py-10 text-[var(--color-text-muted)]">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm">No complaints submitted yet</p>
                </div>
              )}
              {complaints.map((c) => (
                <div key={c.id} className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs px-2 py-1 bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] rounded-lg">{c.category}</span>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium
                        ${c.status === "Resolved"    ? "bg-green-500/20 text-green-400" :
                          c.status === "In Progress" ? "bg-blue-500/20 text-blue-400" :
                          "bg-amber-500/20 text-amber-400"}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={c.status} onChange={(e) => updateComplaintStatus(c.id, e.target.value)}
                        className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-[var(--color-text-primary)] text-xs focus:outline-none cursor-pointer">
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Resolved</option>
                      </select>
                      <button onClick={() => removeComplaint(c.id)}
                        className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-sm">🗑️</button>
                    </div>
                  </div>
                  <h4 className="text-[var(--color-text-primary)] font-semibold text-sm mb-1">{c.title}</h4>
                  <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">{c.desc}</p>
                  <p className="text-[var(--color-text-muted)] text-xs mt-2">— {c.by} · {c.date}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {activeTab === "Announcements" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📢 Post Announcement</h3>
                <div className="flex gap-3">
                  <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && annTitle.trim() && (addAnnouncement({ title: annTitle, tag: annTag, postedBy: user?.name }), setAnnTitle(""))}
                    placeholder="Announcement text..."
                    className="flex-1 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm" />
                  <select value={annTag} onChange={(e) => setAnnTag(e.target.value)}
                    className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer">
                    {TAG_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={() => { if (annTitle.trim()) { addAnnouncement({ title: annTitle, tag: annTag, postedBy: user?.name }); setAnnTitle(""); } }}
                    disabled={!annTitle.trim()}
                    className="px-4 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer">
                    Post
                  </button>
                </div>
              </div>
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">All Announcements ({announcements.length})</h3>
                {announcements.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No announcements yet.</p>}
                {announcements.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 p-4 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-blue-500">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">{a.tag}</span>
                      </div>
                      <p className="text-[var(--color-text-primary)] text-sm font-medium">{a.title}</p>
                      <p className="text-[var(--color-text-muted)] text-xs mt-1">{a.time} · Posted by {a.postedBy}</p>
                    </div>
                    <button onClick={() => removeAnnouncement(a.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-sm flex-shrink-0">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NOTICE BOARD ── */}
          {activeTab === "Notice Board" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📢 Post Notice</h3>
                <input
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="Notice title..."
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm"
                />
                <textarea
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="Notice details (optional)..."
                  rows={3}
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm resize-none"
                />
                <div className="flex gap-3">
                  <select
                    value={noticeTag}
                    onChange={(e) => setNoticeTag(e.target.value)}
                    className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer"
                  >
                    {["Notice", "Exam", "Event", "Holiday", "Urgent"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={handlePostNotice}
                    disabled={!noticeTitle.trim()}
                    className="flex-1 px-4 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer"
                  >
                    📌 Post Notice
                  </button>
                </div>
              </div>

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">All Notices ({notices.length})</h3>
                {notices.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No notices posted yet.</p>}
                {notices.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-3 p-4 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-[var(--color-accent-solid)]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-full">{n.tag}</span>
                        <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] rounded-full capitalize">{n.postedRole}</span>
                      </div>
                      <p className="text-[var(--color-text-primary)] text-sm font-medium">{n.title}</p>
                      {n.content && <p className="text-[var(--color-text-secondary)] text-xs mt-1">{n.content}</p>}
                      <p className="text-[var(--color-text-muted)] text-xs mt-1">{n.date} {n.time} · Posted by {n.postedBy}</p>
                    </div>
                    <button onClick={() => removeNotice(n.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-sm flex-shrink-0">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GALLERY ── */}
          {activeTab === "Gallery" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📸 Upload Photo</h3>
                <input
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  placeholder="Caption..."
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && setGalleryFile(e.target.files[0])}
                  className="w-full text-[var(--color-text-secondary)] text-sm"
                />
                <button
                  onClick={handleUploadGalleryPhoto}
                  disabled={!galleryCaption.trim() || !galleryFile || galleryUploading}
                  className="w-full py-3 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer"
                >
                  {galleryUploading ? "⏳ Uploading..." : "📤 Upload to Gallery"}
                </button>
              </div>

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Gallery ({gallery.length})</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {gallery.length === 0 && <p className="text-[var(--color-text-muted)] text-sm col-span-4">No photos uploaded yet.</p>}
                  {gallery.map((g) => (
                    <div key={g.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl overflow-hidden border border-[var(--color-border)] group relative">
                      {g.url ? (
                        <img src={g.url} alt={g.caption} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-[var(--color-bg-hover)] flex items-center justify-center text-3xl">🖼️</div>
                      )}
                      <div className="p-2">
                        <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{g.caption}</p>
                        <p className="text-[var(--color-text-muted)] text-xs">{g.uploadedBy}</p>
                      </div>
                      <button
                        onClick={() => removeGalleryPhoto(g.id)}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600 rounded-lg flex items-center justify-center text-white text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-[var(--color-text-primary)] font-bold text-lg mb-2">Confirm Action</h3>
            <p className="text-[var(--color-text-secondary)] text-sm mb-2">{confirmAction.label}</p>
            <p className="text-[var(--color-text-muted)] text-xs mb-6">
              Student: <span className="text-[var(--color-text-primary)] font-medium">
                {students.find((s) => s.id === confirmAction.studentId)?.name || confirmAction.studentId}
              </span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-sm cursor-pointer">
                Cancel
              </button>
              <button onClick={executeAction}
                className="flex-1 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold cursor-pointer">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}