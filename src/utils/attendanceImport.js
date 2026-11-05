// src/utils/attendanceImport.js
//
// Bulk attendance import helpers for the Admin "Marks & Attendance" tab.
//   parseAttendanceFile(file, XLSX)   -> { kind, sem, period, sources }
//   suggestSubjectMappings(...)       -> auto-maps file columns/sheets to LMS subjects
//   buildStudentIndex / findStudent   -> matches file rows to registered students
//   buildAttendanceTemplate(...)      -> blank Excel template (one sheet per subject)
//
// Needs one extra package for PDF reading:   npm install pdfjs-dist

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const STOP_WORDS = new Set(["OF", "AND", "FOR", "USING", "THE", "TO", "IN", "WITH", "A", "AN", "&"]);

export const normUsn = (v) => {
  const s = String(v ?? "").toUpperCase().replace(/\s+/g, "");
  return s.replace(/^I(?=EW)/, "1");
};

export const isRealUsn = (v) => {
  const s = normUsn(v);
  return s.length >= 6 && /\d/.test(s) && s !== "LATERAL";
};

export const normName = (v) =>
  String(v ?? "").toUpperCase().replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();

const normLabel = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const toIntOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const mode = (arr) => {
  const counts = new Map();
  arr.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best = null, bestN = 0;
  counts.forEach((n, v) => { if (n > bestN) { best = v; bestN = n; } });
  return best;
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ───────────────────────── PDF parsing ─────────────────────────
//   pages: Array<Array<{ str, x, y, w }>>

export function parseAttendancePdfItems(pages) {
  const allText = pages.flat().map((i) => i.str).join(" ");

  let sem = null;
  const semMatch = allText.match(/SEM\s*:?\s*(VIII|VII|VI|IV|V|III|II|I|\d)\b/i);
  if (semMatch) {
    const t = semMatch[1].toUpperCase();
    sem = ROMAN[t] || Number(t) || null;
  }
  const periodMatch = allText.match(/From\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s+to\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  const period = periodMatch ? `${periodMatch[1]} to ${periodMatch[2]}` : null;

  const rightEdge = (i) => i.x + (i.w || 0);
  const centre = (i) => i.x + (i.w || 0) / 2;

  let columns = null;
  let anchorMaxX = 95;

  for (const items of pages) {
    const subjHdr = items.find((i) => /^subject\s*name$/i.test(i.str.trim()));
    if (!subjHdr) continue;

    const labels = items
      .filter((i) => Math.abs(i.y - subjHdr.y) <= 3 && i.x > rightEdge(subjHdr) + 2)
      .sort((a, b) => a.x - b.x);
    if (!labels.length) continue;

    columns = labels.map((l) => ({ label: l.str.trim(), hx: centre(l), ref: null, total: null }));

    const heldHdr = items.find((i) => /^no\.?\s*of\s*classes/i.test(i.str.trim()));
    if (heldHdr) {
      items
        .filter((i) => Math.abs(i.y - heldHdr.y) <= 3 && i.x > rightEdge(heldHdr) && /^\d+$/.test(i.str.trim()))
        .forEach((t) => {
          let best = null, bestD = Infinity;
          columns.forEach((c) => {
            const d = Math.abs(centre(t) - c.hx);
            if (d < bestD) { bestD = d; best = c; }
          });
          if (best && best.total === null) {
            best.total = Number(t.str.trim());
            best.ref = rightEdge(t);
          }
        });
    }

    const offsets = columns.filter((c) => c.ref !== null).map((c) => c.ref - c.hx);
    const med = median(offsets);
    columns.forEach((c) => { if (c.ref === null) c.ref = c.hx + med; });

    const slHdr = items.find((i) => /^s[il]\.?\s*no/i.test(i.str.trim()));
    const usnHdr = items.find((i) => /^usn$/i.test(i.str.trim()));
    if (slHdr && usnHdr) anchorMaxX = (slHdr.x + usnHdr.x) / 2;
    break;
  }

  if (!columns) {
    throw new Error("Could not find the subject header row in this PDF. Please upload the Excel file instead.");
  }

  const students = [];

  for (const items of pages) {
    const anchors = items
      .filter((i) => i.x < anchorMaxX && /^\d{1,3}$/.test(i.str.trim()))
      .sort((a, b) => b.y - a.y);
    if (!anchors.length) continue;

    const gaps = anchors.slice(1).map((a, k) => anchors[k].y - a.y).filter((g) => g > 0);
    const maxDy = Math.max(4, (gaps.length ? median(gaps) : 10) * 0.55);

    const buckets = anchors.map(() => []);
    items.forEach((it) => {
      if (anchors.includes(it)) return;
      let bi = -1, bd = Infinity;
      anchors.forEach((a, k) => {
        const d = Math.abs(it.y - a.y);
        if (d < bd) { bd = d; bi = k; }
      });
      if (bi >= 0 && bd <= maxDy) buckets[bi].push(it);
    });

    anchors.forEach((_, k) => {
      const row = buckets[k].filter((i) => i.x >= anchorMaxX).sort((a, b) => a.x - b.x);
      if (!row.length) return;

      const usnItem = row[0];
      const rest = row.slice(1);
      const usn = usnItem.str.trim();
      const name = rest
        .filter((i) => !/^\d+$/.test(i.str.trim()))
        .map((i) => i.str.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const values = {};
      rest
        .filter((i) => /^\d+$/.test(i.str.trim()))
        .forEach((v) => {
          let best = null, bd = Infinity;
          columns.forEach((c) => {
            const d = Math.abs(rightEdge(v) - c.ref);
            if (d < bd) { bd = d; best = c; }
          });
          if (best && !(best.label in values)) values[best.label] = Number(v.str.trim());
        });

      if (usn || name) students.push({ usn, name, values });
    });
  }

  if (!students.length) {
    throw new Error("No student rows were found in this PDF. If it is a scanned image, please upload the Excel file instead.");
  }

  const sources = [];
  columns.forEach((c) => {
    const rows = [];
    students.forEach((s) => {
      if (c.label in s.values) rows.push({ usn: s.usn, name: s.name, attended: s.values[c.label], total: c.total });
    });
    const missing = students
      .filter((s) => !(c.label in s.values))
      .map((s) => ({ usn: s.usn, name: s.name }));
    sources.push({
      label: c.label,
      total: c.total,
      rows,
      missing,
      note: rows.length === 0
        ? (c.total !== null
            ? "Classes held is filled in, but no attendance was entered for any student"
            : "No attendance in this file for this subject")
        : undefined,
    });
  });

  return { kind: "pdf", sem, period, studentCount: students.length, sources };
}

async function extractPdfPages(file) {
  const pdfjs = await import("pdfjs-dist");
  try {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  } catch {
    // worker already configured elsewhere (e.g. PDFViewer) — carry on
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      tc.items
        .filter((i) => i.str && i.str.trim())
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }))
    );
  }
  return pages;
}

