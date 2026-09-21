import { useState, useEffect, useRef } from "react";
import { downloadFile } from "../utils/download";

// ─────────────────────────────────────────────────────────────
// In-app document viewer.
//
//  • PDFs      → drawn on the page with PDF.js (works on phones too —
//                 the browser's built-in PDF frame does NOT work on
//                 Android, which is why "View" used to fall back to an
//                 external page).
//  • Images    → shown directly.
//  • Word / PowerPoint / Excel → shown in an embedded viewer.
//  • Anything else → a message + Download button.
// ─────────────────────────────────────────────────────────────

const PDFJS_SOURCES = [
  {
    lib: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    worker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  },
  {
    lib: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  },
];

const OFFICE_EXTENSIONS = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const MAX_CANVAS_PIXELS = 4_000_000; // keeps phones from running out of memory

let pdfjsPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error("script load failed")); };
    document.head.appendChild(s);
  });
}

// Loads PDF.js once (from a CDN, so nothing needs installing) and reuses it.
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = (async () => {
    for (const source of PDFJS_SOURCES) {
      try {
        await loadScript(source.lib);
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = source.worker;
          return window.pdfjsLib;
        }
      } catch {
        // try the next source
      }
    }
    pdfjsPromise = null;
    throw new Error("Couldn't load the PDF viewer. Check your internet connection.");
  })();

  return pdfjsPromise;
}

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

