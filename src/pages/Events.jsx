import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const TAG_COLORS = {
  Technical: "bg-blue-500/20 text-blue-400",
  Lecture:   "bg-violet-500/20 text-violet-400",
  Cultural:  "bg-pink-500/20 text-pink-400",
  Sports:    "bg-green-500/20 text-green-400",
  Workshop:  "bg-amber-500/20 text-amber-400",
};

export default function Events() {
  const { user } = useAuth();
  const { events, addEvent, removeEvent, joinEvent } = useLMS();

  const isFaculty = user?.role === "faculty" || user?.role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [success, setSuccess]       = useState("");
  const [newEvent, setNewEvent]     = useState({
    title: "", desc: "", date: "", time: "",
    venue: "", tag: "Technical", googleFormUrl: "",
  });

  const handleAddEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      alert("Title and date are required.");
      return;
    }
    addEvent({ ...newEvent, organizer: user?.name });
    setNewEvent({ title: "", desc: "", date: "", time: "", venue: "", tag: "Technical", googleFormUrl: "" });
    setShowForm(false);
    setSuccess(`✅ "${newEvent.title}" has been hosted successfully! Students will see it now.`);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleJoin = (event) => {
    if (event.googleFormUrl) {
      window.open(event.googleFormUrl, "_blank");
    }
    joinEvent(event.id, user?.id);
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Events" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

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
              <button onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-medium transition-all cursor-pointer">
                {showForm ? "✕ Cancel" : "+ Host Event"}
              </button>
            </div>
          )}

          {showForm && isFaculty && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
              <h3 className="text-[var(--color-text-primary)] font-semibold">📅 Host New Event</h3>

              <input value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Event title *"
                className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm" />

              <textarea value={newEvent.desc}
                onChange={(e) => setNewEvent({ ...newEvent, desc: e.target.value })}
                placeholder="Event description" rows={3}
                className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm resize-none" />

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

              <div>
                <label className="text-[var(--color-text-secondary)] text-xs mb-1 block">
                  Google Form URL <span className="text-[var(--color-text-muted)]">(students will be redirected here when they click Join)</span>
                </label>
                <input value={newEvent.googleFormUrl}
                  onChange={(e) => setNewEvent({ ...newEvent, googleFormUrl: e.target.value })}
                  placeholder="https://forms.gle/your-form-link"
                  className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm" />
              </div>

              <button onClick={handleAddEvent}
                className="w-full py-3 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer">
                🚀 Host Event — Visible to All Students Now
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {events.length === 0 && (
              <div className="col-span-2 text-center py-12 text-[var(--color-text-muted)]">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-sm">No events yet. Faculty can host one above.</p>
              </div>
            )}
            {events.map((e) => {
              const joined = e.joined.includes(user?.id);
              return (
                <div key={e.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${TAG_COLORS[e.tag] || "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)]"}`}>
                      {e.tag}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-muted)] text-xs">{e.date}</span>
                      {isFaculty && (
                        <button onClick={() => removeEvent(e.id)}
                          className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors cursor-pointer text-sm">🗑️</button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[var(--color-text-primary)] font-bold text-base mb-1">{e.title}</h4>
                    <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">{e.desc}</p>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
                    {e.time   && <span>🕐 {e.time}</span>}
                    {e.venue  && <span>📍 {e.venue}</span>}
                    <span>👤 {e.organizer}</span>
                  </div>

                  {e.googleFormUrl && (
                    <div className="bg-[var(--color-accent-soft-bg)] border border-[var(--color-accent-solid)]/20 rounded-xl px-3 py-2 text-xs text-[var(--color-accent-soft-text)]">
                      📋 Registration form available — click Join to open
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[var(--color-text-muted)] text-xs">👥 {e.joined.length} joined</span>
                    <button onClick={() => handleJoin(e)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer
                        ${joined
                          ? "bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30"
                          : "bg-[var(--color-accent-solid)] hover:opacity-90 text-white"}`}>
                      {joined ? "✅ Joined (click to leave)" : e.googleFormUrl ? "📋 Join & Register →" : "Join Event →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </main>
      </div>
    </div>
  );
}