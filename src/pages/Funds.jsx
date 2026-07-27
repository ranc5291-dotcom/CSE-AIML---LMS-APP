import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLMS } from "../context/LMSContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const INITIAL_TRANSACTIONS = [
  { id: 1, desc: "Lab Equipment Purchase", amount: -45000, date: "2026-05-15", by: "Admin" },
  { id: 2, desc: "Alumni Donation", amount: 50000, date: "2026-05-01", by: "Alumni" },
];

export default function Funds() {
  const { user } = useAuth();
  const { fundRequests, addFundRequest, removeFundRequest } = useLMS();

  const isAdmin  = user?.role === "admin" || user?.role === "faculty";
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [activeTab, setActiveTab]       = useState("Overview");
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [qrImage, setQrImage]           = useState(null);
  const qrRef                           = useRef(null);

  // Fund request form
  const [showReqForm, setShowReqForm]   = useState(false);
  const [reqForm, setReqForm]           = useState({
    hostName: "", reason: "", totalAmount: "", totalStudents: "",
  });

  // Transaction form
  const [showTxForm, setShowTxForm]     = useState(false);
  const [newTx, setNewTx]               = useState({ desc: "", amount: "", type: "credit" });

  const totalFund = transactions.reduce((sum, t) => sum + t.amount, 0);

  const handleAddRequest = () => {
    const { hostName, reason, totalAmount, totalStudents } = reqForm;
    if (!hostName || !reason || !totalAmount || !totalStudents) {
      alert("All fields are required."); return;
    }
    const total = Number(totalAmount);
    const count = Number(totalStudents);
    addFundRequest({
      hostName,
      reason,
      totalAmount: total,
      perPerson: count > 0 ? Math.ceil(total / count) : total,
      totalStudents: count,
    });
    setReqForm({ hostName: "", reason: "", totalAmount: "", totalStudents: "" });
    setShowReqForm(false);
  };

  const handleAddTx = () => {
    if (!newTx.desc || !newTx.amount) return;
    const amount = newTx.type === "credit"
      ? Math.abs(Number(newTx.amount))
      : -Math.abs(Number(newTx.amount));
    setTransactions((prev) => [{
      id: Date.now(), desc: newTx.desc, amount,
      date: new Date().toISOString().split("T")[0],
      by: user?.name,
    }, ...prev]);
    setNewTx({ desc: "", amount: "", type: "credit" });
    setShowTxForm(false);
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} title="Branch Funds" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
            <p className="text-emerald-100 text-sm mb-1">Branch Fund Management 💰</p>
            <h2 className="text-2xl font-bold">Total Available Fund</h2>
            <p className={`text-4xl font-bold mt-2 ${totalFund >= 0 ? "text-emerald-200" : "text-red-300"}`}>
              ₹{Math.abs(totalFund).toLocaleString()}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {["Overview", "Payment Requests", "QR Payment"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                  ${activeTab === tab ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "Overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                  <p className="text-green-400 text-xs mb-1">Total Credits</p>
                  <p className="text-green-400 font-bold text-2xl">
                    ₹{transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                  <p className="text-red-400 text-xs mb-1">Total Debits</p>
                  <p className="text-red-400 font-bold text-2xl">
                    ₹{Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end">
                  <button onClick={() => setShowTxForm(!showTxForm)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all">
                    {showTxForm ? "✕ Cancel" : "+ Add Transaction"}
                  </button>
                </div>
              )}

              {showTxForm && isAdmin && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                  <input value={newTx.desc} onChange={(e) => setNewTx({ ...newTx, desc: e.target.value })}
                    placeholder="Description..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600" />
                  <div className="flex gap-2">
                    <input type="number" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                      placeholder="Amount (₹)"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600" />
                    <select value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer">
                      <option value="credit">+ Credit</option>
                      <option value="debit">− Debit</option>
                    </select>
                  </div>
                  <button onClick={handleAddTx} disabled={!newTx.desc || !newTx.amount}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium cursor-pointer">
                    Add Transaction
                  </button>
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">📋 Transaction History</h3>
                <div className="space-y-2">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                          ${t.amount > 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
                          {t.amount > 0 ? "💚" : "🔴"}
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium">{t.desc}</p>
                          <p className="text-gray-500 text-xs">{t.date} · {t.by}</p>
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
          {activeTab === "Payment Requests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">Payment requests raised by hosts</p>
                <button onClick={() => setShowReqForm(!showReqForm)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-all">
                  {showReqForm ? "✕ Cancel" : "+ Raise Request"}
                </button>
              </div>

              {showReqForm && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-white font-semibold">💳 New Payment Request</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Host Name *</label>
                      <input value={reqForm.hostName}
                        onChange={(e) => setReqForm({ ...reqForm, hostName: e.target.value })}
                        placeholder="e.g. Student Council / Dr. Sharma"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Total Amount (₹) *</label>
                      <input type="number" value={reqForm.totalAmount}
                        onChange={(e) => setReqForm({ ...reqForm, totalAmount: e.target.value })}
                        placeholder="e.g. 15000"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-400 text-xs mb-1 block">Reason for Payment *</label>
                      <textarea value={reqForm.reason}
                        onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
                        placeholder="Describe what the payment is for..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600 resize-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">No. of Students *</label>
                      <input type="number" value={reqForm.totalStudents}
                        onChange={(e) => setReqForm({ ...reqForm, totalStudents: e.target.value })}
                        placeholder="e.g. 60"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600" />
                    </div>
                    <div className="flex items-end">
                      {reqForm.totalAmount && reqForm.totalStudents && Number(reqForm.totalStudents) > 0 && (
                        <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">
                          <p className="text-emerald-300 text-xs">Amount per person</p>
                          <p className="text-emerald-400 font-bold text-lg">
                            ₹{Math.ceil(Number(reqForm.totalAmount) / Number(reqForm.totalStudents)).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={handleAddRequest}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
                    Submit Payment Request
                  </button>
                </div>
              )}

              {fundRequests.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-4xl mb-2">💳</p>
                  <p className="text-sm">No payment requests yet.</p>
                </div>
              )}

              {fundRequests.map((req) => (
                <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Payment Request</p>
                      <h4 className="text-white font-bold text-base">{req.reason}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium
                        ${req.status === "Active" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                        {req.status}
                      </span>
                      {isAdmin && (
                        <button onClick={() => removeFundRequest(req.id)}
                          className="text-gray-600 hover:text-red-400 cursor-pointer transition-colors">🗑️</button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Host</p>
                      <p className="text-white text-xs font-semibold">{req.hostName}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Total Amount</p>
                      <p className="text-emerald-400 font-bold text-sm">₹{req.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                      <p className="text-emerald-300 text-xs mb-1">Per Person</p>
                      <p className="text-emerald-400 font-bold text-lg">₹{req.perPerson.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>👥 {req.totalStudents} students</span>
                    <span>📅 {req.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── QR PAYMENT ── */}
          {activeTab === "QR Payment" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-white font-semibold">📱 Payment QR Scanner</h3>
                <p className="text-gray-400 text-xs">Scan to pay the branch fund directly</p>

                <div className="flex flex-col items-center justify-center bg-gray-800 rounded-2xl p-8 border border-gray-700 min-h-56">
                  {qrImage ? (
                    <>
                      <img src={qrImage} alt="QR Code" className="w-52 h-52 object-contain rounded-xl" />
                      <p className="text-gray-400 text-xs mt-3">Scan this QR to pay branch fund</p>
                    </>
                  ) : (
                    <>
                      <div className="w-32 h-32 bg-gray-700 rounded-xl flex items-center justify-center mb-3">
                        <span className="text-5xl">📲</span>
                      </div>
                      <p className="text-gray-500 text-sm">No QR uploaded yet</p>
                      {!isAdmin && <p className="text-gray-600 text-xs mt-1">Admin will upload the payment QR</p>}
                    </>
                  )}
                </div>

                {isAdmin && (
                  <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer">
                    📤 {qrImage ? "Update QR Code" : "Upload QR Code"}
                    <input ref={qrRef} type="file" accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setQrImage(ev.target.result);
                        reader.readAsDataURL(file);
                      }} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}