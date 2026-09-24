import { useState, useEffect, useRef } from "react";
import { aiSupportAPI } from "../utils/api";

const QUESTION_LIMIT = 3;
const MAX_CHARS = 500;

const SUGGESTIONS = [
  "Why can't I see my marks?",
  "How do I install the app?",
  "Why am I not getting notifications?",
];

function formatResetTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AIAssistantWidget() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm the LMS assistant. Ask me how anything in this app works — notifications, marks, attendance, notes, complaints and more.",
    },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [resetAt, setResetAt]     = useState(null);
  const [error, setError]         = useState(null);
  const bottomRef = useRef(null);

  const loadStatus = async () => {
    try {
      const s = await aiSupportAPI.status();
      setRemaining(s.remaining);
      setResetAt(s.reset_at || null);
    } catch {
      /* status is non-critical */
    }
  };

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const limitReached = remaining !== null && remaining <= 0;

  // When the limit is hit, re-check automatically once the reset time passes
  useEffect(() => {
    if (!limitReached || !resetAt) return;
    const ms = new Date(resetAt).getTime() - Date.now();
    if (isNaN(ms)) return;
    const t = setTimeout(loadStatus, Math.max(ms, 0) + 1000);
    return () => clearTimeout(t);
  }, [limitReached, resetAt]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading || limitReached) return;

    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await aiSupportAPI.ask(question);
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
      setRemaining(res.remaining);
      setResetAt(res.reset_at || null);
    } catch (err) {
      if (err.status === 429) {
        setRemaining(0);
        if (err.resetAt) setResetAt(err.resetAt);
      } else {
        setError(err.message || "Something went wrong. Please try again.");
        loadStatus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const resetTime = formatResetTime(resetAt);

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] px-5 py-4 text-white flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">🤖 LMS Assistant</h3>
          <p className="text-white/80 text-xs mt-0.5">Ask questions about using this app</p>
        </div>
        {remaining !== null && (
          <span className="text-xs font-medium bg-white/20 rounded-full px-3 py-1.5 flex-shrink-0">
            {remaining}/{QUESTION_LIMIT} left
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
                ${m.role === "user"
                  ? "bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] text-white rounded-br-md"
                  : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-primary)] rounded-bl-md"}`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
              Thinking...
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && !limitReached && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] cursor-pointer transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-500">
          {error}
        </div>
      )}

      {/* Limit reached */}
      {limitReached && (
        <div className="mx-4 mb-3 rounded-xl px-4 py-3 text-sm border bg-yellow-500/10 border-yellow-500/30 text-yellow-500">
          You've used all {QUESTION_LIMIT} questions for now.
          {resetTime ? ` You can ask again after ${resetTime}.` : " Please try again in a few hours."}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[var(--color-border)] p-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading || limitReached}
          placeholder={limitReached ? "Question limit reached" : "Type your question..."}
          className="flex-1 resize-none bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-solid)] text-sm disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={loading || limitReached || !input.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex-shrink-0"
        >
          Send
        </button>
      </div>
      <p className="px-4 pb-3 text-[var(--color-text-muted)] text-[11px]">
        AI can make mistakes. For anything important, contact your department through the Complaint Box.
      </p>
    </div>
  );
}