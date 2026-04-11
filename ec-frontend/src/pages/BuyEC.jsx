import { useState } from "react";
import { CreditCard, AlertTriangle, Info } from "lucide-react";
import client from "../api/client";
import { apiError, GRID_PRICE_CAD } from "../constants";
import { Card, PrimaryBtn, PageHeader, ErrMsg } from "../components/ui";

export default function BuyEC({ user, updateUser }) {
  const [CAD, setCAD] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const TIERS = [10, 25, 50, 100];

  const fiat      = CAD && parseFloat(CAD) > 0 ? parseFloat(CAD) : null;
  const ecPreview = fiat ? (fiat / GRID_PRICE_CAD).toFixed(2) : null;

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/economy/buy-ec", { fiat_amount: parseFloat(CAD) });
      updateUser({ ec_balance: user.ec_balance + data.purchase.ec_amount });
      setResult(data.purchase);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="p-7 max-w-lg">
        <div className="flex flex-col items-center text-center py-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "#f0f9ff" }}>
            <CreditCard size={36} style={{ color: "#38bdf8" }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Purchase Complete!</h2>
          <p className="text-slate-500 text-sm">
            You bought <strong>${result.fiat_amount.toFixed(2)} CAD</strong> worth of EnergyCredits
          </p>
          <p className="text-5xl font-black mt-3 mb-1" style={{ color: "#38bdf8" }}>{result.ec_amount.toFixed(2)} EC</p>
          <p className="text-xs text-slate-400 mb-6">added to your balance</p>
          <PrimaryBtn onClick={() => { setResult(null); setCAD(""); }} className="w-full max-w-xs py-3">
            Buy More EC
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-md">
      <PageHeader title="Buy EC" sub="Purchase EnergyCredits with fiat currency" />

      <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-5 border" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
        <AlertTriangle size={14} style={{ color: "#d97706" }} className="shrink-0" />
        <p className="text-xs font-semibold" style={{ color: "#92400e" }}>Simulated — no real payment processed</p>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Select</p>
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => {
              const active = CAD === String(t);
              return (
                <button
                  key={t}
                  onClick={() => { setError(""); setCAD(String(t)); }}
                  className="py-2.5 rounded-xl text-sm font-bold border transition-all"
                  style={{
                    background:  active ? "#38bdf8" : "#fff",
                    color:       active ? "#fff"    : "#475569",
                    borderColor: active ? "#38bdf8" : "#e2e8f0",
                  }}
                >
                  ${t}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Custom Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
            <input
              type="number"
              value={CAD}
              onChange={(e) => { setError(""); setCAD(e.target.value); }}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl pl-8 pr-16 py-2.5 text-sm text-slate-800 bg-white focus:outline-none transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">CAD</span>
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-center justify-between border" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#0369a1" }}>EC You'll Receive</p>
            <p className="text-3xl font-black" style={{ color: "#38bdf8" }}>{ecPreview ? `${ecPreview} EC` : "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">Rate</p>
            <p className="text-sm font-bold text-slate-700">$0.10 CAD per EC</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <Info size={11} className="shrink-0 mt-0.5" /> Simulated purchase. No real funds are charged.
        </p>

        <ErrMsg msg={error} />

        <PrimaryBtn onClick={submit} disabled={loading || !ecPreview} className="w-full py-3 text-base">
          {loading ? "Processing…" : `Purchase ${ecPreview ? `${ecPreview} EC` : "EC"}`}
        </PrimaryBtn>
      </Card>
    </div>
  );
}
