import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getFundTransactions, addFundTransaction,
  getFundPaymentRequests, addFundPaymentRequest, updateFundPaymentRequestStatus,
  getFundQR, updateFundQR,
} from "../utils/supabase";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function Funds() {
  const { user } = useAuth();
  // activeRole reflects whichever dashboard a multi-role user is currently
  // on (set by AuthContext.setActiveRole) — falls back to their primary
  // role for single-role users.
  const role = user?.activeRole || user?.role;
  const isAdmin   = role === "admin";
  const isFaculty = role === "faculty";
  const canManageFund = isAdmin;                 // add credit/debit
  const canManageQR    = isAdmin || isFaculty;    // upload/change QR

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState("Overview");

  const [transactions, setTransactions] = useState([]);
  const [requests, setRequests]         = useState([]);
  const [qr, setQr]                     = useState(null);
  const [loading, setLoading]           = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tx, reqs, qrRow] = await Promise.all([
      getFundTransactions(),
      getFundPaymentRequests(),
      getFundQR(),
    ]);
    setTransactions(tx);
    setRequests(reqs);
    setQr(qrRow);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalCredits = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
  const totalDebits  = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0));
  const availableFund = totalCredits - totalDebits; // Available Fund = Total Credits - Total Debits

  // ── Add Credit / Debit (Admin) ──
  const [showTxForm, setShowTxForm] = useState(false);
  const [newTx, setNewTx]           = useState({ title: "", amount: "", type: "credit" });
  const [txSaving, setTxSaving]     = useState(false);

  const handleAddTx = async () => {
    if (!newTx.title || !newTx.amount) return;
    setTxSaving(true);
    const res = await addFundTransaction({
      title: newTx.title, amount: newTx.amount, type: newTx.type, createdBy: user?.id,
    });
    setTxSaving(false);
    if (!res.ok) { alert("Failed to save: " + res.error); return; }
    setNewTx({ title: "", amount: "", type: "credit" });
    setShowTxForm(false);
    loadAll();
  };

  // ── Payment Requests (Student submits, Admin/Faculty view+approve) ──
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef]       = useState("");
  const [payProof, setPayProof]   = useState(null);
  const [paySaving, setPaySaving] = useState(false);
  const [paySuccess, setPaySuccess] = useState("");

  const handleSubmitPayment = async () => {
    if (!payAmount) { alert("Enter the amount you paid."); return; }
    setPaySaving(true);
    const res = await addFundPaymentRequest({
      studentId: user?.id, studentName: user?.name,
      amount: payAmount, transactionRef: payRef, proofFile: payProof,
    });
    setPaySaving(false);
    if (!res.ok) { alert("Failed to submit: " + res.error); return; }
    setPayAmount(""); setPayRef(""); setPayProof(null);
    setPaySuccess("✅ Payment submitted. Admin/Faculty will verify it shortly.");
    setTimeout(() => setPaySuccess(""), 4000);
    loadAll();
  };

  const handleUpdateStatus = async (id, status) => {
    const res = await updateFundPaymentRequestStatus(id, status);
    if (!res.ok) { alert("Failed: " + res.error); return; }
    loadAll();
  };

  const myRequests = requests.filter((r) => r.student_id === user?.id);
  const visibleRequests = role === "student" ? myRequests : requests;

  // ── QR management (Admin/Faculty) ──
  const [qrUploading, setQrUploading] = useState(false);

  const handleUploadQR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQrUploading(true);
    const res = await updateFundQR(file, user?.id);
    setQrUploading(false);
    if (!res.ok) { alert("QR upload failed: " + res.error); return; }
    loadAll();
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-app)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Branch Funds" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-gradient-to-r from-[var(--color-accent-from)] to-[var(--color-accent-to)] rounded-2xl p-5 text-white">
            <p className="text-white/80 text-sm mb-1">Branch Fund Management 💰</p>
            <h2 className="text-2xl font-bold">Total Available Fund</h2>
            <p className={`text-4xl font-bold mt-2 ${availableFund >= 0 ? "text-white" : "text-red-300"}`}>
              ₹{Math.abs(availableFund).toLocaleString()}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {["Overview", "Payment Requests", "QR Payment"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab
                    ? "bg-[var(--color-accent-solid)] text-white"
                    : "bg-[var(--color-bg-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>
                {tab}
              </button>
            ))}
          </div>

          {loading && <p className="text-[var(--color-text-muted)] text-sm">Loading fund data…</p>}

          {/* ── OVERVIEW ── */}
          {!loading && activeTab === "Overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                  <p className="text-green-400 text-xs mb-1">Total Credits</p>
                  <p className="text-green-400 font-bold text-2xl">₹{totalCredits.toLocaleString()}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                  <p className="text-red-400 text-xs mb-1">Total Debits</p>
                  <p className="text-red-400 font-bold text-2xl">₹{totalDebits.toLocaleString()}</p>
                </div>
              </div>

              {canManageFund && (
                <div className="flex justify-end">
                  <button onClick={() => setShowTxForm(!showTxForm)}
                    className="px-4 py-2 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-medium cursor-pointer transition-all">
                    {showTxForm ? "✕ Cancel" : "+ Add Transaction"}
                  </button>
                </div>
              )}

              {showTxForm && canManageFund && (
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4 space-y-3">
                  <input value={newTx.title} onChange={(e) => setNewTx({ ...newTx, title: e.target.value })}
                    placeholder="Title (e.g. Alumni Donation)"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                  <div className="flex gap-2">
                    <input type="number" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                      placeholder="Amount (₹)"
                      className="flex-1 bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                    <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                      className="bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none cursor-pointer">
                      <option value="credit">+ Credit</option>
                      <option value="debit">− Debit</option>
                    </select>
                  </div>
                  <button onClick={handleAddTx} disabled={!newTx.title || !newTx.amount || txSaving}
                    className="w-full py-2 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer">
                    {txSaving ? "Saving..." : "Add Transaction"}
                  </button>
                </div>
              )}

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">📋 Transaction History</h3>
                <div className="space-y-2">
                  {transactions.length === 0 && (
                    <p className="text-[var(--color-text-muted)] text-sm">No transactions yet.</p>
                  )}
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-[var(--color-bg-surface-alt)] rounded-xl px-4 py-3 border border-[var(--color-border)]">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                          ${t.amount > 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                          {t.amount > 0 ? "💚" : "🔴"}
                        </div>
                        <div>
                          <p className="text-[var(--color-text-primary)] text-xs font-medium">{t.title}</p>
                          <p className="text-[var(--color-text-muted)] text-xs">{new Date(t.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className={`font-bold text-sm ${t.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {t.amount > 0 ? "+" : ""}₹{Math.abs(t.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENT REQUESTS ── */}
          {!loading && activeTab === "Payment Requests" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <h3 className="text-[var(--color-text-primary)] font-semibold mb-4">Payment Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left text-[var(--color-text-secondary)] text-xs py-2 pr-4">Student</th>
                        <th className="text-left text-[var(--color-text-secondary)] text-xs py-2 pr-4">Amount</th>
                        <th className="text-left text-[var(--color-text-secondary)] text-xs py-2 pr-4">Status</th>
                        {(isAdmin || isFaculty) && <th className="text-left text-[var(--color-text-secondary)] text-xs py-2">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRequests.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--color-border)]/50">
                          <td className="py-3 pr-4 text-[var(--color-text-primary)] text-xs">{r.student_name}</td>
                          <td className="py-3 pr-4 text-[var(--color-text-primary)] text-xs">₹{Number(r.amount).toLocaleString()}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${r.status === "Approved" ? "bg-green-500/20 text-green-400" :
                                r.status === "Rejected" ? "bg-red-500/20 text-red-400" :
                                "bg-amber-500/20 text-amber-400"}`}>
                              {r.status}
                            </span>
                          </td>
                          {(isAdmin || isFaculty) && (
                            <td className="py-3 flex gap-2">
                              {r.status === "Pending" && (
                                <>
                                  <button onClick={() => handleUpdateStatus(r.id, "Approved")}
                                    className="px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs cursor-pointer">Approve</button>
                                  <button onClick={() => handleUpdateStatus(r.id, "Rejected")}
                                    className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs cursor-pointer">Reject</button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {visibleRequests.length === 0 && (
                        <tr><td colSpan={4} className="py-6 text-center text-[var(--color-text-muted)] text-sm">No payment requests yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── QR PAYMENT ── */}
          {!loading && activeTab === "QR Payment" && (
            <div className="space-y-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
                <h3 className="text-[var(--color-text-primary)] font-semibold">📱 College Fund Payment</h3>
                <p className="text-[var(--color-text-secondary)] text-xs">Scan this QR code to make your payment.</p>

                <div className="flex flex-col items-center justify-center bg-[var(--color-bg-surface-alt)] rounded-2xl p-8 border border-[var(--color-border)] min-h-56">
                  {qr?.qr_url ? (
                    <img src={qr.qr_url} alt="QR Code" className="w-52 h-52 object-contain rounded-xl" />
                  ) : (
                    <>
                      <div className="w-32 h-32 bg-[var(--color-bg-hover)] rounded-xl flex items-center justify-center mb-3">
                        <span className="text-5xl">📲</span>
                      </div>
                      <p className="text-[var(--color-text-muted)] text-sm">No QR uploaded yet</p>
                      {role === "student" && <p className="text-[var(--color-text-muted)] text-xs mt-1">Admin/Faculty will upload the payment QR</p>}
                    </>
                  )}
                </div>

                {canManageQR && (
                  <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 text-white rounded-xl text-sm font-medium transition-all cursor-pointer">
                    {qrUploading ? "⏳ Uploading..." : qr?.qr_url ? "📤 Update QR Code" : "📤 Upload QR Code"}
                    <input type="file" accept="image/*" onChange={handleUploadQR} disabled={qrUploading} className="hidden" />
                  </label>
                )}
              </div>

              {/* Student payment submission — students only */}
              {role === "student" && (
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3">
                  <h3 className="text-[var(--color-text-primary)] font-semibold">Submit Your Payment</h3>
                  <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount (₹)"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                  <input value={payRef} onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Transaction ID"
                    className="w-full bg-[var(--color-bg-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent-solid)] placeholder-[var(--color-text-muted)]" />
                  <input type="file" accept="image/*" onChange={(e) => setPayProof(e.target.files[0])}
                    className="w-full text-[var(--color-text-secondary)] text-xs" />
                  <button onClick={handleSubmitPayment} disabled={!payAmount || paySaving}
                    className="w-full py-2.5 bg-[var(--color-accent-solid)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer">
                    {paySaving ? "Submitting..." : "Submit Payment"}
                  </button>
                  {paySuccess && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm text-center">{paySuccess}</div>}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}