import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  getSubjectAssessments, createAssessments, updateAssessmentMaxMarks,
  updateAssessmentPublish, getMarksForAssessment, saveMarksBulk,
} from "../utils/supabase";

// ══════════════════════════════════════════════════════════
// ONE INTERNAL'S PANEL — self-contained: owns its own max-marks
// editing, manual entry, CSV/Excel upload, and publish state.
// Collapsible so 5 internals stays scannable.
// ══════════════════════════════════════════════════════════
function InternalPanel({ assessment, subject, facultyId, students, allStudents, onMaxMarksSaved, onPublishChanged }) {
  const [expanded, setExpanded] = useState(true);
  const [maxMarksInput, setMaxMarksInput] = useState(assessment.max_marks);
  const [savingMax, setSavingMax] = useState(false);
  const [mode, setMode] = useState("manual"); // "manual" | "upload"

  const [rowsByStudent, setRowsByStudent] = useState({});
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [maxMsg, setMaxMsg] = useState("");
  const [publishing, setPublishing] = useState(false);

  const [excelFile, setExcelFile] = useState(null);
  const [excelStage, setExcelStage] = useState("idle");
  const [excelRows, setExcelRows] = useState([]);
  const [excelFormatError, setExcelFormatError] = useState("");
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

  const loadMarks = async () => {
    const rows = await getMarksForAssessment(assessment.id);
    const map = {};
    rows.forEach((r) => { map[r.student_id] = r.marks_obtained; });
    setRowsByStudent(map);
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

  const handlePublishToggle = async () => {
    if (!assessment.is_published && !marksUsable) return;
    setPublishing(true);
    const res = await updateAssessmentPublish(assessment.id, !assessment.is_published);
    setPublishing(false);
    if (res.ok) onPublishChanged(assessment.id, !assessment.is_published);
  };

  // ── CSV / Excel upload ──
  const handleDownloadTemplate = () => {
    if (students.length === 0) return;
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
    let rows;
    try {
      const buffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("empty");
    } catch {
      setExcelFormatError("Invalid file format or empty sheet. Upload a valid .xlsx, .xls, or .csv file.");
      return;
    }

    const seen = new Set();
    const preview = rows.map((row, idx) => {
      const usnRaw = row.USN ?? row.usn ?? "";
      const scoredRaw = row["Marks Obtained"] ?? row.Marks ?? row.marks ?? "";
      const usn = String(usnRaw).trim();
      const errors = [];

      if (!usn) errors.push("Missing USN");
      const globalStudent = allStudents.find((s) => String(s.usn || s.id).trim().toLowerCase() === usn.toLowerCase());
      const enrolledStudent = students.find((s) => String(s.usn || s.id).trim().toLowerCase() === usn.toLowerCase());

      if (usn && !globalStudent) errors.push("Invalid USN");
      else if (usn && globalStudent && !enrolledStudent) errors.push("Student not enrolled in this subject/semester");

      if (usn) {
        const key = usn.toLowerCase();
        if (seen.has(key)) errors.push("Duplicate student");
        else seen.add(key);
      }

      if (scoredRaw === "" || scoredRaw === null) {
        // leave blank — not an error, just "no mark for this student" (skipped on save)
      } else if (isNaN(Number(scoredRaw))) errors.push("Enter valid marks");
      else if (Number(scoredRaw) > maxMarks) errors.push(`Enter valid marks (max ${maxMarks})`);
      else if (Number(scoredRaw) < 0) errors.push("Enter valid marks (cannot be negative)");

      return {
        rowIndex: idx + 2, usn,
        name: enrolledStudent?.name || globalStudent?.name || "—",
        studentId: enrolledStudent?.id || null,
        scored: scoredRaw, errors,
      };
    });

    setExcelRows(preview);
    setExcelStage("previewing");
  };

  const excelHasErrors = excelRows.some((r) => r.errors.length > 0);
  const excelSavableRows = excelRows.filter((r) => r.errors.length === 0 && r.scored !== "" && r.scored !== null);

  const handleConfirmExcel = async () => {
    if (excelHasErrors || !marksUsable || excelSavableRows.length === 0) return;
    setExcelStage("saving");
    const rows = excelSavableRows.map((r) => ({
      studentId: r.studentId, subjectId: subject.id, assessmentId: assessment.id, marksObtained: Number(r.scored),
    }));
    await saveMarksBulk(rows, facultyId);
    await loadMarks();
    setExcelStage("done");
  };

  const resetExcel = () => {
    setExcelFile(null); setExcelRows([]); setExcelStage("idle"); setExcelFormatError("");
    if (excelFileRef.current) excelFileRef.current.value = "";
  };

  return (
    <div className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-primary)] font-semibold text-sm">{`Internal ${assessment.assessment_number}`}</span>
          <span className="text-[var(--color-text-muted)] text-xs">max {maxMarks}</span>
          {assessment.is_published ? (
            <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Published</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Draft</span>
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
                        onChange={(e) => { setExcelFile(e.target.files[0] || null); setExcelStage("idle"); setExcelRows([]); setExcelFormatError(""); }}
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
                        {excelHasErrors ? "Some rows have errors — fix them and re-upload before saving." : "All rows look good. Review below, then confirm to save."}
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
                                  {r.errors.length === 0 ? <span className="text-green-400">OK</span> : <span className="text-red-400">{r.errors.join(", ")}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleConfirmExcel} disabled={excelHasErrors || excelStage === "saving" || excelSavableRows.length === 0}
                          className="px-5 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                          {excelStage === "saving" ? "⏳ Saving..." : "✅ Confirm & Save"}
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
                      ✅ Marks saved for {excelSavableRows.length} student(s).
                    </div>
                  )}
                </div>
              )}

              {/* Publish */}
              <div className="pt-2 border-t border-[var(--color-border)] flex items-center gap-3">
                <button onClick={handlePublishToggle} disabled={publishing || (!assessment.is_published && !marksUsable)}
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// INTERNAL MARKS MODAL
// ══════════════════════════════════════════════════════════
export default function InternalMarksModal({ subjectRow, facultyId, year, sem, students, allStudents, onClose }) {
  const subject = subjectRow.subjects;
  const [assessments, setAssessments] = useState([]);
  const [configCount, setConfigCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState("");

  const loadAssessments = async () => {
    setLoading(true);
    const list = await getSubjectAssessments(subject.id, year, sem);
    setAssessments(list);
    setConfigCount(list.length || 1);
    setLoading(false);
  };

  useEffect(() => { loadAssessments(); /* eslint-disable-next-line */ }, [subject.id, year, sem]);

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

    const list = await getSubjectAssessments(subject.id, year, sem);
    setAssessments(list);
    setLoading(false);
  };

  const patchAssessment = (id, patch) => {
    setAssessments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

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
            {configCount < assessments.length && (
              <p className="text-amber-400 text-xs">⚠ Reducing the count here won't delete existing internals — remove them individually if needed.</p>
            )}
            {applyMsg && <p className="text-red-400 text-xs">{applyMsg}</p>}
          </div>

          {loading ? (
            <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>
          ) : assessments.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm">Set a number of internals above and click Apply to begin.</p>
          ) : (
            <div className="space-y-3">
              {assessments.map((a) => (
                <InternalPanel
                  key={a.id}
                  assessment={a}
                  subject={subject}
                  facultyId={facultyId}
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