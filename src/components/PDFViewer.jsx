import { useState } from "react";

export default function PDFViewer({ fileUrl, fileName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const ext = (fileName || "").split(".").pop().toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPdf   = ext === "pdf";

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">{isImage ? "🖼️" : "📄"}</span>
          <p className="text-white text-sm font-medium truncate max-w-xs">{fileName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            ⬇️ Download
          </button>
          <button
            onClick={() => window.open(fileUrl, "_blank")}
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

        {/* Loading spinner */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Loading document...</p>
            </div>
          </div>
        )}

        {/* Image viewer */}
        {isImage && !error && (
          <div className="flex items-center justify-center min-h-full p-6">
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          </div>
        )}

        {/* PDF viewer */}
        {isPdf && !error && (
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-full border-0"
            style={{ display: loading ? "none" : "block" }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        )}

        {/* Other file types or error fallback */}
        {(!isImage && !isPdf && !error) && (
          <div className="flex items-center justify-center min-h-full">
            <div className="text-center space-y-4 p-8">
              <p className="text-5xl">📎</p>
              <p className="text-white font-semibold">{fileName}</p>
              <p className="text-gray-400 text-sm">
                This file type cannot be previewed directly.
              </p>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                ⬇️ Download to View
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
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
                  onClick={() => window.open(fileUrl, "_blank")}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  ↗ Open in Tab
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}