// src/utils/attendanceUpload.js
// Shared by the Faculty and Admin dashboards.
// 1) parse a file / pasted text into raw rows
// 2) reconcile those rows against the students of the selected Year + Sem
// Nothing here touches the database.

// ── Normalisers ──────────────────────────────────────────────
// USN: drop every character that is not A-Z / 0-9 (spaces, non-breaking
// spaces, zero-width characters, dashes) and uppercase. "1EW24CI012 " and
// "1ew24ci012" and "1EW24CI012" (with a hidden character) all become equal.
export const normId = (v) =>
  String(v ?? "").normalize("NFKC").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

// Name: letters only, lowercase. "Amisha.G" and "AMISHA G" become equal.
export const normName = (v) =>
  String(v ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z]/g, "");

const nameTokens = (v) =>
  String(v ?? "").normalize("NFKC").toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 3);

// Same person if the names are equal, one contains the other, or they share a
// word of 3+ letters ("BHARAT SHANTAPPA DORANAHALLI" vs "Bharat Doranahalli").
const namesAgree = (a, b) => {
  const na = normName(a), nb = normName(b);
  if (!na || !nb) return true; // nothing to compare
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const tb = new Set(nameTokens(b));
  return nameTokens(a).some((t) => tb.has(t));
};

const toStr = (v) => String(v ?? "").trim();
const toInt = (v) => {
  const s = toStr(v);
  return /^\d+$/.test(s) ? Number(s) : NaN;
};

const USN_RE = /([0-9][A-Za-z]{2}\d{2}[A-Za-z]{2}\d{3})/;
const FRACTION_RE = /(\d+)\s*\/\s*(\d+)/;

// ── Header recognition (case / spacing / punctuation insensitive) ──
const ALIASES = {
  usn: ["usn", "usnno", "usnnumber", "rollno", "regno", "registerno"],
  name: ["name", "studentname", "studentsname", "students", "student"],
  attended: ["attended", "attendedclasses", "classesattended", "present", "noofclassesattended"],
  total: ["total", "totalclasses", "classesheld", "held", "noofclasses", "noofclassesheld", "conducted"],
  combined: ["attendance", "attendedtotal", "attendedtotalclasses"],
};

const headerKey = (cell) => String(cell ?? "").toLowerCase().replace(/[^a-z]/g, "");

function rowsFromMatrix(matrix, source) {
  // find the header row among the first 15 rows
  let headerIdx = -1;
  let cols = {};
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const found = {};
    (matrix[i] || []).forEach((cell, c) => {
      const key = headerKey(cell);
      Object.entries(ALIASES).forEach(([field, list]) => {
        if (found[field] === undefined && list.includes(key)) found[field] = c;
      });
    });
    if (found.usn !== undefined || found.name !== undefined) { headerIdx = i; cols = found; break; }
  }

  const out = [];
  matrix.forEach((cells, i) => {
    if (i <= headerIdx || !cells) return;
    const cell = (field) => (cols[field] !== undefined ? cells[cols[field]] : "");

    let usn = toStr(cell("usn"));
    let name = toStr(cell("name"));
    let attended = toStr(cell("attended"));
    let total = toStr(cell("total"));

    // one column holding "10 / 12"
    if (cols.combined !== undefined) {
      const m = String(cells[cols.combined] ?? "").match(FRACTION_RE);
      if (m) { attended = attended || m[1]; total = total || m[2]; }
    }

    // headerless / converted-from-PDF sheets: look through the whole row
    const joined = cells.map((c) => String(c ?? "")).join(" | ");
    if (!usn) { const m = joined.match(USN_RE); if (m) usn = m[1]; }
    if (attended === "" && total === "") {
      const m = joined.match(FRACTION_RE);
      if (m) { attended = m[1]; total = m[2]; }
    }
    if (!name) {
      const c = cells.find((x) => /[A-Za-z]{3,}/.test(String(x ?? "")) && !USN_RE.test(String(x ?? "")));
      if (c) name = toStr(c);
    }

    if (!normId(usn) && !normName(name)) return; // blank row
    if (!normId(usn) && attended === "" && total === "") return; // stray text row
    out.push({ usn, name, attended, total, source: `${source}, row ${i + 1}` });
  });
  return out;
}

// ── Public: parse an .xlsx / .xls / .csv file ──────────────────
export async function parseSpreadsheetFile(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const out = [];
  wb.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: false });
    out.push(...rowsFromMatrix(matrix, sheetName));
  });
  return out;
}

// ── Public: parse text copied from a PDF / Word / Excel ────────
// Lines like:  14 1EW24CI012 DEVIKA KYADAPPA 10 / 12 83.33%
export function parsePastedText(text) {
  const out = [];
  String(text || "").split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/([0-9][A-Za-z]{2}\d{2}[A-Za-z]{2}\d{3})\s+(.*?)\s+(\d+)\s*\/\s*(\d+)/);
    if (m) out.push({ usn: m[1], name: m[2].trim(), attended: m[3], total: m[4], source: `line ${i + 1}` });
  });
  return out;
}

// ── Public: match raw rows against the class ───────────────────
// students: [{ id, usn, name }]  (the students of the selected Year + Sem)
// Returns:
//   entries  – file rows that matched a student (with warnings / problems)
//   extras   – file rows that match nobody in this class
//   missing  – students in this class with NO row in the file
export function reconcile(parsed, students) {
  const byUsn = new Map();
  const byName = new Map();
  students.forEach((s) => {
    byUsn.set(normId(s.usn || s.id), s);
    const k = normName(s.name);
    byName.set(k, [...(byName.get(k) || []), s]);
  });

  const byStudent = new Map(); // studentId -> entry (last one wins, flagged duplicate)
  const extras = [];

  parsed.forEach((p) => {
    let student = byUsn.get(normId(p.usn));
    let matchedBy = "usn";
    if (!student) {
      const cands = byName.get(normName(p.name)) || [];
      if (cands.length === 1) { student = cands[0]; matchedBy = "name"; }
    }
    if (!student) {
      extras.push({ parsed: p, reason: normId(p.usn) ? "USN not found in this class" : "No USN in this row" });
      return;
    }

    const problems = [];
    const a = toInt(p.attended), t = toInt(p.total);
    if (Number.isNaN(a) || Number.isNaN(t)) problems.push("Attended / Total is not a whole number");
    else if (a > t) problems.push("Attended is more than Total");

    const warnings = [];
    if (matchedBy === "name") warnings.push(`USN "${p.usn || "—"}" not found — matched by name only`);
    else if (!namesAgree(p.name, student.name)) warnings.push(`Name in file is "${p.name}"`);

    if (byStudent.has(student.id)) problems.push("This student appears more than once in the file");

    byStudent.set(student.id, {
      student,
      parsed: p,
      attended: toStr(p.attended),
      total: toStr(p.total),
      problems,
      warnings,
    });
  });

  const entries = [...byStudent.values()];
  const missing = students.filter((s) => !byStudent.has(s.id));
  return { entries, extras, missing };
}