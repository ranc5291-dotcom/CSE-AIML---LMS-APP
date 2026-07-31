import { useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall";

function IosInstructionsModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-3">Add to Home Screen</h2>
        <ol className="text-gray-300 text-sm text-left space-y-2 mb-5 list-decimal list-inside">
          <li>Tap the <strong>Share</strong> icon in Safari's toolbar</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
          <li>Tap <strong>Add</strong> in the top-right corner</li>
        </ol>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default function InstallAppButton({ className = "" }) {
  const { isInstallable, isInstalled, isIos, promptInstall } = usePWAInstall();
  const [showIosModal, setShowIosModal] = useState(false);

  // Already installed — render nothing, ever.
  if (isInstalled) return null;

  // iOS Safari can never get a native prompt — show instructions instead.
  if (isIos) {
    return (
      <>
        <button
          onClick={() => setShowIosModal(true)}
          className={
            className ||
            "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all"
          }
        >
          Add to Home Screen
        </button>
        {showIosModal && <IosInstructionsModal onClose={() => setShowIosModal(false)} />}
      </>
    );
  }

  // Not installable yet (e.g. criteria not met, or prompt hasn't fired) — show nothing.
  if (!isInstallable) return null;

  const handleClick = async () => {
    await promptInstall();
  };

  return (
    <button
      onClick={handleClick}
      className={
        className ||
        "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all"
      }
    >
      Install App
    </button>
  );
}