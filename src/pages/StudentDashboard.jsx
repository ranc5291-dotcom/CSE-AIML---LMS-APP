import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLMS, normalizeSubjectMarks } from "../context/LMSContext";
import { getStudentMarksFull, getCatalogSubjects } from "../utils/supabase";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PDFViewer from "../components/PDFViewer";

const YEARS = [
  { label: "1st Year", sems: ["Sem 1", "Sem 2"] },
  { label: "2nd Year", sems: ["Sem 3", "Sem 4"] },
  { label: "3rd Year", sems: ["Sem 5", "Sem 6"] },
  { label: "4th Year", sems: ["Sem 7", "Sem 8"] },
];

const ALL_SEMS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

const DASHBOARD_TABS = ["Overview", "Notes & Subjects", "Placement", "Marks", "Attendance"];

// getStudentMarksFull() expects a year LABEL ("3rd Year") alongside the sem
// label ("Sem 5") — it does yearNumber()/semNumber() conversion internally.
// This derives that year label from a sem label using the YEARS map above.
function getYearForSem(semLabel) {
  const found = YEARS.find((y) => y.sems.includes(semLabel));
  return found ? found.label : null;
}

function SubjectPopup({ subject, sem, notes, assignments, onClose, onOpenPDF }) {
  const [tab, setTab] = useState("Notes");
  const TABS = ["Notes", "Assignments", "PYQ"];

  const subjectNotes = notes.filter(
    (n) => n.subject === subject && n.sem === sem && n.type !== "Assignment"
  );
  const subjectPYQ = notes.filter(
    (n) => n.subject === subject && n.sem === sem && n.type === "PYQ"
  );
  const subjectAssignments = assignments.filter(
    (a) => a.subject === subject && a.sem === sem
  );

  const displayNotes =
    tab === "PYQ" ? subjectPYQ :
    tab === "Assignments" ? [] :
    subjectNotes.filter((n) => n.type !== "PYQ");

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-[var(--color-text-primary)] font-bold text-lg">Subject: {subject}</h2>
            <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">{sem} - Click a file to view or download</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-all">
            X
          </button>
        </div>

        <div className="flex gap-1 p-3 border-b border-[var(--color-border)]">
          {TABS.map((t) => {
            const tabClass = tab === t
              ? "flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer bg-[var(--color-accent-solid)] text-white"
              : "flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]";
            const count = t === "Notes" ? subjectNotes.filter((n) => n.type !== "PYQ").length :
              t === "Assignments" ? subjectAssignments.length :
              subjectPYQ.length;
            return (
              <button key={t} onClick={() => setTab(t)} className={tabClass}>
                {t}
                <span className="ml-1 text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(tab === "Notes" || tab === "PYQ") && (
            <>
              {displayNotes.length === 0 && (
                <div className="text-center py-10 text-[var(--color-text-muted)]">
                  <p className="text-sm">No {tab === "PYQ" ? "Previous Year Questions" : "notes"} uploaded yet for {subject}</p>
                  <p className="text-xs mt-1">Faculty will upload them soon</p>
                </div>
              )}
              {displayNotes.map((note) => {
                const viewClass = note.fileUrl
                  ? "flex-1 py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1 transition-all text-[var(--color-accent-soft-text)] hover:bg-[var(--color-accent-soft-bg)]"
                  : "flex-1 py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1 transition-all text-[var(--color-text-muted)] cursor-not-allowed";
                const downloadClass = note.fileUrl
                  ? "flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-all text-green-400 hover:bg-green-500/10 cursor-pointer"
                  : "flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-all text-[var(--color-text-muted)] pointer-events-none";
                return (
                  <div key={note.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-text-muted)] transition-all">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-lg flex-shrink-0">
                        {note.type === "PYQ" ? "PYQ" : "PDF"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{note.file}</p>
                        <p className="text-[var(--color-text-muted)] text-xs">
                          <span className="text-[var(--color-accent-soft-text)]">{note.type}</span> - {note.uploadedBy}
                          {note.size && ` - ${note.size}`}
                        </p>
                      </div>
                      <span className="text-[var(--color-text-muted)] text-xs flex-shrink-0">{note.date}</span>
                    </div>
                    <div className="flex border-t border-[var(--color-border)]">
                      <button onClick={() => onOpenPDF(note.fileUrl, note.file)} disabled={!note.fileUrl} className={viewClass}>View</button>
                      <div className="w-px bg-[var(--color-border)]" />
                      <a href={note.fileUrl || "#"} target="_blank" rel="noreferrer" download={note.file} className={downloadClass}>Download</a>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === "Assignments" && (
            <>
              {subjectAssignments.length === 0 && (
                <div className="text-center py-10 text-[var(--color-text-muted)]">
                  <p className="text-sm">No assignments for {subject} yet</p>
                </div>
              )}
              {subjectAssignments.map((a) => (
                <div key={a.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden border-l-4 border-l-amber-500">
                  <div className="p-3">
                    <p className="text-[var(--color-text-primary)] text-sm font-medium">{a.title}</p>
                    <p className="text-[var(--color-text-muted)] text-xs mt-1">
                      Due: <span className="text-amber-400 font-medium">{a.due}</span>
                      {a.uploadedBy && ` - by ${a.uploadedBy}`}
                    </p>
                  </div>
                  {a.fileUrl && (
                    <div className="flex border-t border-[var(--color-border)]">
                      <button onClick={() => onOpenPDF(a.fileUrl, a.title)} className="flex-1 py-2 text-xs font-medium text-[var(--color-accent-soft-text)] hover:bg-[var(--color-accent-soft-bg)] cursor-pointer flex items-center justify-center gap-1">
                        View
                      </button>
                      <div className="w-px bg-[var(--color-border)]" />
                      <a href={a.fileUrl} download={a.title} target="_blank" rel="noreferrer" className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 cursor-pointer flex items-center justify-center gap-1">
                        Download
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PromotionPopup({ promo, onAcknowledge }) {
  if (!promo) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md p-6 text-center shadow-2xl">
        <h2 className="text-[var(--color-text-primary)] font-bold text-xl mb-2">Congratulations!</h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-4">
          You've been promoted from{" "}
          <span className="text-[var(--color-text-primary)] font-semibold">{promo.fromSem}</span> ({promo.fromYear}) to{" "}
          <span className="text-green-400 font-semibold">{promo.toSem}</span> ({promo.toYear}).
        </p>
        <p className="text-[var(--color-text-muted)] text-xs mb-6">
          Your marks and attendance history have been retained - nothing was lost.
        </p>
        <button onClick={onAcknowledge} className="w-full py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
          Got it!
        </button>
      </div>
    </div>
  );
}

// ── MARKS TAB — view-only, Supabase-backed ───────────────────────
function MyMarksPanel({ marksSem, setMarksSem, userId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marksData, setMarksData] = useState({});

  useEffect(() => {
    if (!userId || !marksSem) return;
    let cancelled = false;

    async function fetchMarks() {
      setLoading(true);
      setError(null);
      try {
        const yearLabel = getYearForSem(marksSem);
        if (!yearLabel) {
          if (!cancelled) setMarksData({});
          return;
        }
        const data = await getStudentMarksFull(userId, yearLabel, marksSem);
        if (!cancelled) setMarksData(data || {});
      } catch (err) {
        console.error("Failed to fetch marks:", err);
        if (!cancelled) setError("Could not load marks. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMarks();
    return () => {
      cancelled = true;
    };
  }, [userId, marksSem]);

  const subjectNames = Object.keys(marksData);

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-1">🏆 My Marks</h3>
        <p className="text-[var(--color-text-muted)] text-xs">Select a semester to view your internal marks.</p>
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-md">
        {ALL_SEMS.map((sem) => (
          <button
            key={sem}
            onClick={() => setMarksSem(sem)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer
              ${marksSem === sem
                ? "bg-[var(--color-accent-solid)] text-white"
                : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
          >
            {sem}
          </button>
        ))}
      </div>

      <div className="pt-2 space-y-3">
        <h4 className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider">
          {marksSem} — My Marks
        </h4>

        {loading && (
          <p className="text-[var(--color-text-muted)] text-sm">Loading marks…</p>
        )}

        {!loading && error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {!loading && !error && subjectNames.length === 0 && (
          <p className="text-[var(--color-text-muted)] text-sm">No subjects have been added for {marksSem} yet.</p>
        )}

        {!loading && !error && subjectNames.map((subject) => {
          const normalized = normalizeSubjectMarks(marksData[subject]);
          const enteredKeys = Object.keys(normalized);
          const hasAnyMarks = enteredKeys.length > 0;

          if (!hasAnyMarks) {
            return (
              <div key={subject} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-4 flex items-center justify-between gap-3">
                <p className="text-[var(--color-text-primary)] text-sm font-medium">{subject}</p>
                <p className="text-[var(--color-text-muted)] text-xs italic">Marks have not been published for this subject yet.</p>
              </div>
            );
          }

          const cols = enteredKeys.sort();
          const publishedKeys = enteredKeys.filter((k) => normalized[k]?.published);
          const totalScored = publishedKeys.reduce((s, k) => s + (Number(normalized[k]?.scored) || 0), 0);
          const totalMax = publishedKeys.reduce((s, k) => s + (Number(normalized[k]?.total) || 0), 0);
          const pct = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;

          return (
            <div key={subject} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[var(--color-text-primary)] text-sm font-semibold">{subject}</p>
                {totalMax > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${pct >= 75 ? "bg-green-500/20 text-green-400" : pct >= 50 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
                    {totalScored}/{totalMax} · {pct}%
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {cols.map((c) => (
                        <th key={c} className="text-center text-[var(--color-text-secondary)] text-xs py-1.5 px-3 whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {cols.map((c) => {
                        const cell = normalized[c];
                        const isPublished = !!cell?.published;
                        return (
                          <td key={c} className="text-center py-2 px-3 text-[var(--color-text-primary)] text-sm">
                            {isPublished
                              ? `${cell.scored}/${cell.total}`
                              : <span className="text-[var(--color-text-muted)] text-xs italic">Marks not published yet</span>}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const {
    notes, attendance, marks,
    assignments, announcements, notices,
    companies, dsaList, placementUploads,
    events, gallery,
    promotions, acknowledgePromotion,
  } = useLMS();

  const [mobileOpen, setMobileOpen]     = useState(false);
  const [activeTab, setActiveTab]       = useState(location.state?.tab || "Overview");
  const [selectedYear, setSelectedYear] = useState(() => {
    return YEARS.find((y) => y.label === user?.year) || YEARS[2];
  });
  const [selectedSem, setSelectedSem]   = useState(user?.sem || "Sem 5");
  const [marksSem, setMarksSem]         = useState(user?.sem || "Sem 5");
  const [pdfViewer, setPdfViewer]       = useState(null);
  const [subjectPopup, setSubjectPopup] = useState(null);
  const [activePromo, setActivePromo]   = useState(null);

  // ── SUBJECT CATALOG (Supabase — same source Manage Subjects writes
  // to) — scoped to the student's currently-browsed Year + Semester.
  // This replaces the old Firebase `subjects[sem]` list so newly
  // added/edited/removed catalog subjects show up here immediately,
  // without a separate student-side sync step.
  const [catalogSubjects, setCatalogSubjects] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    getCatalogSubjects(selectedYear.label, selectedSem).then((subs) => {
      if (!cancelled) {
        setCatalogSubjects(subs);
        setCatalogLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedYear.label, selectedSem]);

  useEffect(() => {
    if (user?.sem && user.sem !== selectedSem) {
      const matchedYear = YEARS.find((y) => y.label === user.year);
      if (matchedYear) setSelectedYear(matchedYear);
      setSelectedSem(user.sem);
      setMarksSem(user.sem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sem, user?.year]);

  useEffect(() => {
    if (!user?.id || !promotions) return;
    const mine = promotions
      .filter((p) => p.studentId === user.id && !p.acknowledged)
      .sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
    if (mine.length > 0) setActivePromo(mine[0]);
  }, [promotions, user?.id]);

  const handleAcknowledgePromo = () => {
    if (activePromo) acknowledgePromotion(activePromo.id);
    setActivePromo(null);
  };

  const myAttendance = attendance[user?.id] || {};
  const myMarks      = marks[user?.id] || {};

  const avgAttendance = Object.values(myAttendance).length
    ? Math.round(
        Object.values(myAttendance).reduce((a, b) => a + (Number(b) || 0), 0) /
        Object.values(myAttendance).length
      )
    : 0;

  const subjectPctList = Object.values(myMarks).map((subjectData) => {
    const internalsObj = normalizeSubjectMarks(subjectData);
    const entries = Object.values(internalsObj);
    if (entries.length === 0) return 0;
    const totalScored = entries.reduce((s, v) => s + (Number(v.scored) || 0), 0);
    const totalMax = entries.reduce((s, v) => s + (Number(v.total) || 100), 0);
    return totalMax > 0 ? totalScored / totalMax : 0;
  });

  const avgMarks = subjectPctList.length
    ? ((subjectPctList.reduce((a, b) => a + b, 0) / subjectPctList.length) * 10).toFixed(1)
    : "0.0";

  const myAssignments  = assignments.filter((a) => a.sem === user?.sem);
  const openCompanies  = companies.filter((c) => c.status === "Open");
  const upcomingEvents = [...events]
    .filter((e) => e.date >= new Date().toISOString().split("T")[0])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const allNotices = [
    ...(notices || []),
    ...(announcements || []),
  ].sort((a, b) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });

  const openPDF = (fileUrl, fileName) => {
    if (fileUrl) setPdfViewer({ fileUrl, fileName });
    else alert(`"${fileName}" - Ask faculty to re-upload this file.`);
  };

  const STATS = [
    { label: "Attendance",          value: `${avgAttendance}%`, color: "from-blue-500 to-cyan-500",    onClick: () => setActiveTab("Attendance") },
    { label: "CGPA",                value: avgMarks,             color: "from-violet-500 to-purple-500", onClick: () => setActiveTab("Marks") },
    { label: "Pending Assignments", value: myAssignments.length, color: "from-amber-500 to-orange-500", onClick: () => setActiveTab("Notes & Subjects") },
    { label: "Open Drives",         value: openCompanies.length, color: "from-rose-500 to-pink-500",    onClick: () => setActiveTab("Placement") },
  ];

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Student Dashboard" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] rounded-2xl p-5 text-white shadow-lg shadow-[var(--color-accent-solid)]/20">
            <p className="text-white/80 text-sm mb-1">Welcome back</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-white/80 text-sm mt-1">
              {user?.branch || "CSEAIML"} - {user?.usn || user?.id} - {user?.year} - {user?.sem}
            </p>
          </div>

          {upcomingEvents.length > 0 && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold text-sm">Upcoming Events</h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {upcomingEvents.map((e) => (
                  <div key={e.id} className="flex-shrink-0 bg-[var(--color-bg-surface-alt)] rounded-xl p-3 border border-[var(--color-border)] min-w-48">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-full">{e.tag}</span>
                    </div>
                    <p className="text-[var(--color-text-primary)] text-xs font-semibold truncate">{e.title}</p>
                    <p className="text-[var(--color-text-muted)] text-xs mt-1">{e.date} - {e.time}</p>
                    <p className="text-[var(--color-text-muted)] text-xs">{e.venue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map((stat) => (
              <button key={stat.label} onClick={stat.onClick} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left cursor-pointer hover:border-[var(--color-text-muted)] transition-all">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg mb-3`}></div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
                <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">{stat.label}</p>
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {DASHBOARD_TABS.map((tab) => {
              const tabClass = activeTab === tab
                ? "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-[var(--color-accent-solid)] text-white"
                : "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]";
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass}>
                  {tab}
                </button>
              );
            })}
          </div>

          {activeTab === "Overview" && (
            <div className="space-y-4">

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[var(--color-text-primary)] font-semibold">Notice Board</h3>
                  <span className="text-xs px-2 py-0.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-full ml-auto">
                    {allNotices.length} notices
                  </span>
                </div>
                <div className="space-y-3">
                  {allNotices.length === 0 && (
                    <p className="text-[var(--color-text-muted)] text-sm">No notices yet.</p>
                  )}
                  {allNotices.map((n) => {
                    const cardClass =
                      n.tag === "Urgent" ? "p-3 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-red-500" :
                      n.tag === "Exam" ? "p-3 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-amber-500" :
                      n.tag === "Event" ? "p-3 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-green-500" :
                      "p-3 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-blue-500";
                    const tagClass =
                      n.tag === "Urgent" ? "text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-red-500/20 text-red-400" :
                      n.tag === "Exam" ? "text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-500/20 text-amber-400" :
                      n.tag === "Event" ? "text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-green-500/20 text-green-400" :
                      "text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-500/20 text-blue-400";
                    return (
                      <div key={n.id} className={cardClass}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[var(--color-text-primary)] text-xs font-medium leading-snug">{n.title}</p>
                          <span className={tagClass}>{n.tag}</span>
                        </div>
                        {n.content && <p className="text-[var(--color-text-secondary)] text-xs mt-1">{n.content}</p>}
                        <p className="text-[var(--color-text-muted)] text-xs mt-1">
                          {n.time || n.date} - {n.postedBy}
                          {n.postedRole && ` (${n.postedRole})`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Assignment Reminders</h3>
                <div className="space-y-3">
                  {myAssignments.length === 0 && (
                    <div className="text-center py-5 text-[var(--color-text-muted)]">
                      <p className="text-sm">No pending assignments</p>
                    </div>
                  )}
                  {myAssignments.map((a) => (
                    <div key={a.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden border-l-4 border-l-amber-500">
                      <div className="p-3">
                        <p className="text-[var(--color-text-primary)] text-xs font-medium">{a.title}</p>
                        <p className="text-[var(--color-text-muted)] text-xs mt-1">
                          {a.subject} - Due: <span className="text-amber-400">{a.due}</span>
                        </p>
                      </div>
                      {a.fileUrl && (
                        <div className="flex border-t border-[var(--color-border)]">
                          <button onClick={() => openPDF(a.fileUrl, a.title)} className="flex-1 py-2 text-xs font-medium text-[var(--color-accent-soft-text)] hover:bg-[var(--color-accent-soft-bg)] cursor-pointer flex items-center justify-center gap-1">
                            View
                          </button>
                          <div className="w-px bg-[var(--color-border)]" />
                          <a href={a.fileUrl} download={a.title} target="_blank" rel="noreferrer" className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 cursor-pointer flex items-center justify-center gap-1">
                            Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {gallery && gallery.length > 0 && (
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[var(--color-text-primary)] font-semibold">Branch Gallery</h3>
                    <span className="text-[var(--color-text-muted)] text-xs">{gallery.length} photos</span>
                  </div>
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                    {gallery.slice(0, 8).map((g) => (
                      <div key={g.id} className="rounded-xl overflow-hidden aspect-square bg-[var(--color-bg-surface-alt)]">
                        {g.url ? (
                          <img src={g.url} alt={g.caption} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {openCompanies.length > 0 && (
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[var(--color-text-primary)] font-semibold">Open Placement Drives</h3>
                    <button onClick={() => setActiveTab("Placement")} className="text-amber-400 text-xs hover:text-amber-300 cursor-pointer">View All</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {openCompanies.slice(0, 4).map((c) => (
                      <div key={c.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3 border border-[var(--color-border)]">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <p className="text-[var(--color-text-primary)] text-xs font-bold">{c.name}</p>
                            <p className="text-[var(--color-text-secondary)] text-xs">{c.role}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Open</span>
                        </div>
                        <p className="text-amber-400 text-xs">{c.package}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Notes & Subjects" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Subjects by Year & Semester</h3>
                <div className="flex gap-2 flex-wrap mb-3">
                  {YEARS.map((year) => {
                    const yearClass = selectedYear.label === year.label
                      ? "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-[var(--color-accent-solid)] text-white"
                      : "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]";
                    return (
                      <button key={year.label} onClick={() => { setSelectedYear(year); setSelectedSem(year.sems[0]); }} className={yearClass}>
                        {year.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mb-5">
                  {selectedYear.sems.map((sem) => {
                    const semClass = selectedSem === sem
                      ? "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-[var(--color-accent-to)] text-white"
                      : "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]";
                    return (
                      <button key={sem} onClick={() => setSelectedSem(sem)} className={semClass}>
                        {sem}
                      </button>
                    );
                  })}
                </div>

                {catalogLoading && (
                  <p className="text-[var(--color-text-muted)] text-sm py-4">Loading subjects...</p>
                )}

                {!catalogLoading && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {catalogSubjects.map((s) => {
                      const subjectName = s.subject_name;
                      const subjectNotesCount = notes.filter(
                        (n) => n.subject === subjectName && n.sem === selectedSem
                      ).length;
                      const subjectAssignCount = assignments.filter(
                        (a) => a.subject === subjectName && a.sem === selectedSem
                      ).length;
                      return (
                        <button key={s.id} onClick={() => setSubjectPopup({ subject: subjectName, sem: selectedSem })} className="bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] hover:border-[var(--color-accent-solid)]/50 rounded-xl p-4 cursor-pointer transition-all group text-left">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent-from)]/20 to-[var(--color-accent-to)]/20 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform"></div>
                          <p className="text-[var(--color-text-primary)] text-xs font-semibold leading-tight mb-2">{subjectName}</p>
                          <p className="text-[var(--color-text-muted)] text-xs">{selectedSem}</p>
                          <div className="flex gap-2 mt-2">
                            {subjectNotesCount > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-md">{subjectNotesCount}</span>
                            )}
                            {subjectAssignCount > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-md">{subjectAssignCount}</span>
                            )}
                            {subjectNotesCount === 0 && subjectAssignCount === 0 && (
                              <span className="text-xs text-[var(--color-text-muted)]">Tap to open</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {catalogSubjects.length === 0 && (
                      <div className="col-span-4 text-center py-8 text-[var(--color-text-muted)]">
                        <p className="text-sm">No subjects added yet for {selectedSem}</p>
                        <p className="text-xs mt-1">Faculty will add subjects soon</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">All Notes & PYQs - {selectedSem}</h3>
                <div className="space-y-3">
                  {notes.filter((n) => n.sem === selectedSem).length === 0 && (
                    <div className="text-center py-6 text-[var(--color-text-muted)]">
                      <p className="text-sm">No files uploaded yet for {selectedSem}</p>
                    </div>
                  )}
                  {notes.filter((n) => n.sem === selectedSem).map((note) => {
                    const viewClass = note.fileUrl
                      ? "flex-1 py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1 transition-all text-[var(--color-accent-soft-text)] hover:bg-[var(--color-accent-soft-bg)]"
                      : "flex-1 py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1 transition-all text-[var(--color-text-muted)] cursor-not-allowed";
                    const downloadClass = note.fileUrl
                      ? "flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-all text-green-400 hover:bg-green-500/10 cursor-pointer"
                      : "flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-all text-[var(--color-text-muted)] pointer-events-none";
                    return (
                      <div key={note.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-text-muted)] transition-all">
                        <div className="flex items-center gap-3 p-3">
                          <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-lg flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{note.file}</p>
                            <p className="text-[var(--color-text-muted)] text-xs">
                              {note.subject} - <span className="text-[var(--color-accent-soft-text)]">{note.type}</span> - {note.uploadedBy}
                              {note.size && ` - ${note.size}`}
                            </p>
                          </div>
                          <span className="text-[var(--color-text-muted)] text-xs flex-shrink-0">{note.date}</span>
                        </div>
                        <div className="flex border-t border-[var(--color-border)]">
                          <button onClick={() => openPDF(note.fileUrl, note.file)} disabled={!note.fileUrl} className={viewClass}>View</button>
                          <div className="w-px bg-[var(--color-border)]" />
                          <a href={note.fileUrl || "#"} target="_blank" rel="noreferrer" download={note.file} className={downloadClass}>Download</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Placement" && (
            <div className="space-y-5">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Company Drives ({companies.length})</h3>
                {companies.length === 0 && (
                  <div className="text-center py-8 text-[var(--color-text-muted)]">
                    <p className="text-sm">No companies listed yet.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {companies.map((c) => {
                    const statusClass = c.status === "Open"
                      ? "text-xs px-2 py-1 rounded-lg font-medium bg-green-500/20 text-green-400"
                      : "text-xs px-2 py-1 rounded-lg font-medium bg-red-500/20 text-red-400";
                    return (
                      <div key={c.id} className="bg-[var(--color-bg-surface-alt)] rounded-2xl p-4 border border-[var(--color-border)] space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-[var(--color-text-primary)] font-bold">{c.name}</h4>
                            <p className="text-[var(--color-text-secondary)] text-sm">{c.role}</p>
                          </div>
                          <span className={statusClass}>{c.status}</span>
                        </div>
                        {c.description && <p className="text-[var(--color-text-secondary)] text-xs">{c.description}</p>}
                        {c.eligibility && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                            <p className="text-blue-300 text-xs font-semibold mb-0.5">Eligibility</p>
                            <p className="text-blue-200 text-xs">{c.eligibility}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                          <span>{c.package}</span>
                          {c.deadline && <span>Deadline: {c.deadline}</span>}
                        </div>
                        {c.status === "Open" && (
                          <button
                            onClick={() => {
                              if (c.googleFormUrl) window.open(c.googleFormUrl, "_blank");
                              else alert("Application form not set up yet. Contact Placement Officer.");
                            }}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium cursor-pointer transition-all"
                          >
                            {c.googleFormUrl ? "Apply Now - Open Google Form" : "Apply Now"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {placementUploads.length > 0 && (
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                  <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Placement Resources</h3>
                  <div className="space-y-2">
                    {placementUploads.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-[var(--color-bg-surface-alt)] rounded-xl px-4 py-3 border border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-[var(--color-text-primary)] text-xs font-medium">{item.title}</p>
                            <p className="text-[var(--color-text-muted)] text-xs">{item.category} - {item.uploadedBy} - {item.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.fileUrl && (
                            <button onClick={() => openPDF(item.fileUrl, item.fileName || item.title)} className="px-3 py-1.5 bg-violet-600/20 text-violet-300 rounded-lg text-xs hover:bg-violet-600/30 transition-all cursor-pointer">
                              View
                            </button>
                          )}
                          {(item.fileUrl || item.link) && (
                            <a href={item.fileUrl || item.link} target="_blank" rel="noreferrer" download={item.fileName || undefined} className="px-3 py-1.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-lg text-xs hover:opacity-80 transition-all">
                              {item.fileUrl ? "Download" : "Open"}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dsaList.length > 0 && (
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                  <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">DSA Practice Questions ({dsaList.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)]">
                          {["#", "Problem", "Topic", "Difficulty"].map((h) => (
                            <th key={h} className="text-left text-[var(--color-text-secondary)] text-xs py-2 px-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dsaList.map((d, i) => {
                          const diffClass =
                            d.difficulty === "Easy" ? "text-xs px-2 py-0.5 rounded-lg font-medium bg-green-500/20 text-green-400" :
                            d.difficulty === "Medium" ? "text-xs px-2 py-0.5 rounded-lg font-medium bg-amber-500/20 text-amber-400" :
                            "text-xs px-2 py-0.5 rounded-lg font-medium bg-red-500/20 text-red-400";
                          return (
                            <tr key={d.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-hover)]/50 transition-colors">
                              <td className="py-2 px-3 text-[var(--color-text-muted)] text-xs">{i + 1}</td>
                              <td className="py-2 px-3">
                                <a href={d.link || "#"} target="_blank" rel="noreferrer" className="text-[var(--color-accent-soft-text)] hover:opacity-80 text-xs font-medium">{d.title}</a>
                              </td>
                              <td className="py-2 px-3 text-[var(--color-text-secondary)] text-xs">{d.topic}</td>
                              <td className="py-2 px-3">
                                <span className={diffClass}>{d.difficulty}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Marks" && (
            <div className="space-y-4">
              <MyMarksPanel
                marksSem={marksSem}
                setMarksSem={setMarksSem}
                userId={user?.id}
              />
            </div>
          )}

          {activeTab === "Attendance" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">My Attendance</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(myAttendance).length === 0 && (
                    <p className="text-[var(--color-text-muted)] text-sm col-span-4">No attendance recorded yet.</p>
                  )}
                  {Object.entries(myAttendance).map(([subject, pct]) => {
                    const scoreClass = Number(pct) >= 75 ? "text-xl font-bold text-green-400" : Number(pct) >= 60 ? "text-xl font-bold text-amber-400" : "text-xl font-bold text-red-400";
                    const barClass = Number(pct) >= 75 ? "h-1.5 rounded-full bg-green-500" : Number(pct) >= 60 ? "h-1.5 rounded-full bg-amber-500" : "h-1.5 rounded-full bg-red-500";
                    return (
                      <div key={subject} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3">
                        <p className="text-[var(--color-text-secondary)] text-xs mb-2 truncate">{subject}</p>
                        <p className={scoreClass}>
                          {pct}<span className="text-[var(--color-text-muted)] text-xs">%</span>
                        </p>
                        <div className="mt-2 bg-[var(--color-border)] rounded-full h-1.5">
                          <div className={barClass} style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                        </div>
                        {Number(pct) < 75 && <p className="text-red-400 text-xs mt-1">Below 75%</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {subjectPopup && (
        <SubjectPopup
          subject={subjectPopup.subject}
          sem={subjectPopup.sem}
          notes={notes}
          assignments={assignments}
          onClose={() => setSubjectPopup(null)}
          onOpenPDF={openPDF}
        />
      )}

      {pdfViewer && (
        <PDFViewer
          fileUrl={pdfViewer.fileUrl}
          fileName={pdfViewer.fileName}
          onClose={() => setPdfViewer(null)}
        />
      )}

      {activePromo && (
        <PromotionPopup promo={activePromo} onAcknowledge={handleAcknowledgePromo} />
      )}
    </div>
  );
}