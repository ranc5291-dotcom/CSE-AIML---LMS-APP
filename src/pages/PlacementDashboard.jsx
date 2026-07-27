import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PDFViewer from "../components/PDFViewer";

const DIFFICULTY = ["Easy", "Medium", "Hard"];
const UPLOAD_CATEGORIES = [
  "DSA Sheet",
  "Aptitude Material",
  "Company Brochure",
  "Resume Tips",
  "Interview Guide",
  "Mock Test",
  "Other",
];

const TABS = ["Companies", "DSA Questions", "Aptitude Test", "Resources"];

const DSA_SORT_OPTIONS = [
  { key: "title",      label: "Problem" },
  { key: "topic",      label: "Topic" },
  { key: "difficulty", label: "Difficulty" },
];

const COMPANY_SORT_OPTIONS = [
  { key: "name",   label: "Name" },
  { key: "status", label: "Status" },
  { key: "package", label: "Package" },
];

export default function PlacementDashboard() {
  const { user } = useAuth();
  const {
    companies, addCompany, removeCompany,
    dsaList, addDsa, removeDsa,
    aptitude, addAptitude, removeAptitude,
    placementUploads, addPlacementUpload, removePlacementUpload,
  } = useLMS();

  const isOfficer = user?.role === "placement" || user?.role === "admin";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState("Companies");
  const [pdfViewer, setPdfViewer]   = useState(null);

  // Companies form
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: "", role: "", package: "", deadline: "", status: "Open",
    eligibility: "", description: "", googleFormUrl: "",
  });

  // Companies sort
  const [companySortBy, setCompanySortBy]   = useState("name");
  const [companySortDir, setCompanySortDir] = useState("asc");
  const toggleCompanySort = (key) => {
    if (companySortBy === key) setCompanySortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCompanySortBy(key); setCompanySortDir("asc"); }
  };
  const sortedCompanies = [...companies].sort((a, b) => {
    const av = String(a[companySortBy] ?? "").trim().toLowerCase();
    const bv = String(b[companySortBy] ?? "").trim().toLowerCase();
    const cmp = av.localeCompare(bv, undefined, { numeric: true });
    return companySortDir === "asc" ? cmp : -cmp;
  });

  // DSA form
  const [showDsaForm, setShowDsaForm] = useState(false);
  const [newDsa, setNewDsa] = useState({ title: "", difficulty: "Easy", topic: "", link: "" });

  // DSA sort
  const [dsaSortBy, setDsaSortBy]   = useState(null); // null = original/insertion order
  const [dsaSortDir, setDsaSortDir] = useState("asc");
  const toggleDsaSort = (key) => {
    if (dsaSortBy === key) setDsaSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setDsaSortBy(key); setDsaSortDir("asc"); }
  };
  const sortedDsaList = dsaSortBy
    ? [...dsaList].sort((a, b) => {
        const av = String(a[dsaSortBy] ?? "").trim().toLowerCase();
        const bv = String(b[dsaSortBy] ?? "").trim().toLowerCase();
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return dsaSortDir === "asc" ? cmp : -cmp;
      })
    : dsaList;

  // Aptitude form
  const [showAptForm, setShowAptForm] = useState(false);
  const [newQ, setNewQ]               = useState({ question: "", options: ["", "", "", ""], answer: 0 });
  const [answers, setAnswers]         = useState({});
  const [submitted, setSubmitted]     = useState(false);

  // Resources/Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("DSA Sheet");
  const [uploadTitle, setUploadTitle]       = useState("");
  const [uploadFile, setUploadFile]         = useState(null);
  const [uploadLink, setUploadLink]         = useState("");
  const [uploadStatus, setUploadStatus]     = useState(""); // optional: "", "Open", "Closed"
  const [uploading, setUploading]           = useState(false);
  const uploadRef                           = useRef(null);

  const handleAddCompany = () => {
    if (!newCompany.name || !newCompany.role) return;
    addCompany({ ...newCompany });
    setNewCompany({
      name: "", role: "", package: "", deadline: "", status: "Open",
      eligibility: "", description: "", googleFormUrl: "",
    });
    setShowCompanyForm(false);
  };

  const handleAddDsa = () => {
    if (!newDsa.title || !newDsa.topic) return;
    addDsa({ ...newDsa });
    setNewDsa({ title: "", difficulty: "Easy", topic: "", link: "" });
    setShowDsaForm(false);
  };

  const handleAddQuestion = () => {
    if (!newQ.question || newQ.options.some((o) => !o)) return;
    addAptitude({ ...newQ });
    setNewQ({ question: "", options: ["", "", "", ""], answer: 0 });
    setShowAptForm(false);
  };

  const handleUpload = async () => {
    if (!uploadTitle) return;
    setUploading(true);
    try {
      await addPlacementUpload({
        category:   uploadCategory,
        title:      uploadTitle,
        link:       uploadLink,
        status:     uploadStatus || null,
        uploadedBy: user?.name,
        date:       new Date().toISOString().split("T")[0],
      }, uploadFile); // actual File object — uploaded to Cloudinary inside addPlacementUpload

      setUploadTitle("");
      setUploadFile(null);
      setUploadLink("");
      setUploadStatus("");
      if (uploadRef.current) uploadRef.current.value = "";
      setShowUploadForm(false);
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  };

  const score = submitted
    ? aptitude.filter((q) => answers[q.id] === q.answer).length
    : 0;

  const groupedUploads = UPLOAD_CATEGORIES.reduce((acc, cat) => {
    const items = placementUploads.filter((u) => u.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Placement Portal" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-5 text-white">
            <p className="text-amber-100 text-sm mb-1">Placement Portal 💼</p>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab
                    ? "bg-amber-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── COMPANIES ── */}
          {activeTab === "Companies" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-500 text-xs font-medium">Sort by:</span>
                  {COMPANY_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => toggleCompanySort(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1
                        ${companySortBy === opt.key ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                      {opt.label}
                      {companySortBy === opt.key && <span>{companySortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  ))}
                </div>
                {isOfficer && (
                  <button
                    onClick={() => setShowCompanyForm(!showCompanyForm)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all"
                  >
                    {showCompanyForm ? "✕ Cancel" : "+ Add Company"}
                  </button>
                )}
              </div>

              {showCompanyForm && isOfficer && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-white font-semibold">🏢 Add Company</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { key: "name",    placeholder: "Company name *" },
                      { key: "role",    placeholder: "Job role *" },
                      { key: "package", placeholder: "Package (e.g. ₹8 LPA)" },
                    ].map(({ key, placeholder }) => (
                      <input
                        key={key}
                        value={newCompany[key]}
                        onChange={(e) => setNewCompany({ ...newCompany, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                      />
                    ))}
                    <input
                      type="date"
                      value={newCompany.deadline}
                      onChange={(e) => setNewCompany({ ...newCompany, deadline: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                    <select
                      value={newCompany.status}
                      onChange={(e) => setNewCompany({ ...newCompany, status: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option>Open</option>
                      <option>Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Eligibility Criteria</label>
                    <input
                      value={newCompany.eligibility}
                      onChange={(e) => setNewCompany({ ...newCompany, eligibility: e.target.value })}
                      placeholder="e.g. 8.0+ CGPA, No active backlogs, 2026 batch only"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Job Description</label>
                    <textarea
                      value={newCompany.description}
                      onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
                      placeholder="Brief description of the role..."
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Google Form URL{" "}
                      <span className="text-gray-600">
                        (students will be redirected here when they click Apply)
                      </span>
                    </label>
                    <input
                      value={newCompany.googleFormUrl}
                      onChange={(e) => setNewCompany({ ...newCompany, googleFormUrl: e.target.value })}
                      placeholder="https://forms.gle/your-application-form"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>

                  <button
                    onClick={handleAddCompany}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  >
                    + Add Company
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sortedCompanies.length === 0 && (
                  <p className="text-gray-600 text-sm col-span-2">No companies added yet.</p>
                )}
                {sortedCompanies.map((c) => (
                  <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-white font-bold text-base">{c.name}</h4>
                        <p className="text-gray-400 text-sm">{c.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-lg font-medium
                            ${c.status === "Open"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"}`}
                        >
                          {c.status}
                        </span>
                        {isOfficer && (
                          <button
                            onClick={() => removeCompany(c.id)}
                            className="text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    {c.description && (
                      <p className="text-gray-400 text-xs leading-relaxed">{c.description}</p>
                    )}

                    {c.eligibility && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                        <p className="text-blue-300 text-xs font-semibold mb-1">✅ Eligibility Criteria</p>
                        <p className="text-blue-200 text-xs">{c.eligibility}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>💰 {c.package}</span>
                      {c.deadline && <span>📅 Deadline: {c.deadline}</span>}
                    </div>

                    {c.status === "Open" && (
                      <button
                        onClick={() => {
                          if (c.googleFormUrl) {
                            window.open(c.googleFormUrl, "_blank");
                          } else {
                            alert("Application form not set up yet. Contact the Placement Officer.");
                          }
                        }}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium transition-all cursor-pointer"
                      >
                        {c.googleFormUrl ? "📋 Apply Now → Open Google Form" : "Apply Now →"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DSA QUESTIONS ── */}
          {activeTab === "DSA Questions" && (
            <div className="space-y-4">
              {isOfficer && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDsaForm(!showDsaForm)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all"
                  >
                    {showDsaForm ? "✕ Cancel" : "+ Add Question"}
                  </button>
                </div>
              )}

              {showDsaForm && isOfficer && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-white font-semibold">➕ Add DSA Question</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      value={newDsa.title}
                      onChange={(e) => setNewDsa({ ...newDsa, title: e.target.value })}
                      placeholder="Problem title *"
                      className="col-span-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                    <input
                      value={newDsa.topic}
                      onChange={(e) => setNewDsa({ ...newDsa, topic: e.target.value })}
                      placeholder="Topic *"
                      className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                    <select
                      value={newDsa.difficulty}
                      onChange={(e) => setNewDsa({ ...newDsa, difficulty: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {DIFFICULTY.map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <input
                      value={newDsa.link}
                      onChange={(e) => setNewDsa({ ...newDsa, link: e.target.value })}
                      placeholder="LeetCode / GFG link"
                      className="col-span-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                    <button
                      onClick={handleAddDsa}
                      className="col-span-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer py-2"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-800/50">
                      <th className="text-left text-gray-400 text-xs py-3 px-4">#</th>
                      {DSA_SORT_OPTIONS.map((opt) => (
                        <th
                          key={opt.key}
                          onClick={() => toggleDsaSort(opt.key)}
                          className="text-left text-gray-400 text-xs py-3 px-4 cursor-pointer select-none hover:text-white transition-colors"
                        >
                          {opt.label} {dsaSortBy === opt.key && (dsaSortDir === "asc" ? "▲" : "▼")}
                        </th>
                      ))}
                      {isOfficer && <th className="text-gray-400 text-xs py-3 px-4"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDsaList.map((d, i) => (
                      <tr
                        key={d.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-500 text-xs">{i + 1}</td>
                        <td className="py-3 px-4">
                          <a
                            href={d.link || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                          >
                            {d.title}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{d.topic}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-lg font-medium
                              ${d.difficulty === "Easy"
                                ? "bg-green-500/20 text-green-400"
                                : d.difficulty === "Medium"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-red-500/20 text-red-400"}`}
                          >
                            {d.difficulty}
                          </span>
                        </td>
                        {isOfficer && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => removeDsa(d.id)}
                              className="text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
                            >
                              🗑️
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {dsaList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-600 text-sm">
                          No questions added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── APTITUDE TEST ── */}
          {activeTab === "Aptitude Test" && (
            <div className="space-y-4">
              {isOfficer && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowAptForm(!showAptForm)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all"
                  >
                    {showAptForm ? "✕ Cancel" : "+ Add Question"}
                  </button>
                </div>
              )}

              {showAptForm && isOfficer && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-white font-semibold">➕ Add Aptitude Question</h3>
                  <input
                    value={newQ.question}
                    onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
                    placeholder="Question *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {newQ.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct"
                          checked={newQ.answer === idx}
                          onChange={() => setNewQ({ ...newQ, answer: idx })}
                          className="cursor-pointer accent-amber-500"
                        />
                        <input
                          value={opt}
                          onChange={(e) => {
                            const opts = [...newQ.options];
                            opts[idx] = e.target.value;
                            setNewQ({ ...newQ, options: opts });
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 placeholder-gray-600"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs">
                    Select the radio button next to the correct answer.
                  </p>
                  <button
                    onClick={handleAddQuestion}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer"
                  >
                    + Add Question
                  </button>
                </div>
              )}

              {submitted ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                  <p className="text-5xl mb-4">🎯</p>
                  <h3 className="text-white text-2xl font-bold mb-2">Test Completed!</h3>
                  <p className="text-4xl font-bold text-amber-400 mb-4">
                    {score} / {aptitude.length}
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setAnswers({}); }}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  {aptitude.map((q, i) => (
                    <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <p className="text-white text-sm font-medium">
                          <span className="text-amber-400 mr-2">Q{i + 1}.</span>
                          {q.question}
                        </p>
                        {isOfficer && (
                          <button
                            onClick={() => removeAptitude(q.id)}
                            className="text-gray-600 hover:text-red-400 cursor-pointer flex-shrink-0"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                            className={`text-left px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border
                              ${answers[q.id] === idx
                                ? "bg-amber-600 border-amber-500 text-white"
                                : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"}`}
                          >
                            {String.fromCharCode(65 + idx)}. {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {aptitude.length > 0 && (
                    <button
                      onClick={() => setSubmitted(true)}
                      disabled={Object.keys(answers).length < aptitude.length}
                      className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold cursor-pointer"
                    >
                      Submit Test ({Object.keys(answers).length}/{aptitude.length} answered)
                    </button>
                  )}

                  {aptitude.length === 0 && (
                    <div className="text-center py-12 text-gray-600">
                      <p className="text-4xl mb-2">📝</p>
                      <p className="text-sm">
                        No questions yet.{" "}
                        {isOfficer ? "Add some above." : "Check back soon."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── RESOURCES ── */}
          {activeTab === "Resources" && (
            <div className="space-y-5">
              {isOfficer && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowUploadForm(!showUploadForm)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all"
                  >
                    {showUploadForm ? "✕ Cancel" : "📤 Upload Resource"}
                  </button>
                </div>
              )}

              {showUploadForm && isOfficer && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-white font-semibold">📤 Upload Placement Resource</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Category</label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {UPLOAD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Title *</label>
                      <input
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Resource title"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                      />
                    </div>
                  </div>

                  {/* Optional status — Open / Closed / None */}
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Status <span className="text-gray-600">(optional)</span>
                    </label>
                    <select
                      value={uploadStatus}
                      onChange={(e) => setUploadStatus(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">— None —</option>
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div
                    onClick={() => uploadRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all
                      ${uploadFile
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-gray-600 hover:border-gray-500"}`}
                  >
                    <span className="text-2xl">{uploadFile ? "📄" : "📁"}</span>
                    <p className="text-gray-300 text-sm">
                      {uploadFile ? uploadFile.name : "Click to attach a file (optional)"}
                    </p>
                    <input
                      ref={uploadRef}
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Or paste a link</label>
                    <input
                      value={uploadLink}
                      onChange={(e) => setUploadLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={!uploadTitle || uploading}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer"
                  >
                    {uploading ? "⏳ Uploading..." : "Upload Resource"}
                  </button>
                </div>
              )}

              {/* Grouped uploads */}
              {Object.keys(groupedUploads).length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm">No resources uploaded yet.</p>
                </div>
              )}

              {Object.entries(groupedUploads).map(([cat, items]) => (
                <div key={cat} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-3">📂 {cat}</h3>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700 flex-wrap gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📄</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-white text-xs font-medium">{item.title}</p>
                              {item.status && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                  ${item.status === "Open"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"}`}>
                                  {item.status}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs">
                              {item.uploadedBy} · {item.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.fileUrl && (
                            <button
                              onClick={() => setPdfViewer({ fileUrl: item.fileUrl, fileName: item.fileName || item.title })}
                              className="px-3 py-1.5 bg-violet-600/20 text-violet-300 rounded-lg text-xs hover:bg-violet-600/30 transition-all cursor-pointer"
                            >
                              👁 View
                            </button>
                          )}
                          {(item.fileUrl || item.link) && (
                            <a
                              href={item.fileUrl || item.link}
                              target="_blank"
                              rel="noreferrer"
                              download={item.fileName || undefined}
                              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-all"
                            >
                              {item.fileUrl ? "⬇️ Download" : "🔗 Open"}
                            </a>
                          )}
                          {isOfficer && (
                            <button
                              onClick={() => removePlacementUpload(item.id)}
                              className="text-gray-600 hover:text-red-400 cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <PDFViewer
          fileUrl={pdfViewer.fileUrl}
          fileName={pdfViewer.fileName}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}
