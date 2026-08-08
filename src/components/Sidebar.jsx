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
    { icon: "⚙️", label: "Settings",    path: "/settings" },
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
    { icon: "⚙️", label: "Settings",        path: "/settings" },
  ],
  placement: [
    { icon: "🏠", label: "Dashboard",     path: "/placement" },
    { icon: "🏢", label: "Companies",     path: "/placement" },
    { icon: "🧠", label: "DSA Questions", path: "/placement" },
    { icon: "📝", label: "Aptitude Test", path: "/placement" },
    { icon: "📤", label: "Upload Data",   path: "/placement" },
    { icon: "⚙️", label: "Settings",      path: "/settings" },
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
    { icon: "⚙️", label: "Settings",           path: "/settings" },
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
        fixed top-0 left-0 h-full bg-[var(--color-bg-surface)] border-r border-[var(--color-border)] z-30 flex flex-col
        transition-all duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto
        ${collapsed ? "w-20" : "w-64"}
      `}>
        {/* Logo + collapse toggle */}
        <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${roleColor} flex items-center justify-center text-lg shadow-lg`}>
              🏫
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[var(--color-text-primary)] font-bold text-sm leading-tight truncate">CSEAIML</p>
                <p className="text-[var(--color-text-muted)] text-xs truncate">LMS Portal</p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setCollapsed((c) => !c);
              setMobileOpen && setMobileOpen(false);
            }}
            className="w-7 h-7 flex-shrink-0 rounded-lg bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-all"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] mx-3 mt-3 rounded-xl bg-[var(--color-bg-surface-alt)]">
          {collapsed ? (
            <p className="text-[var(--color-text-primary)] text-sm font-semibold text-center">
              {(user?.name || "?").charAt(0).toUpperCase()}
            </p>
          ) : (
            <>
              <p className="text-[var(--color-text-primary)] text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-[var(--color-text-secondary)] text-xs capitalize truncate">{subLabel}</p>
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
                    ? "bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] text-white shadow-lg"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <button onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 cursor-pointer
              ${collapsed ? "justify-center" : ""}`}>
            <span>🚪</span> {!collapsed && "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}