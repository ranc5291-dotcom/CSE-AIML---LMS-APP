import * as XLSX from "xlsx";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase, getCatalogSubjects, getStudentMarksFull, getStudentAttendanceFull } from "../utils/supabase";
import { normalizeSubjectMarks } from "../context/LMSContext";
import { isLateralStudent } from "../utils/studentHelpers";
import { useLiveRefresh } from "../utils/useLiveRefresh";

const SEMS = [1, 2, 3, 4, 5, 6, 7, 8];
const ORD = ["1st", "2nd", "3rd", "4th"];
const yearLabelOfSem = (n) => `${ORD[Math.ceil(n / 2) - 1]} Year`;

const STATUS_BADGE = {
  active: "bg-green-500/20 text-green-400",
  detained: "bg-amber-500/20 text-amber-400",
  dropout: "bg-red-500/20 text-red-400",
  transferred: "bg-blue-500/20 text-blue-400",
};
const STATUS_LABEL = { active: "Active", detained: "Detained", dropout: "Dropout", transferred: "Transferred" };
const EVENT_LABEL = {
  promoted: "⬆️ Promoted",
  detained: "🔁 Detained",
  dropout: "🚫 Dropout",
  transferred: "🔀 Transferred",
  restored: "✅ Restored to active",
};

const startOf = (s) => Number(s.admission_year || s.start_year) || null;
const endOf = (s) => {
  const st = startOf(s);
  return Number(s.end_year) || (st ? st + 4 : null);
};
const batchKey = (s) => {
  const a = startOf(s);
  return a ? `${a}-${endOf(s)}` : "Unknown";
};
const batchLabel = (k) => (k === "Unknown" ? "Batch not set" : k.replace("-", " – "));

// ── Profile changes made by students (USN / batch years) ──
const FIELD_LABEL = { usn: "USN", admission_year: "Admission year", end_year: "End year", entry_type: "Entry type", name: "Name", phone: "Phone" };

// One student save writes one row per changed field with the same timestamp,
// so group them back into a single "who changed what" entry.
function groupLog(rows) {
  const map = {};
  rows.forEach((r) => {
    const k = `${r.student_id || r.student_usn}|${r.created_at}`;
    if (!map[k]) {
      map[k] = {
        key: k,
        studentId: r.student_id,
        name: r.student_name,
        usn: r.student_usn,
        email: r.student_email,
        by: r.changed_by_name,
        byRole: r.changed_by_role,
        at: r.created_at,
        changes: [],
      };
    }
    map[k].changes.push({ field: r.field, oldV: r.old_value, newV: r.new_value });
  });
  return Object.values(map).sort((a, b) => new Date(b.at) - new Date(a.at));
}

function ChangeEntry({ g, onOpen }) {
  const when = g.at ? new Date(g.at) : null;
  return (
    <div className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3 border-l-4 border-amber-500 space-y-1.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-[var(--color-text-primary)] text-sm font-semibold">
            {g.name || "A student"} <span className="text-[var(--color-text-muted)] font-normal text-xs">changed their details</span>
          </p>
          <p className="text-[var(--color-text-muted)] text-xs">
            🪪 {g.usn || "—"} · 📧 {g.email || "—"} · {g.byRole || "student"}
          </p>
        </div>
        {onOpen && g.studentId && (
          <button onClick={() => onOpen(g.studentId)}
            className="px-2.5 py-1 text-xs rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-accent-soft-text)] cursor-pointer">
            View student
          </button>
        )}
      </div>
      <div className="space-y-1">
        {g.changes.map((c, i) => (
          <p key={i} className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">{FIELD_LABEL[c.field] || c.field}:</span>{" "}
            <span className="text-red-400 line-through">{c.oldV || "—"}</span>{" "}
            <span className="text-[var(--color-text-muted)]">→</span>{" "}
            <span className="text-green-400 font-semibold">{c.newV}</span>
          </p>
        ))}
      </div>
      <p className="text-[var(--color-text-muted)] text-xs">
        Changed by {g.by || g.name || "the student"}{when ? ` · ${when.toLocaleDateString()} ${when.toLocaleTimeString()}` : ""}
      </p>
    </div>
  );
}

