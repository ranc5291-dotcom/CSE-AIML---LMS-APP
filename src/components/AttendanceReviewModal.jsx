// src/components/AttendanceReviewModal.jsx
// Shown after a file / pasted text is read, BEFORE anything is filled in or
// saved. Faculty/Admin must settle every problem row and every student who
// has no data in the file (fix it here, or choose to leave those students
// unchanged) before "Apply to table" unlocks.
import { useMemo, useState } from "react";

const digits = (v) => String(v).replace(/\D/g, "").slice(0, 4);
const isValidPair = (a, t) => {
  if (a === "" || t === "") return false;
  const an = Number(a), tn = Number(t);
  return Number.isInteger(an) && Number.isInteger(tn) && an >= 0 && tn >= 0 && an <= tn;
};

function Pair({ a, t, onA, onT, invalid }) {
  const cls = `w-12 text-center bg-[var(--color-bg-surface)] border rounded-lg py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-solid)] ${
    invalid ? "border-red-500" : "border-[var(--color-border)]"
  }`;
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <input inputMode="numeric" value={a} onChange={(e) => onA(digits(e.target.value))} placeholder="0" className={cls} />
      <span className="text-[var(--color-text-muted)] text-xs">/</span>
      <input inputMode="numeric" value={t} onChange={(e) => onT(digits(e.target.value))} placeholder="0" className={cls} />
    </div>
  );
}

