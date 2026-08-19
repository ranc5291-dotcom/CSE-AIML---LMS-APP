import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
export { supabase };


export async function logLogin(user) {
  try {
    await supabase.from("login_logs").insert({
      user_id:   user.id,
      user_name: user.name,
      role:      user.role,
      usn:       user.usn || user.id,
    });
  } catch (e) { console.warn("logLogin failed", e); }
}

export async function saveEnrollment(student) {
  try {
    const { error } = await supabase.from("enrollments").insert({
      name:       student.name,
      usn:        student.usn,
      password:   student.password,
      branch:     student.branch,
      year:       student.year,
      sem:        student.sem,
      start_year: student.startYear,
      end_year:   student.endYear,
    });
    return error;
  } catch (e) { return e; }
}

export async function getEnrollments() {
  try {
    const { data } = await supabase.from("enrollments").select("*").order("created_at", { ascending: false });
    return data || [];
  } catch { return []; }
}

export async function saveComplaint(complaint) {
  try {
    await supabase.from("complaints").insert({
      title:           complaint.title,
      category:        complaint.category,
      description:     complaint.desc,
      submitted_by:    complaint.by,
      submitted_by_id: complaint.userId,
    });
  } catch (e) { console.warn("saveComplaint failed", e); }
}

export async function updateComplaintStatusDB(id, status) {
  try {
    await supabase.from("complaints").update({ status }).eq("id", id);
  } catch (e) { console.warn("updateComplaintStatus failed", e); }
}

export async function saveAnnouncement(a) {
  try {
    await supabase.from("announcements").insert({
      title:     a.title,
      tag:       a.tag,
      posted_by: a.postedBy,
    });
  } catch (e) { console.warn("saveAnnouncement failed", e); }
}

