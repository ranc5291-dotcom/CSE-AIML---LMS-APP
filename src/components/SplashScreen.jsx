export default function SplashScreen({ fading = false }) {
  return (
    <div
      className={`min-h-screen bg-[var(--color-bg-app)] flex flex-col items-center justify-center gap-4 transition-opacity duration-500 ease-out ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30 p-2 flex items-center justify-center">
        <img
          src="/icons/icon-512.png"
          alt="CSE(AIML) LMS"
          className="w-full h-full object-contain rounded-2xl"
        />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
          CSE(AIML)
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1 text-sm">
          Learning Management System
        </p>
      </div>
    </div>
  );
}