function Section({ title, tone, children, count }) {
  if (!count) return null;
  const toneCls = {
    red: "text-red-400",
    amber: "text-amber-400",
    muted: "text-[var(--color-text-secondary)]",
  }[tone];
  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold ${toneCls}`}>{title} ({count})</p>
      {children}
    </div>
  );
}

const Row = ({ children }) => (
  <div className="flex items-center justify-between gap-3 flex-wrap bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2.5">
    {children}
  </div>
);

export default function AttendanceReviewModal({ result, subjectName, onApply, onCancel }) {
  const { entries, extras, missing } = result;

  const [edits, setEdits] = useState({});       // studentId -> { a, t }  (fixes and manual fills)
  const [accepted, setAccepted] = useState({}); // studentId -> true      (rows matched by name / name differs)
  const [skipMissing, setSkipMissing] = useState(false);

  const setPair = (id, patch, base) =>
    setEdits((p) => ({ ...p, [id]: { ...(p[id] || base), ...patch } }));

  const rows = useMemo(
    () =>
      entries.map((e) => {
        const ed = edits[e.student.id];
        const a = ed ? ed.a : e.attended;
        const t = ed ? ed.t : e.total;
        const duplicate = e.problems.some((p) => p.includes("more than once"));
        const valid = isValidPair(a, t);
        const needsAccept = e.warnings.length > 0;
        // an edited row is considered fixed, even if the original had a problem
        const resolved = valid && (!needsAccept || accepted[e.student.id]) && (!duplicate || !!ed || !!accepted[e.student.id]);
        return { ...e, a, t, valid, needsAccept, duplicate, resolved };
      }),
    [entries, edits, accepted]
  );

  const missingRows = useMemo(
    () =>
      missing.map((s) => {
        const ed = edits[s.id] || { a: "", t: "" };
        return { student: s, a: ed.a, t: ed.t, valid: isValidPair(ed.a, ed.t) };
      }),
    [missing, edits]
  );

  const clean = rows.filter((r) => r.problems.length === 0 && !r.needsAccept);
  const attention = rows.filter((r) => r.problems.length > 0 || r.needsAccept);
  const unresolvedAttention = attention.filter((r) => !r.resolved).length;
  const unresolvedMissing = skipMissing ? 0 : missingRows.filter((m) => !m.valid).length;
  const blocked = unresolvedAttention > 0 || unresolvedMissing > 0;

  const apply = () => {
    const out = [
      ...rows.filter((r) => r.resolved).map((r) => ({ studentId: r.student.id, attended: Number(r.a), total: Number(r.t) })),
      ...missingRows.filter((m) => m.valid).map((m) => ({ studentId: m.student.id, attended: Number(m.a), total: Number(m.t) })),
    ];
    onApply(out);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-[var(--color-border)]">
          <h3 className="text-[var(--color-text-primary)] font-bold text-lg">Review attendance before applying</h3>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {subjectName ? `${subjectName} · ` : ""}Nothing is saved or sent to students yet. Settle the items below first.
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-green-500/15 text-green-400">{clean.length} ready</span>
            <span className={`px-2.5 py-1 rounded-full ${attention.length ? "bg-amber-500/15 text-amber-400" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)]"}`}>
              {attention.length} need a check
            </span>
            <span className={`px-2.5 py-1 rounded-full ${missing.length ? "bg-red-500/15 text-red-400" : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)]"}`}>
              {missing.length} no data in file
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)]">
              {extras.length} not in this class
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <Section title="Students with no data in the file" tone="red" count={missingRows.length}>
            <p className="text-[var(--color-text-muted)] text-xs">
              These students are in {subjectName || "this class"} but the file has no usable row for them. Enter their numbers here, or leave them unchanged below.
            </p>
            {missingRows.map((m) => (
              <Row key={m.student.id}>
                <div className="min-w-0">
                  <p className="text-[var(--color-text-primary)] text-xs font-semibold truncate">{m.student.name}</p>
                  <p className="text-[var(--color-text-muted)] text-xs">{m.student.usn || m.student.id}</p>
                </div>
                <Pair
                  a={m.a} t={m.t}
                  onA={(v) => setPair(m.student.id, { a: v }, { a: "", t: "" })}
                  onT={(v) => setPair(m.student.id, { t: v }, { a: "", t: "" })}
                />
              </Row>
            ))}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={skipMissing} onChange={(e) => setSkipMissing(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-[var(--color-accent-solid)]" />
              Leave students without data unchanged (their current attendance stays as it is)
            </label>
          </Section>

          <Section title="Check these rows" tone="amber" count={attention.length}>
            {attention.map((r) => (
              <Row key={r.student.id}>
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--color-text-primary)] text-xs font-semibold truncate">{r.student.name}</p>
                  <p className="text-[var(--color-text-muted)] text-xs">{r.student.usn || r.student.id}</p>
                  {[...r.problems, ...r.warnings].map((w) => (
                    <p key={w} className={`text-xs mt-0.5 ${r.problems.includes(w) ? "text-red-400" : "text-amber-400"}`}>{w}</p>
                  ))}
                  <p className="text-[var(--color-text-muted)] text-[11px] mt-0.5">File: {r.parsed.source}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Pair
                    a={r.a} t={r.t} invalid={!r.valid}
                    onA={(v) => setPair(r.student.id, { a: v }, { a: r.a, t: r.t })}
                    onT={(v) => setPair(r.student.id, { t: v }, { a: r.a, t: r.t })}
                  />
                  {(r.needsAccept || r.duplicate) && (
                    <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
                      <input type="checkbox" checked={!!accepted[r.student.id]}
                        onChange={(e) => setAccepted((p) => ({ ...p, [r.student.id]: e.target.checked }))}
                        className="w-4 h-4 cursor-pointer accent-[var(--color-accent-solid)]" />
                      Correct
                    </label>
                  )}
                </div>
              </Row>
            ))}
          </Section>

          <Section title="In the file, but not in this class (ignored)" tone="muted" count={extras.length}>
            {extras.map((x, i) => (
              <Row key={i}>
                <div className="min-w-0">
                  <p className="text-[var(--color-text-primary)] text-xs font-semibold truncate">{x.parsed.name || "—"}</p>
                  <p className="text-[var(--color-text-muted)] text-xs">{x.parsed.usn || "—"} · {x.reason}</p>
                </div>
                <span className="text-[var(--color-text-muted)] text-xs">{x.parsed.attended}/{x.parsed.total}</span>
              </Row>
            ))}
          </Section>

          {clean.length > 0 && attention.length === 0 && missing.length === 0 && (
            <p className="text-green-400 text-sm">All {clean.length} students matched cleanly.</p>
          )}
        </div>

        <div className="p-5 border-t border-[var(--color-border)] space-y-3">
          {blocked && (
            <p className="text-amber-400 text-xs">
              {unresolvedAttention > 0 && `${unresolvedAttention} row(s) still need a fix or a "Correct" tick. `}
              {unresolvedMissing > 0 && `${unresolvedMissing} student(s) have no numbers yet.`}
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 py-2.5 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-sm cursor-pointer">
              Cancel
            </button>
            <button onClick={apply} disabled={blocked}
              className="flex-1 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold cursor-pointer">
              Apply to table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}