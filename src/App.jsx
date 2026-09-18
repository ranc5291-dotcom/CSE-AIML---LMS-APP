import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LMSProvider } from "./context/LMSContext";
import { useFCM } from "./hooks/useFCM";
import { PWAInstallProvider } from "./hooks/usePWAInstall";
import Login from "./pages/Login";
import SplashScreen from "./components/SplashScreen";

// Route-level code splitting — each page's JS is only downloaded when
// that route is actually visited, instead of all four dashboards
// (+ every sub-page) being bundled into the initial load.
const StudentDashboard   = lazy(() => import("./pages/StudentDashboard"));
const FacultyDashboard   = lazy(() => import("./pages/FacultyDashboard"));
const PlacementDashboard = lazy(() => import("./pages/PlacementDashboard"));
const AdminDashboard     = lazy(() => import("./pages/AdminDashboard"));
const ComplaintBox       = lazy(() => import("./pages/ComplaintBox"));
const Events             = lazy(() => import("./pages/Events"));
const Funds              = lazy(() => import("./pages/Funds"));
const Gallery            = lazy(() => import("./pages/Gallery"));
const Settings           = lazy(() => import("./pages/Settings"));
const Timetable          = lazy(() => import("./pages/Timetable"));

const ROLE_ROUTES = {
  student: "/student",
  faculty: "/faculty",
  placement: "/placement",
  admin: "/admin",
};

const SPLASH_MIN_DURATION = 2500; // ms the splash stays fully visible
const SPLASH_FADE_DURATION = 500; // ms for the fade-out (matches SplashScreen's transition duration)

// Splash is shown once per browser tab session (not on every return to "/",
// e.g. after logout) — tracked outside the component so it survives
// re-renders/remounts of RootRoute within the same page load.
let splashShownThisSession = false;

function RootRoute() {
  const { user, authLoading } = useAuth();

  // 'splash' -> fully visible, 'fading' -> fade-out in progress, 'done' -> removed
  const [phase, setPhase] = useState(splashShownThisSession ? "done" : "splash");
  const [minDurationDone, setMinDurationDone] = useState(splashShownThisSession);

  // Guards against the fade being triggered more than once (and prevents
  // the "done" timer from being cancelled by an effect re-run).
  const fadeStarted = useRef(splashShownThisSession);

  useEffect(() => {
    if (splashShownThisSession) return;
    const timer = setTimeout(() => setMinDurationDone(true), SPLASH_MIN_DURATION);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fadeStarted.current) return;
    if (minDurationDone && !authLoading) {
      fadeStarted.current = true;
      setPhase("fading");
      const timer = setTimeout(() => {
        splashShownThisSession = true;
        setPhase("done");
      }, SPLASH_FADE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [minDurationDone, authLoading]);

  if (phase !== "done") {
    return <SplashScreen fading={phase === "fading"} />;
  }

  const role = user?.activeRole || user?.role;
  if (user && ROLE_ROUTES[role]) {
    return <Navigate to={ROLE_ROUTES[role]} replace />;
  }
  return <Login />;
}

function ProtectedRoute({ children, role }) {
  const { user, hasRole } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (role && !hasRole(role)) return <Navigate to="/" />;
  return children;
}

// Small, dependency-free fallback so lazy-loaded route chunks don't flash
// a blank white screen while downloading. Uses your theme variables so it
// matches dark/light mode.
function RouteLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-bg-app)]">
      <div className="w-8 h-8 border-2 border-[var(--color-accent-solid)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Separate inner component so useFCM() has access to both the Router
// context (useNavigate, for click-to-navigate on notifications) and the
// Auth context (useAuth, to know which user to register FCM tokens for).
function AppContent() {
  useFCM();

  return (
    <Suspense fallback={<RouteLoader />}>
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
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
        <Route path="/timetable" element={
          <ProtectedRoute><Timetable /></ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <PWAInstallProvider>
      <AuthProvider>
        <LMSProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </LMSProvider>
      </AuthProvider>
    </PWAInstallProvider>
  );
}