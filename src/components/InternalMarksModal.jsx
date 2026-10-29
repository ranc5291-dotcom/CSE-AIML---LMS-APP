import { useState, useRef, useEffect } from "react";

import {
  supabase,
  getSubjectAssessments, createAssessments, updateAssessmentMaxMarks,
  updateAssessmentPublish, getMarksForAssessment, saveMarksBulk,
} from "../utils/supabase";
import { normId, normName } from "../utils/attendanceUpload";
import { useLMS } from "../context/LMSContext";
import { useAuth } from "../context/AuthContext";

// Header recognition for marks sheets (case / spacing / punctuation insensitive)
const MARK_HEADERS = {
  usn: ["usn", "usnno", "usnnumber", "rollno", "regno", "registerno"],
  name: ["name", "studentname", "studentsname", "students", "student"],
  marks: ["marksobtained", "marks", "marksscored", "obtained", "scored", "score"],
};
const headerKey = (c) => String(c ?? "").toLowerCase().replace(/[^a-z]/g, "");

// ══════════════════════════════════════════════════════════
// ONE INTERNAL'S PANEL — self-contained: owns its own max-marks
// editing, manual entry, CSV/Excel upload, and publish state.
// Collapsible so 5 internals stays scannable.
// ══════════════════════════════════════════════════════════
function InternalPanel({ assessment, subject, facultyId, year, sem, students, allStudents, onMaxMarksSaved, onPublishChanged }) {
  const lms = useLMS();
  const auth = useAuth();
  const notifyAcademicUpdate = lms?.notifyAcademicUpdate;
  const facultyName = auth?.user?.name;

  const [expanded, setExpanded] = useState(true);
  const [maxMarksInput, setMaxMarksInput] = useState(assessment.max_marks);
  const [savingMax, setSavingMax] = useState(false);
  const [mode, setMode] = useState("manual"); // "manual" | "upload"

  const [rowsByStudent, setRowsByStudent] = useState({});
  const [marksLoaded, setMarksLoaded] = useState(false);
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [maxMsg, setMaxMsg] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishCheckOpen, setPublishCheckOpen] = useState(false);

  const [excelFile, setExcelFile] = useState(null);
  const [excelStage, setExcelStage] = useState("idle");
  const [excelRows, setExcelRows] = useState([]);
  const [excelMissing, setExcelMissing] = useState([]);
  const [skipErrorRows, setSkipErrorRows] = useState(false);
  const [excelFormatError, setExcelFormatError] = useState("");
  const [excelSaveError, setExcelSaveError] = useState("");
  const excelFileRef = useRef(null);

  const maxMarks = Number(assessment.max_marks) || 0;
  const marksUsable = maxMarks >= 1;

  // Data-integrity guard: marks recorded ABOVE the current max_marks can
  // only happen if max_marks was lowered after marks were saved (e.g. a
  // save that slipped through before handleSaveMaxMarks blocked it, or a
  // direct DB edit). Surface it plainly rather than silently rendering
  // marks that look impossible next to the header.
  const studentsOverLimit = Object.entries(rowsByStudent)
    .filter(([, val]) => Number(val) > maxMarks)
    .map(([studentId, val]) => {
      const stu = students.find((s) => s.id === studentId) || allStudents.find((s) => s.id === studentId);
      return { studentId, marks: Number(val), name: stu?.name || "Unknown student", usn: stu?.usn || studentId };
    });

  // Students of this class who have NO saved mark for this internal.
  // (A saved 0 counts as a mark; only a missing row counts as "no marks".)
  const studentsWithoutMarks = students.filter((s) => {
    const v = rowsByStudent[s.id];
    return v === undefined || v === null || v === "";
  });

  // Typed in the table but not saved yet — students would not see these.
  const unsavedCount = Object.values(pending).filter((v) => v !== "" && v !== null && v !== undefined).length;

  const loadMarks = async () => {
    const rows = await getMarksForAssessment(assessment.id);
    const map = {};
    rows.forEach((r) => { map[r.student_id] = r.marks_obtained; });
    setRowsByStudent(map);
    setMarksLoaded(true);
  };

  useEffect(() => { loadMarks(); /* eslint-disable-next-line */ }, [assessment.id]);

  const handleSaveMaxMarks = async () => {
    setMaxMsg("");
    const val = Number(maxMarksInput);
    if (isNaN(val) || val < 0) { setMaxMsg("Maximum marks must be a non-negative number."); return; }

    // Guard: don't let a new (lower) max marks value strand existing
    // student marks above it — e.g. Internal 2 has tejas = 56 recorded,
    // faculty must not be able to save max = 50 until that mark is fixed.
    const enteredMarks = Object.values(rowsByStudent)
      .map((m) => Number(m))
      .filter((m) => !isNaN(m));
    const maxEntered = enteredMarks.length > 0 ? Math.max(...enteredMarks) : null;
    if (maxEntered !== null && val < maxEntered) {
      setMaxMsg(
        `Can't set maximum to ${val} — a student already has ${maxEntered} marks recorded for this internal. Correct that mark first, then lower the maximum.`
      );
      return;
    }

    setSavingMax(true);
    const res = await updateAssessmentMaxMarks(assessment.id, val);
    setSavingMax(false);
    if (res.ok) onMaxMarksSaved(assessment.id, val);
    else setMaxMsg("Save failed: " + res.error);
  };

  const getCurrentValue = (studentId) => {
    if (studentId in pending) return pending[studentId];
    return rowsByStudent[studentId] ?? "";
  };

  const rowError = (studentId) => {
    const val = getCurrentValue(studentId);
    if (val === "" || val === null || val === undefined) return null;
    const n = Number(val);
    if (isNaN(n)) return "Enter valid marks";
    if (n < 0) return "Enter valid marks (cannot be negative)";
    if (n > maxMarks) return `Enter valid marks (max ${maxMarks})`;
    return null;
  };

  const pendingHasErrors = Object.keys(pending).some((sid) => rowError(sid) !== null);

  const handleSaveMarks = async () => {
    // Empty fields are skipped entirely — never silently saved as 0.
    const edited = Object.entries(pending).filter(([, v]) => v !== "" && v !== null && v !== undefined);
    if (edited.length === 0 || !marksUsable) return;
    if (pendingHasErrors) { setSaveMsg("Fix invalid marks before saving."); return; }
    setSaving(true);
    const rows = edited.map(([studentId, val]) => ({
      studentId, subjectId: subject.id, assessmentId: assessment.id, marksObtained: Number(val),
    }));
    const res = await saveMarksBulk(rows, facultyId);
    setSaving(false);
    if (res.ok) {
      setRowsByStudent((p) => {
        const next = { ...p };
        rows.forEach((r) => { next[r.studentId] = r.marksObtained; });
        return next;
      });
      setPending({});
      setSaveMsg(`✅ Saved marks for ${edited.length} student(s).`);
      setTimeout(() => setSaveMsg(""), 3000);
    } else {
      setSaveMsg("Save failed: " + res.error);
    }
  };

  // ── Publish ──
  // Unpublishing is immediate. Publishing first checks for students who
  // would see no marks (or unsaved typed marks, or marks above the max)
  // and shows them in a review dialog; if everything is complete it
  // publishes straight away.
  const requestPublishToggle = () => {
    if (!assessment.is_published && !marksUsable) return;
    if (assessment.is_published) { doPublishToggle(); return; }
    if (studentsWithoutMarks.length > 0 || unsavedCount > 0 || studentsOverLimit.length > 0) {
      setPublishCheckOpen(true);
      return;
    }
    doPublishToggle();
  };

  const doPublishToggle = async () => {
    setPublishCheckOpen(false);
    if (!assessment.is_published && !marksUsable) return;
    const wasPublished = !!assessment.is_published;
    setPublishing(true);
    const res = await updateAssessmentPublish(assessment.id, !wasPublished);
    setPublishing(false);
    if (res.ok) {
      onPublishChanged(assessment.id, !wasPublished);

      // Marks stay hidden from students until published, so THIS is the
      // moment they should hear about it — an on-screen pop-up for
      // students who have the app open, plus a push notification for
      // students who don't. Scoped to this year + semester. A failure
      // here never blocks or undoes the publish itself.
      if (!wasPublished && notifyAcademicUpdate) {
        try {
          await notifyAcademicUpdate({
            title: `Internal ${assessment.assessment_number} Marks Published — ${subject.subject_name}`,
            body: `Your Internal ${assessment.assessment_number} marks for ${subject.subject_name} are now available.`,
            year,
            semester: sem,
            postedBy: facultyName || "Faculty",
            url: "/student",
          });
        } catch (err) {
          console.warn("Marks published, but the notification failed:", err?.message || err);
        }
      }
    }
  };

  // ── CSV / Excel upload ──
  const handleDownloadTemplate = async() => {
    if (students.length === 0) return;
    const XLSX = await import("xlsx");
    const rows = students.map((stu) => ({
      USN: stu.usn || stu.id,
      "Student Name": stu.name || "",
      Marks: "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Internal ${assessment.assessment_number}`);
    XLSX.writeFile(wb, `${subject.subject_name.replace(/\s+/g, "_")}_Internal${assessment.assessment_number}_template.xlsx`);
  };

  const handleValidate = async () => {
    if (!excelFile) return;
    setExcelFormatError("");
    setExcelSaveError("");
    setSkipErrorRows(false);
    const XLSX = await import("xlsx");

    let matrix;
    try {
      const buffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      if (!Array.isArray(matrix) || matrix.length === 0) throw new Error("empty");
    } catch {
      setExcelFormatError("Invalid file format or empty sheet. Upload a valid .xlsx, .xls, or .csv file.");
      return;
    }

    // Find the header row (it need not be the first row) and the columns.
    let headerIdx = -1;
    let cols = {};
    for (let i = 0; i < Math.min(matrix.length, 15); i++) {
      const found = {};
      (matrix[i] || []).forEach((cell, c) => {
        const k = headerKey(cell);
        Object.entries(MARK_HEADERS).forEach(([field, list]) => {
          if (found[field] === undefined && list.includes(k)) found[field] = c;
        });
      });
      if (found.usn !== undefined || found.name !== undefined) { headerIdx = i; cols = found; break; }
    }
    if (headerIdx === -1 || cols.marks === undefined) {
      setExcelFormatError(
        "Couldn't find the columns. The sheet needs a USN (or Name) column and a Marks column — use Download Template to get the right layout."
      );
      return;
    }

    const seen = new Set();
    const preview = [];
    matrix.forEach((cells, i) => {
      if (i <= headerIdx || !cells) return;
      if (cells.every((c) => String(c ?? "").trim() === "")) return; // blank row

      const usn = String(cols.usn !== undefined ? cells[cols.usn] ?? "" : "").trim();
      const fileName = String(cols.name !== undefined ? cells[cols.name] ?? "" : "").trim();
      const scoredRaw = String(cells[cols.marks] ?? "").trim();
      const errors = [];
      const warnings = [];

      // 1) match by USN (ignores spaces / hidden characters / case)
      let student = usn ? students.find((s) => normId(s.usn || s.id) === normId(usn)) : null;
      // 2) fall back to an exact (letters-only) name match, if unique
      if (!student && fileName) {
        const cands = students.filter((s) => normName(s.name) === normName(fileName));
        if (cands.length === 1) {
          student = cands[0];
          warnings.push(usn ? "USN not found — matched by name" : "Matched by name");
        }
      }

      if (!student) {
        const elsewhere = usn ? allStudents.find((s) => normId(s.usn || s.id) === normId(usn)) : null;
        if (elsewhere) errors.push("Student not enrolled in this subject/semester");
        else errors.push(usn || fileName ? "Invalid USN" : "Missing USN");
      } else {
        if (seen.has(student.id)) errors.push("Duplicate student");
        else seen.add(student.id);
      }

      if (scoredRaw === "") {
        // leave blank — not an error, just "no mark for this student" (skipped on save)
      } else if (isNaN(Number(scoredRaw))) errors.push("Enter valid marks");
      else if (Number(scoredRaw) > maxMarks) errors.push(`Enter valid marks (max ${maxMarks})`);
      else if (Number(scoredRaw) < 0) errors.push("Enter valid marks (cannot be negative)");

      preview.push({
        rowIndex: i + 1,
        usn,
        name: student?.name || fileName || "—",
        studentId: student?.id || null,
        scored: scoredRaw,
        errors,
        warnings,
      });
    });

    if (preview.length === 0) {
      setExcelFormatError("No student rows found below the header.");
      return;
    }

    // Students of this class that the file gives NO marks for
    // (not in the file at all, or a blank marks cell).
    const withMark = new Set(
      preview.filter((r) => r.studentId && r.errors.length === 0 && r.scored !== "").map((r) => r.studentId)
    );
    setExcelMissing(students.filter((s) => !withMark.has(s.id)));
    setExcelRows(preview);
    setExcelStage("previewing");
  };

  const excelHasErrors = excelRows.some((r) => r.errors.length > 0);
  const excelErrorCount = excelRows.filter((r) => r.errors.length > 0).length;
  const excelSavableRows = excelRows.filter((r) => r.errors.length === 0 && r.scored !== "" && r.scored !== null);
  const excelBlocked = excelHasErrors && !skipErrorRows;

  const handleConfirmExcel = async () => {
    if (excelBlocked || !marksUsable || excelSavableRows.length === 0) return;
    setExcelStage("saving");
    setExcelSaveError("");
    const rows = excelSavableRows.map((r) => ({
      studentId: r.studentId, subjectId: subject.id, assessmentId: assessment.id, marksObtained: Number(r.scored),
    }));
    const res = await saveMarksBulk(rows, facultyId);
    if (res && res.ok === false) {
      setExcelSaveError("Save failed: " + res.error);
      setExcelStage("previewing");
      return;
    }
    await loadMarks();
    setExcelStage("done");
  };

  const resetExcel = () => {
    setExcelFile(null); setExcelRows([]); setExcelMissing([]); setExcelStage("idle");
    setExcelFormatError(""); setExcelSaveError(""); setSkipErrorRows(false);
    if (excelFileRef.current) excelFileRef.current.value = "";
  };

  return (
    <div className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[var(--color-text-primary)] font-semibold text-sm">{`Internal ${assessment.assessment_number}`}</span>
          <span className="text-[var(--color-text-muted)] text-xs">max {maxMarks}</span>
          {assessment.is_published ? (
            <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Published</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Draft</span>
          )}
          {marksLoaded && students.length > 0 && studentsWithoutMarks.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
              {studentsWithoutMarks.length} without marks
            </span>
          )}
          {studentsOverLimit.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
              ⚠ {studentsOverLimit.length} over max
            </span>
          )}
        </div>
        <span className="text-[var(--color-text-muted)] text-xs">{expanded ? "▲ Collapse" : "▼ Expand"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)] pt-4">
          {/* Max marks */}
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-[var(--color-text-secondary)] text-xs block mb-1">Maximum Marks</label>
              <input type="number" min="0" value={maxMarksInput}
                onChange={(e) => setMaxMarksInput(e.target.value)}
                className="w-24 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-center text-[var(--color-text-primary)]" />
            </div>
            <button onClick={handleSaveMaxMarks} disabled={savingMax}
              className="px-3 py-1.5 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40">
              {savingMax ? "Saving..." : "Save Max"}
            </button>
            {!marksUsable && (
              <p className="text-amber-400 text-xs">⚠ Set maximum marks (≥ 1) before entering or publishing marks.</p>
            )}
          </div>
          {maxMsg && <p className="text-red-400 text-xs -mt-2">{maxMsg}</p>}

          {studentsOverLimit.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 space-y-1">
              <p className="text-red-400 text-xs font-semibold">
                ⚠ Data integrity: {studentsOverLimit.length} student{studentsOverLimit.length > 1 ? "s have" : " has"} marks above this internal's current maximum ({maxMarks}).
              </p>
              <ul className="text-red-300 text-xs list-disc list-inside">
                {studentsOverLimit.map((s) => (
                  <li key={s.studentId}>{s.name} ({s.usn}) — {s.marks} recorded, max is {maxMarks}</li>
                ))}
              </ul>
              <p className="text-red-300/80 text-[11px]">
                This usually means the maximum was lowered after marks were saved.
                {assessment.is_published && " These marks are currently visible to students in this inconsistent state."}
                {" "}Correct the mark(s) above, or raise the maximum back up, before making further changes.
              </p>
            </div>
          )}

          {students.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm">No students are currently enrolled in this subject.</p>
          ) : (
            <>
              {/* Manual / Upload toggle */}
              <div className="flex gap-2">
                <button onClick={() => setMode("manual")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all
                    ${mode === "manual" ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"}`}>
                  ✍️ Enter Marks Manually
                </button>
                <button onClick={() => setMode("upload")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all
                    ${mode === "upload" ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"}`}>
                  📊 Upload Marks
                </button>
              </div>

              {mode === "manual" && (
                <div className="space-y-3">
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--color-bg-surface-alt)]">
                        <tr className="border-b border-[var(--color-border)]">
                          <th className="text-left text-[var(--color-text-secondary)] text-xs py-2 pr-4">USN</th>
                          <th className="text-left text-[var(--color-text-secondary)] text-xs py-2 pr-4">Student Name</th>
                          <th className="text-center text-[var(--color-text-secondary)] text-xs py-2 px-2">Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((stu) => {
                          const err = rowError(stu.id);
                          return (
                            <tr key={stu.id} className="border-b border-[var(--color-border)]/50">
                              <td className="py-2 pr-4 text-[var(--color-text-muted)] text-xs">{stu.usn || stu.id}</td>
                              <td className="py-2 pr-4 text-[var(--color-text-primary)] text-xs">{stu.name}</td>
                              <td className="py-2 px-2 text-center">
                                <input type="number" min="0" max={maxMarks}
                                  disabled={!marksUsable}
                                  value={getCurrentValue(stu.id)}
                                  onChange={(e) => setPending((p) => ({ ...p, [stu.id]: e.target.value }))}
                                  className={`w-20 bg-[var(--color-bg-surface)] border rounded-lg px-2 py-1.5 text-xs text-center text-[var(--color-text-primary)] disabled:opacity-40
                                    ${err ? "border-red-500" : "border-[var(--color-border)]"}`} />
                                {err && <p className="text-red-400 text-[10px] mt-0.5">{err}</p>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={handleSaveMarks}
                    disabled={!marksUsable || pendingHasErrors || Object.keys(pending).length === 0 || saving}
                    className="px-5 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                    {saving ? "⏳ Saving..." : "💾 Save Marks"}
                  </button>
                  {saveMsg && <p className="text-xs text-[var(--color-text-secondary)]">{saveMsg}</p>}
                </div>
              )}

              {mode === "upload" && (
                <div className="space-y-3">
                  <button onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl text-xs font-medium cursor-pointer">
                    ⬇️ Download Template
                  </button>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div onClick={() => excelFileRef.current?.click()}
                      className={`flex-1 border-2 border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer
                        ${excelFile ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-soft-bg)]" : "border-[var(--color-border)]"}`}>
                      <span className="text-2xl">{excelFile ? "📄" : "📁"}</span>
                      <p className="text-[var(--color-text-secondary)] text-sm font-medium truncate">
                        {excelFile ? excelFile.name : "Click to browse Excel/CSV file"}
                      </p>
                      <input ref={excelFileRef} type="file" accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          setExcelFile(e.target.files[0] || null);
                          setExcelStage("idle"); setExcelRows([]); setExcelMissing([]);
                          setExcelFormatError(""); setExcelSaveError("");
                        }}
                        className="hidden" />
                    </div>
                    <button onClick={handleValidate} disabled={!excelFile || !marksUsable}
                      className="px-5 py-2.5 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] disabled:opacity-40 text-[var(--color-text-primary)] rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap">
                      🔍 Validate
                    </button>
                  </div>

                  {excelFormatError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-xs">⚠️ {excelFormatError}</div>
                  )}

                  {excelStage === "previewing" && (
                    <div className="space-y-3">
                      <p className={`text-xs font-medium ${excelHasErrors ? "text-amber-400" : "text-green-400"}`}>
                        {excelHasErrors
                          ? `${excelErrorCount} row(s) have errors — fix the file and re-upload, or tick "Skip rows with errors" below.`
                          : "All rows look good. Review below, then confirm to save."}
                      </p>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[var(--color-bg-surface-alt)]">
                            <tr className="border-b border-[var(--color-border)]">
                              <th className="text-left py-2 px-2 text-[var(--color-text-secondary)]">Row</th>
                              <th className="text-left py-2 px-2 text-[var(--color-text-secondary)]">USN</th>
                              <th className="text-left py-2 px-2 text-[var(--color-text-secondary)]">Name</th>
                              <th className="text-center py-2 px-2 text-[var(--color-text-secondary)]">Marks</th>
                              <th className="text-left py-2 px-2 text-[var(--color-text-secondary)]">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelRows.map((r) => (
                              <tr key={r.rowIndex} className="border-b border-[var(--color-border)]/50">
                                <td className="py-1.5 px-2 text-[var(--color-text-muted)]">{r.rowIndex}</td>
                                <td className="py-1.5 px-2 text-[var(--color-text-primary)]">{r.usn || "—"}</td>
                                <td className="py-1.5 px-2 text-[var(--color-text-primary)]">{r.name}</td>
                                <td className="py-1.5 px-2 text-center text-[var(--color-text-primary)]">{r.scored === "" ? "—" : r.scored}</td>
                                <td className="py-1.5 px-2">
                                  {r.errors.length > 0
                                    ? <span className="text-red-400">{r.errors.join(", ")}</span>
                                    : r.warnings.length > 0
                                      ? <span className="text-amber-400">{r.warnings.join(", ")}</span>
                                      : <span className="text-green-400">OK</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {excelHasErrors && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text-secondary)]">
                          <input type="checkbox" checked={skipErrorRows} onChange={(e) => setSkipErrorRows(e.target.checked)}
                            className="w-4 h-4 cursor-pointer accent-[var(--color-accent-solid)]" />
                          Skip rows with errors and save only the valid rows
                        </label>
                      )}

                      {excelMissing.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 space-y-1">
                          <p className="text-amber-400 text-xs font-semibold">
                            {excelMissing.length} student(s) get no marks from this file
                          </p>
                          <p className="text-amber-300/80 text-[11px]">
                            They are missing from the file, or their marks cell is blank or has an error. Their current marks stay unchanged.
                          </p>
                          <ul className="text-amber-300 text-xs list-disc list-inside max-h-32 overflow-y-auto">
                            {excelMissing.map((s) => (
                              <li key={s.id}>{s.name} ({s.usn || s.id})</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {excelSaveError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-xs">⚠️ {excelSaveError}</div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={handleConfirmExcel} disabled={excelBlocked || excelStage === "saving" || excelSavableRows.length === 0}
                          className="px-5 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                          {excelStage === "saving" ? "⏳ Saving..." : `✅ Confirm & Save (${excelSavableRows.length})`}
                        </button>
                        <button onClick={resetExcel}
                          className="px-4 py-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl text-sm font-medium cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {excelStage === "done" && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-xs">
                      ✅ Marks saved for {excelSavableRows.length} student(s). Nothing is visible to students until you publish.
                    </div>
                  )}
                </div>
              )}

              {/* Publish */}
              <div className="pt-2 border-t border-[var(--color-border)] flex items-center gap-3">
                <button onClick={requestPublishToggle} disabled={publishing || (!assessment.is_published && !marksUsable)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40
                    ${assessment.is_published ? "bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]" : "bg-green-600 hover:bg-green-500 text-white"}`}>
                  {publishing ? "⏳ Working..." : assessment.is_published ? "↩️ Unpublish" : "📢 Publish Marks"}
                </button>
                <p className="text-[var(--color-text-muted)] text-xs">
                  {assessment.is_published ? "Students can currently see this internal's marks." : "Marks are hidden from students until published."}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pre-publish review */}
      {publishCheckOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-[var(--color-border)]">
              <h3 className="text-[var(--color-text-primary)] font-bold text-lg">
                Publish Internal {assessment.assessment_number} marks?
              </h3>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">
                {subject.subject_name} · {students.length - studentsWithoutMarks.length} of {students.length} students have marks.
                Students are notified as soon as you publish.
              </p>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {unsavedCount > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-xs font-semibold">{unsavedCount} typed mark(s) are not saved yet</p>
                  <p className="text-red-300/80 text-[11px] mt-0.5">Students would not see them. Click Save Marks first.</p>
                </div>
              )}

              {studentsOverLimit.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-xs font-semibold">{studentsOverLimit.length} mark(s) are above the maximum ({maxMarks})</p>
                  <ul className="text-red-300 text-xs list-disc list-inside mt-1">
                    {studentsOverLimit.map((s) => (
                      <li key={s.studentId}>{s.name} ({s.usn}) — {s.marks}</li>
                    ))}
                  </ul>
                </div>
              )}

              {studentsWithoutMarks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-amber-400 text-xs font-semibold">
                    {studentsWithoutMarks.length} student(s) have no marks
                  </p>
                  <ul className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-xs text-[var(--color-text-primary)] space-y-1 max-h-56 overflow-y-auto">
                    {studentsWithoutMarks.map((s) => (
                      <li key={s.id} className="flex justify-between gap-3">
                        <span className="truncate">{s.name}</span>
                        <span className="text-[var(--color-text-muted)] flex-shrink-0">{s.usn || s.id}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[var(--color-text-muted)] text-[11px]">
                    If you publish now, these students will see no mark for this internal.
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-[var(--color-border)] flex gap-3">
              <button
                onClick={() => { setPublishCheckOpen(false); setMode("manual"); setExpanded(true); }}
                className="flex-1 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold cursor-pointer">
                Go back and enter marks
              </button>
              <button
                onClick={doPublishToggle}
                disabled={unsavedCount > 0 || studentsOverLimit.length > 0}
                className="flex-1 py-2.5 bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-xl text-sm font-medium cursor-pointer">
                Publish anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// INTERNAL MARKS MODAL
// ══════════════════════════════════════════════════════════
export default function InternalMarksModal({ subjectRow, facultyId, year, sem, students, allStudents, onClose, onCountChanged }) {
  const subject = subjectRow.subjects;
  const [assessments, setAssessments] = useState([]);
  const [configCount, setConfigCount] = useState(subject.num_internals || 1);
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState("");

  // configCount now comes from the subject's persisted num_internals
  // setting, not from however many assessment rows happen to exist —
  // that's what previously let stale/hidden internals leak through to
  // the student dashboard regardless of what faculty had selected here.
  useEffect(() => {
    setConfigCount(subject.num_internals || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, subject.num_internals]);

  const loadAssessments = async () => {
    setLoading(true);
    const list = await getSubjectAssessments(subject.id, year, sem);
    setAssessments(list);
    setLoading(false);
  };

  useEffect(() => { loadAssessments(); /* eslint-disable-next-line */ }, [subject.id, year, sem]);

  // Realtime: if another faculty/admin session changes this subject's
  // num_internals, or adds/edits assessment rows for it, refresh live
  // instead of showing stale data until the modal is closed and reopened.
  useEffect(() => {
    const channel = supabase
      .channel(`internal-marks-sync-${subject.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "subject_assessments", filter: `subject_id=eq.${subject.id}` },
        () => { loadAssessments(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, year, sem]);

  const handleApplyCount = async () => {
    setLoading(true);
    setApplyMsg("");
    const existing = await getSubjectAssessments(subject.id, year, sem);
    const existingNumbers = new Set(existing.map((a) => a.assessment_number));
    const numbersToCreate = Array.from({ length: configCount }, (_, i) => i + 1)
      .filter((n) => !existingNumbers.has(n));

    if (numbersToCreate.length > 0) {
      const result = await createAssessments(subject.id, year, sem, numbersToCreate, {});
      if (!result.ok) {
        setApplyMsg(`Could not create internals: ${result.error}`);
        setLoading(false);
        return;
      }
    }

    // Persist the selected count on the subject itself. This is the
    // single source of truth the student dashboard reads to decide how
    // many internals to show — without this, lowering the count here
    // only hid rows in this modal's own view; the student side never
    // knew the count had changed.
    //
    // Retry once on failure (covers transient network hiccups), and if it
    // still fails, surface the ACTUAL Postgres error message instead of a
    // generic one — a silent/generic failure here is exactly what let the
    // faculty and student views drift out of sync (e.g. this fails on every
    // attempt if the "subjects" table is missing the num_internals column).
    let subjErr = (
      await supabase.from("subjects").update({ num_internals: configCount }).eq("id", subject.id)
    ).error;

    if (subjErr) {
      subjErr = (
        await supabase.from("subjects").update({ num_internals: configCount }).eq("id", subject.id)
      ).error;
    }

    if (subjErr) {
      console.warn("Failed to persist num_internals:", subjErr.message);
      setApplyMsg(
        `Internals created, but the count couldn't be saved (${subjErr.message}). ` +
        `Students will keep seeing the old count until this is fixed — if this keeps happening, ` +
        `make sure your "subjects" table has an integer "num_internals" column.`
      );
    } else {
      // Tell the parent dashboard so its own copy of this subject's
      // num_internals updates immediately — otherwise reopening this
      // modal later re-seeds configCount from FacultyDashboard's stale
      // in-memory value and it looks like the change didn't stick.
      onCountChanged?.(subject.id, configCount);
    }

    const list = await getSubjectAssessments(subject.id, year, sem);
    setAssessments(list);
    setLoading(false);
  };

  const patchAssessment = (id, patch) => {
    setAssessments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  // Only show internals up to the currently selected count. Internals
  // beyond that are NOT deleted — their data (marks, max, publish state)
  // stays intact in the database — they're just hidden from view until
  // the count is raised again.
  const visibleAssessments = assessments.filter((a) => a.assessment_number <= configCount);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-[var(--color-text-primary)] font-bold text-lg">{subject.subject_name} — Internal Marks</h2>
            <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">{year} · {sem}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <h3 className="text-[var(--color-text-primary)] font-semibold text-sm">Assessment Settings</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-[var(--color-text-secondary)] text-xs">Number of Internals</label>
                <select value={configCount} onChange={(e) => setConfigCount(Number(e.target.value))}
                  className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-[var(--color-text-primary)] text-xs cursor-pointer">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={handleApplyCount} disabled={loading}
                className="px-4 py-1.5 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40">
                Apply
              </button>
            </div>
            <p className="text-[var(--color-text-muted)] text-xs">
              Select the number of internal assessments conducted for this subject. Each internal gets its own maximum marks below.
            </p>
            {applyMsg && <p className="text-red-400 text-xs">{applyMsg}</p>}
          </div>

          {loading ? (
            <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>
          ) : visibleAssessments.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm">Set a number of internals above and click Apply to begin.</p>
          ) : (
            <div className="space-y-3">
              {visibleAssessments.map((a) => (
                <InternalPanel
                  key={a.id}
                  assessment={a}
                  subject={subject}
                  facultyId={facultyId}
                  year={year}
                  sem={sem}
                  students={students}
                  allStudents={allStudents}
                  onMaxMarksSaved={(id, val) => patchAssessment(id, { max_marks: val })}
                  onPublishChanged={(id, val) => patchAssessment(id, { is_published: val })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}