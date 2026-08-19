import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { useAuth, getAllStudents } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import {
  getCatalogSubjects,
  addCatalogSubject, editCatalogSubject,
  deactivateCatalogSubject, restoreCatalogSubject,
  getFacultySubjects, saveFacultySubjects,
  getSubjectAssessments, createAssessments, updateAssessmentMaxMarks,
  getStudentsByYearSem, getAllStudentProfiles,
  getMarksForAssessment, saveMarksBulk,
} from "../utils/supabase";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PDFViewer from "../components/PDFViewer";
import InternalMarksModal from "../components/InternalMarksModal";

const YEARS = [
  { label: "1st Year", sems: ["Sem 1", "Sem 2"] },
  { label: "2nd Year", sems: ["Sem 3", "Sem 4"] },
  { label: "3rd Year", sems: ["Sem 5", "Sem 6"] },
  { label: "4th Year", sems: ["Sem 7", "Sem 8"] },
];

const TABS = ["My Subjects", "Upload Notes", "Assignments", "Attendance", "Notice Board", "Gallery"];

// ══════════════════════════════════════════════════════════
// OPTION 1 — MANAGE SUBJECTS (catalog CRUD)
// Add / edit / deactivate / restore subjects for a Year+Semester.
// This is the shared catalog — changes here affect every faculty
// member and every student in that Year+Semester, not just the
// faculty member who made the change.
// ══════════════════════════════════════════════════════════
function SubjectCatalogModal({ initialYear, initialSem, onClose, onChanged }) {
  const [year, setYear] = useState(initialYear);
  const [sem, setSem] = useState(initialSem);
  const [activeList, setActiveList] = useState([]);
  const [inactiveList, setInactiveList] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [rowBusyId, setRowBusyId] = useState(null);
  const [rowMsg, setRowMsg] = useState({}); // { [id]: message }

  const currentYearObj = YEARS.find((y) => y.label === year) || YEARS[0];

  const loadAll = async () => {
    setLoading(true);
    const [active, all] = await Promise.all([
      getCatalogSubjects(year, sem),
      getCatalogSubjects(year, sem, { includeInactive: true }),
    ]);
    setActiveList(active);
    setInactiveList(all.filter((s) => !s.is_active));
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    setAddOpen(false);
    setEditingId(null);
    setRowMsg({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, sem]);

  const handleAdd = async () => {
    setAddError("");
    if (!addName.trim()) { setAddError("Subject name is required."); return; }
    setAddSaving(true);
    const res = await addCatalogSubject(year, sem, { name: addName, code: addCode });
    setAddSaving(false);
    if (!res.ok) { setAddError(res.error); return; }
    setAddName(""); setAddCode(""); setAddOpen(false);
    await loadAll();
    onChanged?.();
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditName(s.subject_name || "");
    setEditCode(s.subject_code || "");
    setEditError("");
  };

  const handleSaveEdit = async (subjectId) => {
    setEditError("");
    if (!editName.trim()) { setEditError("Subject name is required."); return; }
    setEditSaving(true);
    const res = await editCatalogSubject(subjectId, { name: editName, code: editCode }, year, sem);
    setEditSaving(false);
    if (!res.ok) { setEditError(res.error); return; }
    setEditingId(null);
    await loadAll();
    onChanged?.();
  };

  const handleRemove = async (s) => {
    setRowBusyId(s.id);
    setRowMsg((p) => ({ ...p, [s.id]: "" }));
    const res = await deactivateCatalogSubject(s.id);
    setRowBusyId(null);
    if (!res.ok) {
      setRowMsg((p) => ({ ...p, [s.id]: res.error }));
      return;
    }
    await loadAll();
    onChanged?.();
  };

  const handleRestore = async (s) => {
    setRowBusyId(s.id);
    const res = await restoreCatalogSubject(s.id);
    setRowBusyId(null);
    if (!res.ok) {
      setRowMsg((p) => ({ ...p, [s.id]: res.error }));
      return;
    }
    await loadAll();
    onChanged?.();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-[var(--color-text-primary)] font-bold text-lg">Manage Subjects</h2>
            <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">
              Add, edit, or remove subjects in the shared catalog. Changes here affect every faculty member and student for this Year + Semester.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer flex-shrink-0">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">Year</p>
            <div className="flex gap-2 flex-wrap">
              {YEARS.map((y) => (
                <button key={y.label}
                  onClick={() => { setYear(y.label); setSem(y.sems[0]); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                    ${year === y.label ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {y.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">Semester</p>
            <div className="flex gap-2">
              {currentYearObj.sems.map((s) => (
                <button key={s} onClick={() => setSem(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                    ${sem === s ? "bg-[var(--color-accent-to)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider">
                Subjects — {year}, {sem} {!loading && `(${activeList.length})`}
              </p>
              <button onClick={() => setAddOpen((o) => !o)}
                className="text-[var(--color-accent-soft-text)] text-xs font-medium hover:opacity-80 cursor-pointer">
                {addOpen ? "Cancel" : "+ Add Subject"}
              </button>
            </div>

            {addOpen && (
              <div className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl p-4 mb-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs block mb-1">Subject Name</label>
                    <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. English"
                      className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs block mb-1">Subject Code (optional)</label>
                    <input value={addCode} onChange={(e) => setAddCode(e.target.value)} placeholder="e.g. ENG101"
                      className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                  </div>
                </div>
                {addError && <p className="text-red-400 text-xs">{addError}</p>}
                <button onClick={handleAdd} disabled={addSaving}
                  className="px-4 py-2 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer">
                  {addSaving ? "Adding..." : "Add Subject"}
                </button>
              </div>
            )}

            {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>}
            {!loading && activeList.length === 0 && (
              <p className="text-[var(--color-text-muted)] text-sm">No subjects yet for {sem}. Add the first one above.</p>
            )}

            <div className="space-y-2">
              {activeList.map((s) => (
                <div key={s.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] p-3">
                  {editingId === s.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]" />
                        <input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Subject code"
                          className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]" />
                      </div>
                      {editError && <p className="text-red-400 text-xs">{editError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(s.id)} disabled={editSaving}
                          className="px-3 py-1.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xs font-medium cursor-pointer">
                          {editSaving ? "Saving..." : "Save Changes"}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-xs font-medium cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[var(--color-text-primary)] text-sm font-medium truncate">{s.subject_name}</p>
                        {s.subject_code && <p className="text-[var(--color-text-muted)] text-xs">{s.subject_code}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => startEdit(s)}
                          className="px-3 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-xs font-medium cursor-pointer hover:bg-[var(--color-bg-hover)]">
                          Edit
                        </button>
                        <button onClick={() => handleRemove(s)} disabled={rowBusyId === s.id}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40">
                          {rowBusyId === s.id ? "..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  )}
                  {rowMsg[s.id] && <p className="text-red-400 text-xs mt-2">{rowMsg[s.id]}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <button onClick={() => setShowInactive((v) => !v)}
              className="text-[var(--color-text-secondary)] text-xs font-medium hover:text-[var(--color-text-primary)] cursor-pointer">
              {showInactive ? "▲ Hide" : "▼ Show"} inactive subjects {!loading && `(${inactiveList.length})`}
            </button>
            {showInactive && (
              <div className="space-y-2 mt-3">
                {inactiveList.length === 0 && (
                  <p className="text-[var(--color-text-muted)] text-sm">No inactive subjects for {sem}.</p>
                )}
                {inactiveList.map((s) => (
                  <div key={s.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] p-3 flex items-center justify-between gap-3 opacity-70">
                    <div className="min-w-0">
                      <p className="text-[var(--color-text-primary)] text-sm font-medium truncate">{s.subject_name}</p>
                      <p className="text-[var(--color-text-muted)] text-xs">Inactive — historical marks/attendance are preserved.</p>
                    </div>
                    <button onClick={() => handleRestore(s)} disabled={rowBusyId === s.id}
                      className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 flex-shrink-0">
                      {rowBusyId === s.id ? "..." : "Restore"}
                    </button>
                    {rowMsg[s.id] && <p className="text-red-400 text-xs mt-2">{rowMsg[s.id]}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-[var(--color-border)]">
          <button onClick={onClose}
            className="w-full py-3 bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl text-sm font-semibold cursor-pointer transition-all">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// OPTION 2 — MY TEACHING SUBJECTS — faculty self-selects subjects for
// a Year+Semester from the shared subjects catalog. No admin step.
// ══════════════════════════════════════════════════════════
function ManageSubjectsModal({ facultyId, initialYear, initialSem, onClose, onSaved }) {
  const [year, setYear] = useState(initialYear);
  const [sem, setSem] = useState(initialSem);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentYearObj = YEARS.find((y) => y.label === year) || YEARS[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCatalogSubjects(year, sem),
      getFacultySubjects(facultyId, year, sem),
    ]).then(([subs, mine]) => {
      if (cancelled) return;
      setCatalog(subs);
      setSelected(new Set(mine.map((r) => r.subject_id)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [facultyId, year, sem]);

  const toggle = (subjectId) => {
    setSelected((p) => {
      const next = new Set(p);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveFacultySubjects(facultyId, year, sem, [...selected]);
    setSaving(false);
    onSaved(year, sem);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <h2 className="text-[var(--color-text-primary)] font-bold text-lg">My Teaching Subjects</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">Year</p>
            <div className="flex gap-2 flex-wrap">
              {YEARS.map((y) => (
                <button key={y.label}
                  onClick={() => { setYear(y.label); setSem(y.sems[0]); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                    ${year === y.label ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {y.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">Semester</p>
            <div className="flex gap-2">
              {currentYearObj.sems.map((s) => (
                <button key={s} onClick={() => setSem(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                    ${sem === s ? "bg-[var(--color-accent-to)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">
              Subjects available — {year}, {sem}
            </p>
            {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>}
            {!loading && catalog.length === 0 && (
              <p className="text-[var(--color-text-muted)] text-sm">
                No subjects found for {sem} in the catalog. Use "Manage Subjects" to add some first.
              </p>
            )}
            <div className="space-y-2">
              {catalog.map((s) => (
                <label key={s.id} className="flex items-center gap-3 bg-[var(--color-bg-surface-alt)] rounded-xl px-4 py-3 cursor-pointer border border-[var(--color-border)] hover:border-[var(--color-accent-solid)]/40">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="w-4 h-4 cursor-pointer accent-[var(--color-accent-solid)]"
                  />
                  <span className="text-[var(--color-text-primary)] text-sm font-medium">{s.subject_name}</span>
                  {s.subject_code && <span className="text-[var(--color-text-muted)] text-xs ml-auto">{s.subject_code}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-[var(--color-border)] flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl text-sm font-semibold cursor-pointer transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
            {saving ? "Saving..." : "💾 Save My Subjects"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════

export default function FacultyDashboard() {
  const { user, enrolledVersion } = useAuth();
  const {
    notes, addNote, removeNote,
    attendance, updateAttendance,
    assignments, addAssignment, removeAssignment,
    notices, addNotice, removeNotice,
    gallery, addGalleryPhoto, removeGalleryPhoto,
  } = useLMS();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("My Subjects");
  const [selectedYear, setSelectedYear] = useState(YEARS[2]);
  const [selectedSem, setSelectedSem] = useState("Sem 5");
  const [pdfViewer, setPdfViewer] = useState(null);

  const [mySubjects, setMySubjects] = useState([]); // faculty_subjects rows joined with subjects
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);       // My Teaching Subjects
  const [catalogOpen, setCatalogOpen] = useState(false);     // Manage Subjects (catalog CRUD)
  const [marksModalSubjectRow, setMarksModalSubjectRow] = useState(null);
  const [quickJumpValue, setQuickJumpValue] = useState("");

  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  };

  const [noteSubject, setNoteSubject] = useState("");
  const [noteType, setNoteType] = useState("Notes");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef(null);

  const [assignTitle, setAssignTitle] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignFile, setAssignFile] = useState(null);
  const [assignUploading, setAssignUploading] = useState(false);
  const assignFileRef = useRef(null);

  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeTag, setNoticeTag] = useState("Notice");

  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const galleryFileRef = useRef(null);

  const [allStudents, setAllStudents] = useState([]);
  const [semStudents, setSemStudents] = useState([]);

  const facultyId = user?.id;

  const loadMySubjects = async (year = selectedYear.label, sem = selectedSem) => {
    setSubjectsLoading(true);
    const rows = await getFacultySubjects(facultyId, year, sem);
    setMySubjects(rows);
    setSubjectsLoading(false);
  };

  useEffect(() => {
    if (!facultyId) return;
    loadMySubjects(selectedYear.label, selectedSem);
    setQuickJumpValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyId, selectedYear.label, selectedSem]);

  useEffect(() => {
    getAllStudentProfiles().then(setAllStudents);
  }, [enrolledVersion]);

  useEffect(() => {
    getStudentsByYearSem(selectedYear.label, selectedSem).then(setSemStudents);
  }, [selectedYear.label, selectedSem, enrolledVersion]);

  const STUDENTS = [...semStudents].sort((a, b) => {
    const av = sortBy === "usn" ? (a.usn || a.id || "") : (a.name || "");
    const bv = sortBy === "usn" ? (b.usn || b.id || "") : (b.name || "");
    const cmp = String(av).trim().toLowerCase().localeCompare(String(bv).trim().toLowerCase(), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const subjectNames = mySubjects.map((r) => r.subjects?.subject_name).filter(Boolean);

  const handleUploadNote = async () => {
    if (!noteSubject || !selectedFile) { alert("Please select a subject and a file."); return; }
    setUploading(true);
    try {
      await addNote({ subject: noteSubject, type: noteType, sem: selectedSem, uploadedBy: user?.name }, selectedFile);
      setNoteSubject(""); setNoteType("Notes"); setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadSuccess("✅ File uploaded! Students can now view and download it.");
      setTimeout(() => setUploadSuccess(""), 3000);
    } catch (err) { alert("Upload failed: " + err.message); }
    setUploading(false);
  };

  const handleAddAssignment = async () => {
    if (!assignTitle || !assignSubject || !assignDue) return;
    setAssignUploading(true);
    try {
      await addAssignment({ title: assignTitle, subject: assignSubject, due: assignDue, sem: selectedSem, uploadedBy: user?.name }, assignFile);
      setAssignTitle(""); setAssignSubject(""); setAssignDue(""); setAssignFile(null);
      if (assignFileRef.current) assignFileRef.current.value = "";
    } catch (err) { alert("Failed: " + err.message); }
    setAssignUploading(false);
  };

  const handleUpdateAttendance = (stuId, stuName, subject, value) => {
    updateAttendance(stuId, subject, value, stuName, selectedSem);
  };

  const handlePostNotice = () => {
    if (!noticeTitle.trim()) return;
    addNotice({ title: noticeTitle, content: noticeContent, tag: noticeTag, postedBy: user?.name, postedRole: "faculty" });
    setNoticeTitle(""); setNoticeContent(""); setNoticeTag("Notice");
  };

  const handleUploadGalleryPhoto = async () => {
    if (!galleryCaption.trim() || !galleryFile) { alert("Please add a caption and select a photo."); return; }
    setGalleryUploading(true); setGalleryError("");
    try {
      await addGalleryPhoto({ caption: galleryCaption, uploadedBy: user?.name, category: "Faculty" }, galleryFile);
      setGalleryCaption(""); setGalleryFile(null);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    } catch (err) {
      setGalleryError("Photo saved locally, but didn't sync to the shared gallery (" + (err.message || "unknown error") + ").");
      setGalleryCaption(""); setGalleryFile(null);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
    setGalleryUploading(false);
  };

  const semNotes = notes.filter((n) => n.sem === selectedSem);

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Faculty Dashboard" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] rounded-2xl p-5 text-white flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-white/80 text-sm mb-1">Faculty Portal 👨‍🏫</p>
              <h2 className="text-2xl font-bold">{user?.name}</h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={quickJumpValue}
                onChange={(e) => {
                  const row = mySubjects.find((r) => String(r.id) === e.target.value);
                  setQuickJumpValue(e.target.value);
                  if (row) setMarksModalSubjectRow(row);
                }}
                disabled={mySubjects.length === 0}
                className="bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium px-3 py-2 cursor-pointer backdrop-blur-sm text-white [&>option]:text-black"
              >
                <option value="" disabled>
                  {mySubjects.length === 0 ? "No subjects selected" : "📖 Jump to subject..."}
                </option>
                {mySubjects.map((row) => (
                  <option key={row.id} value={row.id}>{row.subjects?.subject_name}</option>
                ))}
              </select>

              <button onClick={() => setCatalogOpen(true)}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium cursor-pointer transition-all backdrop-blur-sm">
                📋 Manage Subjects
              </button>

              <button onClick={() => setManageOpen(true)}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium cursor-pointer transition-all backdrop-blur-sm">
                ⚙️ My Teaching Subjects
              </button>
            </div>
          </div>

          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4">
            <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-3">Select Year &amp; Semester</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {YEARS.map((y) => (
                <button key={y.label} onClick={() => { setSelectedYear(y); setSelectedSem(y.sems[0]); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                    ${selectedYear.label === y.label ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {y.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {selectedYear.sems.map((sem) => (
                <button key={sem} onClick={() => setSelectedSem(sem)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                    ${selectedSem === sem ? "bg-[var(--color-accent-to)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {sem}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all
                  ${activeTab === tab ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "My Subjects" && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📚 My Subjects — {selectedYear.label} • {selectedSem}</h3>
                <div className="flex gap-3">
                  <button onClick={() => setCatalogOpen(true)} className="text-[var(--color-text-secondary)] text-xs hover:opacity-80 cursor-pointer">
                    Manage subject catalog
                  </button>
                  <button onClick={() => setManageOpen(true)} className="text-[var(--color-accent-soft-text)] text-xs hover:opacity-80 cursor-pointer">
                    + Add/remove my subjects
                  </button>
                </div>
              </div>

              {subjectsLoading && <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>}

              {!subjectsLoading && mySubjects.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  <p className="text-sm">You haven't selected any subjects for {selectedSem} yet.</p>
                  <button onClick={() => setManageOpen(true)} className="mt-3 px-4 py-2 bg-[var(--color-accent-solid)] text-white rounded-xl text-xs font-medium cursor-pointer">
                    Select Subjects I Teach
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {mySubjects.map((row) => {
                  const isInactive = row.subjects?.is_active === false;
                  return (
                    <button key={row.id} onClick={() => setMarksModalSubjectRow(row)}
                      className="flex items-center justify-between bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] rounded-xl px-3 py-2.5 border border-[var(--color-border)] hover:border-[var(--color-accent-solid)]/50 gap-2 text-left cursor-pointer transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">📖</span>
                        <div className="min-w-0">
                          <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{row.subjects?.subject_name}</p>
                          <p className="text-[var(--color-text-muted)] text-[10px] mt-0.5">{selectedYear.label} • {selectedSem} — View Subject →</p>
                        </div>
                      </div>
                      {isInactive ? (
                        <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full flex-shrink-0">Inactive — records only</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-full flex-shrink-0">Assigned</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "Upload Notes" && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-5">
              <h3 className="text-[var(--color-text-primary)] font-semibold">📤 Upload Notes / PYQ — {selectedSem}</h3>
              <div className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">Subject</label>
                    <select value={noteSubject} onChange={(e) => setNoteSubject(e.target.value)}
                      className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm cursor-pointer">
                      <option value="">— Select Subject —</option>
                      {subjectNames.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    {subjectNames.length === 0 && (
                      <p className="text-amber-400 text-xs mt-1">⚠ Select your subjects first from My Subjects.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">Type</label>
                    <select value={noteType} onChange={(e) => setNoteType(e.target.value)}
                      className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm cursor-pointer">
                      <option value="Notes">📝 Notes</option>
                      <option value="PYQ">📋 Previous Year Questions</option>
                      <option value="Assignment">📌 Assignment</option>
                      <option value="Reference">📚 Reference Material</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1.5 block">File</label>
                  <div onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                      ${selectedFile ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-soft-bg)]" : "border-[var(--color-border)]"}`}>
                    <span className="text-3xl">{selectedFile ? "📄" : "📁"}</span>
                    {selectedFile ? (
                      <p className="text-[var(--color-accent-soft-text)] text-sm font-medium">{selectedFile.name}</p>
                    ) : (
                      <p className="text-[var(--color-text-secondary)] text-sm font-medium">Click to browse file</p>
                    )}
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                      onChange={(e) => e.target.files[0] && setSelectedFile(e.target.files[0])} className="hidden" />
                  </div>
                </div>
                <button onClick={handleUploadNote} disabled={!noteSubject || !selectedFile || uploading}
                  className="w-full py-3 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                  {uploading ? "⏳ Uploading..." : "📤 Upload"}
                </button>
                {uploadSuccess && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm text-center">{uploadSuccess}</div>}
              </div>

              <div>
                <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-3">Uploaded — {selectedSem} ({semNotes.length})</p>
                <div className="space-y-2">
                  {semNotes.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No files uploaded yet.</p>}
                  {semNotes.map((note) => (
                    <div key={note.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0"><span className="text-lg">📕</span></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{note.file}</p>
                          <p className="text-[var(--color-text-muted)] text-xs">{note.subject} · {note.type} · {note.uploadedBy}</p>
                        </div>
                        <button onClick={() => removeNote(note.id)} className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-base ml-2">🗑️</button>
                      </div>
                      {note.fileUrl && (
                        <div className="flex border-t border-[var(--color-border)]">
                          <button onClick={() => setPdfViewer({ fileUrl: note.fileUrl, fileName: note.file })}
                            className="flex-1 py-2 text-xs font-medium text-[var(--color-accent-soft-text)] hover:bg-[var(--color-accent-soft-bg)] cursor-pointer">👁 Preview</button>
                          <div className="w-px bg-[var(--color-border)]" />
                          <a href={note.fileUrl} target="_blank" rel="noreferrer" download={note.file}
                            className="flex-1 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 cursor-pointer text-center">⬇️ Download</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Assignments" && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
              <h3 className="text-[var(--color-text-primary)] font-semibold">📝 Assignment Reminders — {selectedSem}</h3>
              <div className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-2xl p-4 space-y-3">
                <input type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} placeholder="Assignment title..."
                  className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)}
                    className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm cursor-pointer">
                    <option value="">Select Subject</option>
                    {subjectNames.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)}
                    className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm" />
                </div>
                <div onClick={() => assignFileRef.current?.click()}
                  className={`w-full border border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer
                    ${assignFile ? "border-amber-500 bg-amber-500/10" : "border-[var(--color-border)]"}`}>
                  <span className="text-xl">{assignFile ? "📄" : "📎"}</span>
                  <p className="text-[var(--color-text-secondary)] text-xs flex-1">{assignFile ? assignFile.name : "Attach PDF (optional)"}</p>
                  <input ref={assignFileRef} type="file" accept=".pdf,.doc,.docx" onChange={(e) => setAssignFile(e.target.files[0])} className="hidden" />
                </div>
                <button onClick={handleAddAssignment} disabled={!assignTitle || !assignSubject || !assignDue || assignUploading}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer">
                  {assignUploading ? "⏳ Uploading..." : "+ Add Assignment Reminder"}
                </button>
              </div>
              <div className="space-y-2">
                {assignments.filter((a) => a.sem === selectedSem).map((a) => (
                  <div key={a.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden border-l-4 border-l-amber-500">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-[var(--color-text-primary)] text-xs font-medium">{a.title}</p>
                        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">{a.subject} · Due: {a.due}</p>
                      </div>
                      <button onClick={() => removeAssignment(a.id)} className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-base ml-4">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Attendance" && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📅 Attendance — {selectedSem}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleSort("name")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${sortBy === "name" ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                    Name {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                  <button onClick={() => toggleSort("usn")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${sortBy === "usn" ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                    USN {sortBy === "usn" && (sortDir === "asc" ? "▲" : "▼")}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left text-[var(--color-text-secondary)] text-xs py-2 pr-4 min-w-32">Student</th>
                      {subjectNames.map((s) => (
                        <th key={s} className="text-[var(--color-text-secondary)] text-xs py-2 px-2 text-center min-w-24">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STUDENTS.map((stu) => (
                      <tr key={stu.id} className="border-b border-[var(--color-border)]/50">
                        <td className="py-3 pr-4">
                          <p className="text-[var(--color-text-primary)] text-xs font-medium">{stu.name}</p>
                          <p className="text-[var(--color-text-muted)] text-xs">{stu.usn || stu.id}</p>
                        </td>
                        {subjectNames.map((subject) => {
                          const val = attendance[stu.id]?.[subject] ?? "";
                          return (
                            <td key={subject} className="py-3 px-2 text-center">
                              <input type="number" min="0" max="100" value={val}
                                onChange={(e) => handleUpdateAttendance(stu.id, stu.name, subject, Number(e.target.value))}
                                className="w-16 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-center" />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {STUDENTS.length === 0 && (
                      <tr><td colSpan={99} className="py-6 text-center text-[var(--color-text-muted)] text-sm">No students found for {selectedSem}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "Notice Board" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📢 Post Notice</h3>
                <input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="Notice title..."
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm" />
                <textarea value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} placeholder="Notice details..." rows={3}
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm resize-none" />
                <div className="flex gap-3">
                  <select value={noticeTag} onChange={(e) => setNoticeTag(e.target.value)}
                    className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[var(--color-text-primary)] text-sm cursor-pointer">
                    {["Notice", "Exam", "Event", "Holiday", "Urgent"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={handlePostNotice} disabled={!noticeTitle.trim()}
                    className="flex-1 px-4 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer">
                    📌 Post Notice
                  </button>
                </div>
              </div>
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">All Notices ({notices.length})</h3>
                {notices.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-3 p-4 bg-[var(--color-bg-surface-alt)] rounded-xl border-l-4 border-[var(--color-accent-solid)]">
                    <div className="flex-1">
                      <p className="text-[var(--color-text-primary)] text-sm font-medium">{n.title}</p>
                      {n.content && <p className="text-[var(--color-text-secondary)] text-xs mt-1">{n.content}</p>}
                    </div>
                    <button onClick={() => removeNotice(n.id)} className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-sm flex-shrink-0">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Gallery" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📸 Upload Photo</h3>
                <input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} placeholder="Caption"
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] text-sm" />
                <div onClick={() => galleryFileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer
                    ${galleryFile ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-soft-bg)]" : "border-[var(--color-border)]"}`}>
                  <span className="text-3xl">{galleryFile ? "🖼️" : "📁"}</span>
                  {galleryFile && <p className="text-[var(--color-accent-soft-text)] text-sm font-medium">{galleryFile.name}</p>}
                  <input ref={galleryFileRef} type="file" accept="image/*" onChange={(e) => e.target.files[0] && setGalleryFile(e.target.files[0])} className="hidden" />
                </div>
                <button onClick={handleUploadGalleryPhoto} disabled={!galleryCaption.trim() || !galleryFile || galleryUploading}
                  className="w-full py-3 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                  {galleryUploading ? "⏳ Uploading..." : "📤 Upload to Gallery"}
                </button>
                {galleryError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-xs">⚠️ {galleryError}</div>}
              </div>
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Gallery ({gallery.length})</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {gallery.map((g) => (
                    <div key={g.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl overflow-hidden border border-[var(--color-border)] group relative">
                      {g.url ? <img src={g.url} alt={g.caption} className="w-full h-32 object-cover" /> : <div className="w-full h-32 bg-[var(--color-bg-hover)] flex items-center justify-center text-3xl">🖼️</div>}
                      <div className="p-2">
                        <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{g.caption}</p>
                      </div>
                      <button onClick={() => removeGalleryPhoto(g.id)}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600 rounded-lg flex items-center justify-center text-white text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-all">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {pdfViewer && <PDFViewer fileUrl={pdfViewer.fileUrl} fileName={pdfViewer.fileName} onClose={() => setPdfViewer(null)} />}

      {catalogOpen && (
        <SubjectCatalogModal
          initialYear={selectedYear.label}
          initialSem={selectedSem}
          onClose={() => setCatalogOpen(false)}
          onChanged={() => loadMySubjects(selectedYear.label, selectedSem)}
        />
      )}

      {manageOpen && (
        <ManageSubjectsModal
          facultyId={facultyId}
          initialYear={selectedYear.label}
          initialSem={selectedSem}
          onClose={() => setManageOpen(false)}
          onSaved={(year, sem) => {
            setManageOpen(false);
            const yObj = YEARS.find((y) => y.label === year);
            if (yObj) setSelectedYear(yObj);
            setSelectedSem(sem);
            loadMySubjects(year, sem);
          }}
        />
      )}

      {marksModalSubjectRow && (
        <InternalMarksModal
          subjectRow={marksModalSubjectRow}
          facultyId={facultyId}
          year={selectedYear.label}
          sem={selectedSem}
          students={STUDENTS}
          allStudents={allStudents}
          onClose={() => { setMarksModalSubjectRow(null); setQuickJumpValue(""); }}
        />
      )}
    </div>
  );
}