// ── PDF drawn page-by-page on canvases. Only the pages near the screen are
// kept drawn, so even long PDFs stay light on memory. ──
function PdfCanvasViewer({ fileUrl, zoom, jumpTo, onLoaded, onError, onVisiblePage }) {
  const scrollRef = useRef(null);
  const pdfRef = useRef(null);
  const canvasRefs = useRef({});
  const renderedRef = useRef({}); // pageNum -> true while drawn at the current scale
  const tasksRef = useRef({});    // pageNum -> running render task
  const rafRef = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [firstSize, setFirstSize] = useState(null); // page 1 size at scale 1
  const [containerWidth, setContainerWidth] = useState(0);

  // 1) Download + open the PDF
  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    setNumPages(0);
    setFirstSize(null);

    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Couldn't fetch the file (HTTP ${res.status}).`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        if (cancelled) { pdf.destroy(); return; }

        pdfRef.current = pdf;
        const first = await pdf.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (cancelled) return;

        setFirstSize({ width: viewport.width, height: viewport.height });
        setNumPages(pdf.numPages);
        onLoaded?.(pdf.numPages);
      } catch (err) {
        if (!cancelled) onError?.(err);
      }
    })();

    return () => {
      cancelled = true;
      Object.values(tasksRef.current).forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
      tasksRef.current = {};
      renderedRef.current = {};
      try { loadingTask?.destroy(); } catch { /* ignore */ }
      pdfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // 2) Keep track of the available width so pages fit the screen
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setContainerWidth((prev) => (Math.abs(prev - w) > 8 ? w : prev));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = firstSize && containerWidth
    ? Math.round(((containerWidth - 24) / firstSize.width) * zoom * 1000) / 1000
    : 0;

  // 3) Draw the pages that are on (or near) the screen, free the far ones
  useEffect(() => {
    if (!firstSize || !scale || numPages === 0) return;
    const root = scrollRef.current;
    const pdf = pdfRef.current;
    if (!root || !pdf) return;

    // Scale changed (zoom / resize) → everything must be redrawn.
    Object.values(tasksRef.current).forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
    tasksRef.current = {};
    renderedRef.current = {};
    Object.values(canvasRefs.current).forEach((c) => { if (c) { c.width = 0; c.height = 0; } });

    const renderPage = async (n) => {
      if (renderedRef.current[n]) return;
      renderedRef.current[n] = true;
      try {
        const page = await pdf.getPage(n);
        const canvas = canvasRefs.current[n];
        if (!canvas || !renderedRef.current[n]) return;

        const viewport = page.getViewport({ scale });
        let ratio = Math.min(window.devicePixelRatio || 1, 2);
        const pixels = viewport.width * viewport.height * ratio * ratio;
        if (pixels > MAX_CANVAS_PIXELS) {
          ratio = Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
        }

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const holder = canvas.parentElement;
        if (holder) {
          holder.style.width = canvas.style.width;
          holder.style.height = canvas.style.height;
        }

        const task = page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        tasksRef.current[n] = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          renderedRef.current[n] = false;
          console.warn(`PDF page ${n} failed to draw:`, err?.message || err);
        }
      }
    };

    const releasePage = (n) => {
      renderedRef.current[n] = false;
      const task = tasksRef.current[n];
      if (task) {
        try { task.cancel(); } catch { /* ignore */ }
        delete tasksRef.current[n];
      }
      const canvas = canvasRefs.current[n];
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const n = Number(entry.target.dataset.page);
          if (entry.isIntersecting) renderPage(n);
          else releasePage(n);
        });
      },
      { root, rootMargin: "800px 0px" }
    );
    root.querySelectorAll("[data-page]").forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, [firstSize, scale, numPages]);

  // 4) Tell the parent which page is showing
  const handleScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const c = scrollRef.current;
      if (!c) return;
      const probe = c.scrollTop + c.clientHeight / 3;
      const els = c.querySelectorAll("[data-page]");
      let current = 1;
      for (let i = 0; i < els.length; i++) {
        if (els[i].offsetTop <= probe) current = i + 1;
        else break;
      }
      onVisiblePage?.(current);
    });
  };

  // 5) Jump to a page when asked (page buttons / keyboard / after zoom)
  useEffect(() => {
    if (!jumpTo) return;
    const c = scrollRef.current;
    if (!c) return;
    const el = c.querySelector(`[data-page="${jumpTo.page}"]`);
    if (el) c.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "smooth" });
  }, [jumpTo]);

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-auto">
      <div style={{ minWidth: "100%", width: "max-content" }} className="py-3">
        {firstSize && scale > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            data-page={n}
            className="relative mx-auto mb-3 bg-white shadow-lg"
            style={{ width: firstSize.width * scale, height: firstSize.height * scale }}
          >
            <canvas ref={(el) => { canvasRefs.current[n] = el; }} className="block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PDFViewer({ fileUrl, fileName, files, onClose }) {
  // `files` is optional: an array of { fileUrl, fileName } for ←/→
  // navigation between multiple attachments. Falls back to single-file mode.
  const fileList = files && files.length > 0 ? files : [{ fileUrl, fileName }];
  const startIndex = Math.max(0, fileList.findIndex((f) => f.fileUrl === fileUrl));

  const [index, setIndex]     = useState(startIndex);
  const [page, setPage]       = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom]       = useState(1);
  const [jumpTo, setJumpTo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const current    = fileList[index] || fileList[0];
  const currentUrl  = current?.fileUrl;
  const currentName = current?.fileName;

  const ext      = getExtension(currentName, currentUrl);
  const isImage  = IMAGE_EXTENSIONS.includes(ext);
  const isPdf    = ext === "pdf";
  const isOffice = OFFICE_EXTENSIONS.includes(ext);

  // Reset viewer state whenever the active file changes
  useEffect(() => {
    setPage(1);
    setNumPages(0);
    setZoom(1);
    setJumpTo(null);
    setLoading(true);
    setError(false);
    setErrorMsg("");
  }, [index, currentUrl]);

  const goToFile = (newIndex) => {
    if (newIndex < 0 || newIndex >= fileList.length) return;
    setIndex(newIndex);
  };

  const goToPage = (p) => {
    if (!numPages) return;
    const target = Math.min(Math.max(1, p), numPages);
    setPage(target);
    setJumpTo({ page: target, nonce: Date.now() });
  };

  const changeZoom = (delta) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 100) / 100)));
    setJumpTo({ page, nonce: Date.now() });
  };

  // Keyboard navigation: ↑/↓ page, ←/→ file, Esc close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowUp") goToPage(page - 1);
      else if (e.key === "ArrowDown") goToPage(page + 1);
      else if (e.key === "ArrowLeft") goToFile(index - 1);
      else if (e.key === "ArrowRight") goToFile(index + 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, fileList.length, onClose, page, numPages]);

  // Saves the file to the device (a plain <a download> is ignored for
  // files hosted on another domain, so this goes through the helper).
  const handleDownload = () => {
    downloadFile(currentUrl, currentName || "document");
  };

  const officeSrc = isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(currentUrl)}`
    : "";

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">{isImage ? "🖼️" : "📄"}</span>
          <p className="text-[var(--color-text-primary)] text-sm font-medium truncate max-w-xs">{currentName}</p>
          {fileList.length > 1 && (
            <span className="text-[var(--color-text-muted)] text-xs flex-shrink-0">
              {index + 1} / {fileList.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {fileList.length > 1 && (
            <>
              <button
                onClick={() => goToFile(index - 1)}
                disabled={index === 0}
                className="px-3 py-2 bg-[var(--color-bg-surface-alt)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-xl text-sm transition-all cursor-pointer"
                title="Previous file (←)"
              >
                ←
              </button>
              <button
                onClick={() => goToFile(index + 1)}
                disabled={index === fileList.length - 1}
                className="px-3 py-2 bg-[var(--color-bg-surface-alt)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-xl text-sm transition-all cursor-pointer"
                title="Next file (→)"
              >
                →
              </button>
            </>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            ⬇️ Download
          </button>
          <button
            onClick={() => window.open(currentUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            ↗ Open in Tab
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-[var(--color-bg-surface-alt)] hover:bg-red-600 text-[var(--color-text-primary)] hover:text-white rounded-xl text-sm transition-all cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* PDF page + zoom controls */}
      {isPdf && numPages > 0 && !error && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] flex-shrink-0 text-xs text-[var(--color-text-secondary)]">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-2.5 py-1 bg-[var(--color-bg-surface-alt)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-lg cursor-pointer"
            title="Previous page (↑)"
          >
            ‹
          </button>
          <span className="min-w-20 text-center">Page {page} / {numPages}</span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= numPages}
            className="px-2.5 py-1 bg-[var(--color-bg-surface-alt)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-lg cursor-pointer"
            title="Next page (↓)"
          >
            ›
          </button>
          <span className="mx-2 w-px h-4 bg-[var(--color-border)]" />
          <button
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            className="px-2.5 py-1 bg-[var(--color-bg-surface-alt)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-lg cursor-pointer"
            title="Zoom out"
          >
            −
          </button>
          <span className="min-w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="px-2.5 py-1 bg-[var(--color-bg-surface-alt)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-primary)] rounded-lg cursor-pointer"
            title="Zoom in"
          >
            +
          </button>
        </div>
      )}

      {/* Viewer */}
      <div className="flex-1 relative overflow-hidden bg-[var(--color-bg-app)]">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[var(--color-accent-solid)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[var(--color-text-secondary)] text-sm">Loading document...</p>
            </div>
          </div>
        )}

        {isImage && !error && (
          <div className="absolute inset-0 overflow-auto">
            <div className="flex items-center justify-center min-h-full p-6">
              <img
                src={currentUrl}
                alt={currentName}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                onLoad={() => setLoading(false)}
                onError={() => { setLoading(false); setError(true); }}
              />
            </div>
          </div>
        )}

        {isPdf && !error && (
          <PdfCanvasViewer
            key={currentUrl}
            fileUrl={currentUrl}
            zoom={zoom}
            jumpTo={jumpTo}
            onLoaded={(n) => { setNumPages(n); setLoading(false); }}
            onError={(err) => { setLoading(false); setError(true); setErrorMsg(err?.message || ""); }}
            onVisiblePage={setPage}
          />
        )}

        {isOffice && !error && (
          <iframe
            key={officeSrc}
            src={officeSrc}
            title={currentName}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        )}

        {!isImage && !isPdf && !isOffice && !error && (
          <div className="absolute inset-0 overflow-auto flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <p className="text-5xl">📎</p>
              <p className="text-[var(--color-text-primary)] font-semibold">{currentName}</p>
              <p className="text-[var(--color-text-secondary)] text-sm">This file type cannot be previewed directly.</p>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                ⬇️ Download to View
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 overflow-auto flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <p className="text-5xl">⚠️</p>
              <p className="text-[var(--color-text-primary)] font-semibold">Couldn't load preview</p>
              <p className="text-[var(--color-text-secondary)] text-sm">
                {errorMsg || "The file may have expired or can't be displayed in the browser."}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  ⬇️ Download File
                </button>
                <button
                  onClick={() => window.open(currentUrl, "_blank")}
                  className="px-6 py-3 bg-[var(--color-bg-surface-alt)] hover:opacity-80 text-[var(--color-text-primary)] rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  ↗ Open in Tab
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-1.5 bg-[var(--color-bg-surface)] border-t border-[var(--color-border)] text-center text-[var(--color-text-muted)] text-xs flex-shrink-0">
        ↑↓ change page · ←→ switch file · Esc close
      </div>
    </div>
  );
}