export async function saveMark(studentId, studentName, subject, sem, mark) {
  try {
    await supabase.from("marks").upsert({
      student_id:   studentId,
      student_name: studentName,
      subject, sem, mark,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,subject,sem" });
  } catch (e) { console.warn("saveMark failed", e); }
}

export async function saveAttendance(studentId, studentName, subject, sem, percentage) {
  try {
    await supabase.from("attendance").upsert({
      student_id:   studentId,
      student_name: studentName,
      subject, sem, percentage,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,subject,sem" });
  } catch (e) { console.warn("saveAttendance failed", e); }
}

export async function saveEventRegistration(eventId, eventTitle, user) {
  try {
    await supabase.from("event_registrations").insert({
      event_id:     String(eventId),
      event_title:  eventTitle,
      student_name: user.name,
      student_id:   user.id,
      usn:          user.usn || user.id,
    });
  } catch (e) { console.warn("saveEventRegistration failed", e); }
}

// ── NOTES: upload file to Supabase Storage + save metadata to DB ──
export async function saveNote(note, file) {
  try {
    let file_url = null;

    if (file) {
      const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(safeName, file, { upsert: false });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("notes")
          .getPublicUrl(safeName);
        file_url = urlData.publicUrl;
      } else {
        console.warn("Storage upload failed:", uploadError.message);
      }
    }

    const { data, error } = await supabase.from("notes").insert({
      subject:     note.subject,
      type:        note.type,
      file_name:   note.file,
      sem:         note.sem,
      uploaded_by: note.uploadedBy,
      file_url,
    }).select().single();

    if (error) console.warn("saveNote DB insert failed:", error.message);
    return { data, file_url };
  } catch (e) {
    console.warn("saveNote failed", e);
    return { data: null, file_url: null };
  }
}

export async function fetchNotes() {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((n) => ({
      id:         n.id,
      subject:    n.subject,
      type:       n.type,
      file:       n.file_name,
      sem:        n.sem,
      uploadedBy: n.uploaded_by,
      date:       new Date(n.created_at).toLocaleDateString("en-IN"),
      fileUrl:    n.file_url || null,
      size:       n.size || null,
    }));
  } catch (e) {
    console.warn("fetchNotes failed", e);
    return [];
  }
}

export async function deleteNote(noteId, fileUrl) {
  try {
    if (fileUrl) {
      const path = fileUrl.split("/notes/")[1];
      if (path) await supabase.storage.from("notes").remove([path]);
    }
    await supabase.from("notes").delete().eq("id", noteId);
  } catch (e) { console.warn("deleteNote failed", e); }
}

export async function uploadPlacementFile(file) {
  const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

  const { error: uploadError } = await supabase.storage
    .from("placement-uploads")
    .upload(safeName, file, { upsert: false });

  if (uploadError) {
    throw new Error("Supabase upload failed: " + uploadError.message);
  }

  const { data: urlData } = supabase.storage
    .from("placement-uploads")
    .getPublicUrl(safeName);

  return { fileUrl: urlData.publicUrl, fileName: file.name };
}

export async function deletePlacementFile(fileUrl) {
  try {
    if (!fileUrl) return;
    const path = fileUrl.split("/placement-uploads/")[1];
    if (path) await supabase.storage.from("placement-uploads").remove([path]);
  } catch (e) { console.warn("deletePlacementFile failed", e); }
}

// ══════════════════════════════════════════════════════════
// ACADEMIC SYSTEM — Subjects / Faculty Subjects / Marks
// All identity here is a Firebase UID stored as text (matches
// profiles.id), since there's no Supabase Auth session.
// ══════════════════════════════════════════════════════════

export function semNumber(semLabel) {
  const n = parseInt(String(semLabel).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function yearNumber(yearLabel) {
  const map = { "1st Year": 1, "2nd Year": 2, "3rd Year": 3, "4th Year": 4 };
  return map[yearLabel] ?? null;
}

// ══════════════════════════════════════════════════════════
// SUBJECT CATALOG — Option 1 "Manage Subjects". Faculty-managed,
// scoped to academic_year + semester. This is the single source of
// truth for the subject list — faculty_subjects (teaching assignment),
// subject_assessments, and marks all reference subjects.id from here.
//
// NOTE: this is separate from the older Firebase `subjects` collection
// used by LMSContext (StudentDashboard's "Notes & Subjects" tab, and
// Notes/Assignments matching by subject NAME string). That system is
// untouched by this feature — reconciling the two is a separate,
// larger migration and was out of scope here.
// ══════════════════════════════════════════════════════════

function normalizeSubjectName(name) {
  return String(name || "").trim();
}

// includeInactive: true also returns deactivated subjects (used only by
// the "Inactive Subjects / Restore" view). Every other caller — My
// Teaching Subjects, the student subject browser, Marks, Attendance —
// gets the default (active-only) behavior automatically.
export async function getCatalogSubjects(year, semLabel, { includeInactive = false } = {}) {
  const semN = semNumber(semLabel);
  const yearN = yearNumber(year);
  if (!semN || !yearN) return [];
  let q = supabase.from("subjects").select("*").eq("semester", semN).eq("academic_year", yearN);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("subject_name", { ascending: true });
  if (error) { console.warn("getCatalogSubjects:", error.message); return []; }
  return data || [];
}

async function checkDuplicateSubject(year, semLabel, name, excludeId = null) {
  const semN = semNumber(semLabel);
  const yearN = yearNumber(year);
  const trimmed = normalizeSubjectName(name);
  if (!semN || !yearN || !trimmed) return false;
  let q = supabase.from("subjects")
    .select("id", { count: "exact", head: true })
    .eq("semester", semN).eq("academic_year", yearN).eq("is_active", true)
    .ilike("subject_name", trimmed);
  if (excludeId) q = q.neq("id", excludeId);
  const { count, error } = await q;
  if (error) { console.warn("checkDuplicateSubject:", error.message); return false; }
  return (count || 0) > 0;
}

export async function addCatalogSubject(year, semLabel, { name, code } = {}) {
  const semN = semNumber(semLabel);
  const yearN = yearNumber(year);
  const trimmed = normalizeSubjectName(name);
  if (!trimmed) return { ok: false, error: "Subject name is required." };
  if (!semN || !yearN) return { ok: false, error: "Invalid year or semester." };
  if (await checkDuplicateSubject(year, semLabel, trimmed)) {
    return { ok: false, error: "Subject name already exists for this semester." };
  }
  const { data, error } = await supabase.from("subjects").insert({
    subject_name: trimmed,
    subject_code: code ? String(code).trim() : null,
    semester: semN,
    academic_year: yearN,
    is_active: true,
  }).select().single();
  if (error) { console.warn("addCatalogSubject:", error.message); return { ok: false, error: "Unable to add subject. Please try again." }; }
  return { ok: true, data };
}

export async function editCatalogSubject(subjectId, { name, code } = {}, year, semLabel) {
  const trimmed = normalizeSubjectName(name);
  if (!trimmed) return { ok: false, error: "Subject name is required." };
  if (await checkDuplicateSubject(year, semLabel, trimmed, subjectId)) {
    return { ok: false, error: "Subject name already exists for this semester." };
  }
  const { error } = await supabase.from("subjects").update({
    subject_name: trimmed,
    subject_code: code ? String(code).trim() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", subjectId);
  if (error) { console.warn("editCatalogSubject:", error.message); return { ok: false, error: "Unable to save changes." }; }
  return { ok: true };
}

// Whether this subject is referenced anywhere that a hard delete would
// destroy: teaching assignments, configured internals, or saved marks.
async function catalogSubjectHasReferences(subjectId) {
  const [fs, sa, mk] = await Promise.all([
    supabase.from("faculty_subjects").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
    supabase.from("subject_assessments").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
    supabase.from("marks").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
  ]);
  return (fs.count || 0) > 0 || (sa.count || 0) > 0 || (mk.count || 0) > 0;
}

// Deactivates (soft-delete) if the subject has any academic data
// attached; only hard-deletes a subject that has genuinely never
// been used by anyone.
export async function deactivateCatalogSubject(subjectId) {
  const hasRefs = await catalogSubjectHasReferences(subjectId);
  if (hasRefs) {
    const { error } = await supabase.from("subjects")
      .update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", subjectId);
    if (error) { console.warn("deactivateCatalogSubject:", error.message); return { ok: false, error: "Unable to remove subject." }; }
    return { ok: true, deactivated: true };
  }
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) { console.warn("deactivateCatalogSubject (delete):", error.message); return { ok: false, error: "Unable to remove subject." }; }
  return { ok: true, deactivated: false };
}

export async function restoreCatalogSubject(subjectId) {
  const { error } = await supabase.from("subjects")
    .update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", subjectId);
  if (error) { console.warn("restoreCatalogSubject:", error.message); return { ok: false, error: "Unable to restore subject." }; }
  return { ok: true };
}

// Backward-compatible wrapper — some older callers only have a sem label,
// not a year. Sem labels map 1:1 to a year in this app (Sem 1/2 → 1st
// Year only, etc.), so deriving year from the label is safe.
export async function getSubjectsBySemester(semLabel) {
  const YEARS = [
    { label: "1st Year", sems: ["Sem 1", "Sem 2"] },
    { label: "2nd Year", sems: ["Sem 3", "Sem 4"] },
    { label: "3rd Year", sems: ["Sem 5", "Sem 6"] },
    { label: "4th Year", sems: ["Sem 7", "Sem 8"] },
  ];
  const found = YEARS.find((y) => y.sems.includes(semLabel));
  if (!found) return [];
  return getCatalogSubjects(found.label, semLabel);
}

// ── FACULTY_SUBJECTS — faculty self-selects what they teach ──
export async function getFacultySubjects(facultyId, year, semLabel) {
  const { data, error } = await supabase
    .from("faculty_subjects")
    .select("*, subjects(*)")
    .eq("faculty_id", facultyId)
    .eq("year", year)
    .eq("semester", semLabel);
  if (error) { console.warn("getFacultySubjects:", error.message); return []; }
  return data || [];
}

export async function saveFacultySubjects(facultyId, year, semLabel, subjectIds) {
  const existing = await getFacultySubjects(facultyId, year, semLabel);
  const existingIds = new Set(existing.map((r) => r.subject_id));
  const wantIds = new Set(subjectIds);

  const toAdd = subjectIds.filter((id) => !existingIds.has(id));
  const toRemove = existing.filter((r) => !wantIds.has(r.subject_id));

  if (toAdd.length > 0) {
    const rows = toAdd.map((subject_id) => ({
      faculty_id: facultyId, subject_id, year, semester: semLabel,
    }));
    const { error } = await supabase.from("faculty_subjects").insert(rows);
    if (error) console.warn("saveFacultySubjects insert:", error.message);
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("faculty_subjects")
      .delete()
      .in("id", toRemove.map((r) => r.id));
    if (error) console.warn("saveFacultySubjects delete:", error.message);
  }
}

// ══════════════════════════════════════════════════════════
// SUBJECT_ASSESSMENTS — dynamic "Internal 1/2/3..." config.
// ══════════════════════════════════════════════════════════

export function assessmentDisplayName(a) {
  return `Internal ${a.assessment_number}`;
}

export async function getSubjectAssessments(subjectId, year, semLabel) {
  const { data, error } = await supabase
    .from("subject_assessments")
    .select("*")
    .eq("subject_id", subjectId)
    .eq("academic_year", yearNumber(year))
    .eq("semester", semNumber(semLabel))
    .order("assessment_number", { ascending: true });
  if (error) { console.warn("getSubjectAssessments:", error.message); return []; }
  return data || [];
}

export async function createAssessments(subjectId, year, semLabel, numbersToCreate, maxMarksByNumber = {}) {
  if (!numbersToCreate || numbersToCreate.length === 0) return { ok: true };
  const rows = numbersToCreate.map((n) => ({
    subject_id: subjectId,
    academic_year: yearNumber(year),
    semester: semNumber(semLabel),
    assessment_type: "internal",
    assessment_number: n,
    max_marks: maxMarksByNumber?.[n] ?? 0,
    is_published: false,
  }));
  const { error } = await supabase.from("subject_assessments").insert(rows);
  if (error) { console.warn("createAssessments:", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function updateAssessmentMaxMarks(assessmentId, maxMarks) {
  const { error } = await supabase
    .from("subject_assessments")
    .update({ max_marks: maxMarks })
    .eq("id", assessmentId);
  if (error) { console.warn("updateAssessmentMaxMarks:", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function updateAssessmentPublish(assessmentId, isPublished) {
  const { error } = await supabase
    .from("subject_assessments")
    .update({ is_published: isPublished })
    .eq("id", assessmentId);
  if (error) { console.warn("updateAssessmentPublish:", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function deleteAssessment(assessmentId) {
  const { error } = await supabase.from("subject_assessments").delete().eq("id", assessmentId);
  if (error) { console.warn("deleteAssessment:", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function assessmentHasMarks(assessmentId) {
  const { count, error } = await supabase
    .from("marks")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);
  if (error) { console.warn("assessmentHasMarks:", error.message); return false; }
  return (count || 0) > 0;
}

// ── STUDENTS — from profiles, scoped by year + sem ──
export async function getStudentsByYearSem(year, semLabel) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .eq("year", year)
    .eq("sem", semLabel);
  if (error) { console.warn("getStudentsByYearSem:", error.message); return []; }
  return data || [];
}

export async function getAllStudentProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student");
  if (error) { console.warn("getAllStudentProfiles:", error.message); return []; }
  return data || [];
}

// ── MARKS (faculty side — one internal at a time) ──
export async function getMarksForAssessment(assessmentId) {
  const { data, error } = await supabase
    .from("marks")
    .select("*")
    .eq("assessment_id", assessmentId);
  if (error) { console.warn("getMarksForAssessment:", error.message); return []; }
  return data || [];
}

export async function saveMarksBulk(rows, updatedBy) {
  const payload = rows.map((r) => ({
    student_id: r.studentId,
    subject_id: r.subjectId,
    assessment_id: r.assessmentId,
    marks_obtained: r.marksObtained,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("marks")
    .upsert(payload, { onConflict: "student_id,assessment_id" });
  if (error) { console.warn("saveMarksBulk:", error.message); return { ok: false, error: error.message }; }
  return { ok: true, count: payload.length };
}

// ── STUDENT-FACING: all marks for one student, one semester ──
export async function getStudentMarksFull(studentId, year, semLabel) {
  const yearN = yearNumber(year);
  const semN = semNumber(semLabel);
  if (!yearN || !semN) return {};

  const { data: assessments, error: aErr } = await supabase
    .from("subject_assessments")
    .select("*, subjects(*)")
    .eq("academic_year", yearN)
    .eq("semester", semN)
    .order("assessment_number", { ascending: true });
  if (aErr) { console.warn("getStudentMarksFull (assessments):", aErr.message); return {}; }
  if (!assessments || assessments.length === 0) return {};

  const assessmentIds = assessments.map((a) => a.id);
  const { data: marksRows, error: mErr } = await supabase
    .from("marks")
    .select("*")
    .eq("student_id", studentId)
    .in("assessment_id", assessmentIds);
  if (mErr) console.warn("getStudentMarksFull (marks):", mErr.message);

  const markByAssessment = {};
  (marksRows || []).forEach((m) => { markByAssessment[m.assessment_id] = m; });

  const result = {};
  assessments.forEach((a) => {
    const subjectName = a.subjects?.subject_name;
    if (!subjectName) return;
    if (!result[subjectName]) result[subjectName] = {};
    const label = `Internal ${a.assessment_number}`;
    const markRow = markByAssessment[a.id];
    const isPublished = !!a.is_published;
    result[subjectName][label] = {
      scored: isPublished && markRow ? markRow.marks_obtained : null,
      total: a.max_marks,
      published: isPublished && !!markRow,
    };
  });
  return result;
}

// ══════════════════════════════════════════════════════════
// CLEAR ACCOUNT DATA — deletes only Supabase rows owned by `uid`.
// ══════════════════════════════════════════════════════════

const USER_OWNED_TABLES = [
  { table: "event_registrations", column: "student_id" },
  { table: "login_logs",          column: "user_id" },
  { table: "complaints",          column: "submitted_by_id" },
  { table: "marks",               column: "student_id" },
  { table: "attendance",          column: "student_id" },
];

const FACULTY_OWNED_TABLES = [
  { table: "faculty_subjects", column: "faculty_id" },
];

export async function clearSupabaseUserData(uid, role) {
  const errors = [];
  const tables = [
    ...USER_OWNED_TABLES,
    ...(role === "faculty" ? FACULTY_OWNED_TABLES : []),
  ];

  for (const { table, column } of tables) {
    const { error } = await supabase.from(table).delete().eq(column, uid);
    if (error) errors.push(`${table}: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }
}
// ══════════════════════════════════════════════════════════
// USER ROLES — multi-role access (Admin-assigned)
// ══════════════════════════════════════════════════════════

export async function getUserRoles(userId) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) { console.warn("getUserRoles failed", error); return []; }
  return (data || []).map((r) => r.role);
}

export async function getAllUserRoles() {
  const { data, error } = await supabase.from("user_roles").select("*");
  if (error) { console.warn("getAllUserRoles failed", error); return []; }
  return data || [];
}

// Syncs this user's extra roles to exactly the given array (adds missing,
// removes anything not in the list). Pass the FULL desired role set,
// including their primary profiles.role if you want it explicit — it's
// harmless either way since login always merges profiles.role in too.
export async function setUserRoles(userId, roles) {
  try {
    const current = await getUserRoles(userId);
    const toAdd = roles.filter((r) => !current.includes(r));
    const toRemove = current.filter((r) => !roles.includes(r));

    if (toAdd.length > 0) {
      const rows = toAdd.map((role) => ({ user_id: userId, role }));
      const { error } = await supabase.from("user_roles").insert(rows);
      if (error) throw error;
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .in("role", toRemove);
      if (error) throw error;
    }
    return { success: true };
  } catch (err) {
    console.warn("setUserRoles failed", err);
    return { success: false, error: err.message };
  }
}