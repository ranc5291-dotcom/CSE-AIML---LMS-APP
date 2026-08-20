import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = {
  student: [
    { icon: "🏠", label: "Dashboard",   path: "/student" },
    { icon: "📚", label: "Subjects",    path: "/student", tab: "Notes & Subjects" },
    { icon: "📄", label: "Notes & PYQ", path: "/student", tab: "Notes & Subjects" },
    { icon: "📅", label: "Attendance",  path: "/student", tab: "Attendance" },
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
    { icon: "📚", label: "My Subjects",     path: "/faculty" },
    { icon: "📤", label: "Upload Notes",    path: "/faculty" },
    { icon: "📅", label: "Attendance",      path: "/faculty" },
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

const ROLE_ROUTES = {
  student: "/student",
  faculty: "/faculty",
  placement: "/placement",
  admin: "/admin",
};

const ROLE_ICONS = {
  student: "🎓",
  faculty: "👨‍🏫",
  placement: "💼",
  admin: "🛡️",
};

const ROLE_LABELS = {
  student: "Student",
  faculty: "Faculty",
  placement: "Placement",
  admin: "Admin",
};

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, logout, setActiveRole } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const currentRole = user?.activeRole || user?.role;
  const items = NAV_ITEMS[currentRole] || NAV_ITEMS.student;
  const multiRole = (user?.roles?.length || 0) > 1;

  // The tab the *current page* is actually showing right now. Falls back
  // to "Overview" the same way StudentDashboard's own activeTab state does,
  // so a fresh page load and a client-side nav agree on what's "active".
  const currentTab = location.state?.tab || "Overview";

  const handleNav = (path, tab) => {
    navigate(path, { state: { tab } });
    setMobileOpen && setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSwitchRole = (role) => {
    if (role === currentRole) return;
    setActiveRole(role);
    navigate(ROLE_ROUTES[role] || "/");
    setMobileOpen && setMobileOpen(false);
  };

  const roleColor = ROLE_COLORS[currentRole] || ROLE_COLORS.student;

  const subLabel =
    currentRole === "student"
      ? (user?.usn || "Student")
      : currentRole;

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

        {/* Dashboard switcher — only shown for multi-role users */}
        {multiRole && !collapsed && (
          <div className="px-3 pt-3">
            <p className="text-[var(--color-text-muted)] text-xs font-semibold px-2 mb-1.5 uppercase tracking-wide">
              Switch Dashboard
            </p>
            <div className="space-y-1">
              {user.roles.map((r) => (
                <button
                  key={r}
                  onClick={() => handleSwitchRole(r)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all
                    ${r === currentRole
                      ? "bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] text-white shadow-md"
                      : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                    }`}
                >
                  <span>{ROLE_ICONS[r] || "🔑"}</span>
                  {ROLE_LABELS[r] || r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {items.map((item, idx) => {
            // A nav item is "active" only when both the path AND the tab
            // match what's actually being shown. Items with no `tab` (like
            // Dashboard) are only active on the default "Overview" tab —
            // otherwise every "/student" item lit up together regardless
            // of which section you were actually viewing.
            const isCurrentPage =
              location.pathname === item.path &&
              (item.tab ? item.tab === currentTab : currentTab === "Overview");

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