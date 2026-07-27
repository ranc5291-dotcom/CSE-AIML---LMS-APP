export default function Navbar({ onMenuClick, title }) {
  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        ☰
      </button>
      <h1 className="text-white font-semibold text-base">{title}</h1>
    </header>
  );
}