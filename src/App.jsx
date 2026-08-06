import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LMSProvider } from "./context/LMSContext";
import { useFCM } from "./hooks/useFCM";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import PlacementDashboard from "./pages/PlacementDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ComplaintBox from "./pages/ComplaintBox";
import Events from "./pages/Events";
import Funds from "./pages/Funds";
import Gallery from "./pages/Gallery";

const ROLE_ROUTES = {
  student: "/student",
  faculty: "/faculty",
  placement: "/placement",
  admin: "/admin",
};

// Root route ("/") — if a session already exists in AuthContext (restored
// from localStorage on app load), skip Login entirely and go straight to
// that user's dashboard. This is what prevents the PWA from showing the
// login/role-select screen every time it's reopened despite an active session.
function RootRoute() {
  const { user } = useAuth();
  if (user && ROLE_ROUTES[user.role]) {
    return <Navigate to={ROLE_ROUTES[user.role]} replace />;
  }
  return <Login />;
}

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

// Separate inner component so useFCM() has access to both the Router
// context (useNavigate, for click-to-navigate on notifications) and the
// Auth context (useAuth, to know which user to register FCM tokens for).
function AppContent() {
  useFCM();

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/student" element={
        <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/faculty" element={
        <ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>
      } />
      <Route path="/placement" element={
        <ProtectedRoute role="placement"><PlacementDashboard /></ProtectedRoute>
      } />
      {/* Redirect old/wrong path to correct placement route */}
      <Route path="/placement-info" element={<Navigate to="/placement" replace />} />
      <Route path="/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/complaints" element={
        <ProtectedRoute><ComplaintBox /></ProtectedRoute>
      } />
      <Route path="/events" element={
        <ProtectedRoute><Events /></ProtectedRoute>
      } />
      <Route path="/funds" element={
        <ProtectedRoute><Funds /></ProtectedRoute>
      } />
      <Route path="/gallery" element={
        <ProtectedRoute><Gallery /></ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LMSProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </LMSProvider>
    </AuthProvider>
  );
}