// ───────────────────────── Excel / CSV parsing ─────────────────────────

const pick = (rec, names) => {
  for (const n of names) if (n in rec) return rec[n];
  return undefined;
};

export function parseAttendanceWorkbook(XLSX, wb) {
  const sources = [];
  const ignored = [];

  wb.SheetNames.forEach((sheetName) => {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    const recs = raw.map((r) => {
      const o = {};
      Object.keys(r).forEach((k) => { o[String(k).trim().toLowerCase()] = r[k]; });
      return o;
    });

    if (!recs.length || !("usn" in recs[0])) { ignored.push(sheetName); return; }

    const rows = [];
    const allTotals = [];
    let blank = 0;
    const missing = [];
    recs.forEach((r) => {
      const usn = String(r.usn ?? "").trim();
      const name = String(pick(r, ["name", "student name", "students name"]) ?? "").trim();
      if (!usn && !name) return;
      const attended = toIntOrNull(pick(r, ["attended", "present", "classes attended", "attended classes"]));
      const total = toIntOrNull(pick(r, ["total", "total classes", "classes held", "held"]));
      if (total !== null && !Number.isNaN(total)) allTotals.push(total);
      if (attended === null) { blank++; missing.push({ usn, name }); return; }
      rows.push({ usn, name, attended, total });
    });

    const sheetTotal = allTotals.length ? mode(allTotals) : null;
    rows.forEach((r) => { if (r.total === null) r.total = sheetTotal; });

    let note;
    if (rows.length === 0) {
      note = sheetTotal !== null
        ? "Total classes is filled in, but no attended values found"
        : "Sheet is empty";
    }
    sources.push({ label: String(sheetName).trim(), total: sheetTotal, rows, note, blank, missing });
  });

  if (!sources.length) {
    throw new Error("No sheet with Name / USN / Attended / Total columns was found in this file.");
  }
  return { kind: "excel", sem: null, period: null, sources, ignored };
}

export async function parseAttendanceFile(file, XLSX) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pages = await extractPdfPages(file);
    return parseAttendancePdfItems(pages);
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return parseAttendanceWorkbook(XLSX, wb);
}

// ───────────────────────── subject auto-mapping ─────────────────────────

const significantWords = (name) =>
  String(name ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));

