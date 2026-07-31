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

    // 1. Upload the actual file to Supabase Storage bucket "notes"
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

    // 2. Save metadata + public URL to the notes table
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

// ── NOTES: fetch all notes from DB (used on app load) ──
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

// ── NOTES: delete file from storage + row from DB ──
export async function deleteNote(noteId, fileUrl) {
  try {
    if (fileUrl) {
      // Extract storage path from public URL
      const path = fileUrl.split("/notes/")[1];
      if (path) await supabase.storage.from("notes").remove([path]);
    }
    await supabase.from("notes").delete().eq("id", noteId);
  } catch (e) { console.warn("deleteNote failed", e); }
}

// ── PLACEMENT UPLOADS: upload file to Supabase Storage bucket "placement-uploads" ──
// Unlike the Cloudinary helper this used to go through, this has NO blob-URL
// fallback — if the upload fails, it throws, so the caller can surface a real
// error instead of silently saving a broken blob: URL that only works in the
// uploader's own browser tab.
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

// ── PLACEMENT UPLOADS: delete file from storage (call before/with Firestore delete) ──
export async function deletePlacementFile(fileUrl) {
  try {
    if (!fileUrl) return;
    const path = fileUrl.split("/placement-uploads/")[1];
    if (path) await supabase.storage.from("placement-uploads").remove([path]);
  } catch (e) { console.warn("deletePlacementFile failed", e); }
}