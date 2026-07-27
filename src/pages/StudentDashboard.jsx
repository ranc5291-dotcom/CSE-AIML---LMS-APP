import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PDFViewer from "../components/PDFViewer";

const YEARS = [
  { label: "1st Year", sems: ["Sem 1", "Sem 2"] },
  { label: "2nd Year", sems: ["Sem 3", "Sem 4"] },
  { label: "3rd Year", sems: ["Sem 5", "Sem 6"] },
  { label: "4th Year", sems: ["Sem 7", "Sem 8"] },
];

const DASHBOARD_TABS = ["Overview", "Notes & Subjects", "Placement", "Marks"];

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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">📖 {subject}</h2>
            <p className="text-gray-400 text-xs mt-0.5">{sem} · Click a file to view or download</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer transition-all">
            ✕
          </button>
        </div>

        <div className="flex gap-1 p-3 border-b border-gray-800">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer
                ${tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {t === "Notes" ? "📝 Notes" : t === "Assignments" ? "📌 Assignments" : "📋 PYQ"}
              <span className="ml-1 text-xs opacity-70">
                ({t === "Notes" ? subjectNotes.filter((n) => n.type !== "PYQ").length :
                  t === "Assignments" ? subjectAssignments.length :
                  subjectPYQ.length})
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(tab === "Notes" || tab === "PYQ") && (
            <>
              {displayNotes.length === 0 && (
                <div className="text-center py-10 text-gray-600">
                  <p className="text-3xl mb-2">{tab === "PYQ" ? "📋" : "📝"}</p>
                  <p className="text-sm">No {tab === "PYQ" ? "Previous Year Questions" : "notes"} uploaded yet for {subject}</p>
                  <p className="text-xs mt-1">Faculty will upload them soon</p>
                </div>
              )}
              {displayNotes.map((note) => (
                <div key={note.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-lg flex-shrink-0">
                      {note.type === "PYQ" ? "📋" : "📕"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{note.file}</p>
                      <p className="text-gray-500 text-xs">
                        <span className="text-blue-400">{note.type}</span> · {note.uploadedBy}
                        {note.size && ` · ${note.size}`}
                      </p>
                    </div>
                    <span className="text-gray-600 text-xs flex-shrink-0">{note.date}</span>
                  </div>
                  <div className="flex border-t border-gray-700">
                    <button
                      onClick={() => onOpenPDF(note.fileUrl, note.file)}
                      disabled={!note.fileUrl}
                      className={`flex-1 py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1 transition-all
                        ${note.fileUrl ? "text-blue-400 hover:bg-blue-500/10" : "text-gray-600 cursor-not-allowed"}`}>
                      👁 View
                    </button>
                    <div className="w-px bg-gray-700" />
                    <a
                      href={note.fileUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      download={note.file}
                      className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-all
                        ${note.fileUrl ? "text-green-400 hover:bg-green-500/10 cursor-pointer" : "text-gray-600 pointer-events-none"}`}>
                      ⬇️ Download
                    </a>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === "Assignments" && (
            <>
              {subjectAssignments.length === 0 && (
                <div className="text-center py-10 text-gray-600">
                  <p className="text-3xl mb-2">📌</p>
                  <p className="text-sm">No assignments for {subject} yet</p>
                </div>
              )}
              {subjectAssignments.map((a) => (
                <div key={a.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden border-l-4 border-l-amber-500">
                  <div className="p-3">
                    <p className="text-white text-sm font-medium">{a.title}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Due: <span className="text-amber-400 font-medium">{a.due}</span>
                      {a.uploadedBy && ` · by ${a.uploadedBy}`}
                    </p>
                  </div>
                  {a.fileUrl && (
                    <div className="flex border-t border-gray-700">
                      <button onClick={() => onOpenPDF(a.fileUrl, a.title)}
                        className="flex-1 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/10 cursor-pointer flex items-center justify-center gap-1">
                        👁 View
                      </button>
                      <div className="w-px bg-gray-700" />
                      <a
                        href={a.fileUrl}
                        download={a.title}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 cursor-pointer flex items-center justify-center gap-1">
                        ⬇️ Download
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

// ── Promotion Popup — shown once when the admin promotes this student ──
function PromotionPopup({ promo, onAcknowledge }) {
  if (!promo) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-white font-bold text-xl mb-2">Congratulations!</h2>
        <p className="text-gray-300 text-sm mb-4">
          You've been promoted from{" "}
          <span className="text-white font-semibold">{promo.fromSem}</span> ({promo.fromYear}) to{" "}
          <span className="text-green-400 font-semibold">{promo.toSem}</span> ({promo.toYear}).
        </p>
        <p className="text-gray-500 text-xs mb-6">
          Your marks and attendance history have been retained — nothing was lost.
        </p>
        <button
          onClick={onAcknowledge}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all"
        >
          Got it! 🎓
        </button>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const {
    subjects, notes, attendance, marks,
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
  const [pdfViewer, setPdfViewer]       = useState(null);
  const [subjectPopup, setSubjectPopup] = useState(null);
  const [activePromo, setActivePromo]   = useState(null);

  // Keep the Year/Sem selector in sync if the student's own sem changes
  // (e.g. right after being promoted) so their subjects update automatically.
  useEffect(() => {
    if (user?.sem && user.sem !== selectedSem) {
      const matchedYear = YEARS.find((y) => y.label === user.year);
      if (matchedYear) setSelectedYear(matchedYear);
      setSelectedSem(user.sem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sem, user?.year]);

  // Find the most recent unacknowledged promotion belonging to this student
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

  const avgMarks = Object.values(myMarks).length
    ? (
        Object.values(myMarks).reduce((acc, m) => {
          const scored = typeof m === "object" ? (Number(m.scored) || 0) : (Number(m) || 0);
          const total  = typeof m === "object" ? (Number(m.total) || 100) : 100;
          return acc + (total > 0 ? (scored / total) * 10 : 0);
        }, 0) / Object.values(myMarks).length
      ).toFixed(1)
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
    else alert(`"${fileName}" — Ask faculty to re-upload this file.`);
  };

  // Every stat card is clickable and jumps to the tab where that data lives.
  const STATS = [
    { label: "Attendance",          value: `${avgAttendance}%`, icon: "📅", color: "from-blue-500 to-cyan-500",    onClick: () => setActiveTab("Marks") },
    { label: "CGPA",                value: avgMarks,             icon: "🏆", color: "from-violet-500 to-purple-500", onClick: () => setActiveTab("Marks") },
    { label: "Pending Assignments", value: myAssignments.length, icon: "📝", color: "from-amber-500 to-orange-500", onClick: () => setActiveTab("Notes & Subjects") },
    { label: "Open Drives",         value: openCompanies.length, icon: "💼", color: "from-rose-500 to-pink-500",    onClick: () => setActiveTab("Placement") },
  ];

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Student Dashboard" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
            <p className="text-blue-100 text-sm mb-1">Welcome back 👋</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-blue-100 text-sm mt-1">
              {user?.branch || "CSEAIML"} · {user?.usn || user?.id} · {user?.year} · {user?.sem}
            </p>
          </div>

          {/* Upcoming Events Strip */}
          {upcomingEvents.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📅</span>
                <h3 className="text-white font-semibold text-sm">Upcoming Events</h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {upcomingEvents.map((e) => (
                  <div key={e.id} className="flex-shrink-0 bg-gray-800 rounded-xl p-3 border border-gray-700 min-w-48">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">{e.tag}</span>
                    </div>
                    <p className="text-white text-xs font-semibold truncate">{e.title}</p>
                    <p className="text-gray-500 text-xs mt-1">📅 {e.date} · {e.time}</p>
                    <p className="text-gray-500 text-xs">📍 {e.venue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats — every card is clickable */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map((stat) => (
              <button
                key={stat.label}
                onClick={stat.onClick}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-left cursor-pointer hover:border-gray-600 transition-all">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg mb-3`}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {DASHBOARD_TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "Overview" && (
            <div className="space-y-4">

              {/* Notice Board */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📢</span>
                  <h3 className="text-white font-semibold">Notice Board</h3>
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full ml-auto">
                    {allNotices.length} notices
                  </span>
                </div>
                <div className="space-y-3">
                  {allNotices.length === 0 && (
                    <p className="text-gray-600 text-sm">No notices yet.</p>
                  )}
                  {allNotices.map((n) => (
                    <div key={n.id} className={`p-3 bg-gray-800 rounded-xl border-l-4
                      ${n.tag === "Urgent" ? "border-red-500" :
                        n.tag === "Exam" ? "border-amber-500" :
                        n.tag === "Event" ? "border-green-500" :
                        "border-blue-500"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white text-xs font-medium leading-snug">{n.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0
                          ${n.tag === "Urgent" ? "bg-red-500/20 text-red-400" :
                            n.tag === "Exam" ? "bg-amber-500/20 text-amber-400" :
                            n.tag === "Event" ? "bg-green-500/20 text-green-400" :
                            "bg-blue-500/20 text-blue-400"}`}>
                          {n.tag}
                        </span>
                      </div>
                      {n.content && <p className="text-gray-400 text-xs mt-1">{n.content}</p>}
                      <p className="text-gray-500 text-xs mt-1">
                        {n.time || n.date} · {n.postedBy}
                        {n.postedRole && ` (${n.postedRole})`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignment Reminders */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">📌 Assignment Reminders</h3>
                <div className="space-y-3">
                  {myAssignments.length === 0 && (
                    <div className="text-center py-5 text-gray-600">
                      <p className="text-2xl mb-1">✅</p>
                      <p className="text-sm">No pending assignments</p>
                    </div>
                  )}
                  {myAssignments.map((a) => (
                    <div key={a.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden border-l-4 border-l-amber-500">
                      <div className="p-3">
                        <p className="text-white text-xs font-medium">{a.title}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          {a.subject} · Due: <span className="text-amber-400">{a.due}</span>
                        </p>
                      </div>
                      {a.fileUrl && (
                        <div className="flex border-t border-gray-700">
                          <button onClick={() => openPDF(a.fileUrl, a.title)}
                            className="flex-1 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/10 cursor-pointer flex items-center justify-center gap-1">
                            👁 View
                          </button>
                          <div className="w-px bg-gray-700" />
                          <a
                            href={a.fileUrl}
                            download={a.title}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 cursor-pointer flex items-center justify-center gap-1">
                            ⬇️ Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gallery preview */}
              {gallery && gallery.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">📸 Branch Gallery</h3>
                    <span className="text-gray-500 text-xs">{gallery.length} photos</span>
                  </div>
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                    {gallery.slice(0, 8).map((g) => (
                      <div key={g.id} className="rounded-xl overflow-hidden aspect-square bg-gray-800">
                        {g.url ? (
                          <img src={g.url} alt={g.caption} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick open drives */}
              {openCompanies.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">💼 Open Placement Drives</h3>
                    <button onClick={() => setActiveTab("Placement")}
                      className="text-amber-400 text-xs hover:text-amber-300 cursor-pointer">View All →</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {openCompanies.slice(0, 4).map((c) => (
                      <div key={c.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <p className="text-white text-xs font-bold">{c.name}</p>
                            <p className="text-gray-400 text-xs">{c.role}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Open</span>
                        </div>
                        <p className="text-amber-400 text-xs">💰 {c.package}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES & SUBJECTS ── */}
          {activeTab === "Notes & Subjects" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">📚 Subjects by Year & Semester</h3>
                <div className="flex gap-2 flex-wrap mb-3">
                  {YEARS.map((year) => (
                    <button key={year.label}
                      onClick={() => { setSelectedYear(year); setSelectedSem(year.sems[0]); }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                        ${selectedYear.label === year.label ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                      {year.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mb-5">
                  {selectedYear.sems.map((sem) => (
                    <button key={sem} onClick={() => setSelectedSem(sem)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                        ${selectedSem === sem ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                      {sem}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(subjects[selectedSem] || []).map((subject) => {
                    const subjectNotesCount = notes.filter(
                      (n) => n.subject === subject && n.sem === selectedSem
                    ).length;
                    const subjectAssignCount = assignments.filter(
                      (a) => a.subject === subject && a.sem === selectedSem
                    ).length;
                    return (
                      <button
                        key={subject}
                        onClick={() => setSubjectPopup({ subject, sem: selectedSem })}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all group text-left">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                          📖
                        </div>
                        <p className="text-white text-xs font-semibold leading-tight mb-2">{subject}</p>
                        <p className="text-gray-500 text-xs">{selectedSem}</p>
                        <div className="flex gap-2 mt-2">
                          {subjectNotesCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-md">
                              {subjectNotesCount} 📄
                            </span>
                          )}
                          {subjectAssignCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-md">
                              {subjectAssignCount} 📌
                            </span>
                          )}
                          {subjectNotesCount === 0 && subjectAssignCount === 0 && (
                            <span className="text-xs text-gray-600">Tap to open</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {(subjects[selectedSem] || []).length === 0 && (
                    <div className="col-span-4 text-center py-8 text-gray-600">
                      <p className="text-3xl mb-2">📚</p>
                      <p className="text-sm">No subjects added yet for {selectedSem}</p>
                      <p className="text-xs mt-1">Faculty will add subjects soon</p>
                    </div>
                  )}
                </div>
              </div>

              {/* All notes for selected sem */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">📄 All Notes & PYQs — {selectedSem}</h3>
                <div className="space-y-3">
                  {notes.filter((n) => n.sem === selectedSem).length === 0 && (
                    <div className="text-center py-6 text-gray-600">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-sm">No files uploaded yet for {selectedSem}</p>
                    </div>
                  )}
                  {notes.filter((n) => n.sem === selectedSem).map((note) => (
                    <div key={note.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all">
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-lg flex-shrink-0">📕</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{note.file}</p>
                          <p className="text-gray-500 text-xs">
                            {note.subject} · <span className="text-blue-400">{note.type}</span> · {note.uploadedBy}
                            {note.size && ` · ${note.size}`}
                          </p>
                        </div>
                        <span className="text-gray-600 text-xs flex-shrink-0">{note.date}</span>
                      </div>
                      <div className="flex border-t border-gray-700">
                        <button
                          onClick={() => openPDF(note.fileUrl, note.file)}
                          disabled={!note.fileUrl}
                          className={`flex-1 py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1 transition-all
                            ${note.fileUrl ? "text-blue-400 hover:bg-blue-500/10" : "text-gray-600 cursor-not-allowed"}`}>
                          👁 View
                        </button>
                        <div className="w-px bg-gray-700" />
                        <a
                          href={note.fileUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          download={note.file}
                          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-all
                            ${note.fileUrl ? "text-green-400 hover:bg-green-500/10 cursor-pointer" : "text-gray-600 pointer-events-none"}`}>
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PLACEMENT ── */}
          {activeTab === "Placement" && (
            <div className="space-y-5">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">🏢 Company Drives ({companies.length})</h3>
                {companies.length === 0 && (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm">No companies listed yet.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {companies.map((c) => (
                    <div key={c.id} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-bold">{c.name}</h4>
                          <p className="text-gray-400 text-sm">{c.role}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium
                          ${c.status === "Open" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {c.status}
                        </span>
                      </div>
                      {c.description && <p className="text-gray-400 text-xs">{c.description}</p>}
                      {c.eligibility && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                          <p className="text-blue-300 text-xs font-semibold mb-0.5">✅ Eligibility</p>
                          <p className="text-blue-200 text-xs">{c.eligibility}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>💰 {c.package}</span>
                        {c.deadline && <span>📅 Deadline: {c.deadline}</span>}
                      </div>
                      {c.status === "Open" && (
                        <button
                          onClick={() => {
                            if (c.googleFormUrl) window.open(c.googleFormUrl, "_blank");
                            else alert("Application form not set up yet. Contact Placement Officer.");
                          }}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium cursor-pointer transition-all">
                          {c.googleFormUrl ? "📋 Apply Now → Open Google Form" : "Apply Now →"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {placementUploads.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4">📂 Placement Resources</h3>
                  <div className="space-y-2">
                    {placementUploads.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📄</span>
                          <div>
                            <p className="text-white text-xs font-medium">{item.title}</p>
                            <p className="text-gray-500 text-xs">{item.category} · {item.uploadedBy} · {item.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.fileUrl && (
                            <button
                              onClick={() => openPDF(item.fileUrl, item.fileName || item.title)}
                              className="px-3 py-1.5 bg-violet-600/20 text-violet-300 rounded-lg text-xs hover:bg-violet-600/30 transition-all cursor-pointer"
                            >
                              👁 View
                            </button>
                          )}
                        {(item.fileUrl || item.link) && (
                          <a
                            href={item.fileUrl || item.link}
                            target="_blank"
                            rel="noreferrer"
                            download={item.fileName || undefined}
                            className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-all"
                          >
                            {item.fileUrl ? "⬇️ Download" : "🔗 Open"}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dsaList.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4">💻 DSA Practice Questions ({dsaList.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {["#", "Problem", "Topic", "Difficulty"].map((h) => (
                            <th key={h} className="text-left text-gray-400 text-xs py-2 px-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dsaList.map((d, i) => (
                          <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="py-2 px-3 text-gray-500 text-xs">{i + 1}</td>
                            <td className="py-2 px-3">
                              <a href={d.link || "#"} target="_blank" rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs font-medium">{d.title}</a>
                            </td>
                            <td className="py-2 px-3 text-gray-400 text-xs">{d.topic}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-lg font-medium
                                ${d.difficulty === "Easy" ? "bg-green-500/20 text-green-400" :
                                  d.difficulty === "Medium" ? "bg-amber-500/20 text-amber-400" :
                                  "bg-red-500/20 text-red-400"}`}>
                                {d.difficulty}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MARKS ── */}
          {activeTab === "Marks" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">🏆 My Marks</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(myMarks).length === 0 && (
                    <p className="text-gray-600 text-sm col-span-4">No marks recorded yet.</p>
                  )}
                  {Object.entries(myMarks).map(([subject, markData]) => {
                    const scored = typeof markData === "object" ? (Number(markData.scored) || 0) : (Number(markData) || 0);
                    const total  = typeof markData === "object" ? (Number(markData.total) || 100) : 100;
                    const pct    = total > 0 ? Math.round((scored / total) * 100) : 0;
                    return (
                      <div key={subject} className="bg-gray-800 rounded-xl p-3">
                        <p className="text-gray-400 text-xs mb-2 truncate">{subject}</p>
                        <p className={`text-xl font-bold
                          ${pct >= 75 ? "text-green-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {scored}
                          <span className="text-gray-600 text-xs">/{total}</span>
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{pct}%</p>
                        <div className="mt-2 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">📅 My Attendance</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(myAttendance).length === 0 && (
                    <p className="text-gray-600 text-sm col-span-4">No attendance recorded yet.</p>
                  )}
                  {Object.entries(myAttendance).map(([subject, pct]) => (
                    <div key={subject} className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-400 text-xs mb-2 truncate">{subject}</p>
                      <p className={`text-xl font-bold
                        ${Number(pct) >= 75 ? "text-green-400" : Number(pct) >= 60 ? "text-amber-400" : "text-red-400"}`}>
                        {pct}<span className="text-gray-600 text-xs">%</span>
                      </p>
                      <div className="mt-2 bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${Number(pct) >= 75 ? "bg-green-500" : Number(pct) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(Number(pct), 100)}%` }}
                        />
                      </div>
                      {Number(pct) < 75 && <p className="text-red-400 text-xs mt-1">⚠ Below 75%</p>}
                    </div>
                  ))}
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