function scoreLabel(label, subject, saved) {
  const l = normLabel(label);
  if (!l) return 0;
  if (saved && String(saved) === String(subject.id)) return 100;
  if (l === normLabel(subject.subject_code)) return 100;
  if (l === normLabel(subject.subject_name)) return 100;
  if ((l === "OOP" || l === "OOPS") && String(subject.subject_name ?? "").toUpperCase().startsWith("OBJECT ORIENTED")) return 90;

  const words = significantWords(subject.subject_name);
  const initials = words.map((w) => w[0]).join("");
  if (l === initials) return 90;
  for (let k = 2; k < words.length; k++) {
    if (l === words.slice(0, k).map((w) => w[0]).join("")) return 70;
  }
  if (l.length >= 3 && words[0] && words[0].startsWith(l)) return 60;
  return 0;
}

export function suggestSubjectMappings(sources, subjects, savedMap = {}, fallbackSubjectId = null) {
  const pairs = [];
  sources.forEach((src, si) => {
    if (!src.rows.length) return;
    subjects.forEach((sub) => {
      const s = scoreLabel(src.label, sub, savedMap[normLabel(src.label)]);
      if (s > 0) pairs.push({ si, id: sub.id, s });
    });
  });
  pairs.sort((a, b) => b.s - a.s);

  const result = {};
  const used = new Set();
  pairs.forEach((p) => {
    if (result[p.si] !== undefined || used.has(String(p.id))) return;
    result[p.si] = p.id;
    used.add(String(p.id));
  });

  if (sources.length === 1 && fallbackSubjectId && result[0] === undefined && sources[0].rows.length) {
    result[0] = subjects.find((s) => String(s.id) === String(fallbackSubjectId))?.id;
  }
  return result;
}

export const labelKey = normLabel;

// ───────────────────────── student matching ─────────────────────────

export function buildStudentIndex(students) {
  const byUsn = new Map();
  const byName = new Map();
  students.forEach((st) => {
    const u = normUsn(st.usn || st.id);
    if (u) byUsn.set(u, st);
    const n = normName(st.name);
    if (n) byName.set(n, [...(byName.get(n) || []), st]);
  });
  return { byUsn, byName, list: students };
}

export function findStudent(row, idx) {
  if (isRealUsn(row.usn)) {
    const hit = idx.byUsn.get(normUsn(row.usn));
    if (hit) return hit;
  }
  const n = normName(row.name);
  if (!n) return null;

  const exact = idx.byName.get(n);
  if (exact && exact.length === 1) return exact[0];

  const tokens = n.split(" ").filter((t) => t.length > 1);
  if (tokens.length >= 2) {
    const cands = idx.list.filter((st) => {
      const st_t = normName(st.name).split(" ").filter((t) => t.length > 1);
      if (st_t.length < 2) return false;
      const a = new Set(tokens), b = new Set(st_t);
      const small = a.size <= b.size ? a : b;
      const big = a.size <= b.size ? b : a;
      return [...small].every((t) => big.has(t));
    });
    if (cands.length === 1) return cands[0];
  }

  // Same first name; the other parts are equal or just initials of each other
  // e.g. "VISHWA NOOLESH MUTAGI" and "Vishwa N M". Only accepted if exactly one student fits.
  const parts = n.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const compat = (a, b) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));
    const initialMatches = idx.list.filter((st) => {
      const sp = normName(st.name).split(" ").filter(Boolean);
      if (sp.length < 2 || sp[0] !== parts[0]) return false;
      const [short, long] = sp.length <= parts.length ? [sp, parts] : [parts, sp];
      const used = new Set();
      return short.slice(1).every((t) => {
        const k = long.findIndex((u, i) => i > 0 && !used.has(i) && compat(t, u));
        if (k < 0) return false;
        used.add(k);
        return true;
      });
    });
    if (initialMatches.length === 1) return initialMatches[0];
  }
  return null;
}

// ───────────────────────── template ─────────────────────────

const safeSheetName = (s, used) => {
  let n = String(s || "Sheet").replace(/[\[\]:*?/\\]/g, "").slice(0, 31) || "Sheet";
  let k = 2;
  while (used.has(n.toLowerCase())) n = `${n.slice(0, 28)}_${k++}`;
  used.add(n.toLowerCase());
  return n;
};

export function buildAttendanceTemplate(XLSX, students, subjects) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const sorted = [...students].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  subjects.forEach((sub) => {
    const aoa = [["Name", "USN", "Attended", "Total"]];
    sorted.forEach((st) => aoa.push([st.name || "", st.usn || "", "", ""]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sub.subject_code || sub.subject_name, used));
  });

  const help = XLSX.utils.aoa_to_sheet([
    ["How to use this template"],
    ["1. Fill Attended and Total for each student in the sheet of that subject."],
    ["2. Total = classes held for the subject (same number for every student)."],
    ["3. Leave Attended blank to skip a student. Do not rename the sheets."],
    ["4. Upload the file from Marks & Attendance > Upload PDF / Excel."],
  ]);
  help["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, help, safeSheetName("Instructions", used));
  return wb;
}