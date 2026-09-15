import { createContext, useContext, useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, updateDoc,
} from "firebase/firestore";
import { attendanceAPI, marksAPI, sendNotification } from "../utils/api";
import { uploadPlacementFile, deletePlacementFile, saveEventRegistration } from "../utils/supabase";

const LMSContext = createContext(null);

const INITIAL_SUBJECTS = {
  "Sem 1": ["Mathematics I", "Physics", "C Programming", "English"],
  "Sem 2": ["Mathematics II", "Chemistry", "Data Structures", "EVS"],
  "Sem 3": ["DBMS", "OS", "Computer Networks", "OOP with Java"],
  "Sem 4": ["Software Engineering", "DAA", "Microprocessors", "Web Tech"],
  "Sem 5": ["Machine Learning", "AI", "Cloud Computing", "Mobile App Dev"],
  "Sem 6": ["Deep Learning", "NLP", "Big Data", "Information Security"],
  "Sem 7": ["Generative AI", "MLOps", "IoT", "Project Phase I"],
  "Sem 8": ["Research Methodology", "Entrepreneurship", "Project Phase II", "Elective"],
};

const SEM_TO_YEAR = {
  "Sem 1": "1st Year", "Sem 2": "1st Year",
  "Sem 3": "2nd Year", "Sem 4": "2nd Year",
  "Sem 5": "3rd Year", "Sem 6": "3rd Year",
  "Sem 7": "4th Year", "Sem 8": "4th Year",
};

async function uploadToCloudinary(file) {
  const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "cseaiml_unsigned";
  if (!CLOUD_NAME) throw new Error("Cloudinary cloud name not set in .env");
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST", body: form,
  });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return {
    fileUrl:  data.secure_url,
    fileName: file.name,
    fileSize: (file.size / 1024).toFixed(1) + " KB",
    publicId: data.public_id,
  };
}

export function normalizeSubjectMarks(subjectData) {
  if (!subjectData || typeof subjectData !== "object") return {};
  if ("scored" in subjectData || "total" in subjectData) {
    return { "Internal 1": { scored: subjectData.scored ?? "", total: subjectData.total ?? 100 } };
  }
  return subjectData;
}

export function getInternalCount(internals, sem, subject) {
  const n = internals?.[sem]?.[subject];
  return n && n > 0 ? n : 1;
}

