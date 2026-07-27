import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LMSProvider } from "./context/LMSContext";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import PlacementDashboard from "./pages/PlacementDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ComplaintBox from "./pages/ComplaintBox";
import Events from "./pages/Events";
import Funds from "./pages/Funds";
import Gallery from "./pages/Gallery";

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <LMSProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
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
        </BrowserRouter>
      </LMSProvider>
    </AuthProvider>
  );
}