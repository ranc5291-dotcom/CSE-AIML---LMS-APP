import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PDFViewer from "../components/PDFViewer";

const ALL_SEMS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

// Used only to decide whether to show an inline image thumbnail in the
// card — actual viewing is fully handled by PDFViewer itself, which
// already detects image/PDF/other and falls back gracefully.
function isImageFile(fileName = "") {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

export default function Timetable() {
  const { user, hasAnyRole } = useAuth();
  const { timetables, addTimetable, removeTimetable } = useLMS();

  const [mobileOpen, setMobileOpen]   = useState(false);
  const [selectedSem, setSelectedSem] = useState(user?.sem || "Sem 1");
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState(null);
  const [viewerFile, setViewerFile]   = useState(null);

  // Checks the full set of roles granted to this account (via multi-role
  // access), not just their original signup role — so someone given
  // faculty/admin access from a different primary role still sees the
  // upload controls here.
  const isFaculty = hasAnyRole(["faculty", "admin"]);

  // `timetables` comes ordered createdAt desc (see LMSContext's listener),
  // so the first match for a given semester is always the latest upload.
  const semEntries = (timetables || []).filter((t) => t.sem === selectedSem);
  const current    = semEntries[0] || null;
  const history    = semEntries.slice(1);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await addTimetable(selectedSem, file, user?.name || "Faculty");
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleView = (t) => {
    setViewerFile({ fileUrl: t.fileUrl, fileName: t.fileName });
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remove this timetable?")) return;
    await removeTimetable(id);
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Timetable" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <h2 className="text-[var(--color-text-primary)] font-semibold mb-1">🗓️ Timetable</h2>
            <p className="text-[var(--color-text-muted)] text-xs mb-4">
              {isFaculty
                ? "Select a semester and upload the timetable as an image or PDF."
                : "Select a semester to view your timetable."}
            </p>

            <div className="grid grid-cols-4 gap-2 max-w-md">
              {ALL_SEMS.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSelectedSem(sem)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer
                    ${selectedSem === sem
                      ? "bg-[var(--color-accent-solid)] text-white"
                      : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          {isFaculty && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
              <h3 className="text-[var(--color-text-primary)] font-semibold text-sm">Upload Timetable — {selectedSem}</h3>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--color-border)] rounded-xl py-8 cursor-pointer hover:border-[var(--color-accent-solid)]/50 transition-all">
                <span className="text-2xl">📤</span>
                <span className="text-[var(--color-text-secondary)] text-xs">
                  {uploading ? "Uploading…" : "Click to upload image or PDF"}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleFileChange}
                />
              </label>
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          )}

          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
            <h3 className="text-[var(--color-text-primary)] font-semibold text-sm">{selectedSem} — Current Timetable</h3>

            {!current && (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <p className="text-sm">No timetable uploaded yet for {selectedSem}</p>
                {isFaculty && <p className="text-xs mt-1">Upload one above</p>}
              </div>
            )}

            {current && (
              <div className="bg-[var(--color-bg-surface-alt)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                {isImageFile(current.fileName) && (
                  <img
                    src={current.fileUrl}
                    alt={`${selectedSem} timetable`}
                    className="w-full max-h-96 object-contain bg-black/20 cursor-pointer"
                    onClick={() => handleView(current)}
                  />
                )}
                <div className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-lg flex-shrink-0">
                    {isImageFile(current.fileName) ? "🖼️" : "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{current.fileName}</p>
                    <p className="text-[var(--color-text-muted)] text-xs">
                      Uploaded by {current.uploadedBy} - {current.date}
                    </p>
                  </div>
                </div>
                <div className="flex border-t border-[var(--color-border)]">
                  <button onClick={() => handleView(current)} className="flex-1 py-2.5 text-xs font-medium text-[var(--color-accent-soft-text)] hover:bg-[var(--color-accent-soft-bg)] cursor-pointer transition-all">
                    View
                  </button>
                  <div className="w-px bg-[var(--color-border)]" />
                  <a href={current.fileUrl} download={current.fileName} target="_blank" rel="noreferrer" className="flex-1 py-2.5 text-xs font-medium text-green-400 hover:bg-green-500/10 cursor-pointer flex items-center justify-center transition-all">
                    Download
                  </a>
                  {isFaculty && (
                    <>
                      <div className="w-px bg-[var(--color-border)]" />
                      <button onClick={() => handleRemove(current.id)} className="flex-1 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 cursor-pointer transition-all">
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {isFaculty && history.length > 0 && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-2">
              <h3 className="text-[var(--color-text-primary)] font-semibold text-sm mb-2">Previous Uploads — {selectedSem}</h3>
              {history.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-[var(--color-bg-surface-alt)] rounded-xl px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[var(--color-text-primary)] text-xs font-medium truncate">{t.fileName}</p>
                    <p className="text-[var(--color-text-muted)] text-xs">{t.uploadedBy} - {t.date}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleView(t)} className="px-3 py-1.5 bg-[var(--color-accent-soft-bg)] text-[var(--color-accent-soft-text)] rounded-lg text-xs hover:opacity-80 transition-all cursor-pointer">
                      View
                    </button>
                    <button onClick={() => handleRemove(t.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all cursor-pointer">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>
      </div>

      {viewerFile && (
        <PDFViewer
          fileUrl={viewerFile.fileUrl}
          fileName={viewerFile.fileName}
          onClose={() => setViewerFile(null)}
        />
      )}
    </div>
  );
}