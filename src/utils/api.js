// ============================================================
// CSEAIML LMS — API Service
// All calls go to FastAPI backend at localhost:8000
// ============================================================

const BASE_URL = "http://localhost:8000";

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

  // Student registration
  registerStudent: (data) => post("/auth/register/student", data),

  // Staff registration (faculty/placement/admin)
  registerStaff: (data) => post("/auth/register/staff", data),

  // Login (all roles)
  login: (email, password, role) =>
    post("/auth/login", { email, password, role }),

  // Forgot password
  forgotPassword: (email) =>
    post("/auth/forgot-password", { email }),

  // Reset password
  resetPassword: (token, new_password) =>
    post("/auth/reset-password", { token, new_password }),

  // Get all students (admin)
  getAllStudents: () => get("/auth/students"),

  // Get all users (admin)
  getAllUsers: () => get("/auth/users"),
};


// ── NOTES ─────────────────────────────────────────────────────
export const notesAPI = {

  // Upload note with file
  upload: (file, subject, type, sem, uploadedBy) => {
    const form = new FormData();
    form.append("file",       file);
    form.append("subject",    subject);
    form.append("type",       type);
    form.append("sem",        sem);
    form.append("uploadedBy", uploadedBy);
    return post("/notes/upload", form, true);
  },

  // Get notes by sem
  getBySem: (sem) => get(`/notes/${encodeURIComponent(sem)}`),

  // Get all notes
  getAll: () => get("/notes/"),

  // Delete note
  delete: (id) => del(`/notes/${id}`),
};


// ── ASSIGNMENTS ───────────────────────────────────────────────
export const assignmentsAPI = {

  // Upload assignment (with optional file)
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

  // Get assignments by sem
  getBySem: (sem) => get(`/assignments/${encodeURIComponent(sem)}`),

  // Delete assignment
  delete: (id) => del(`/assignments/${id}`),
};


// ── ATTENDANCE ────────────────────────────────────────────────
export const attendanceAPI = {

  // Update attendance
  update: (studentId, studentName, subject, sem, value) =>
    post("/attendance/update", { studentId, studentName, subject, sem, value }),

  // Get student's attendance
  getByStudent: (studentId) => get(`/attendance/${studentId}`),

  // Get sem attendance (all students)
  getBySem: (sem) => get(`/attendance/sem/${encodeURIComponent(sem)}`),
};


// ── MARKS ─────────────────────────────────────────────────────
export const marksAPI = {

  // Update mark
  update: (studentId, studentName, subject, sem, value) =>
    post("/marks/update", { studentId, studentName, subject, sem, value }),

  // Get student's marks
  getByStudent: (studentId) => get(`/marks/${studentId}`),

  // Get sem marks (all students)
  getBySem: (sem) => get(`/marks/sem/${encodeURIComponent(sem)}`),
};


// ── COMPLAINTS ────────────────────────────────────────────────
export const complaintsAPI = {

  // Add complaint
  add: (data, by) =>
    post(`/complaints/?by=${encodeURIComponent(by)}`, data),

  // Get all complaints
  getAll: () => get("/complaints/"),

  // Update status
  updateStatus: (id, status) =>
    patch(`/complaints/${id}/status`, { status }),

  // Delete
  delete: (id) => del(`/complaints/${id}`),
};


// ── ANNOUNCEMENTS ─────────────────────────────────────────────
export const announcementsAPI = {

  // Add announcement
  add: (data, postedBy) =>
    post(`/announcements/?postedBy=${encodeURIComponent(postedBy)}`, data),

  // Get all
  getAll: () => get("/announcements/"),

  // Delete
  delete: (id) => del(`/announcements/${id}`),
};


// ── EVENTS ────────────────────────────────────────────────────
export const eventsAPI = {

  // Add event
  add: (data, organizer) =>
    post(`/events/?organizer=${encodeURIComponent(organizer)}`, data),

  // Get all
  getAll: () => get("/events/"),

  // Join / Leave event
  join: (eventId, userId) =>
    post(`/events/${eventId}/join?userId=${encodeURIComponent(userId)}`),

  // Delete
  delete: (id) => del(`/events/${id}`),
};


// ── COMPANIES ─────────────────────────────────────────────────
export const companiesAPI = {

  // Add company
  add: (data) => post("/companies/", data),

  // Get all
  getAll: () => get("/companies/"),

  // Delete
  delete: (id) => del(`/companies/${id}`),
};