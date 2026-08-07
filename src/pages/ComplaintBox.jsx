import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { saveComplaint, saveAnnouncement } from "../utils/supabase";

const CATEGORIES = ["Academic", "Infrastructure", "Faculty", "Administration", "Hostel", "Other"];

export default function ComplaintBox() {
  const { user }    = useAuth();
  const { complaints, addComplaint, updateComplaintStatus } = useLMS();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [title, setTitle]           = useState("");
  const [category, setCategory]     = useState("");
  const [desc, setDesc]             = useState("");
  const [success, setSuccess]       = useState("");
  const [error, setError]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter]         = useState("All");

  const handleSubmit = async () => {
    if (!title || !category || !desc) return;
    setError("");
    setSubmitting(true);
    try {
      await addComplaint({ title, category, desc, by: user?.name });
      saveComplaint({ title, category, desc, by: user?.name, userId: user?.id }); // fire-and-forget Supabase log
      setTitle(""); setCategory(""); setDesc("");
      setShowForm(false);
      setSuccess("Complaint submitted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to submit complaint: " + (err.message || "Please try again."));
    }
    setSubmitting(false);
  };

  const filtered = filter === "All" ? complaints : complaints.filter((c) => c.status === filter);
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Complaint Box" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-5 text-white">
            <p className="text-rose-100 text-sm mb-1">Branch Complaint Box 📬</p>
            <h2 className="text-2xl font-bold">Raise a Complaint</h2>
            <p className="text-rose-100 text-sm mt-1">Your concerns will be addressed by the administration</p>
          </div>

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
              ✅ {success}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              {["All", "Pending", "In Progress", "Resolved"].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer
                    ${filter === f ? "bg-rose-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer">
              {showForm ? "✕ Cancel" : "+ New Complaint"}
            </button>
          </div>

          {showForm && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-semibold">📝 New Complaint</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Complaint title..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 text-sm" />
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500 text-sm cursor-pointer">
                <option value="">Select Category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe your complaint in detail..." rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 text-sm resize-none" />
              <button onClick={handleSubmit} disabled={!title || !category || !desc || submitting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all cursor-pointer">
                {submitting ? "Submitting..." : "Submit Complaint"}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-sm">No complaints found</p>
              </div>
            )}
            {filtered.map((c) => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded-lg">{c.category}</span>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium
                      ${c.status === "Resolved"    ? "bg-green-500/20 text-green-400" :
                        c.status === "In Progress" ? "bg-blue-500/20 text-blue-400" :
                        "bg-amber-500/20 text-amber-400"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <select
                        value={c.status}
                        onChange={(e) => updateComplaintStatus(c.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none cursor-pointer">
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Resolved</option>
                      </select>
                    )}
                    <span className="text-gray-600 text-xs">{c.date}</span>
                  </div>
                </div>
                <h4 className="text-white font-semibold text-sm mb-1">{c.title}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{c.desc}</p>
                <p className="text-gray-600 text-xs mt-2">— {c.by}</p>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}