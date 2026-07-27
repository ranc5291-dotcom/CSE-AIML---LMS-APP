import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PDFViewer from "../components/PDFViewer";

const YEARS = [
  { label: "1st Year", sems: ["Sem 1", "Sem 2"] },
  { label: "2nd Year", sems: ["Sem 3", "Sem 4"] },
  { label: "3rd Year", sems: ["Sem 5", "Sem 6"] },
  { label: "4th Year", sems: ["Sem 7", "Sem 8"] },
];

const PHOTO_CATEGORIES = ["Events", "Achievements", "Lab Work", "Sports", "Cultural", "Campus Life"];
const RESOURCE_TYPES   = ["Timetable", "Calendar of Events", "Academic Schedule", "Exam Schedule", "Other"];

// ── Image Lightbox Modal ──────────────────────────────────────────
function ImageLightbox({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-700 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">🖼️</span>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate max-w-xs">{photo.caption}</p>
            <p className="text-gray-400 text-xs">{photo.category} · {photo.uploadedBy} · {photo.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={photo.url}
            download={photo.caption}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            ⬇️ Download
          </a>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-700 hover:bg-red-600 text-white rounded-xl text-sm transition-all cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center p-6 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.caption}
          className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
        />
      </div>
    </div>
  );
}

// ── Main Gallery Component ────────────────────────────────────────
export default function Gallery() {
  const { user } = useAuth();
  const {
    gallery, addGalleryPhoto, removeGalleryPhoto,
    semResources, addSemResource, removeSemResource,
  } = useLMS();

  const canUpload = user?.role === "faculty" || user?.role === "admin";

  const [mobileOpen, setMobileOpen]       = useState(false);
  const [activeTab, setActiveTab]         = useState("Gallery");
  const [selectedYear, setSelectedYear]   = useState(YEARS[2]);
  const [selectedSem, setSelectedSem]     = useState("Sem 5");
  const [pdfViewer, setPdfViewer]         = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);   // ← image lightbox

  // Gallery upload
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [photoCaption, setPhotoCaption]   = useState("");
  const [photoCategory, setPhotoCategory] = useState("Events");
  const [photoFile, setPhotoFile]         = useState(null);
  const [photoPreview, setPhotoPreview]   = useState(null);
  const photoRef                          = useRef(null);

  // Sem resource upload
  const [showResForm, setShowResForm]     = useState(false);
  const [resType, setResType]             = useState("Timetable");
  const [resTitle, setResTitle]           = useState("");
  const [resFile, setResFile]             = useState(null);
  const resRef                            = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAddPhoto = () => {
    if (!photoFile || !photoCaption.trim()) {
      alert("Please add a caption and select a photo.");
      return;
    }
    addGalleryPhoto({
      caption: photoCaption,
      category: photoCategory,
      url: photoPreview,
      uploadedBy: user?.name,
      date: new Date().toISOString().split("T")[0],
    });
    setPhotoCaption(""); setPhotoFile(null); setPhotoPreview(null);
    if (photoRef.current) photoRef.current.value = "";
    setShowPhotoForm(false);
  };

  const handleAddResource = () => {
    if (!resFile || !resTitle.trim()) {
      alert("Please enter a title and select a file.");
      return;
    }
    const fileUrl = URL.createObjectURL(resFile);
    addSemResource(selectedSem, {
      type: resType,
      title: resTitle,
      fileName: resFile.name,
      fileUrl,
      uploadedBy: user?.name,
      date: new Date().toISOString().split("T")[0],
    });
    setResTitle(""); setResFile(null);
    if (resRef.current) resRef.current.value = "";
    setShowResForm(false);
  };

  const semRes = semResources[selectedSem] || [];
  const groupedByType = RESOURCE_TYPES.reduce((acc, type) => {
    const items = semRes.filter((r) => r.type === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Gallery & Resources" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-gradient-to-r from-pink-600 to-rose-600 rounded-2xl p-5 text-white">
            <p className="text-pink-100 text-sm mb-1">📸 Gallery &amp; Sem Resources</p>
            <h2 className="text-2xl font-bold">Branch Gallery</h2>
            <p className="text-pink-100 text-sm mt-1">Only academic/branch photos — no personal photos allowed</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {["Gallery", "Sem Resources"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── GALLERY TAB ── */}
          {activeTab === "Gallery" && (
            <div className="space-y-5">
              {/* Policy notice */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                <p className="text-amber-300 text-xs font-semibold mb-1">📌 Upload Guidelines</p>
                <ul className="text-amber-200 text-xs space-y-0.5 list-disc list-inside">
                  <li>Only branch/academic related photos allowed</li>
                  <li>No personal, offensive, or inappropriate photos</li>
                  <li>Photos should represent events, achievements, or campus activities</li>
                  <li>Faculty/Admin can remove inappropriate photos</li>
                </ul>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">{gallery.length} photos uploaded</p>
                <button onClick={() => setShowPhotoForm(!showPhotoForm)}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all">
                  {showPhotoForm ? "✕ Cancel" : "📷 Upload Photo"}
                </button>
              </div>

              {showPhotoForm && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-white font-semibold">📷 Upload Branch Photo</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Caption *</label>
                      <input value={photoCaption}
                        onChange={(e) => setPhotoCaption(e.target.value)}
                        placeholder="e.g. Hackathon Winners 2026"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500 placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Category</label>
                      <select value={photoCategory}
                        onChange={(e) => setPhotoCategory(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500 cursor-pointer">
                        {PHOTO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div
                    onClick={() => photoRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all
                      ${photoPreview ? "border-pink-500" : "border-gray-600 hover:border-gray-500"}`}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="preview" className="w-full h-48 object-cover" />
                    ) : (
                      <div className="p-8 flex flex-col items-center gap-2">
                        <span className="text-3xl">📷</span>
                        <p className="text-gray-300 text-sm">Click to select photo</p>
                        <p className="text-gray-600 text-xs">JPG, PNG supported</p>
                      </div>
                    )}
                    <input ref={photoRef} type="file" accept="image/*"
                      onChange={handlePhotoChange} className="hidden" />
                  </div>

                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-300">
                    ⚠️ By uploading, you confirm this is a branch/academic photo.
                  </div>

                  <button onClick={handleAddPhoto}
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
                    Upload Photo
                  </button>
                </div>
              )}

              {/* Photo grid */}
              {gallery.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-4xl mb-2">📷</p>
                  <p className="text-sm">No photos yet. Be the first to upload a branch photo!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {gallery.map((photo) => (
                    <div key={photo.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

                      {/* Photo thumbnail */}
                      {photo.url ? (
                        <div
                          className="relative cursor-pointer group"
                          onClick={() => setLightboxPhoto(photo)}
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption}
                            className="w-full h-40 object-cover group-hover:brightness-75 transition-all"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                              🔍 Click to view
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-40 bg-gray-800 flex items-center justify-center">
                          <span className="text-4xl">🖼️</span>
                        </div>
                      )}

                      {/* Card footer */}
                      <div className="p-3 space-y-2">
                        <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded-full">
                            {photo.category}
                          </span>
                          <span className="text-gray-600 text-xs">{photo.uploadedBy}</span>
                        </div>

                        {/* View button */}
                        <div className="flex gap-2">
                          {photo.url && (
                            <button
                              onClick={() => setLightboxPhoto(photo)}
                              className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-xs font-medium transition-all cursor-pointer"
                            >
                              👁 View
                            </button>
                          )}
                          {(canUpload || photo.uploadedBy === user?.name) && (
                            <button
                              onClick={() => removeGalleryPhoto(photo.id)}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-all cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SEM RESOURCES TAB ── */}
          {activeTab === "Sem Resources" && (
            <div className="space-y-5">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Select Year &amp; Semester</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  {YEARS.map((y) => (
                    <button key={y.label}
                      onClick={() => { setSelectedYear(y); setSelectedSem(y.sems[0]); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer
                        ${selectedYear.label === y.label ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                      {y.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {selectedYear.sems.map((sem) => (
                    <button key={sem} onClick={() => setSelectedSem(sem)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer
                        ${selectedSem === sem ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                      {sem}
                    </button>
                  ))}
                </div>
              </div>

              {canUpload && (
                <div className="flex justify-end">
                  <button onClick={() => setShowResForm(!showResForm)}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all">
                    {showResForm ? "✕ Cancel" : `📤 Upload for ${selectedSem}`}
                  </button>
                </div>
              )}

              {showResForm && canUpload && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-white font-semibold">📤 Upload Resource for {selectedSem}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Resource Type</label>
                      <select value={resType} onChange={(e) => setResType(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500 cursor-pointer">
                        {RESOURCE_TYPES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Title *</label>
                      <input value={resTitle} onChange={(e) => setResTitle(e.target.value)}
                        placeholder="e.g. Sem 5 Timetable 2026"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500 placeholder-gray-600" />
                    </div>
                  </div>

                  <div
                    onClick={() => resRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all
                      ${resFile ? "border-pink-500 bg-pink-500/10" : "border-gray-600 hover:border-gray-500"}`}>
                    <span className="text-2xl">{resFile ? "📄" : "📁"}</span>
                    <p className="text-gray-300 text-sm">{resFile ? resFile.name : "Click to select file (PDF, image, etc.)"}</p>
                    <input ref={resRef} type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setResFile(e.target.files[0])} className="hidden" />
                  </div>

                  <button onClick={handleAddResource}
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                    Upload for {selectedSem}
                  </button>
                </div>
              )}

              {semRes.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-4xl mb-2">📂</p>
                  <p className="text-sm">No resources uploaded for {selectedSem} yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedByType).map(([type, items]) => (
                    <div key={type} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <h3 className="text-white font-semibold mb-3">
                        {type === "Timetable" ? "📅" :
                         type === "Calendar of Events" ? "📆" :
                         type === "Exam Schedule" ? "📋" : "📄"} {type}
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📄</span>
                              <div>
                                <p className="text-white text-xs font-medium">{item.title}</p>
                                <p className="text-gray-500 text-xs">{item.uploadedBy} · {item.date}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setPdfViewer({ fileUrl: item.fileUrl, fileName: item.title })}
                                className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-all cursor-pointer">
                                👁 View
                              </button>
                              <a href={item.fileUrl} download={item.fileName}
                                className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs hover:bg-green-600/30 transition-all cursor-pointer">
                                ⬇️ Download
                              </a>
                              {canUpload && (
                                <button onClick={() => removeSemResource(selectedSem, item.id)}
                                  className="text-gray-600 hover:text-red-400 cursor-pointer transition-colors">🗑️</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* PDF/file viewer for Sem Resources */}
      {pdfViewer && (
        <PDFViewer
          fileUrl={pdfViewer.fileUrl}
          fileName={pdfViewer.fileName}
          onClose={() => setPdfViewer(null)}
        />
      )}

      {/* Image lightbox for Gallery photos */}
      {lightboxPhoto && (
        <ImageLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}