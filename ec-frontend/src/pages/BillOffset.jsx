import { useState } from "react";
import { Receipt, Check } from "lucide-react";
import client from "../api/client";
import { apiError, whToCAD, fmtDate } from "../constants";
import { Card, PrimaryBtn, PageHeader, ExpiryBadge } from "../components/ui";

export default function BillOffset({ batches, setBatches }) {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const available = batches.filter((b) => b.status === "available");

  const toggle = (id) => {
    setError("");
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const sel      = available.filter((b) => selected.includes(b.id));
  const totalWh  = sel.reduce((s, b) => s + b.wh_remaining, 0);
  const savings  = whToCAD(totalWh).toFixed(2);
  const ecEquiv  = whToCAD(totalWh).toFixed(2);

  const apply = async () => {
    if (!sel.length) return;
    setError("");
    setLoading(true);
    const succeededIds = [];
    try {
      for (const batch of sel) {
        await client.post("/economy/offset", { batch_id: batch.id });
        succeededIds.push(batch.id);
      }
      setBatches((prev) => prev.filter((b) => !succeededIds.includes(b.id)));
      setResult({ count: sel.length, totalWh, savings });
      setSelected([]);
    } catch (err) {
      if (succeededIds.length) {
        setBatches((prev) => prev.filter((b) => !succeededIds.includes(b.id)));
        setSelected((prev) => prev.filter((id) => !succeededIds.includes(id)));
      }
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="p-7 max-w-lg">
        <div className="flex flex-col items-center text-center py-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "#f0fdf4" }}>
            <Check size={36} style={{ color: "#16a34a" }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Offset Applied!</h2>
          <p className="text-slate-500 text-sm mb-1">
            {result.count} batch{result.count > 1 ? "es" : ""} · {result.totalWh.toLocaleString()} Wh
          </p>
          <p className="text-5xl font-black mt-2 mb-1" style={{ color: "#16a34a" }}>${result.savings}</p>
          <p className="text-sm text-slate-400 mb-6">credited to your bill</p>
          <PrimaryBtn onClick={() => setResult(null)} className="w-full max-w-xs py-3">Start Over</PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-5xl">
      <PageHeader title="Bill Offset" sub="Select energy batches to offset your electricity bill" />

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {available.length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No available batches — log energy to create batches.</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <div className="flex-1 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Choose Batches</p>
            {available.map((b) => {
              const on = selected.includes(b.id);
              const batchSavings = whToCAD(b.wh_remaining).toFixed(2);
              return (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className="w-full text-left rounded-2xl border p-4 transition-all"
                  style={{
                    borderColor: on ? "#38bdf8" : "#f1f5f9",
                    background:  on ? "#f0f9ff" : "#fff",
                    boxShadow:   on ? "0 0 0 2px #bae6fd" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{ borderColor: on ? "#38bdf8" : "#cbd5e1", background: on ? "#38bdf8" : "transparent" }}
                    >
                      {on && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">#{b.id}</p>
                      <p className="text-xs text-slate-400">Expires {fmtDate(b.expires_at)}</p>
                    </div>
                    <div className="text-right mr-3">
                      <p className="font-black text-slate-900">
                        {b.wh_remaining.toLocaleString()}{" "}
                        <span className="text-xs font-semibold text-slate-400">Wh</span>
                      </p>
                      <p className="text-xs text-slate-400">≈ ${batchSavings} CAD savings</p>
                    </div>
                    <ExpiryBadge level={b.warning_level} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="w-64 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Summary</p>
            <Card className="p-5 sticky top-6">
              <div className="space-y-3 mb-5">
                {[
                  { label: "Batches selected", value: selected.length },
                  { label: "Total energy",     value: `${totalWh.toLocaleString()} Wh` },
                  { label: "Grid value",        value: `$${ecEquiv} CAD` },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{r.label}</span>
                    <span className="font-bold text-slate-800">{r.value}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-slate-500">Est. Bill Savings</span>
                    <span className="text-2xl font-black" style={{ color: "#16a34a" }}>${savings}</span>
                  </div>
                </div>
              </div>
              <PrimaryBtn onClick={apply} disabled={selected.length === 0 || loading} className="w-full py-3">
                {loading ? "Applying…" : "Apply Offset"}
              </PrimaryBtn>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
