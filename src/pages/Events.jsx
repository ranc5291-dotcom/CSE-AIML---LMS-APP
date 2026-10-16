import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { sendNotification } from "../utils/api";

const TAG_COLORS = {
  Technical: "bg-blue-500/20 text-blue-400",
  Lecture:   "bg-violet-500/20 text-violet-400",
  Cultural:  "bg-pink-500/20 text-pink-400",
  Sports:    "bg-green-500/20 text-green-400",
  Workshop:  "bg-amber-500/20 text-amber-400",
};

const HIGHLIGHT_PRESETS = [
  "🏆 Prizes", "📜 Certificates", "🍕 Free Food", "🎁 Goodies / Swag",
  "🎤 Guest Speaker", "🛠️ Hands-on", "👥 Team Event", "🤝 Networking",
  "💼 Placement Opportunity", "🎥 Live Demo",
];

const EMPTY_EVENT = {
  title: "", desc: "", date: "", time: "",
  venue: "", tag: "Technical", googleFormUrl: "",
  eventType: "Technical",
  organizerPhone: "", organizerEmail: "",
  extraDates: [],
  poster: "",
  highlights: [],
  registrationOpen: true,
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getEventDates = (e) =>
  (e.dates && e.dates.length ? e.dates : [e.date]).filter(Boolean);

// Closed if the organizer closed it, or if the last date has passed.
const getEventStatus = (e) => {
  if (e.registrationOpen === false) return { closed: true, ended: false };
  const last = [...getEventDates(e)].sort().pop();
  if (last && last < todayStr()) return { closed: true, ended: true };
  return { closed: false, ended: false };
};

// 2026-10-29 -> 29 Oct 2026
const fmtDate = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
};

// Removes trailing "." "," ";" and spaces from phone/email text.
const cleanContact = (s) => String(s || "").trim().replace(/[.,;\s]+$/, "");