function ChangeLogPanel({ log, logErr, onOpen }) {
  const groups = useMemo(() => groupLog(log), [log]);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = groups.filter((g) => g.at && new Date(g.at).getTime() >= weekAgo).length;
  const shown = groups;

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-[var(--color-text-primary)] font-semibold text-sm">🔔 Profile changes by students</h4>
        <div className="flex items-center gap-2">
          {recent > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{recent} in the last 7 days</span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)]">{groups.length} total</span>
        </div>
      </div>
      {logErr && <p className="text-red-400 text-xs">{logErr}</p>}
      {!logErr && groups.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-xs">
          No changes yet. When a student corrects their USN or batch years in Settings, it shows up here.
        </p>
      )}
      <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">{shown.map((g) => <ChangeEntry key={g.key} g={g} onOpen={onOpen} />)}</div>
    </div>
  );
}

// Call this whenever an admin changes a student's status (used by AdminDashboard).
export async function logStatusEvent({ studentId, event, year, sem, remarks, by }) {
  const { error } = await supabase.from("student_status_history").insert({
    student_id: studentId,
    event,
    year: year || null,
    sem: sem || null,
    remarks: remarks || null,
    by_name: by || null,
  });
  if (error) console.warn("Status history not saved:", error.message);
}

// ── BACKLOGS: used by the admin (full control) and the student (add / remove own) ──
export function BacklogManager({ studentId, role = "student", actorName = "", onChanged }) {
  const isAdmin = role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [addSem, setAddSem] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [pick, setPick] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("student_backlogs").select("*")
      .eq("student_id", studentId).order("semester").order("subject_name");
    if (error) setErr("Could not load backlogs: " + error.message);
    else { setErr(""); setItems(data || []); }
    setLoading(false);
  };

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    let c = false;
    getCatalogSubjects(yearLabelOfSem(addSem), `Sem ${addSem}`)
      .then((subs) => { if (!c) { setCatalog(subs || []); setPick(""); } })
      .catch(() => { if (!c) setCatalog([]); });
    return () => { c = true; };
  }, [addSem]);

  const chosen = catalog.find((s) => String(s.id) === pick);
  const subjectName = pick === "__other" ? manualName.trim() : chosen?.subject_name || "";
  const subjectCode = pick === "__other" ? manualCode.trim() : chosen?.subject_code || "";

  const add = async () => {
    if (!subjectName) { setErr("Choose a subject or type its name."); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.from("student_backlogs").insert({
      student_id: studentId, semester: addSem,
      subject_code: subjectCode || null, subject_name: subjectName,
      status: "pending", verified: isAdmin,
      added_by: actorName || null, added_by_role: role,
    });
    setSaving(false);
    if (error) {
      setErr(error.code === "23505" ? "That backlog is already added." : "Failed: " + error.message);
      return;
    }
    setPick(""); setManualName(""); setManualCode("");
    await load(); onChanged?.();
  };

  const patch = async (id, fields) => {
    const { error } = await supabase.from("student_backlogs")
      .update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) setErr("Failed: " + error.message);
    else { await load(); onChanged?.(); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this backlog entry?")) return;
    const { error } = await supabase.from("student_backlogs").delete().eq("id", id);
    if (error) setErr("Failed: " + error.message);
    else { await load(); onChanged?.(); }
  };

  const toggleCleared = (b) => {
    if (b.status === "pending") {
      const when = window.prompt("Cleared in which exam? (e.g. Jun 2026) — optional", "");
      if (when === null) return;
      patch(b.id, { status: "cleared", cleared_in: when.trim() || null });
    } else {
      patch(b.id, { status: "pending", cleared_in: null });
    }
  };

  const grouped = SEMS.map((n) => ({ n, rows: items.filter((i) => i.semester === n) })).filter((g) => g.rows.length);
  const pending = items.filter((i) => i.status === "pending").length;
  const selectCls = "bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 font-medium">{pending} pending</span>
        <span className="text-xs px-2 py-1 rounded-lg bg-green-500/20 text-green-400 font-medium">{items.length - pending} cleared</span>
        {!isAdmin && <span className="text-[var(--color-text-muted)] text-xs">Entries you add are marked "self-reported" until the admin verifies them.</span>}
      </div>

      {err && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-xs">{err}</div>}
      {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading backlogs…</p>}
      {!loading && items.length === 0 && <p className="text-[var(--color-text-muted)] text-sm">No backlogs recorded. 🎉</p>}

      {grouped.map((g) => (
        <div key={g.n} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3 space-y-2">
          <p className="text-[var(--color-text-secondary)] text-xs font-semibold">
            Sem {g.n} · {g.rows.filter((r) => r.status === "pending").length} pending
          </p>
          {g.rows.map((b) => (
            <div key={b.id} className="flex items-center gap-2 flex-wrap bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2">
              <div className="flex-1 min-w-40">
                <p className="text-[var(--color-text-primary)] text-xs font-medium">
                  {b.subject_name}{b.subject_code ? ` (${b.subject_code})` : ""}
                </p>
                <p className="text-[var(--color-text-muted)] text-xs">
                  {b.verified ? "✓ Verified" : "Self-reported"}
                  {b.cleared_in ? ` · cleared in ${b.cleared_in}` : ""}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "pending" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                {b.status === "pending" ? "Backlog" : "Cleared"}
              </span>
              {isAdmin && !b.verified && (
                <button onClick={() => patch(b.id, { verified: true })}
                  className="px-2 py-1 text-xs rounded-lg bg-blue-600/20 text-blue-400 cursor-pointer">Verify</button>
              )}
              {isAdmin && (
                <button onClick={() => toggleCleared(b)}
                  className="px-2 py-1 text-xs rounded-lg bg-green-600/20 text-green-400 cursor-pointer">
                  {b.status === "pending" ? "Mark cleared" : "Reopen"}
                </button>
              )}
              {(isAdmin || !b.verified) && (
                <button onClick={() => remove(b.id)}
                  className="text-[var(--color-text-muted)] hover:text-red-400 text-sm cursor-pointer">🗑️</button>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
        <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider">Add a backlog</p>
        <div className="flex flex-wrap gap-2">
          <select value={addSem} onChange={(e) => setAddSem(Number(e.target.value))} className={selectCls}>
            {SEMS.map((n) => <option key={n} value={n}>Sem {n}</option>)}
          </select>
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={selectCls + " flex-1 min-w-48"}>
            <option value="">Select subject…</option>
            {catalog.map((s) => <option key={s.id} value={String(s.id)}>{s.subject_name}</option>)}
            <option value="__other">Other (type manually)</option>
          </select>
        </div>
        {pick === "__other" && (
          <div className="flex flex-wrap gap-2">
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Subject name"
              className="flex-1 min-w-40 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none" />
            <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Code (optional)"
              className="w-36 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none" />
          </div>
        )}
        <button onClick={add} disabled={saving || !subjectName}
          className="px-4 py-2 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer">
          {saving ? "Adding…" : "➕ Add Backlog"}
        </button>
      </div>
    </div>
  );
}

// ── Marks + attendance for one semester of one student (read-only) ──
function SemesterPerformance({ student }) {
  const current = parseInt(String(student.sem || "").replace(/\D/g, ""), 10) || 1;
  const [sem, setSem] = useState(current);
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState({});
  const [att, setAtt] = useState({});

  useEffect(() => {
    let c = false;
    setLoading(true);
    Promise.all([
      getStudentMarksFull(student.id, yearLabelOfSem(sem), `Sem ${sem}`),
      getStudentAttendanceFull(student.id, yearLabelOfSem(sem), `Sem ${sem}`),
    ])
      .then(([m, a]) => { if (!c) { setMarks(m || {}); setAtt(a || {}); setLoading(false); } })
      .catch(() => { if (!c) { setMarks({}); setAtt({}); setLoading(false); } });
    return () => { c = true; };
  }, [student.id, sem]);

  const subjects = Array.from(new Set([...Object.keys(marks), ...Object.keys(att)]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SEMS.map((n) => (
          <button key={n} onClick={() => setSem(n)}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer
              ${sem === n ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
            Sem {n}
          </button>
        ))}
      </div>
      {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>}
      {!loading && subjects.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm">No marks or attendance recorded for Sem {sem}.</p>
      )}
      {!loading && subjects.map((sub) => {
        const norm = marks[sub] ? normalizeSubjectMarks(marks[sub]) : {};
        const cols = Object.keys(norm).sort();
        const a = att[sub];
        return (
          <div key={sub} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[var(--color-text-primary)] text-xs font-semibold">{sub}</p>
              {a && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${a.percentage >= 75 ? "bg-green-500/20 text-green-400" : a.percentage >= 60 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
                  Attendance {a.percentage}% ({a.attended}/{a.total})
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {cols.length === 0 && <span className="text-[var(--color-text-muted)] text-xs">No marks entered</span>}
              {cols.map((c) => {
                const cell = norm[c];
                return (
                  <span key={c} className="text-xs px-2 py-1 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
                    {c}: {cell?.scored != null ? `${cell.scored}/${cell.total}` : "—"}{cell?.published ? "" : " *"}
                  </span>
                );
              })}
            </div>
            {cols.some((c) => !norm[c]?.published) && (
              <p className="text-[var(--color-text-muted)] text-xs mt-1">* not yet published to the student</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Full details of one student ──
function StudentDetail({ student, history, changeLog = [], adminName, onClose, onChanged }) {
  const [section, setSection] = useState("Backlogs");
  const status = student.status || "active";
  const a = startOf(student);
  const e = endOf(student);
  const rows = history.filter((h) => h.student_id === student.id);
  const profileChanges = groupLog(changeLog.filter((r) => r.student_id === student.id));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)] gap-3">
          <div className="min-w-0">
            <h2 className="text-[var(--color-text-primary)] font-bold text-lg truncate">{student.name}</h2>
            <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">
              🪪 {student.usn || (isLateralStudent(student) ? "USN pending" : student.id)} · 🏛️ {student.branch || "CSEAIML"}{isLateralStudent(student) ? " · Lateral entry" : ""}
            </p>
            <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
              {student.email || "—"}{student.phone ? ` · ${student.phone}` : ""}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer flex-shrink-0">✕</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b border-[var(--color-border)]">
          {[
            ["Admission", a || "—"],
            ["End year", e || "—"],
            ["Current", `${student.year || "—"} · ${student.sem || "—"}`],
          ].map(([l, v]) => (
            <div key={l} className="bg-[var(--color-bg-surface-alt)] rounded-xl p-2.5">
              <p className="text-[var(--color-text-muted)] text-xs">{l}</p>
              <p className="text-[var(--color-text-primary)] text-sm font-semibold">{v}</p>
            </div>
          ))}
          <div className="bg-[var(--color-bg-surface-alt)] rounded-xl p-2.5">
            <p className="text-[var(--color-text-muted)] text-xs">Status</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status] || STATUS_BADGE.active}`}>
              {STATUS_LABEL[status] || "Active"}
            </span>
          </div>
        </div>

        <div className="flex gap-1 p-3 border-b border-[var(--color-border)]">
          {["Backlogs", "Marks & Attendance", "History"].map((t) => (
            <button key={t} onClick={() => setSection(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium cursor-pointer
                ${section === t ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {section === "Backlogs" && (
            <BacklogManager studentId={student.id} role="admin" actorName={adminName} onChanged={onChanged} />
          )}
          {section === "Marks & Attendance" && <SemesterPerformance student={student} />}
          {section === "History" && (
            <div className="space-y-2">
              {profileChanges.length > 0 && (
                <div className="space-y-2 pb-2">
                  <p className="text-[var(--color-text-secondary)] text-xs font-semibold">Profile changes</p>
                  {profileChanges.map((g) => <ChangeEntry key={g.key} g={g} />)}
                </div>
              )}
              {rows.length === 0 && (
                <p className="text-[var(--color-text-muted)] text-sm">
                  No status changes recorded yet. Promotions, detentions and transfers are logged from now on.
                </p>
              )}
              {rows.map((h) => (
                <div key={h.id} className="bg-[var(--color-bg-surface-alt)] rounded-xl px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-[var(--color-text-primary)] text-xs font-medium">{EVENT_LABEL[h.event] || h.event}</p>
                    <p className="text-[var(--color-text-muted)] text-xs">
                      {h.year || "—"} · {h.sem || "—"}{h.remarks ? ` · ${h.remarks}` : ""}{h.by_name ? ` · by ${h.by_name}` : ""}
                    </p>
                  </div>
                  <p className="text-[var(--color-text-muted)] text-xs">{h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN: batch-wise student records ──
export default function StudentRecords({ adminName }) {
  const [students, setStudents] = useState([]);
  const [backlogs, setBacklogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [changeLog, setChangeLog] = useState([]);
  const [logErr, setLogErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const liveTick = useLiveRefresh(["profiles", "profile_change_log", "student_status_history", "student_backlogs"]);

  const [batch, setBatch] = useState("All");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let c = false;
    // First load shows "Loading…"; live refreshes update in place.
    Promise.all([
      supabase.from("profiles")
        .select("id,usn,name,email,phone,branch,year,sem,status,admission_year,start_year,end_year,role,entry_type")
        .eq("role", "student"),
      supabase.from("student_backlogs").select("*"),
      supabase.from("student_status_history").select("*").order("created_at", { ascending: false }),
      supabase.from("profile_change_log").select("*").order("created_at", { ascending: false }).limit(1000),
    ]).then(([p, b, h, cl]) => {
      if (c) return;
      if (p.error) setLoadErr("Could not load students: " + p.error.message);
      else if (b.error || h.error) setLoadErr("Run the SQL for student_backlogs and student_status_history first. " + (b.error?.message || h.error?.message));
      else setLoadErr("");
      setStudents(p.data || []);
      setBacklogs(b.data || []);
      setHistory(h.data || []);
      setChangeLog(cl.data || []);
      setLogErr(cl.error ? "Run the SQL for profile_change_log to see student changes. " + cl.error.message : "");
      setLoading(false);
    });
    return () => { c = true; };
  }, [reloadKey, liveTick]);

  const pendingBy = useMemo(() => {
    const m = {};
    backlogs.forEach((b) => { if (b.status === "pending") m[b.student_id] = (m[b.student_id] || 0) + 1; });
    return m;
  }, [backlogs]);

  const promotedSet = useMemo(
    () => new Set(history.filter((h) => h.event === "promoted").map((h) => h.student_id)),
    [history]
  );

  const batches = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      const k = batchKey(s);
      (map[k] = map[k] || []).push(s);
    });
    return Object.entries(map)
      .map(([key, list]) => ({
        key, list,
        total: list.length,
        active: list.filter((s) => (s.status || "active") === "active").length,
        detained: list.filter((s) => s.status === "detained").length,
        dropout: list.filter((s) => s.status === "dropout").length,
        transferred: list.filter((s) => s.status === "transferred").length,
        withBacklogs: list.filter((s) => pendingBy[s.id] > 0).length,
        lateral: list.filter(isLateralStudent).length,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [students, pendingBy]);

  const visible = students
    .filter((s) => batch === "All" || batchKey(s) === batch)
    .filter((s) => {
      const t = q.trim().toLowerCase();
      return !t || s.name?.toLowerCase().includes(t) || (s.usn || s.id)?.toLowerCase().includes(t) || s.email?.toLowerCase().includes(t);
    })
    .filter((s) => {
      const st = s.status || "active";
      if (filter === "All") return true;
      if (filter === "promoted") return promotedSet.has(s.id);
      if (filter === "lateral") return isLateralStudent(s);
      if (filter === "backlogs") return pendingBy[s.id] > 0;
      return st === filter;
    })
    .sort((x, y) => String(x.usn || x.id).localeCompare(String(y.usn || y.id), undefined, { numeric: true }));

  const openStudent = students.find((s) => s.id === openId);

  // Admin bulk upload: columns  usn | semester | subject | code (optional) | status (optional: pending/cleared)
  const handleBulk = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const byUsn = {};
      students.forEach((s) => { byUsn[String(s.usn || s.id).trim().toUpperCase()] = s; });
      const unique = {};
      let missing = 0, invalid = 0;
      wb.SheetNames.forEach((sn) => {
        XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" }).forEach((raw) => {
          const r = {};
          Object.keys(raw).forEach((k) => { r[k.trim().toLowerCase()] = raw[k]; });
          const st = byUsn[String(r.usn).trim().toUpperCase()];
          const sem = parseInt(String(r.semester ?? r.sem).replace(/\D/g, ""), 10);
          const name = String(r.subject ?? r.subject_name ?? "").trim();
          if (!st) { missing++; return; }
          if (!(sem >= 1 && sem <= 8) || !name) { invalid++; return; }
          unique[`${st.id}|${sem}|${name}`] = {
            student_id: st.id, semester: sem, subject_name: name,
            subject_code: String(r.code ?? r.subject_code ?? "").trim() || null,
            status: String(r.status).trim().toLowerCase() === "cleared" ? "cleared" : "pending",
            verified: true, added_by: adminName || null, added_by_role: "admin",
          };
        });
      });
      const rows = Object.values(unique);
      if (rows.length === 0) {
        setMsg({ type: "err", text: "No valid rows found. Columns needed: usn, semester, subject (code and status optional)." });
        return;
      }
      const { error } = await supabase.from("student_backlogs").upsert(rows, { onConflict: "student_id,semester,subject_name" });
      if (error) { setMsg({ type: "err", text: "Upload failed: " + error.message }); return; }
      const extra = [];
      if (missing) extra.push(`${missing} row(s) skipped: USN not found`);
      if (invalid) extra.push(`${invalid} row(s) skipped: bad semester/subject`);
      setMsg({ type: "ok", text: `✅ Saved ${rows.length} backlog entr${rows.length === 1 ? "y" : "ies"}.${extra.length ? " " + extra.join("; ") + "." : ""}` });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMsg({ type: "err", text: "Could not read the file: " + err.message });
    }
  };

  const FILTERS = [
    ["All", "All"], ["active", "Active"], ["promoted", "Promoted"],
    ["detained", "Detained"], ["transferred", "Transferred"], ["dropout", "Dropout"], ["backlogs", "Has backlogs"], ["lateral", "Lateral entry"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[var(--color-text-primary)] font-semibold text-lg">🗂️ Student Records — Batch wise</h3>
          <p className="text-[var(--color-text-muted)] text-xs">Pick a batch, or search any USN / name for complete details.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleBulk} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium cursor-pointer">
            📤 Upload Backlogs (Excel)
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${msg.type === "ok" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          {msg.text}
        </div>
      )}
      {loadErr && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{loadErr}</div>}
      {loading && <p className="text-[var(--color-text-muted)] text-sm py-6 text-center">Loading…</p>}

      {!loading && (
        <>
          <ChangeLogPanel log={changeLog} logErr={logErr} onOpen={(id) => setOpenId(id)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button onClick={() => setBatch("All")}
              className={`text-left rounded-2xl p-4 border cursor-pointer transition-all
                ${batch === "All" ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-soft-bg)]" : "border-[var(--color-border)] bg-[var(--color-bg-surface)]"}`}>
              <p className="text-[var(--color-text-primary)] font-bold">All batches</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{students.length} students · {batches.length} batch(es)</p>
            </button>
            {batches.map((b) => (
              <button key={b.key} onClick={() => setBatch(b.key)}
                className={`text-left rounded-2xl p-4 border cursor-pointer transition-all
                  ${batch === b.key ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-soft-bg)]" : "border-[var(--color-border)] bg-[var(--color-bg-surface)]"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[var(--color-text-primary)] font-bold">{batchLabel(b.key)}</p>
                  <span className="text-[var(--color-text-primary)] font-bold text-lg">{b.total}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{b.active} active</span>
                  {b.detained > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{b.detained} detained</span>}
                  {b.transferred > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{b.transferred} transferred</span>}
                  {b.dropout > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{b.dropout} dropout</span>}
                  {b.lateral > 0 && <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">{b.lateral} lateral</span>}
                  {b.withBacklogs > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">{b.withBacklogs} with backlogs</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4 space-y-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Enter USN, name or email…"
              className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)]" />
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
                    ${filter === k ? "bg-[var(--color-accent-solid)] text-white" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                  {l}
                </button>
              ))}
            </div>
            <p className="text-[var(--color-text-muted)] text-xs">
              {batch === "All" ? "All batches" : batchLabel(batch)} — showing {visible.length} student(s)
              {filter === "promoted" && history.every((h) => h.event !== "promoted") ? " · promotions are logged from now on" : ""}
            </p>
          </div>

          <div className="space-y-2">
            {visible.length === 0 && (
              <div className="text-center py-10 text-[var(--color-text-muted)]">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-sm">No students match.</p>
              </div>
            )}
            {visible.map((s) => {
              const st = s.status || "active";
              const pend = pendingBy[s.id] || 0;
              return (
                <button key={s.id} onClick={() => setOpenId(s.id)}
                  className="w-full text-left bg-[var(--color-bg-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent-solid)]/60 rounded-2xl p-3 cursor-pointer transition-all flex items-center gap-3 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(s.name || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-40">
                    <p className="text-[var(--color-text-primary)] text-sm font-semibold">{s.name}</p>
                    <p className="text-[var(--color-text-muted)] text-xs">
                      {s.usn || (isLateralStudent(s) ? "USN pending" : s.id)} · {batchLabel(batchKey(s))} · {s.year || "—"} · {s.sem || "—"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {isLateralStudent(s) && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Lateral</span>}
                    {promotedSet.has(s.id) && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Promoted</span>}
                    {pend > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">{pend} backlog{pend > 1 ? "s" : ""}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[st] || STATUS_BADGE.active}`}>{STATUS_LABEL[st] || "Active"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {openStudent && (
        <StudentDetail
          student={openStudent}
          history={history}
          changeLog={changeLog}
          adminName={adminName}
          onClose={() => setOpenId(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}