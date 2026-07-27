import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = {
  student: [
    { icon: "🏠", label: "Dashboard",   path: "/student" },
    { icon: "📚", label: "Subjects",    path: "/student", tab: "Notes & Subjects" },
    { icon: "📄", label: "Notes & PYQ", path: "/student", tab: "Notes & Subjects" },
    { icon: "📅", label: "Attendance",  path: "/student", tab: "Marks" },
    { icon: "🏆", label: "My Marks",    path: "/student", tab: "Marks" },
    { icon: "📣", label: "Events",      path: "/events" },
    { icon: "💬", label: "Complaints",  path: "/complaints" },
    { icon: "💼", label: "Placements",  path: "/student", tab: "Placement" },
    { icon: "📸", label: "Gallery",     path: "/gallery" },
    { icon: "💰", label: "Funds",       path: "/funds" },
  ],
  faculty: [
    { icon: "🏠", label: "Dashboard",       path: "/faculty" },
    { icon: "📚", label: "Manage Subjects", path: "/faculty" },
    { icon: "📤", label: "Upload Notes",    path: "/faculty" },
    { icon: "📅", label: "Attendance",      path: "/faculty" },
    { icon: "🏆", label: "Mark Sheets",     path: "/faculty" },
    { icon: "📝", label: "Assignments",     path: "/faculty" },
    { icon: "📣", label: "Events",          path: "/events" },
    { icon: "📸", label: "Gallery",         path: "/gallery" },
    { icon: "💬", label: "Complaints",      path: "/complaints" },
    { icon: "💰", label: "Funds",           path: "/funds" },
  ],
  placement: [
    { icon: "🏠", label: "Dashboard",     path: "/placement" },
    { icon: "🏢", label: "Companies",     path: "/placement" },
    { icon: "🧠", label: "DSA Questions", path: "/placement" },
    { icon: "📝", label: "Aptitude Test", path: "/placement" },
    { icon: "📤", label: "Upload Data",   path: "/placement" },
  ],
  admin: [
    { icon: "🏠", label: "Overview",           path: "/admin" },
    { icon: "👥", label: "User Management",    path: "/admin" },
    { icon: "📬", label: "Complaints",         path: "/admin" },
    { icon: "📢", label: "Announcements",      path: "/admin" },
    { icon: "🏆", label: "Marks & Attendance", path: "/admin" },
    { icon: "📣", label: "Events",             path: "/events" },
    { icon: "💰", label: "Funds",              path: "/funds" },
    { icon: "💬", label: "Complaint Box",      path: "/complaints" },
  ],
};

const ROLE_COLORS = {
  student:   "from-blue-500 to-violet-600",
  faculty:   "from-violet-500 to-purple-600",
  placement: "from-amber-500 to-orange-600",
  admin:     "from-rose-500 to-red-600",
};

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  // Desktop collapse state — independent from mobile open/close
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV_ITEMS[user?.role] || NAV_ITEMS.student;

  const handleNav = (path, tab) => {
    navigate(path, { state: { tab } });
    setMobileOpen && setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.student;

  // What to show under the name: USN for students, role for everyone else
  const subLabel =
    user?.role === "student"
      ? (user?.usn || "Student")
      : user?.role;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full bg-gray-900 border-r border-gray-800 z-30 flex flex-col
        transition-all duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto
        ${collapsed ? "w-20" : "w-64"}
      `}>
        {/* Logo + collapse toggle */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${roleColor} flex items-center justify-center text-lg shadow-lg`}>
              🏫
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">CSEAIML</p>
                <p className="text-gray-500 text-xs truncate">LMS Portal</p>
              </div>
            )}
          </div>

          {/* Toggle button — collapses/expands on desktop, closes on mobile */}
          <button
            onClick={() => {
              setCollapsed((c) => !c);
              setMobileOpen && setMobileOpen(false);
            }}
            className="w-7 h-7 flex-shrink-0 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer transition-all"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-gray-800 mx-3 mt-3 rounded-xl bg-gray-800/50">
          {collapsed ? (
            <p className="text-white text-sm font-semibold text-center">
              {(user?.name || "?").charAt(0).toUpperCase()}
            </p>
          ) : (
            <>
              <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-gray-400 text-xs capitalize truncate">{subLabel}</p>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {items.map((item, idx) => {
            const isCurrentPage = location.pathname === item.path;

            return (
              <button
                key={`${item.path}-${idx}`}
                onClick={() => handleNav(item.path, item.tab)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-left
                  ${collapsed ? "justify-center" : ""}
                  ${isCurrentPage
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-800">
          <button onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 cursor-pointer
              ${collapsed ? "justify-center" : ""}`}>
            <span>🚪</span> {!collapsed && "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}