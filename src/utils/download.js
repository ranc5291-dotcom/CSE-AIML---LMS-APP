// src/utils/download.js
// Makes every "Download" button actually download the file.
//
// Browsers ignore <a download="..."> for cross-origin URLs (Cloudinary,
// Supabase Storage), so the link just opens the file instead of saving it.
// - Cloudinary: insert the fl_attachment flag so the server sends it as an attachment
// - Supabase Storage: append ?download=filename
// - Anything else: fetch as a blob and save it (falls back to opening in a new tab)

const isCloudinary = (u) => u.includes("res.cloudinary.com") && u.includes("/upload/");
const isSupabase = (u) => u.includes(".supabase.co/storage/");

function cloudinaryAttachmentUrl(url, filename) {
  const isRaw = url.includes("/raw/upload/");
  const base = isRaw
    ? (filename || "download").replace(/[^\w.-]+/g, "_") // raw files: keep the extension
    : (filename || "download").replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_"); // image/pdf: Cloudinary re-adds it
  return url.replace("/upload/", `/upload/fl_attachment:${base}/`);
}

function clickLink(href, name) {
  const a = document.createElement("a");
  a.href = href;
  if (name) a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadFile(url, filename = "download") {
  if (!url) return;

  if (isCloudinary(url)) {
    clickLink(cloudinaryAttachmentUrl(url, filename));
    return;
  }

  if (isSupabase(url)) {
    const sep = url.includes("?") ? "&" : "?";
    clickLink(`${url}${sep}download=${encodeURIComponent(filename)}`);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const blobUrl = URL.createObjectURL(await res.blob());
    clickLink(blobUrl, filename);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}