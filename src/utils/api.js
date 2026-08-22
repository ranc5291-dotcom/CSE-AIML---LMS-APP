// ============================================================
// CSEAIML LMS — API Service
// All calls go to FastAPI backend at localhost:8000
// ============================================================

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function sendNotification({ title, body, url = "/", role = null, userIds = null, year = null, semester = null }) {
  try {
    const res = await fetch(`${BASE_URL}/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, url, role, userIds, year, semester }),
    });
    if (!res.ok) console.warn("Notification send failed:", await res.text());
    return res.ok;
  } catch (err) {
    console.warn("Notification send error:", err.message);
    return false;
  }
}

// ── Helper ────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("lms_token");
}

async function request(method, path, body = null, isFormData = false) {
  const token = getToken();

  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const config = {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : null,
  };

  const res = await fetch(`${BASE_URL}${path}`, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Something went wrong");
  }
  return data;
}

const get  = (path)         => request("GET",    path);
const post = (path, body, isFormData = false) => request("POST", path, body, isFormData);
const patch = (path, body)  => request("PATCH",  path, body);
const del  = (path)         => request("DELETE", path);


// ── AUTH ──────────────────────────────────────────────────────
export const authAPI = {
  registerStudent: (data) => post("/auth/register/student", data),
  registerStaff: (data) => post("/auth/register/staff", data),
  login: (email, password, role) =>
    post("/auth/login", { email, password, role }),
  forgotPassword: (email) =>
    post("/auth/forgot-password", { email }),
  resetPassword: (token, new_password) =>
    post("/auth/reset-password", { token, new_password }),
  getAllStudents: () => get("/auth/students"),
  getAllUsers: () => get("/auth/users"),
};


// ── NOTES ─────────────────────────────────────────────────────
export const notesAPI = {
  upload: (file, subject, type, sem, uploadedBy) => {
    const form = new FormData();
    form.append("file",       file);
    form.append("subject",    subject);
    form.append("type",       type);
    form.append("sem",        sem);
    form.append("uploadedBy", uploadedBy);
    return post("/notes/upload", form, true);
  },
  getBySem: (sem) => get(`/notes/${encodeURIComponent(sem)}`),
  getAll: () => get("/notes/"),
  delete: (id) => del(`/notes/${id}`),
};


// ── ASSIGNMENTS ───────────────────────────────────────────────
export const assignmentsAPI = {
  upload: (data, file = null) => {
    const form = new FormData();
    form.append("title",      data.title);
    form.append("subject",    data.subject);
    form.append("due",        data.due);
    form.append("sem",        data.sem);
    form.append("uploadedBy", data.uploadedBy);
    if (file) form.append("file", file);
    return post("/assignments/upload", form, true);
  },
  getBySem: (sem) => get(`/assignments/${encodeURIComponent(sem)}`),
  delete: (id) => del(`/assignments/${id}`),
};


// ── ATTENDANCE ────────────────────────────────────────────────
export const attendanceAPI = {
  update: (studentId, studentName, subject, sem, value) =>
    post("/attendance/update", { studentId, studentName, subject, sem, value }),
  getByStudent: (studentId) => get(`/attendance/${studentId}`),
  getBySem: (sem) => get(`/attendance/sem/${encodeURIComponent(sem)}`),
};


// ── MARKS ─────────────────────────────────────────────────────
export const marksAPI = {
  update: (studentId, studentName, subject, sem, value) =>
    post("/marks/update", { studentId, studentName, subject, sem, value }),
  getByStudent: (studentId) => get(`/marks/${studentId}`),
  getBySem: (sem) => get(`/marks/sem/${encodeURIComponent(sem)}`),
};


// ── COMPLAINTS ────────────────────────────────────────────────
export const complaintsAPI = {
  add: (data, by) =>
    post(`/complaints/?by=${encodeURIComponent(by)}`, data),
  getAll: () => get("/complaints/"),
  updateStatus: (id, status) =>
    patch(`/complaints/${id}/status`, { status }),
  delete: (id) => del(`/complaints/${id}`),
};


// ── ANNOUNCEMENTS ─────────────────────────────────────────────
export const announcementsAPI = {
  add: (data, postedBy) =>
    post(`/announcements/?postedBy=${encodeURIComponent(postedBy)}`, data),
  getAll: () => get("/announcements/"),
  delete: (id) => del(`/announcements/${id}`),
};


// ── EVENTS ────────────────────────────────────────────────────
export const eventsAPI = {
  add: (data, organizer) =>
    post(`/events/?organizer=${encodeURIComponent(organizer)}`, data),
  getAll: () => get("/events/"),
  join: (eventId, userId) =>
    post(`/events/${eventId}/join?userId=${encodeURIComponent(userId)}`),
  delete: (id) => del(`/events/${id}`),
};


// ── COMPANIES ─────────────────────────────────────────────────
export const companiesAPI = {
  add: (data) => post("/companies/", data),
  getAll: () => get("/companies/"),
  delete: (id) => del(`/companies/${id}`),
};