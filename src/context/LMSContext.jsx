import { createContext, useContext, useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, updateDoc,
} from "firebase/firestore";
import { attendanceAPI, marksAPI, sendNotification } from "../utils/api";
import { uploadPlacementFile, deletePlacementFile } from "../utils/supabase";

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

export function LMSProvider({ children }) {
  const [subjects, setSubjects]           = useState(INITIAL_SUBJECTS);
  const [notes, setNotes]                 = useState([]);
  const [notesLoading, setNotesLoading]   = useState(true);
  const [assignments, setAssignments]     = useState([]);
  const [attendance, setAttendance]       = useState({});
  const [marks, setMarks]                 = useState({});
  const [events, setEvents]               = useState([]);
  const [notices, setNotices]             = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // ── GALLERY — Firestore-synced + local fallback (survives failed/offline writes) ──
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

  // ── PROMOTIONS — notifies students when admin promotes them ──
  const [promotions, setPromotions]       = useState([]);

  // ── ALL FIRESTORE LISTENERS ───────────────────────────────────
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

    // Notes — real-time
    listen("notes", (data) => {
      setNotes(data);
      setNotesLoading(false);
    }, []);

    // Assignments
    listen("assignments", setAssignments, []);

    // Companies — no fake seed data; empty means genuinely empty
    listen("companies", (data) => {
      setCompanies(data);
      setCompaniesLoading(false);
    }, []);

    // Notices — real-time (all roles see this)
    listen("notices", setNotices, []);

    // Announcements — no fake seed data
    listen("announcements", setAnnouncements, []);

    // Gallery — real-time (Firestore-synced portion only; local fallback is separate)
    listen("gallery", setGalleryFirestore, []);

    // DSA — no fake seed data
    listen("dsa", setDsaList, []);

    // Aptitude — no fake seed data
    listen("aptitude", setAptitude, []);

    // Placement uploads
    listen("placementUploads", setPlacementUploads, []);

    // Promotions — real-time, so students see the popup as soon as admin promotes them
    listen("promotions", setPromotions, []);

    // Events — no fake seed data
    listen("events", setEvents, [], "date", "asc");

    // Complaints — no fake seed data; this was the source of the sync
    // confusion (Admin showed 0 while other sessions showed fake "Projector"
    // / "Wi-Fi" placeholder complaints that were never real submissions).
    listen("complaints", setComplaints, []);

    // Subjects
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

    // Marks from Firestore
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

    // Attendance from Firestore
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

  // ── SUBJECTS ──────────────────────────────────────────────────
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

  // ── NOTES — Cloudinary + Firestore ───────────────────────────
  // IMPORTANT: no blob-URL fallback here anymore. A blob: URL only exists in
  // the uploader's own browser tab's memory — it goes dead the instant the
  // page reloads or a new session starts. That's exactly why old notes
  // "wouldn't open" — they were saved with URLs that were never valid for
  // anyone but the original uploader, in that one session. If Cloudinary
  // fails now, the upload fails loudly instead of silently saving a broken link.
  const addNote = async (noteData, file) => {
    let fileUrl = null, fileName = noteData.file || "", fileSize = noteData.size || "";
    if (file) {
      const up = await uploadToCloudinary(file); // throws on failure — caller sees the real error
      fileUrl = up.fileUrl; fileName = up.fileName; fileSize = up.fileSize;
    }
    await addDoc(collection(db, "notes"), {
      subject: noteData.subject, type: noteData.type,
      sem: noteData.sem, uploadedBy: noteData.uploadedBy,
      file: fileName, fileUrl, size: fileSize,
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString(),
    });
    sendNotification({
      title: `New ${noteData.type} — ${noteData.subject}`,
      body: `Uploaded for ${noteData.sem}`,
      url: "/student/notes",
      role: "student",
    });
  };

  const removeNote = async (id) => {
    try { await deleteDoc(doc(db, "notes", String(id))); } catch {}
    setNotes((p) => p.filter((n) => n.id !== id));
  };

  // ── GALLERY — Cloudinary + Firestore, no blob fallback ──
  const addGalleryPhoto = async (photoData, file) => {
    let fileUrl = photoData.url || null;
    if (file) {
      fileUrl = (await uploadToCloudinary(file)).fileUrl; // throws on failure — no more blob fallback
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

  // ── NOTICES ───────────────────────────────────────────────────
  const addNotice = async (notice) => {
    await addDoc(collection(db, "notices"), {
      title:      notice.title,
      content:    notice.content || "",
      tag:        notice.tag || "Notice",
      postedBy:   notice.postedBy,
      postedRole: notice.postedRole || "admin",
      createdAt:  serverTimestamp(),
      date:       new Date().toLocaleDateString(),
      time:       new Date().toLocaleTimeString(),
    });
    sendNotification({
      title: `Notice: ${notice.tag || "New"}`,
      body: notice.title,
      url: "/notices",
    });
  };
  const removeNotice = async (id) => {
    try { await deleteDoc(doc(db, "notices", String(id))); } catch {}
    setNotices((p) => p.filter((n) => n.id !== id));
  };

  // ── ANNOUNCEMENTS ─────────────────────────────────────────────
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

  // ── ATTENDANCE ────────────────────────────────────────────────
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

  // ── MARKS ─────────────────────────────────────────────────────
  const updateMark = async (studentId, subject, scored, total = 100, studentName = "", sem = "") => {
    setMarks((p) => ({
      ...p,
      [studentId]: { ...(p[studentId] || {}), [subject]: { scored, total } },
    }));
    try {
      const { getDocs, query: q2, where, setDoc: sd, updateDoc: upd } = await import("firebase/firestore");
      const snap = await getDocs(q2(collection(db, "marks"), where("studentId", "==", studentId)));
      if (snap.empty) {
        await sd(doc(db, "marks", studentId), {
          studentId, studentName, sem,
          marks: { [subject]: { scored, total } },
          updatedAt: serverTimestamp(),
        });
      } else {
        await upd(snap.docs[0].ref, {
          [`marks.${subject}`]: { scored, total },
          updatedAt: serverTimestamp(),
        });
      }
    } catch { try { await marksAPI.update(studentId, studentName, subject, sem, scored); } catch {} }
  };

  // ── ASSIGNMENTS ───────────────────────────────────────────────
  // No blob fallback — same reasoning as addNote above.
  const addAssignment = async (data, file = null) => {
    let fileUrl = null, fileName = null;
    if (file) {
      const up = await uploadToCloudinary(file);
      fileUrl = up.fileUrl; fileName = up.fileName;
    }
    await addDoc(collection(db, "assignments"), { ...data, fileUrl, file: fileName, createdAt: serverTimestamp() });
    sendNotification({
      title: `New Assignment — ${data.subject || data.title}`,
      body: data.due ? `Due ${data.due}` : "Check the assignment details",
      url: "/student/assignments",
      role: "student",
    });
  };
  const removeAssignment = async (id) => {
    try { await deleteDoc(doc(db, "assignments", String(id))); } catch {}
    setAssignments((p) => p.filter((a) => a.id !== id));
  };

  // ── EVENTS ────────────────────────────────────────────────────
  const addEvent = async (event, organizer = "") => {
    await addDoc(collection(db, "events"), { ...event, organizer, joined: [], createdAt: serverTimestamp() });
  };
  const removeEvent = async (id) => {
    try { await deleteDoc(doc(db, "events", String(id))); } catch {}
    setEvents((p) => p.filter((e) => e.id !== id));
  };
  const joinEvent = async (eventId, userId) => {
    setEvents((p) => p.map((e) => {
      if (e.id !== eventId) return e;
      const already = (e.joined || []).includes(userId);
      return { ...e, joined: already ? e.joined.filter((x) => x !== userId) : [...(e.joined || []), userId] };
    }));
  };

  // ── COMPLAINTS ────────────────────────────────────────────────
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

  // ── COMPANIES ─────────────────────────────────────────────────
  const addCompany = async (c) => {
    await addDoc(collection(db, "companies"), { ...c, createdAt: serverTimestamp() });
  };
  const removeCompany = async (id) => {
    try { await deleteDoc(doc(db, "companies", String(id))); } catch {}
    setCompanies((p) => p.filter((c) => c.id !== id));
  };

  // ── FUND REQUESTS ─────────────────────────────────────────────
  const addFundRequest    = (req) => setFundRequests((p) => [{ ...req, id: Date.now(), status: "Active", date: new Date().toISOString().split("T")[0] }, ...p]);
  const removeFundRequest = (id)  => setFundRequests((p) => p.filter((r) => r.id !== id));

  // ── SEM RESOURCES ─────────────────────────────────────────────
  const addSemResource    = (sem, res) => setSemResources((p) => ({ ...p, [sem]: [{ ...res, id: Date.now() }, ...(p[sem] || [])] }));
  const removeSemResource = (sem, id)  => setSemResources((p) => ({ ...p, [sem]: (p[sem] || []).filter((r) => r.id !== id) }));

  // ── DSA ───────────────────────────────────────────────────────
  const addDsa    = async (d) => { await addDoc(collection(db, "dsa"), { ...d, createdAt: serverTimestamp() }); };
  const removeDsa = async (id) => { try { await deleteDoc(doc(db, "dsa", String(id))); } catch {} setDsaList((p) => p.filter((d) => d.id !== id)); };

  // ── APTITUDE ──────────────────────────────────────────────────
  const addAptitude    = async (q) => { await addDoc(collection(db, "aptitude"), { ...q, createdAt: serverTimestamp() }); };
  const removeAptitude = async (id) => { try { await deleteDoc(doc(db, "aptitude", String(id))); } catch {} setAptitude((p) => p.filter((q) => q.id !== id)); };

  // ── PLACEMENT UPLOADS — uses Supabase Storage, no blob-URL fallback ──
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

  // ── PROMOTIONS ────────────────────────────────────────────────
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
      notes, addNote, removeNote, notesLoading,
      assignments, addAssignment, removeAssignment,
      attendance, updateAttendance,
      marks, updateMark,
      events, addEvent, removeEvent, joinEvent,
      notices, addNotice, removeNotice,
      announcements, addAnnouncement, removeAnnouncement,
      gallery, addGalleryPhoto, removeGalleryPhoto,
      fundRequests, addFundRequest, removeFundRequest,
      semResources, addSemResource, removeSemResource,
      complaints, addComplaint, updateComplaintStatus, removeComplaint,
      companies, addCompany, removeCompany, companiesLoading,
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