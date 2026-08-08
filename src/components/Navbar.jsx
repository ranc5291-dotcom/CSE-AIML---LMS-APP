import InstallAppButton from "./InstallAppButton";

export default function Navbar({ onMenuClick, title }) {
  return (
    <header className="h-14 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] flex items-center px-4 gap-4 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
      >
        ☰
      </button>
      <h1 className="text-[var(--color-text-primary)] font-semibold text-base flex-1">{title}</h1>
      <InstallAppButton className="px-3 py-1.5 bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] hover:opacity-90 text-white rounded-lg text-xs font-medium cursor-pointer transition-all" />
    </header>
  );
}