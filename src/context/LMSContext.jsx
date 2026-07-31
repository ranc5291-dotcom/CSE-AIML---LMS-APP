import { createContext, useContext, useState, useEffect } from "react";
import { db } from "../utils/firebase";
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, updateDoc,
} from "firebase/firestore";
import { attendanceAPI, marksAPI } from "../utils/api";
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
  const [attendance, setAttendance]       = useState({
    STU001: { "Machine Learning": 85, "AI": 90, "Cloud Computing": 78, "Mobile App Dev": 92 },
    STU002: { "DBMS": 88, "OS": 75, "Computer Networks": 91, "OOP with Java": 83 },
    STU003: { "Mathematics I": 95, "Physics": 80, "C Programming": 88, "English": 100 },
  });
  const [marks, setMarks]                 = useState({
    STU001: { "Machine Learning": { scored: 78, total: 100 }, "AI": { scored: 82, total: 100 }, "Cloud Computing": { scored: 74, total: 100 }, "Mobile App Dev": { scored: 88, total: 100 } },
    STU002: { "DBMS": { scored: 85, total: 100 }, "OS": { scored: 70, total: 100 }, "Computer Networks": { scored: 90, total: 100 }, "OOP with Java": { scored: 77, total: 100 } },
    STU003: { "Mathematics I": { scored: 92, total: 100 }, "Physics": { scored: 76, total: 100 }, "C Programming": { scored: 84, total: 100 }, "English": { scored: 95, total: 100 } },
  });
  const [events, setEvents]               = useState([]);
  const [notices, setNotices]             = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // ── GALLERY — Firestore-synced + local fallback (survives failed/offline writes) ──
  const [galleryFirestore, setGalleryFirestore] = useState([]);
  const [galleryFallback, setGalleryFallback]   = useState([]);
  const gallery = [...galleryFallback, ...galleryFirestore];

  const [fundRequests, setFundRequests]   = useState([
    { id: 1, hostName: "Student Council", reason: "Annual Cultural Fest", totalAmount: 15000, perPerson: 300, totalStudents: 50, status: "Active", date: "2026-05-20" },
  ]);
  const [semResources, setSemResources]   = useState({});
  const [complaints, setComplaints]       = useState([]);
  const [companies, setCompanies]         = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [dsaList, setDsaList]             = useState([]);
  const [aptitude, setAptitude]           = useState([
    { id: "apt-1", question: "A train travels 60 km in 1 hour. How long to travel 300 km?", options: ["3 hrs", "4 hrs", "5 hrs", "6 hrs"], answer: 2 },
    { id: "apt-2", question: "What is 15% of 200?", options: ["25", "30", "35", "40"], answer: 1 },
  ]);
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

    // Companies
    listen("companies", (data) => {
      setCompanies(data.length > 0 ? data : [
        { id: "g1", name: "Google",  role: "SWE Intern",       package: "₹12 LPA", deadline: "2026-06-01", status: "Open", eligibility: "8.0+ CGPA, No backlogs", description: "Software engineering internship", googleFormUrl: "" },
        { id: "t1", name: "TCS",     role: "Systems Engineer",  package: "₹7 LPA",  deadline: "2026-06-10", status: "Open", eligibility: "6.0+ CGPA, 2026 batch",   description: "Systems engineering role",        googleFormUrl: "" },
      ]);
      setCompaniesLoading(false);
    }, []);

    // Notices — real-time (all roles see this)
    listen("notices", setNotices, []);

    // Announcements
    listen("announcements", (data) => {
      setAnnouncements(data.length > 0 ? data : [
        { id: "a1", title: "Mid Semester Exam Schedule Released", tag: "Exam",  postedBy: "Admin",      time: "2 hours ago" },
        { id: "a2", title: "Guest Lecture on GenAI — Hall B, 3PM", tag: "Event", postedBy: "Dr. Sharma", time: "Today" },
      ]);
    }, []);

    // Gallery — real-time (Firestore-synced portion only; local fallback is separate)
    listen("gallery", setGalleryFirestore, []);

    // DSA
    listen("dsa", (data) => {
      setDsaList(data.length > 0 ? data : [
        { id: "d1", title: "Two Sum",            difficulty: "Easy", topic: "Arrays",      link: "https://leetcode.com/problems/two-sum/" },
        { id: "d2", title: "Merge K Sorted Lists", difficulty: "Hard", topic: "Linked List", link: "#" },
      ]);
    }, []);

    // Aptitude
    listen("aptitude", (data) => { if (data.length > 0) setAptitude(data); }, []);

    // Placement uploads
    listen("placementUploads", setPlacementUploads, []);

    // Promotions — real-time, so students see the popup as soon as admin promotes them
    listen("promotions", setPromotions, []);

    // Events
    listen("events", (data) => {
      setEvents(data.length > 0 ? data : [
        { id: "e1", title: "Hackathon 2026", desc: "24-hour coding.", date: "2026-06-05", time: "9:00 AM", venue: "Main Hall",     organizer: "Dr. Sharma", joined: [], tag: "Technical" },
        { id: "e2", title: "AI Guest Lecture", desc: "Expert from Google.", date: "2026-05-28", time: "3:00 PM", venue: "Seminar Hall B", organizer: "Prof. Mehta", joined: [], tag: "Lecture" },
      ]);
    }, [], "date", "asc");

    // Complaints
    listen("complaints", (data) => {
      setComplaints(data.length > 0 ? data : [
        { id: "c1", title: "Projector not working in Room 301", desc: "Non-functional for 2 weeks.", category: "Infrastructure", by: "Ram Kumar",    status: "Pending",     date: "2026-05-18" },
        { id: "c2", title: "Wi-Fi very slow in lab",            desc: "Extremely slow.",             category: "Technical",      by: "Priya Sharma", status: "In Progress", date: "2026-05-20" },
      ]);
    }, []);

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
  const addNote = async (noteData, file) => {
    try {
      let fileUrl = null, fileName = noteData.file || "", fileSize = noteData.size || "";
      if (file) {
        try {
          const up = await uploadToCloudinary(file);
          fileUrl = up.fileUrl; fileName = up.fileName; fileSize = up.fileSize;
        } catch {
          fileUrl  = URL.createObjectURL(file);
          fileName = file.name;
          fileSize = (file.size / 1024).toFixed(1) + " KB";
        }
      }
      await addDoc(collection(db, "notes"), {
        subject: noteData.subject, type: noteData.type,
        sem: noteData.sem, uploadedBy: noteData.uploadedBy,
        file: fileName, fileUrl, size: fileSize,
        createdAt: serverTimestamp(),
        date: new Date().toLocaleDateString(),
      });
    } catch (err) {
      const local = { ...noteData, id: Date.now(), date: "Just now", fileUrl: file ? URL.createObjectURL(file) : null };
      setNotes((p) => [local, ...p]);
    }
  };

  const removeNote = async (id) => {
    try { await deleteDoc(doc(db, "notes", String(id))); } catch {}
    setNotes((p) => p.filter((n) => n.id !== id));
  };

  // ── GALLERY — Cloudinary + Firestore, with local fallback on failure ──
  const addGalleryPhoto = async (photoData, file) => {
    let fileUrl = photoData.url || null;
    if (file) {
      try {
        const up = await uploadToCloudinary(file);
        fileUrl = up.fileUrl;
      } catch (cloudErr) {
        console.warn("Gallery: Cloudinary upload failed, using local blob URL instead:", cloudErr.message);
        fileUrl = URL.createObjectURL(file);
      }
    }

    const dateStr = new Date().toLocaleDateString();

    try {
      await addDoc(collection(db, "gallery"), {
        caption:    photoData.caption || "",
        uploadedBy: photoData.uploadedBy || "",
        category:   photoData.category || "General",
        url:        fileUrl,
        createdAt:  serverTimestamp(),
        date:       dateStr,
      });
    } catch (err) {
      console.error("Gallery upload failed to sync to Firestore:", err.code || "", err.message);
      setGalleryFallback((p) => [
        { id: "local-" + Date.now(), caption: photoData.caption || "", uploadedBy: photoData.uploadedBy || "", category: photoData.category || "General", url: fileUrl, date: dateStr },
        ...p,
      ]);
      throw err;
    }
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
    try {
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
    } catch {
      setNotices((p) => [{ ...notice, id: Date.now(), date: new Date().toLocaleDateString() }, ...p]);
    }
  };
  const removeNotice = async (id) => {
    try { await deleteDoc(doc(db, "notices", String(id))); } catch {}
    setNotices((p) => p.filter((n) => n.id !== id));
  };

  // ── ANNOUNCEMENTS ─────────────────────────────────────────────
  const addAnnouncement = async (a) => {
    try {
      await addDoc(collection(db, "announcements"), {
        title: a.title, tag: a.tag, postedBy: a.postedBy,
        time: new Date().toLocaleTimeString(), createdAt: serverTimestamp(),
      });
    } catch {
      setAnnouncements((p) => [{ ...a, id: Date.now(), time: "Just now" }, ...p]);
    }
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
  const addAssignment = async (data, file = null) => {
    try {
      let fileUrl = null, fileName = null;
      if (file) {
        try { const up = await uploadToCloudinary(file); fileUrl = up.fileUrl; fileName = up.fileName; }
        catch { fileUrl = URL.createObjectURL(file); fileName = file.name; }
      }
      await addDoc(collection(db, "assignments"), { ...data, fileUrl, file: fileName, createdAt: serverTimestamp() });
    } catch {
      setAssignments((p) => [{ ...data, id: Date.now() }, ...p]);
    }
  };
  const removeAssignment = async (id) => {
    try { await deleteDoc(doc(db, "assignments", String(id))); } catch {}
    setAssignments((p) => p.filter((a) => a.id !== id));
  };

  // ── EVENTS ────────────────────────────────────────────────────
  const addEvent = async (event, organizer = "") => {
    try { await addDoc(collection(db, "events"), { ...event, organizer, joined: [], createdAt: serverTimestamp() }); }
    catch { setEvents((p) => [{ ...event, id: Date.now(), joined: [] }, ...p]); }
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
    try {
      await addDoc(collection(db, "complaints"), {
        ...c, status: "Pending",
        date: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
      });
    } catch {
      setComplaints((p) => [{ ...c, id: Date.now(), status: "Pending", date: new Date().toISOString().split("T")[0] }, ...p]);
    }
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
    try { await addDoc(collection(db, "companies"), { ...c, createdAt: serverTimestamp() }); }
    catch { setCompanies((p) => [{ ...c, id: String(Date.now()) }, ...p]); }
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
  const addDsa    = async (d) => { try { await addDoc(collection(db, "dsa"), { ...d, createdAt: serverTimestamp() }); } catch { setDsaList((p) => [{ ...d, id: Date.now() }, ...p]); } };
  const removeDsa = async (id) => { try { await deleteDoc(doc(db, "dsa", String(id))); } catch {} setDsaList((p) => p.filter((d) => d.id !== id)); };

  // ── APTITUDE ──────────────────────────────────────────────────
  const addAptitude    = async (q) => { try { await addDoc(collection(db, "aptitude"), { ...q, createdAt: serverTimestamp() }); } catch { setAptitude((p) => [{ ...q, id: Date.now() }, ...p]); } };
  const removeAptitude = async (id) => { try { await deleteDoc(doc(db, "aptitude", String(id))); } catch {} setAptitude((p) => p.filter((q) => q.id !== id)); };

  // ── PLACEMENT UPLOADS — now uses Supabase Storage, no blob-URL fallback ──
  const addPlacementUpload = async (item, file = null) => {
    let fileUrl  = item.fileUrl || null;
    let fileName = item.fileName || null;

    if (file) {
      // No try/catch swallow here on purpose: if this fails, we want the
      // caller (PlacementDashboard's handleUpload) to see the real error
      // via its own catch block, instead of silently saving a blob URL
      // that would break for every other user.
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

    try {
      await addDoc(collection(db, "placementUploads"), { ...payload, createdAt: serverTimestamp() });
    } catch (err) {
      console.warn("addPlacementUpload (Firestore write failed):", err.message);
      setPlacementUploads((p) => [{ ...payload, id: Date.now() }, ...p]);
    }
  };

  const removePlacementUpload = async (id) => {
    try {
      // Look up the item first so we can also delete its file from Storage
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
    try {
      await addDoc(collection(db, "promotions"), { ...payload, createdAt: serverTimestamp() });
    } catch (err) {
      console.warn("addPromotion:", err.message);
      setPromotions((p) => [{ ...payload, id: "local-" + Date.now() }, ...p]);
    }
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