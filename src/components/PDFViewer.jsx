import { useState, useEffect } from "react";

function getExtension(fileName, fileUrl) {
  const tryExt = (s) => {
    if (!s) return "";
    const clean = s.split("?")[0].split("#")[0];
    const parts = clean.split(".");
    if (parts.length < 2) return "";
    const ext = parts.pop().toLowerCase();
    return ext.length <= 5 ? ext : "";
  };
  // Prefer the real filename's extension; fall back to sniffing the URL
  // (covers cases like assignment titles that have no file extension).
  return tryExt(fileName) || tryExt(fileUrl);
}

export default function PDFViewer({ fileUrl, fileName, files, onClose }) {
  // `files` is optional: an array of { fileUrl, fileName } for ←/→
  // navigation between multiple attachments. Falls back to single-file mode.
  const fileList = files && files.length > 0 ? files : [{ fileUrl, fileName }];
  const startIndex = Math.max(0, fileList.findIndex((f) => f.fileUrl === fileUrl));

  const [index, setIndex]     = useState(startIndex);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const current    = fileList[index] || fileList[0];
  const currentUrl  = current?.fileUrl;
  const currentName = current?.fileName;

  const ext     = getExtension(currentName, currentUrl);
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf   = ext === "pdf";

  // Reset viewer state whenever the active file changes
  useEffect(() => {
    setPage(1);
    setLoading(true);
    setError(false);
  }, [index, currentUrl]);

  const goToFile = (newIndex) => {
    if (newIndex < 0 || newIndex >= fileList.length) return;
    setIndex(newIndex);
  };

  // Keyboard navigation: ↑/↓ page, ←/→ file, Esc close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowUp") setPage((p) => Math.max(1, p - 1));
      else if (e.key === "ArrowDown") setPage((p) => p + 1);
      else if (e.key === "ArrowLeft") goToFile(index - 1);
      else if (e.key === "ArrowRight") goToFile(index + 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, fileList.length, onClose]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = currentUrl;
    a.download = currentName || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Chrome/Edge's built-in PDF viewer respects #page=N in the src URL.
  // There's no page-count API without a full PDF.js integration, so
  // up/down just moves the requested page forward/back.
  const pdfSrc = isPdf ? `${currentUrl}#page=${page}` : currentUrl;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">{isImage ? "🖼️" : "📄"}</span>
          <p className="text-white text-sm font-medium truncate max-w-xs">{currentName}</p>
          {fileList.length > 1 && (
            <span className="text-gray-500 text-xs flex-shrink-0">
              {index + 1} / {fileList.length}
            </span>
          )}
          {isPdf && <span className="text-gray-500 text-xs flex-shrink-0">· page {page}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {fileList.length > 1 && (
            <>
              <button
                onClick={() => goToFile(index - 1)}
                disabled={index === 0}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-sm transition-all cursor-pointer"
                title="Previous file (←)"
              >
                ←
              </button>
              <button
                onClick={() => goToFile(index + 1)}
                disabled={index === fileList.length - 1}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-sm transition-all cursor-pointer"
                title="Next file (→)"
              >
                →
              </button>
            </>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            ⬇️ Download
          </button>
          <button
            onClick={() => window.open(currentUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            ↗ Open in Tab
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-700 hover:bg-red-600 text-white rounded-xl text-sm transition-all cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative overflow-auto bg-gray-950">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Loading document...</p>
            </div>
          </div>
        )}

        {isImage && !error && (
          <div className="flex items-center justify-center min-h-full p-6">
            <img
              src={currentUrl}
              alt={currentName}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          </div>
        )}

        {isPdf && !error && (
          <iframe
            key={pdfSrc}
            src={pdfSrc}
            title={currentName}
            className="w-full h-full border-0"
            style={{ display: loading ? "none" : "block" }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        )}

        {!isImage && !isPdf && !error && (
          <div className="flex items-center justify-center min-h-full">
            <div className="text-center space-y-4 p-8">
              <p className="text-5xl">📎</p>
              <p className="text-white font-semibold">{currentName}</p>
              <p className="text-gray-400 text-sm">This file type cannot be previewed directly.</p>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                ⬇️ Download to View
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center min-h-full">
            <div className="text-center space-y-4 p-8">
              <p className="text-5xl">⚠️</p>
              <p className="text-white font-semibold">Couldn't load preview</p>
              <p className="text-gray-400 text-sm">
                The file may have expired or can't be displayed in the browser.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  ⬇️ Download File
                </button>
                <button
                  onClick={() => window.open(currentUrl, "_blank")}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  ↗ Open in Tab
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-1.5 bg-gray-900 border-t border-gray-800 text-center text-gray-600 text-xs flex-shrink-0">
        ↑↓ change page · ←→ switch file · Esc close
      </div>
    </div>
  );
}