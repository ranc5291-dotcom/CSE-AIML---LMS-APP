import { useState, useRef, useEffect } from "react";
import { useAuth, getAllStudents } from "../context/AuthContext";
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

const TABS = ["Subjects", "Upload Notes", "Assignments", "Attendance", "Mark Sheets", "Notice Board", "Gallery"];

export default function FacultyDashboard() {
  const { user, enrolledVersion } = useAuth();
  const {
    subjects, addSubject, removeSubject,
    notes, addNote, removeNote,
    attendance, updateAttendance,
    marks, updateMark,
    assignments, addAssignment, removeAssignment,
    notices, addNotice, removeNotice,
    gallery, addGalleryPhoto, removeGalleryPhoto,
  } = useLMS();

  const [mobileOpen, setMobileOpen]       = useState(false);
  const [activeTab, setActiveTab]         = useState("Subjects");
  const [selectedYear, setSelectedYear]   = useState(YEARS[2]);
  const [selectedSem, setSelectedSem]     = useState("Sem 5");
  const [pdfViewer, setPdfViewer]         = useState(null);

  // Sorting — Attendance & Mark Sheets tables (shared)
  const [sortBy, setSortBy]   = useState("name"); // "name" | "usn"
  const [sortDir, setSortDir] = useState("asc");
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  };

  // Subjects
  const [newSubject, setNewSubject]       = useState("");

  // Notes
  const [noteSubject, setNoteSubject]     = useState("");
  const [noteType, setNoteType]           = useState("Notes");
  const [selectedFile, setSelectedFile]   = useState(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef                      = useRef(null);

  // Assignment
  const [assignTitle, setAssignTitle]     = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignDue, setAssignDue]         = useState("");
  const [assignFile, setAssignFile]       = useState(null);
  const [assignUploading, setAssignUploading] = useState(false);
  const assignFileRef                     = useRef(null);

  // Notice board
  const [noticeTitle, setNoticeTitle]     = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeTag, setNoticeTag]         = useState("Notice");

  // Gallery
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryFile, setGalleryFile]       = useState(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError]     = useState("");
  const galleryFileRef                      = useRef(null);

  // Derived student list based on selected sem
  const [allStudents, setAllStudents] = useState([]);
  useEffect(() => {
    getAllStudents().then(setAllStudents);
  }, [enrolledVersion]);
  const STUDENTS_RAW = allStudents.filter((u) => !u.sem || u.sem === selectedSem);
  const STUDENTS = [...STUDENTS_RAW].sort((a, b) => {
    const av = sortBy === "usn" ? (a.usn || a.id || "") : (a.name || "");
    const bv = sortBy === "usn" ? (b.usn || b.id || "") : (b.name || "");
    const cmp = String(av).trim().toLowerCase().localeCompare(
      String(bv).trim().toLowerCase(), undefined, { numeric: true }
    );
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleAddSubject = () => {
    if (!newSubject.trim()) return;
    addSubject(selectedSem, newSubject.trim());
    setNewSubject("");
  };

  const handleUploadNote = async () => {
    if (!noteSubject || !selectedFile) {
      alert("Please select a subject and a file.");
      return;
    }
    setUploading(true);
    try {
      await addNote({
        subject: noteSubject,
        type: noteType,
        sem: selectedSem,
        uploadedBy: user?.name,
      }, selectedFile);
      setNoteSubject("");
      setNoteType("Notes");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadSuccess("✅ File uploaded! Students can now view and download it.");
      setTimeout(() => setUploadSuccess(""), 3000);
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  };

  const handleAddAssignment = async () => {
    if (!assignTitle || !assignSubject || !assignDue) return;
    setAssignUploading(true);
    try {
      await addAssignment({
        title: assignTitle,
        subject: assignSubject,
        due: assignDue,
        sem: selectedSem,
        uploadedBy: user?.name,
      }, assignFile);
      setAssignTitle("");
      setAssignSubject("");
      setAssignDue("");
      setAssignFile(null);
      if (assignFileRef.current) assignFileRef.current.value = "";
    } catch (err) {
      alert("Failed: " + err.message);
    }
    setAssignUploading(false);
  };

  const handleUpdateMark = (stuId, stuName, subject, scored, total) => {
    updateMark(stuId, subject, scored, total, stuName, selectedSem);
  };

  const handleUpdateAttendance = (stuId, stuName, subject, value) => {
    updateAttendance(stuId, subject, value, stuName, selectedSem);
  };

  const handlePostNotice = () => {
    if (!noticeTitle.trim()) return;
    addNotice({
      title: noticeTitle,
      content: noticeContent,
      tag: noticeTag,
      postedBy: user?.name,
      postedRole: "faculty",
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
    setGalleryError("");
    try {
      await addGalleryPhoto({
        caption: galleryCaption,
        uploadedBy: user?.name,
        category: "Faculty",
      }, galleryFile);
      setGalleryCaption("");
      setGalleryFile(null);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    } catch (err) {
      // The photo is still added to a local fallback list (see LMSContext)
      // so it will still appear below — this just lets faculty know the
      // sync to the shared database didn't go through (e.g. permissions).
      setGalleryError(
        "Photo saved locally, but didn't sync to the shared gallery (" +
        (err.message || "unknown error") +
        "). It may not be visible to other users — check Firestore rules for the 'gallery' collection."
      );
      setGalleryCaption("");
      setGalleryFile(null);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
    setGalleryUploading(false);
  };

  const semNotes = notes.filter((n) => n.sem === selectedSem);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Faculty Dashboard" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          {/* Welcome */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-5 text-white">
            <p className="text-violet-100 text-sm mb-1">Faculty Portal 👨‍🏫</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-violet-100 text-sm mt-1">{user?.name}</p>
          </div>

          {/* Year / Sem selector */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">
              Select Year &amp; Semester
            </p>
            <div className="flex gap-2 flex-wrap mb-3">
              {YEARS.map((y) => (
                <button
                  key={y.label}
                  onClick={() => { setSelectedYear(y); setSelectedSem(y.sems[0]); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer
                    ${selectedYear.label === y.label
                      ? "bg-violet-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"}`}
                >
                  {y.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {selectedYear.sems.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSelectedSem(sem)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer
                    ${selectedSem === sem
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"}`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab
                    ? "bg-white text-gray-900"
                    : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── SUBJECTS ── */}
          {activeTab === "Subjects" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-semibold">📚 Subjects — {selectedSem}</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                  placeholder="Type new subject and press Enter..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                />
                <button
                  onClick={handleAddSubject}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {(subjects[selectedSem] || []).map((subject) => (
                  <div
                    key={subject}
                    className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5 border border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📖</span>
                      <span className="text-white text-xs font-medium">{subject}</span>
                    </div>
                    <button
                      onClick={() => removeSubject(selectedSem, subject)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-sm cursor-pointer ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {(subjects[selectedSem] || []).length === 0 && (
                  <p className="text-gray-600 text-sm col-span-3">
                    No subjects yet. Add one above.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── UPLOAD NOTES ── */}
          {activeTab === "Upload Notes" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
              <h3 className="text-white font-semibold">📤 Upload Notes / PYQ — {selectedSem}</h3>

              <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                      Subject
                    </label>
                    <select
                      value={noteSubject}
                      onChange={(e) => setNoteSubject(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm cursor-pointer"
                    >
                      <option value="">— Select Subject —</option>
                      {(subjects[selectedSem] || []).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    {(subjects[selectedSem] || []).length === 0 && (
                      <p className="text-amber-400 text-xs mt-1">
                        ⚠ Add subjects first from Subjects tab.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                      Type
                    </label>
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm cursor-pointer"
                    >
                      <option value="Notes">📝 Notes</option>
                      <option value="PYQ">📋 Previous Year Questions</option>
                      <option value="Assignment">📌 Assignment</option>
                      <option value="Reference">📚 Reference Material</option>
                    </select>
                  </div>
                </div>

                {/* File picker */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
                    File (PDF / DOCX / PPTX / Image)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                      ${selectedFile
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-gray-600 hover:border-gray-500 bg-gray-800/40"}`}
                  >
                    <span className="text-3xl">{selectedFile ? "📄" : "📁"}</span>
                    {selectedFile ? (
                      <>
                        <p className="text-violet-300 text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-gray-500 text-xs">
                          {(selectedFile.size / 1024).toFixed(1)} KB · Click to change
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-300 text-sm font-medium">Click to browse file</p>
                        <p className="text-gray-500 text-xs">PDF, DOCX, PPTX, PNG, JPG supported</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                      onChange={(e) => e.target.files[0] && setSelectedFile(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                </div>

                <button
                  onClick={handleUploadNote}
                  disabled={!noteSubject || !selectedFile || uploading}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  {uploading ? "⏳ Uploading to Cloudinary..." : "📤 Upload — Students can View & Download"}
                </button>

                {uploadSuccess && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm text-center">
                    {uploadSuccess}
                  </div>
                )}
              </div>

              {/* Uploaded files list */}
              <div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">
                  Uploaded — {selectedSem} ({semNotes.length})
                </p>
                <div className="space-y-2">
                  {semNotes.length === 0 && (
                    <div className="text-center py-8 text-gray-600">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-sm">No files uploaded yet for {selectedSem}</p>
                    </div>
                  )}
                  {semNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">📕</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{note.file}</p>
                          <p className="text-gray-500 text-xs">
                            {note.subject} · <span className="text-blue-400">{note.type}</span> · {note.uploadedBy}
                            {note.size && ` · ${note.size}`}
                          </p>
                        </div>
                        <span className="text-gray-600 text-xs">{note.date}</span>
                        <button
                          onClick={() => removeNote(note.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-base ml-2"
                        >
                          🗑️
                        </button>
                      </div>
                      {note.fileUrl && (
                        <div className="flex border-t border-gray-700">
                          <button
                            type="button"
                            onClick={() => setPdfViewer({ fileUrl: note.fileUrl, fileName: note.file })}
                            className="flex-1 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            👁 Preview
                          </button>
                          <div className="w-px bg-gray-700" />
                          <a
                            href={note.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={note.file}
                            className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            ⬇️ Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ASSIGNMENTS ── */}
          {activeTab === "Assignments" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-semibold">📝 Assignment Reminders — {selectedSem}</h3>
              <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 space-y-3">
                <input
                  type="text"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  placeholder="Assignment title..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={assignSubject}
                    onChange={(e) => setAssignSubject(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm cursor-pointer"
                  >
                    <option value="">Select Subject</option>
                    {(subjects[selectedSem] || []).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={assignDue}
                    onChange={(e) => setAssignDue(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>

                {/* PDF attach */}
                <div
                  onClick={() => assignFileRef.current?.click()}
                  className={`w-full border border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all
                    ${assignFile
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-gray-600 hover:border-gray-500"}`}
                >
                  <span className="text-xl">{assignFile ? "📄" : "📎"}</span>
                  <p className="text-gray-400 text-xs flex-1">
                    {assignFile ? assignFile.name : "Attach assignment PDF (optional)"}
                  </p>
                  {assignFile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignFile(null);
                        if (assignFileRef.current) assignFileRef.current.value = "";
                      }}
                      className="text-gray-500 hover:text-red-400 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                  <input
                    ref={assignFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setAssignFile(e.target.files[0])}
                    className="hidden"
                  />
                </div>

                <button
                  onClick={handleAddAssignment}
                  disabled={!assignTitle || !assignSubject || !assignDue || assignUploading}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
                >
                  {assignUploading ? "⏳ Uploading..." : "+ Add Assignment Reminder"}
                </button>
              </div>

              <div className="space-y-2">
                {assignments.filter((a) => a.sem === selectedSem).length === 0 && (
                  <p className="text-gray-600 text-sm">No assignments added for {selectedSem}.</p>
                )}
                {assignments
                  .filter((a) => a.sem === selectedSem)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden border-l-4 border-l-amber-500"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-white text-xs font-medium">{a.title}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {a.subject} · Due: {a.due}
                          </p>
                        </div>
                        <button
                          onClick={() => removeAssignment(a.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-base ml-4"
                        >
                          🗑️
                        </button>
                      </div>
                      {a.fileUrl && (
                        <div className="flex border-t border-gray-700">
                          <button
                            type="button"
                            onClick={() => setPdfViewer({ fileUrl: a.fileUrl, fileName: a.title })}
                            className="flex-1 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            👁 Preview PDF
                          </button>
                          <div className="w-px bg-gray-700" />
                          <a
                            href={a.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={a.title}
                            className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            ⬇️ Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === "Attendance" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-white font-semibold">📅 Attendance — {selectedSem}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs font-medium">Sort by:</span>
                  <button
                    onClick={() => toggleSort("name")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1
                      ${sortBy === "name" ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                    Name {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                  <button
                    onClick={() => toggleSort("usn")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1
                      ${sortBy === "usn" ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                    USN {sortBy === "usn" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th
                        onClick={() => toggleSort("name")}
                        className="text-left text-gray-400 text-xs py-2 pr-4 min-w-32 cursor-pointer select-none hover:text-white transition-colors"
                      >
                        Student {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}
                      </th>
                      {(subjects[selectedSem] || []).map((s) => (
                        <th key={s} className="text-gray-400 text-xs py-2 px-2 text-center min-w-24">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STUDENTS.map((stu) => (
                      <tr key={stu.id} className="border-b border-gray-800/50">
                        <td className="py-3 pr-4">
                          <p className="text-white text-xs font-medium">{stu.name}</p>
                          <p className="text-gray-500 text-xs">{stu.usn || stu.id}</p>
                        </td>
                        {(subjects[selectedSem] || []).map((subject) => {
                          const val = attendance[stu.id]?.[subject] ?? "";
                          return (
                            <td key={subject} className="py-3 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={val}
                                onChange={(e) =>
                                  handleUpdateAttendance(
                                    stu.id,
                                    stu.name,
                                    subject,
                                    Number(e.target.value)
                                  )
                                }
                                className={`w-16 bg-gray-800 border rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-violet-500 transition-colors
                                  ${val === ""
                                    ? "border-gray-700 text-white"
                                    : val >= 75
                                    ? "border-green-500/50 text-green-400"
                                    : val >= 60
                                    ? "border-amber-500/50 text-amber-400"
                                    : "border-red-500/50 text-red-400"}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {STUDENTS.length === 0 && (
                      <tr>
                        <td colSpan={99} className="py-6 text-center text-gray-600 text-sm">
                          No students found for {selectedSem}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(subjects[selectedSem] || []).length === 0 && (
                  <p className="text-gray-600 text-sm mt-4">
                    ⚠ Add subjects first from the Subjects tab.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── MARK SHEETS — with total & scored editing ── */}
          {activeTab === "Mark Sheets" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-white font-semibold">🏆 Mark Sheets — {selectedSem}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs font-medium">Sort by:</span>
                  <button
                    onClick={() => toggleSort("name")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1
                      ${sortBy === "name" ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                    Name {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                  <button
                    onClick={() => toggleSort("usn")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1
                      ${sortBy === "usn" ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                    USN {sortBy === "usn" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                </div>
                <p className="text-gray-500 text-xs">Edit scored / total marks per subject. Saves automatically.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th
                        onClick={() => toggleSort("name")}
                        className="text-left text-gray-400 text-xs py-2 pr-4 min-w-32 cursor-pointer select-none hover:text-white transition-colors"
                      >
                        Student {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}
                      </th>
                      {(subjects[selectedSem] || []).map((s) => (
                        <th key={s} className="text-gray-400 text-xs py-2 px-2 text-center min-w-36">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STUDENTS.map((stu) => (
                      <tr key={stu.id} className="border-b border-gray-800/50">
                        <td className="py-3 pr-4">
                          <p className="text-white text-xs font-medium">{stu.name}</p>
                          <p className="text-gray-500 text-xs">{stu.usn || stu.id}</p>
                        </td>
                        {(subjects[selectedSem] || []).map((subject) => {
                          const markData = marks[stu.id]?.[subject];
                          const scored   = typeof markData === "object" ? (markData.scored ?? "") : (markData ?? "");
                          const total    = typeof markData === "object" ? (markData.total ?? 100) : 100;
                          const pct = scored !== "" && total > 0 ? Math.round((Number(scored) / Number(total)) * 100) : null;
                          return (
                            <td key={subject} className="py-3 px-2 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={total || 100}
                                  value={scored}
                                  onChange={(e) =>
                                    handleUpdateMark(stu.id, stu.name, subject, e.target.value === "" ? "" : Number(e.target.value), total)
                                  }
                                  placeholder="0"
                                  title="Marks scored"
                                  className={`w-14 bg-gray-800 border rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-violet-500 transition-colors
                                    ${scored === ""
                                      ? "border-gray-700 text-white"
                                      : pct >= 75
                                      ? "border-green-500/50 text-green-400"
                                      : pct >= 50
                                      ? "border-amber-500/50 text-amber-400"
                                      : "border-red-500/50 text-red-400"}`}
                                />
                                <span className="text-gray-600 text-xs">/</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={total}
                                  onChange={(e) =>
                                    handleUpdateMark(stu.id, stu.name, subject, scored, e.target.value === "" ? 100 : Number(e.target.value))
                                  }
                                  title="Total marks"
                                  className="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center text-gray-400 focus:outline-none focus:border-violet-500"
                                />
                              </div>
                              {pct !== null && (
                                <p className={`text-xs mt-1 font-medium
                                  ${pct >= 75 ? "text-green-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                  {pct}%
                                </p>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {STUDENTS.length === 0 && (
                      <tr>
                        <td colSpan={99} className="py-6 text-center text-gray-600 text-sm">
                          No students found for {selectedSem}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(subjects[selectedSem] || []).length === 0 && (
                  <p className="text-gray-600 text-sm mt-4">
                    ⚠ Add subjects first from the Subjects tab.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── NOTICE BOARD ── */}
          {activeTab === "Notice Board" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-white font-semibold">📢 Post Notice</h3>
                <input
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="Notice title..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                />
                <textarea
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="Notice details (optional)..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm resize-none"
                />
                <div className="flex gap-3">
                  <select
                    value={noticeTag}
                    onChange={(e) => setNoticeTag(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none cursor-pointer"
                  >
                    {["Notice", "Exam", "Event", "Holiday", "Urgent"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={handlePostNotice}
                    disabled={!noticeTitle.trim()}
                    className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer"
                  >
                    📌 Post Notice
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-white font-semibold">All Notices ({notices.length})</h3>
                {notices.length === 0 && <p className="text-gray-600 text-sm">No notices posted yet.</p>}
                {notices.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-3 p-4 bg-gray-800 rounded-xl border-l-4 border-violet-500">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">{n.tag}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full capitalize">{n.postedRole}</span>
                      </div>
                      <p className="text-white text-sm font-medium">{n.title}</p>
                      {n.content && <p className="text-gray-400 text-xs mt-1">{n.content}</p>}
                      <p className="text-gray-500 text-xs mt-1">{n.date} {n.time} · Posted by {n.postedBy}</p>
                    </div>
                    <button onClick={() => removeNotice(n.id)}
                      className="text-gray-600 hover:text-red-400 cursor-pointer text-sm flex-shrink-0">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GALLERY ── */}
          {activeTab === "Gallery" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-white font-semibold">📸 Upload Photo</h3>
                <input
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  placeholder="Caption (e.g. Hackathon Winners 2026)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                />
                <div
                  onClick={() => galleryFileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                    ${galleryFile ? "border-violet-500 bg-violet-500/10" : "border-gray-600 hover:border-gray-500 bg-gray-800/40"}`}
                >
                  <span className="text-3xl">{galleryFile ? "🖼️" : "📁"}</span>
                  {galleryFile ? (
                    <p className="text-violet-300 text-sm font-medium">{galleryFile.name}</p>
                  ) : (
                    <p className="text-gray-300 text-sm font-medium">Click to browse photo</p>
                  )}
                  <input
                    ref={galleryFileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && setGalleryFile(e.target.files[0])}
                    className="hidden"
                  />
                </div>
                <button
                  onClick={handleUploadGalleryPhoto}
                  disabled={!galleryCaption.trim() || !galleryFile || galleryUploading}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer"
                >
                  {galleryUploading ? "⏳ Uploading..." : "📤 Upload to Gallery"}
                </button>
                {galleryError && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-xs">
                    ⚠️ {galleryError}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">Gallery ({gallery.length})</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {gallery.length === 0 && (
                    <p className="text-gray-600 text-sm col-span-4">No photos uploaded yet.</p>
                  )}
                  {gallery.map((g) => (
                    <div key={g.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group relative">
                      {g.url ? (
                        <img src={g.url} alt={g.caption} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-gray-700 flex items-center justify-center text-3xl">🖼️</div>
                      )}
                      <div className="p-2">
                        <p className="text-white text-xs font-medium truncate">{g.caption}</p>
                        <p className="text-gray-500 text-xs">{g.uploadedBy}</p>
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

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <PDFViewer
          fileUrl={pdfViewer.fileUrl}
          fileName={pdfViewer.fileName}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}