// Trims spaces and adds https:// if missing
const normalizeUrl = (u) => {
  const s = String(u || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

export default function Events() {
  const { user } = useAuth();
  const { events, addEvent, removeEvent, updateEvent, joinEvent } = useLMS();

  const isFaculty = user?.role === "faculty" || user?.role === "admin";
  const isStudent = user?.role === "student";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);   // null = hosting new, id = editing
  const [success, setSuccess]       = useState("");
  const [newEvent, setNewEvent]     = useState(EMPTY_EVENT);
  const [customHighlight, setCustomHighlight] = useState("");
  const [expanded, setExpanded]     = useState({});
  const posterInputRef = useRef(null);
  const mainRef = useRef(null);

  // ── NEW: scroll to + highlight the event clicked on the dashboard ──
  // If we arrived from the dashboard's "Upcoming Events" strip, scroll to
  // that event's card and briefly highlight it.
  const location = useLocation();
  const targetEventId = location.state?.eventId;

  useEffect(() => {
    if (!targetEventId || events.length === 0) return;
    const el = document.getElementById(`event-${targetEventId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[var(--color-accent-solid)]");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-[var(--color-accent-solid)]");
    }, 2000);
    return () => clearTimeout(t);
  }, [targetEventId, events.length]);

  // ── Join modal ──
  const [joinModalEvent, setJoinModalEvent] = useState(null);
  const [joinNote, setJoinNote] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const addExtraDate = () =>
    setNewEvent((p) => ({ ...p, extraDates: [...p.extraDates, ""] }));
  const updateExtraDate = (i, v) =>
    setNewEvent((p) => ({ ...p, extraDates: p.extraDates.map((d, idx) => (idx === i ? v : d)) }));
  const removeExtraDate = (i) =>
    setNewEvent((p) => ({ ...p, extraDates: p.extraDates.filter((_, idx) => idx !== i) }));

  const toggleHighlight = (h) =>
    setNewEvent((p) => ({
      ...p,
      highlights: p.highlights.includes(h) ? p.highlights.filter((x) => x !== h) : [...p.highlights, h],
    }));

  const addCustomHighlight = () => {
    const v = customHighlight.trim();
    if (!v) return;
    setNewEvent((p) => (p.highlights.includes(v) ? p : { ...p, highlights: [...p.highlights, v] }));
    setCustomHighlight("");
  };

  const handlePosterChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = 0.75;
        let url = canvas.toDataURL("image/jpeg", q);
        while (url.length > 600000 && q > 0.3) {
          q -= 0.15;
          url = canvas.toDataURL("image/jpeg", q);
        }
        setNewEvent((p) => ({ ...p, poster: url }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setNewEvent(EMPTY_EVENT);
    setCustomHighlight("");
    setEditingId(null);
    if (posterInputRef.current) posterInputRef.current.value = "";
  };

  const toggleForm = () => {
    if (showForm) { resetForm(); setShowForm(false); }
    else { resetForm(); setShowForm(true); }
  };

  // Opens the form pre-filled with an existing event
  const startEdit = (e) => {
    const dates = [...getEventDates(e)].sort();
    setNewEvent({
      title: e.title || "",
      desc: e.desc || "",
      date: dates[0] || "",
      extraDates: dates.slice(1),
      time: e.time || "",
      venue: e.venue || "",
      tag: e.tag || "Technical",
      eventType: e.eventType || "Technical",
      googleFormUrl: e.googleFormUrl || "",
      organizerPhone: e.organizerPhone || "",
      organizerEmail: e.organizerEmail || "",
      poster: e.poster || "",
      highlights: e.highlights || [],
      registrationOpen: e.registrationOpen !== false,
    });
    setCustomHighlight("");
    setEditingId(e.id);
    setShowForm(true);
    setTimeout(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const buildPayload = () => {
    const { extraDates, ...rest } = newEvent;
    const dates = Array.from(new Set([newEvent.date, ...extraDates.filter(Boolean)])).sort();
    return {
      ...rest,
      title: rest.title.trim(),
      desc: rest.desc,
      date: dates[0],
      dates,
      googleFormUrl: normalizeUrl(rest.googleFormUrl),
      organizerPhone: cleanContact(rest.organizerPhone),
      organizerEmail: cleanContact(rest.organizerEmail),
    };
  };

  const handleSaveEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      alert("Title and date are required.");
      return;
    }
    const email = cleanContact(newEvent.organizerEmail);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      alert("Please enter a valid organizer email.");
      return;
    }

    const payload = buildPayload();

    if (editingId) {
      updateEvent(editingId, payload);
      setSuccess(`✅ "${payload.title}" has been updated.`);
    } else {
      addEvent({ ...payload, organizer: user?.name }, user?.name);
      sendNotification({
        title: `New Event: ${payload.title}`,
        body: payload.desc || `Hosted by ${user?.name} on ${payload.date}`,
        url: "/events",
        role: "student",
      });
      setSuccess(`✅ "${payload.title}" has been hosted successfully! Students will see it now.`);
    }

    resetForm();
    setShowForm(false);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleJoin = (event) => {
    if (!isStudent) return;
    if (getEventStatus(event).closed) return;
    if ((event.joined || []).includes(user?.id)) return;

    if (event.googleFormUrl) {
      window.open(normalizeUrl(event.googleFormUrl), "_blank", "noopener,noreferrer");
    }
    setJoinModalEvent(event);
    setJoinNote("");
    setJoinError("");
  };

  const confirmJoin = async () => {
    if (!joinModalEvent) return;
    setJoining(true);
    setJoinError("");
    const result = await joinEvent(joinModalEvent.id, user, joinNote);
    setJoining(false);
    if (!result.ok) {
      setJoinError(result.error || "Could not join the event. Please try again.");
      return;
    }
    setJoinModalEvent(null);
    setJoinNote("");
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Events" />
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 space-y-5 min-w-0">

          <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] rounded-2xl p-5 text-white">
            <p className="text-white/80 text-sm mb-1">Branch Events 📣</p>
            <h2 className="text-2xl font-bold">Upcoming Events</h2>
            <p className="text-white/80 text-sm mt-1">Join events happening in your branch</p>
          </div>

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
              {success}
            </div>
          )}

          {isFaculty && (
            <div className="flex justify-end">
              <button onClick={toggleForm}
                className="px-4 py-2 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-medium transition-all cursor-pointer">
                {showForm ? "✕ Cancel" : "+ Host Event"}
              </button>
            </div>
          )}

          {showForm && isFaculty && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
              <h3 className="text-[var(--color-text-primary)] font-semibold">
                {editingId ? "✏️ Edit Event" : "📅 Host New Event"}
              </h3>

              <input value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Event title *"
                className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm" />

              <textarea value={newEvent.desc}
                onChange={(e) => setNewEvent({ ...newEvent, desc: e.target.value })}
                placeholder="Event description" rows={5}
                className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm resize-y" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">Date *</label>
                  <input type="date" value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)]" />
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">Time</label>
                  <input value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    placeholder="e.g. 3:00 PM"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">Venue</label>
                  <input value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                    placeholder="e.g. Hall A"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">Category</label>
                  <select value={newEvent.tag}
                    onChange={(e) => setNewEvent({ ...newEvent, tag: e.target.value })}
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] cursor-pointer">
                    {Object.keys(TAG_COLORS).map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Additional dates */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[var(--color-text-secondary)] text-xs">
                    Additional dates <span className="text-[var(--color-text-muted)]">(if the event runs on multiple days)</span>
                  </label>
                  <button type="button" onClick={addExtraDate}
                    className="text-[var(--color-accent-soft-text)] text-xs font-medium hover:opacity-80 cursor-pointer">
                    + Add another date
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newEvent.extraDates.map((d, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input type="date" value={d} onChange={(e) => updateExtraDate(i, e.target.value)}
                        className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)]" />
                      <button type="button" onClick={() => removeExtraDate(i)}
                        className="text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer text-sm">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event type + registration + organizer contact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">Event Type</label>
                  <select value={newEvent.eventType}
                    onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] cursor-pointer">
                    <option>Technical</option>
                    <option>Non-Technical</option>
                    <option>Both (Tech & Non-Tech)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">Registration</label>
                  <select value={newEvent.registrationOpen ? "open" : "closed"}
                    onChange={(e) => setNewEvent({ ...newEvent, registrationOpen: e.target.value === "open" })}
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] cursor-pointer">
                    <option value="open">🟢 Open</option>
                    <option value="closed">🔴 Closed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                    Organizer Phone <span className="text-[var(--color-text-muted)]">(optional)</span>
                  </label>
                  <input type="tel" value={newEvent.organizerPhone}
                    onChange={(e) => setNewEvent({ ...newEvent, organizerPhone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                    Organizer Email <span className="text-[var(--color-text-muted)]">(optional)</span>
                  </label>
                  <input type="email" value={newEvent.organizerEmail}
                    onChange={(e) => setNewEvent({ ...newEvent, organizerEmail: e.target.value })}
                    placeholder="e.g. name@college.edu"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                </div>
              </div>

              {/* Highlights */}
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                  What's exciting about this event? <span className="text-[var(--color-text-muted)]">(pick any, or add your own)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[...HIGHLIGHT_PRESETS, ...newEvent.highlights.filter((h) => !HIGHLIGHT_PRESETS.includes(h))].map((h) => (
                    <button key={h} type="button" onClick={() => toggleHighlight(h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all
                        ${newEvent.highlights.includes(h)
                          ? "bg-[var(--color-accent-solid)] text-white"
                          : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                      {h}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customHighlight}
                    onChange={(e) => setCustomHighlight(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomHighlight(); } }}
                    placeholder="Add your own, e.g. 🎮 Gaming zone"
                    className="flex-1 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                  <button type="button" onClick={addCustomHighlight}
                    className="px-4 py-2 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-xs font-medium cursor-pointer">
                    + Add
                  </button>
                </div>
              </div>

              {/* Poster */}
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                  Event Poster <span className="text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <div onClick={() => posterInputRef.current?.click()}
                  className={`w-full border border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer
                    ${newEvent.poster ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-soft-bg)]" : "border-[var(--color-border)]"}`}>
                  {newEvent.poster
                    ? <img src={newEvent.poster} alt="Poster preview" className="h-16 w-12 object-cover rounded-lg" />
                    : <span className="text-xl">🖼️</span>}
                  <p className="text-[var(--color-text-secondary)] text-xs flex-1">
                    {newEvent.poster ? "Poster added — click to change" : "Click to upload a poster image"}
                  </p>
                  {newEvent.poster && (
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setNewEvent({ ...newEvent, poster: "" }); if (posterInputRef.current) posterInputRef.current.value = ""; }}
                      className="text-[var(--color-text-muted)] hover:text-red-400 text-xs cursor-pointer">✕</button>
                  )}
                  <input ref={posterInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handlePosterChange(e.target.files[0])} />
                </div>
              </div>

              {/* Link */}
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                  Registration / Event page URL <span className="text-[var(--color-text-muted)]">(students are taken here when they click Join)</span>
                </label>
                <input value={newEvent.googleFormUrl}
                  onChange={(e) => setNewEvent({ ...newEvent, googleFormUrl: e.target.value })}
                  placeholder="https://forms.gle/your-form-link"
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm" />
              </div>

              <div className="flex gap-3">
                {editingId && (
                  <button onClick={() => { resetForm(); setShowForm(false); }}
                    className="flex-1 py-3 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-sm font-semibold cursor-pointer">
                    Cancel
                  </button>
                )}
                <button onClick={handleSaveEvent}
                  className="flex-1 py-3 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer">
                  {editingId ? "💾 Save Changes" : "🚀 Host Event — Visible to All Students Now"}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {events.length === 0 && (
              <div className="col-span-2 text-center py-12 text-[var(--color-text-muted)]">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-sm">No events yet. Faculty can host one above.</p>
              </div>
            )}
            {events.map((e) => {
              const joinedList = e.joined || [];
              const joined = joinedList.includes(user?.id);
              const status = getEventStatus(e);
              const dates  = [...getEventDates(e)].sort();
              const phone  = cleanContact(e.organizerPhone);
              const email  = cleanContact(e.organizerEmail);
              const isOpen = !!expanded[e.id];
              const longDesc = (e.desc || "").length > 220;

              return (
                <div key={e.id} id={`event-${e.id}`} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden flex flex-col min-w-0 transition-shadow">
                  {e.poster && (
                    <div className="bg-black/30 flex items-center justify-center">
                      <img src={e.poster} alt={`${e.title} poster`} className="w-full max-h-96 object-contain" />
                    </div>
                  )}

                  <div className="p-5 flex flex-col gap-4 flex-1 min-w-0">

                    {/* Badges + edit/delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${TAG_COLORS[e.tag] || "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                          {e.tag}
                        </span>
                        {e.eventType && (
                          <span className="text-xs px-2 py-1 rounded-lg font-medium bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]">
                            {e.eventType}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium
                          ${status.closed ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                          {status.closed ? (status.ended ? "🔴 Ended" : "🔴 Closed") : "🟢 Open"}
                        </span>
                      </div>
                      {isFaculty && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => startEdit(e)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 cursor-pointer transition-all">
                            ✏️ Edit
                          </button>
                          <button onClick={() => { if (window.confirm(`Delete "${e.title}"?`)) removeEvent(e.id); }}
                            className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors cursor-pointer text-sm">🗑️</button>
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-[var(--color-text-primary)] font-bold text-base leading-snug break-words">{e.title}</h4>

                    {/* When & where */}
                    <div className="bg-[var(--color-bg-surface-alt)] rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs mt-1">📅</span>
                        <div className="flex flex-wrap gap-1.5">
                          {dates.map((d) => (
                            <span key={d} className="text-xs px-2 py-1 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium">
                              {fmtDate(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {e.time && <p className="text-xs text-[var(--color-text-secondary)]">🕐 {e.time}</p>}
                      {e.venue && <p className="text-xs text-[var(--color-text-secondary)] break-words">📍 {e.venue}</p>}
                    </div>

                    {/* Description */}
                    {e.desc && (
                      <div>
                        <p className={`text-[var(--color-text-secondary)] text-xs leading-relaxed whitespace-pre-line break-words ${isOpen ? "" : "line-clamp-3"}`}>
                          {e.desc}
                        </p>
                        {longDesc && (
                          <button onClick={() => setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                            className="text-[var(--color-accent-soft-text)] text-xs font-medium mt-1 hover:opacity-80 cursor-pointer">
                            {isOpen ? "Show less ▲" : "Read more ▼"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Highlights */}
                    {e.highlights && e.highlights.length > 0 && (
                      <div>
                        <p className="text-[var(--color-text-muted)] text-[10px] font-medium uppercase tracking-wider mb-1.5">Highlights</p>
                        <div className="flex flex-wrap gap-1.5">
                          {e.highlights.map((h) => (
                            <span key={h} className="text-[11px] px-2 py-1 rounded-lg bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] font-medium">
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Organizer */}
                    <div className="border-t border-[var(--color-border)] pt-3 space-y-1.5 text-xs">
                      <p className="text-[var(--color-text-muted)] text-[10px] font-medium uppercase tracking-wider">Organizer</p>
                      <p className="text-[var(--color-text-secondary)]">👤 {e.organizer}</p>
                      {phone && (
                        <p><a href={`tel:${phone}`} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">📱 {phone}</a></p>
                      )}
                      {email && (
                        <p><a href={`mailto:${email}`} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] break-all">📧 {email}</a></p>
                      )}
                    </div>

                    {/* Event / registration link */}
                    {e.googleFormUrl && (
                      <a href={normalizeUrl(e.googleFormUrl)} target="_blank" rel="noreferrer"
                        className="block bg-[var(--color-accent-soft-bg)] border border-[var(--color-accent-solid)]/20 rounded-xl px-3 py-2 text-xs text-[var(--color-accent-soft-text)] font-medium hover:opacity-80">
                        🔗 {isStudent && !status.closed ? "Registration / event page" : "Event page"} →
                      </a>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 flex-wrap mt-auto pt-1">
                      <span className="text-[var(--color-text-muted)] text-xs">👥 {joinedList.length} joined</span>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isFaculty && !status.ended && (
                          <button
                            onClick={() => updateEvent(e.id, { registrationOpen: e.registrationOpen === false })}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all
                              ${e.registrationOpen === false
                                ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                                : "bg-red-600/20 text-red-400 hover:bg-red-600/30"}`}>
                            {e.registrationOpen === false ? "🟢 Reopen Registration" : "🔴 Close Registration"}
                          </button>
                        )}

                        {isStudent && (
                          joined ? (
                            <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600/20 border border-green-500/30 text-green-400 text-right">
                              ✅ You have joined — contact {e.organizer} to cancel
                            </span>
                          ) : status.closed ? (
                            <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400">
                              🔒 {status.ended ? "Event ended" : "Registration closed"}
                            </span>
                          ) : (
                            <button onClick={() => handleJoin(e)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer bg-[var(--color-accent-solid)] hover:opacity-90 text-white flex-shrink-0">
                              {e.googleFormUrl ? "📋 Join & Register →" : "Join Event →"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </main>
      </div>

      {/* Join Event modal */}
      {joinModalEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-[var(--color-text-primary)] font-bold text-lg">Join "{joinModalEvent.title}"</h3>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">
                {user?.name} · {user?.usn || user?.id} · {user?.sem || "—"}
              </p>
              <p className="text-[var(--color-text-muted)] text-xs mt-2">
                Once you join, you won't be able to cancel here — contact {joinModalEvent.organizer} if you need to withdraw.
              </p>
            </div>

            <div>
              <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                Note <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <textarea
                value={joinNote}
                onChange={(e) => setJoinNote(e.target.value)}
                placeholder="Anything the organizer should know..."
                rows={3}
                className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm resize-none"
              />
            </div>

            {joinError && <p className="text-red-400 text-xs">{joinError}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setJoinModalEvent(null); setJoinError(""); }}
                disabled={joining}
                className="flex-1 py-2.5 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-sm cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button onClick={confirmJoin}
                disabled={joining}
                className="flex-1 py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50">
                {joining ? "Joining..." : "Confirm Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}