export function LMSProvider({ children }) {
  const [subjects, setSubjects]           = useState(INITIAL_SUBJECTS);
  const [notes, setNotes]                 = useState([]);
  const [notesLoading, setNotesLoading]   = useState(true);
  const [assignments, setAssignments]     = useState([]);
  const [attendance, setAttendance]       = useState({});
  const [marks, setMarks]                 = useState({});
  const [internals, setInternals]         = useState({});
  const [markSheetUploads, setMarkSheetUploads] = useState([]);
  const [timetables, setTimetables]       = useState([]);
  const [events, setEvents]               = useState([]);
  const [notices, setNotices]             = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [galleryFirestore, setGalleryFirestore] = useState([]);
  const [galleryFallback, setGalleryFallback]   = useState([]);
  const gallery = [...galleryFallback, ...galleryFirestore];

  const [fundRequests, setFundRequests]   = useState([]);
  const [semResources, setSemResources]   = useState({});
  const [complaints, setComplaints]       = useState([]);
  const [companies, setCompanies]         = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [dsaList, setDsaList]             = useState([]);
  const [aptitude, setAptitude]           = useState([]);
  const [placementUploads, setPlacementUploads] = useState([]);

  const [promotions, setPromotions]       = useState([]);

  useEffect(() => {
    const unsubs = [];

    function listen(col, setter, fallback = [], field = "createdAt", dir = "desc") {
      try {
        const q    = query(collection(db, col), orderBy(field, dir));
        const unsub = onSnapshot(q,
          (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          (err)  => { console.warn(`${col}:`, err.message); setter(fallback); }
        );
        unsubs.push(unsub);
      } catch { setter(fallback); }
    }

    listen("notes", (data) => {
      setNotes(data);
      setNotesLoading(false);
    }, []);

    listen("assignments", setAssignments, []);

    listen("companies", (data) => {
      setCompanies(data);
      setCompaniesLoading(false);
    }, []);

    listen("notices", setNotices, []);
    listen("announcements", setAnnouncements, []);
    listen("gallery", setGalleryFirestore, []);
    listen("dsa", setDsaList, []);
    listen("aptitude", setAptitude, []);
    listen("placementUploads", setPlacementUploads, []);
    listen("markSheetUploads", setMarkSheetUploads, []);
    listen("timetables", setTimetables, []);
    listen("promotions", setPromotions, []);
    listen("events", setEvents, [], "date", "asc");
    listen("complaints", setComplaints, []);

    try {
      const unsub = onSnapshot(collection(db, "subjects"),
        (snap) => {
          if (!snap.empty) {
            const rebuilt = {};
            snap.docs.forEach((d) => { rebuilt[d.data().sem] = d.data().subjects || []; });
            setSubjects((p) => ({ ...INITIAL_SUBJECTS, ...rebuilt }));
          }
        },
        (err) => console.warn("subjects:", err.message)
      );
      unsubs.push(unsub);
    } catch {}

    try {
      const unsub = onSnapshot(collection(db, "subjectInternals"),
        (snap) => {
          const rebuilt = {};
          snap.docs.forEach((d) => {
            const data = d.data();
            rebuilt[data.sem] = data.internals || {};
          });
          setInternals((p) => ({ ...p, ...rebuilt }));
        },
        (err) => console.warn("subjectInternals:", err.message)
      );
      unsubs.push(unsub);
    } catch {}

    try {
      const unsub = onSnapshot(collection(db, "marks"),
        (snap) => {
          if (!snap.empty) {
            const rebuilt = {};
            snap.docs.forEach((d) => {
              const data = d.data();
              rebuilt[data.studentId] = data.marks || {};
            });
            setMarks((p) => ({ ...p, ...rebuilt }));
          }
        },
        (err) => console.warn("marks:", err.message)
      );
      unsubs.push(unsub);
    } catch {}

    try {
      const unsub = onSnapshot(collection(db, "attendance"),
        (snap) => {
          if (!snap.empty) {
            const rebuilt = {};
            snap.docs.forEach((d) => {
              const data = d.data();
              rebuilt[data.studentId] = data.attendance || {};
            });
            setAttendance((p) => ({ ...p, ...rebuilt }));
          }
        },
        (err) => console.warn("attendance:", err.message)
      );
      unsubs.push(unsub);
    } catch {}

    return () => unsubs.forEach((u) => u());
  }, []);

  const addSubject = async (sem, name) => {
    setSubjects((p) => ({ ...p, [sem]: [...(p[sem] || []), name] }));
    try {
      const { getDocs, query: q2, where, setDoc, updateDoc: upd } = await import("firebase/firestore");
      const snap = await getDocs(q2(collection(db, "subjects"), where("sem", "==", sem)));
      if (snap.empty) {
        await setDoc(doc(db, "subjects", sem), { sem, subjects: [...(INITIAL_SUBJECTS[sem] || []), name], updatedAt: serverTimestamp() });
      } else {
        const ref  = snap.docs[0].ref;
        const curr = snap.docs[0].data().subjects || [];
        if (!curr.includes(name)) await upd(ref, { subjects: [...curr, name], updatedAt: serverTimestamp() });
      }
    } catch (e) { console.warn("addSubject:", e.message); }
  };

  const removeSubject = async (sem, name) => {
    setSubjects((p) => ({ ...p, [sem]: (p[sem] || []).filter((s) => s !== name) }));
    try {
      const { getDocs, query: q2, where, updateDoc: upd } = await import("firebase/firestore");
      const snap = await getDocs(q2(collection(db, "subjects"), where("sem", "==", sem)));
      if (!snap.empty) {
        const ref  = snap.docs[0].ref;
        const curr = snap.docs[0].data().subjects || [];
        await upd(ref, { subjects: curr.filter((s) => s !== name), updatedAt: serverTimestamp() });
      }
    } catch (e) { console.warn("removeSubject:", e.message); }
  };

  const setSubjectInternals = async (sem, subject, count) => {
    setInternals((p) => ({
      ...p,
      [sem]: { ...(p[sem] || {}), [subject]: count },
    }));
    try {
      const { setDoc: sd } = await import("firebase/firestore");
      await sd(
        doc(db, "subjectInternals", sem),
        { sem, internals: { [subject]: count }, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) { console.warn("setSubjectInternals:", e.message); }
  };

  const addNote = async (noteData, file) => {
    let fileUrl = null, fileName = noteData.file || "", fileSize = noteData.size || "";
    if (file) {
      const up = await uploadToCloudinary(file);
      fileUrl = up.fileUrl; fileName = up.fileName; fileSize = up.fileSize;
    }
    await addDoc(collection(db, "notes"), {
      subject: noteData.subject, type: noteData.type,
      sem: noteData.sem, uploadedBy: noteData.uploadedBy,
      file: fileName, fileUrl, size: fileSize,
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString(),
    });

    await addDoc(collection(db, "notices"), {
      title:      `New ${noteData.type} — ${noteData.subject}`,
      content:    `Uploaded for ${noteData.sem}`,
      tag:        "Academic",
      postedBy:   noteData.uploadedBy,
      postedRole: "faculty",
      targetType: "academic",
      year:       SEM_TO_YEAR[noteData.sem] || null,
      semester:   noteData.sem,
      semesters:  [noteData.sem],
      isBranchWide: false,
      createdAt:  serverTimestamp(),
      date:       new Date().toLocaleDateString(),
      time:       new Date().toLocaleTimeString(),
    });

    sendNotification({
      title: `New ${noteData.type} — ${noteData.subject}`,
      body: `Uploaded for ${noteData.sem}`,
      url: "/student/notes",
      role: "student",
      year: SEM_TO_YEAR[noteData.sem] || null,
      semester: noteData.sem,
    });
  };

  const removeNote = async (id) => {
    try { await deleteDoc(doc(db, "notes", String(id))); } catch {}
    setNotes((p) => p.filter((n) => n.id !== id));
  };

  const addGalleryPhoto = async (photoData, file) => {
    let fileUrl = photoData.url || null;
    if (file) {
      fileUrl = (await uploadToCloudinary(file)).fileUrl;
    }

    const dateStr = new Date().toLocaleDateString();

    await addDoc(collection(db, "gallery"), {
      caption:    photoData.caption || "",
      uploadedBy: photoData.uploadedBy || "",
      category:   photoData.category || "General",
      url:        fileUrl,
      createdAt:  serverTimestamp(),
      date:       dateStr,
    });
  };

  const removeGalleryPhoto = async (id) => {
    if (typeof id === "string" && id.startsWith("local-")) {
      setGalleryFallback((p) => p.filter((g) => g.id !== id));
      return;
    }
    try { await deleteDoc(doc(db, "gallery", String(id))); } catch {}
    setGalleryFirestore((p) => p.filter((g) => g.id !== id));
  };

  // Notice can be a plain message, or carry an optional attachment
  // (PDF, image, etc. — uploaded via Cloudinary, same as notes/gallery).
  //
  // TARGETING — notice.isBranchWide / notice.semesters decide who gets
  // notified:
  //   - isBranchWide: true      → every student, any semester
  //   - semesters: [sem, ...]   → only students in those semester(s)
  //   - neither set             → falls back to notifying everyone
  // Both fields are now persisted on the notice doc AND used when
  // calling sendNotification — previously they were accepted by the
  // caller but silently dropped here, so every notice broadcast to
  // ALL students regardless of what was picked in the "Send To" UI.
  const addNotice = async (notice, file = null) => {
    let fileUrl = null, fileName = null, fileSize = null;
    if (file) {
      const up = await uploadToCloudinary(file);
      fileUrl = up.fileUrl; fileName = up.fileName; fileSize = up.fileSize;
    }

    const isBranchWide = !!notice.isBranchWide;
    const semesters = isBranchWide ? [] : (notice.semesters || []);

    await addDoc(collection(db, "notices"), {
      title:      notice.title,
      content:    notice.content || "",
      tag:        notice.tag || "Notice",
      postedBy:   notice.postedBy,
      postedRole: notice.postedRole || "admin",
      targetType: notice.targetType || "global",
      year:       notice.year || null,
      semester:   notice.semester || null,
      semesters,
      isBranchWide,
      fileUrl, fileName, fileSize,
      createdAt:  serverTimestamp(),
      date:       new Date().toLocaleDateString(),
      time:       new Date().toLocaleTimeString(),
    });

    const title = `Notice: ${notice.tag || "New"}`;
    const body  = notice.title;

    if (isBranchWide) {
      // Whole branch — every student, regardless of semester.
      sendNotification({ title, body, url: "/notices", role: "student" });
    } else if (semesters.length > 0) {
      // The backend's token query ANDs role + year + semester together
      // for a single semester at a time, so fire one targeted call per
      // selected semester rather than trying to pass an array.
      semesters.forEach((sem) => {
        sendNotification({
          title, body, url: "/notices",
          role: "student",
          year: SEM_TO_YEAR[sem] || null,
          semester: sem,
        });
      });
    } else {
      // No semester chosen and not branch-wide — keep the old
      // "notify everyone" behavior as a safe fallback so a notice
      // never silently notifies nobody.
      sendNotification({ title, body, url: "/notices" });
    }
  };
  const removeNotice = async (id) => {
    try { await deleteDoc(doc(db, "notices", String(id))); } catch {}
    setNotices((p) => p.filter((n) => n.id !== id));
  };

  // Generic academic-targeted notification — persisted notice + push,
  // both scoped to a year/sem. Used by Attendance's "Save & Notify"
  // button; reusable for marks or anything similar later.
  const notifyAcademicUpdate = async ({ title, body, year, semester, postedBy, url = "/" }) => {
    await addDoc(collection(db, "notices"), {
      title,
      content:    body,
      tag:        "Academic",
      postedBy,
      postedRole: "faculty",
      targetType: "academic",
      year, semester,
      semesters:  semester ? [semester] : [],
      isBranchWide: false,
      createdAt:  serverTimestamp(),
      date:       new Date().toLocaleDateString(),
      time:       new Date().toLocaleTimeString(),
    });
    sendNotification({ title, body, url, role: "student", year, semester });
  };

  const addAnnouncement = async (a) => {
    await addDoc(collection(db, "announcements"), {
      title: a.title, tag: a.tag, postedBy: a.postedBy,
      time: new Date().toLocaleTimeString(), createdAt: serverTimestamp(),
    });
    sendNotification({
      title: `Announcement: ${a.tag || "New"}`,
      body: a.title,
      url: "/announcements",
    });
  };
  const removeAnnouncement = async (id) => {
    try { await deleteDoc(doc(db, "announcements", String(id))); } catch {}
    setAnnouncements((p) => p.filter((a) => a.id !== id));
  };

  // ── ATTENDANCE — legacy Firestore per-cell writer. No longer called
  // by FacultyDashboard's Attendance tab (replaced by Supabase bulk
  // save in supabase.js), left in place in case anything else uses it.
  const updateAttendance = async (studentId, subject, value, studentName = "", sem = "") => {
    setAttendance((p) => ({ ...p, [studentId]: { ...(p[studentId] || {}), [subject]: value } }));
    try {
      const { getDocs, query: q2, where, setDoc: sd, updateDoc: upd } = await import("firebase/firestore");
      const snap = await getDocs(q2(collection(db, "attendance"), where("studentId", "==", studentId)));
      if (snap.empty) {
        await sd(doc(db, "attendance", studentId), {
          studentId, studentName, sem,
          attendance: { [subject]: value },
          updatedAt: serverTimestamp(),
        });
      } else {
        await upd(snap.docs[0].ref, {
          [`attendance.${subject}`]: value,
          updatedAt: serverTimestamp(),
        });
      }
    } catch { try { await attendanceAPI.update(studentId, studentName, subject, sem, value); } catch {} }
  };

  const updateMark = async (studentId, subject, internalLabel, scored, total = 100, studentName = "", sem = "") => {
    setMarks((p) => ({
      ...p,
      [studentId]: {
        ...(p[studentId] || {}),
        [subject]: { ...(p[studentId]?.[subject] || {}), [internalLabel]: { scored, total } },
      },
    }));
    try {
      const { setDoc: sd } = await import("firebase/firestore");
      await sd(
        doc(db, "marks", studentId),
        {
          studentId, studentName, sem,
          marks: { [subject]: { [internalLabel]: { scored, total } } },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("updateMark:", e.message);
      try { await marksAPI.update(studentId, studentName, subject, sem, scored); } catch {}
    }
  };

  const updateMarksBulk = async (rows, sem = "") => {
    const grouped = {};
    rows.forEach((r) => {
      if (!r.studentId || !r.subject) return;
      const internalLabel = r.internal || "Internal 1";
      if (!grouped[r.studentId]) {
        grouped[r.studentId] = { studentName: r.studentName || "", marks: {} };
      }
      if (!grouped[r.studentId].marks[r.subject]) {
        grouped[r.studentId].marks[r.subject] = {};
      }
      grouped[r.studentId].marks[r.subject][internalLabel] = {
        scored: Number(r.scored) || 0,
        total: Number(r.total) || 100,
      };
    });

    setMarks((p) => {
      const next = { ...p };
      Object.entries(grouped).forEach(([studentId, g]) => {
        const prevSubjects = next[studentId] || {};
        const mergedSubjects = { ...prevSubjects };
        Object.entries(g.marks).forEach(([subject, internalsData]) => {
          mergedSubjects[subject] = { ...(prevSubjects[subject] || {}), ...internalsData };
        });
        next[studentId] = mergedSubjects;
      });
      return next;
    });

    const { setDoc: sd } = await import("firebase/firestore");
    const results = await Promise.allSettled(
      Object.entries(grouped).map(([studentId, g]) =>
        sd(
          doc(db, "marks", studentId),
          {
            studentId,
            studentName: g.studentName,
            sem,
            marks: g.marks,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    return { total: Object.keys(grouped).length, failed };
  };

  const addMarkSheetUpload = async (data, file) => {
    let fileUrl = null, fileName = data.file || "", fileSize = data.size || "";
    if (file) {
      const up = await uploadToCloudinary(file);
      fileUrl = up.fileUrl; fileName = up.fileName; fileSize = up.fileSize;
    }
    await addDoc(collection(db, "markSheetUploads"), {
      sem: data.sem,
      uploadedBy: data.uploadedBy,
      file: fileName,
      fileUrl,
      size: fileSize,
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString(),
    });
  };
  const removeMarkSheetUpload = async (id) => {
    try { await deleteDoc(doc(db, "markSheetUploads", String(id))); } catch {}
    setMarkSheetUploads((p) => p.filter((m) => m.id !== id));
  };

  // ── TIMETABLE — faculty uploads an image or PDF per semester; students
  // (and faculty) can view/download it. `timetables` is ordered by
  // createdAt desc (see the `listen` call above), so for any given
  // semester the FIRST matching entry is always the current/latest one —
  // older entries for that sem are kept as history rather than overwritten.
  const addTimetable = async (sem, file, uploadedBy) => {
    if (!file) throw new Error("A file is required to upload a timetable.");
    const up = await uploadToCloudinary(file);

    await addDoc(collection(db, "timetables"), {
      sem,
      fileUrl: up.fileUrl,
      fileName: up.fileName,
      size: up.fileSize,
      uploadedBy,
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString(),
    });

    await addDoc(collection(db, "notices"), {
      title:      `Timetable updated — ${sem}`,
      content:    `A new timetable has been uploaded for ${sem}`,
      tag:        "Academic",
      postedBy:   uploadedBy,
      postedRole: "faculty",
      targetType: "academic",
      year:       SEM_TO_YEAR[sem] || null,
      semester:   sem,
      semesters:  [sem],
      isBranchWide: false,
      createdAt:  serverTimestamp(),
      date:       new Date().toLocaleDateString(),
      time:       new Date().toLocaleTimeString(),
    });

    sendNotification({
      title: `Timetable updated — ${sem}`,
      body: `A new timetable has been uploaded for ${sem}`,
      url: "/timetable",
      role: "student",
      year: SEM_TO_YEAR[sem] || null,
      semester: sem,
    });
  };

  const removeTimetable = async (id) => {
    try { await deleteDoc(doc(db, "timetables", String(id))); } catch (e) { console.warn("removeTimetable:", e.message); }
    setTimetables((p) => p.filter((t) => t.id !== id));
  };

  const addAssignment = async (data, file = null) => {
    let fileUrl = null, fileName = null;
    if (file) {
      const up = await uploadToCloudinary(file);
      fileUrl = up.fileUrl; fileName = up.fileName;
    }
    await addDoc(collection(db, "assignments"), { ...data, fileUrl, file: fileName, createdAt: serverTimestamp() });

    await addDoc(collection(db, "notices"), {
      title:      `New Assignment — ${data.subject || data.title}`,
      content:    data.due ? `Due ${data.due}` : "Check the assignment details",
      tag:        "Academic",
      postedBy:   data.uploadedBy || data.postedBy || "Faculty",
      postedRole: "faculty",
      targetType: "academic",
      year:       SEM_TO_YEAR[data.sem] || null,
      semester:   data.sem || null,
      semesters:  data.sem ? [data.sem] : [],
      isBranchWide: false,
      createdAt:  serverTimestamp(),
      date:       new Date().toLocaleDateString(),
      time:       new Date().toLocaleTimeString(),
    });

    sendNotification({
      title: `New Assignment — ${data.subject || data.title}`,
      body: data.due ? `Due ${data.due}` : "Check the assignment details",
      url: "/student/assignments",
      role: "student",
      year: SEM_TO_YEAR[data.sem] || null,
      semester: data.sem || null,
    });
  };
  const removeAssignment = async (id) => {
    try { await deleteDoc(doc(db, "assignments", String(id))); } catch {}
    setAssignments((p) => p.filter((a) => a.id !== id));
  };

  const addEvent = async (event, organizer = "") => {
    await addDoc(collection(db, "events"), { ...event, organizer, joined: [], createdAt: serverTimestamp() });
  };
  const removeEvent = async (id) => {
    try { await deleteDoc(doc(db, "events", String(id))); } catch {}
    setEvents((p) => p.filter((e) => e.id !== id));
  };

  // ── JOIN EVENT ──
  // Students only. One join per student per event — enforced client-side
  // here AND server-side by a unique constraint on
  // event_registrations(event_id, student_id) in Supabase, so this can
  // never produce a duplicate registration even under a race condition.
  // There is no "leave"/"unjoin" path: once a student has joined, they
  // must contact the faculty member who hosted the event (event.organizer)
  // to be removed.
  //
  // user: the FULL user object (must include id, name, role, usn, sem).
  // note: optional note captured in the Join modal.
  // Returns { ok: true } on success, or { ok: false, error } on failure —
  // callers should surface `error` to the user rather than assuming success.
  const joinEvent = async (eventId, user, note = "") => {
    if (!user || user.role !== "student") {
      return { ok: false, error: "Only students can join events." };
    }

    const event = events.find((e) => e.id === eventId);
    const alreadyJoined = event ? (event.joined || []).includes(user.id) : false;
    if (alreadyJoined) {
      return { ok: false, error: "You have already joined this event." };
    }

    const result = await saveEventRegistration(eventId, event?.title || "", user, note, event?.tag || null);
    if (!result.ok) return result;

    setEvents((p) => p.map((e) =>
      e.id === eventId ? { ...e, joined: [...(e.joined || []), user.id] } : e
    ));

    return { ok: true };
  };

  const addComplaint = async (c) => {
    await addDoc(collection(db, "complaints"), {
      ...c, status: "Pending",
      date: new Date().toISOString().split("T")[0],
      createdAt: serverTimestamp(),
    });
  };
  const updateComplaintStatus = async (id, status) => {
    try { await updateDoc(doc(db, "complaints", String(id)), { status }); } catch {}
    setComplaints((p) => p.map((c) => c.id === id ? { ...c, status } : c));
  };
  const removeComplaint = async (id) => {
    try { await deleteDoc(doc(db, "complaints", String(id))); } catch {}
    setComplaints((p) => p.filter((c) => c.id !== id));
  };

  const addCompany = async (c) => {
    await addDoc(collection(db, "companies"), { ...c, createdAt: serverTimestamp() });
  };
  const removeCompany = async (id) => {
    try { await deleteDoc(doc(db, "companies", String(id))); } catch {}
    setCompanies((p) => p.filter((c) => c.id !== id));
  };
  const updateCompanyStatus = async (id, status) => {
    setCompanies((p) => p.map((c) => c.id === id ? { ...c, status } : c));
    try {
      await updateDoc(doc(db, "companies", String(id)), { status });
    } catch (e) {
      console.warn("updateCompanyStatus:", e.message);
    }
  };

  const updateCompany = async (id, updates) => {
    setCompanies((p) => p.map((c) => c.id === id ? { ...c, ...updates } : c));
    try {
      await updateDoc(doc(db, "companies", String(id)), { ...updates });
    } catch (e) {
      console.warn("updateCompany:", e.message);
    }
  };

  const addFundRequest    = (req) => setFundRequests((p) => [{ ...req, id: Date.now(), status: "Active", date: new Date().toISOString().split("T")[0] }, ...p]);
  const removeFundRequest = (id)  => setFundRequests((p) => p.filter((r) => r.id !== id));

  const addSemResource    = (sem, res) => setSemResources((p) => ({ ...p, [sem]: [{ ...res, id: Date.now() }, ...(p[sem] || [])] }));
  const removeSemResource = (sem, id)  => setSemResources((p) => ({ ...p, [sem]: (p[sem] || []).filter((r) => r.id !== id) }));

  const addDsa    = async (d) => { await addDoc(collection(db, "dsa"), { ...d, createdAt: serverTimestamp() }); };
  const removeDsa = async (id) => { try { await deleteDoc(doc(db, "dsa", String(id))); } catch {} setDsaList((p) => p.filter((d) => d.id !== id)); };

  const addAptitude    = async (q) => { await addDoc(collection(db, "aptitude"), { ...q, createdAt: serverTimestamp() }); };
  const removeAptitude = async (id) => { try { await deleteDoc(doc(db, "aptitude", String(id))); } catch {} setAptitude((p) => p.filter((q) => q.id !== id)); };

  const addPlacementUpload = async (item, file = null) => {
    let fileUrl  = item.fileUrl || null;
    let fileName = item.fileName || null;

    if (file) {
      const up = await uploadPlacementFile(file);
      fileUrl  = up.fileUrl;
      fileName = up.fileName;
    }

    const payload = {
      category:   item.category,
      title:      item.title,
      fileName,
      fileUrl,
      link:       item.link || null,
      status:     item.status || null,
      uploadedBy: item.uploadedBy,
      date:       item.date || new Date().toISOString().split("T")[0],
    };

    await addDoc(collection(db, "placementUploads"), { ...payload, createdAt: serverTimestamp() });
    sendNotification({
      title: `New Placement Resource — ${item.category}`,
      body: item.title,
      url: "/student/placement",
      role: "student",
    });
  };

  const removePlacementUpload = async (id) => {
    try {
      const item = placementUploads.find((u) => u.id === id);
      if (item?.fileUrl) await deletePlacementFile(item.fileUrl);
      await deleteDoc(doc(db, "placementUploads", String(id)));
    } catch (e) {
      console.warn("removePlacementUpload:", e.message);
    }
    setPlacementUploads((p) => p.filter((u) => u.id !== id));
  };

  const addPromotion = async (promo) => {
    const payload = {
      studentId:   promo.studentId,
      studentName: promo.studentName || "",
      fromYear:    promo.fromYear || "",
      fromSem:     promo.fromSem || "",
      toYear:      promo.toYear || "",
      toSem:       promo.toSem || "",
      acknowledged: false,
    };
    await addDoc(collection(db, "promotions"), { ...payload, createdAt: serverTimestamp() });
  };

  const acknowledgePromotion = async (id) => {
    setPromotions((p) => p.map((pr) => pr.id === id ? { ...pr, acknowledged: true } : pr));
    if (typeof id === "string" && id.startsWith("local-")) return;
    try { await updateDoc(doc(db, "promotions", String(id)), { acknowledged: true }); } catch {}
  };

  return (
    <LMSContext.Provider value={{
      subjects, addSubject, removeSubject,
      internals, setSubjectInternals,
      notes, addNote, removeNote, notesLoading,
      assignments, addAssignment, removeAssignment,
      attendance, updateAttendance,
      marks, updateMark, updateMarksBulk,
      markSheetUploads, addMarkSheetUpload, removeMarkSheetUpload,
      timetables, addTimetable, removeTimetable,
      events, addEvent, removeEvent, joinEvent,
      notices, addNotice, removeNotice,
      announcements, addAnnouncement, removeAnnouncement,
      notifyAcademicUpdate,
      gallery, addGalleryPhoto, removeGalleryPhoto,
      fundRequests, addFundRequest, removeFundRequest,
      semResources, addSemResource, removeSemResource,
      complaints, addComplaint, updateComplaintStatus, removeComplaint,
      companies, addCompany, removeCompany, updateCompanyStatus, companiesLoading,
      dsaList, addDsa, removeDsa,
      aptitude, addAptitude, removeAptitude,
      placementUploads, addPlacementUpload, removePlacementUpload,
      promotions, addPromotion, acknowledgePromotion,
    }}>
      {children}
    </LMSContext.Provider>
  );
}

export function useLMS() { return useContext(LMSContext); }