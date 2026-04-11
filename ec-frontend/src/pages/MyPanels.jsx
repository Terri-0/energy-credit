import { useState } from "react";
import { Sun, Plus, Check } from "lucide-react";
import client from "../api/client";
import { apiError, fmtWh, fmtDate } from "../constants";
import { Card, PrimaryBtn, GhostBtn, FormInput, ErrMsg } from "../components/ui";

export default function MyPanels({ panels, setPanels, user, updateUser }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", capacity: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => { setError(""); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const totalCapacityKw = panels.reduce((s, p) => s + p.capacity_wh / 1000, 0);

  const add = async () => {
    if (!form.name || !form.capacity) return;
    setError("");
    setLoading(true);
    try {
      await client.post("/panels/register", { name: form.name, capacity_wh: parseFloat(form.capacity) * 1000 });
      const panelRes = await client.get("/panels");
      setPanels(panelRes.data.panels ?? []);
      if (!user.has_panels) updateUser({ has_panels: true });
      setForm({ name: "", capacity: "" });
      setShowForm(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-7 max-w-3xl">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Panels</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {panels.length} panels · {totalCapacityKw.toFixed(1)} kW total capacity
          </p>
        </div>
        <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} /> Add Panel
        </PrimaryBtn>
      </div>

      {showForm && (
        <div className="rounded-2xl border p-6 mb-6 space-y-4" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <p className="text-sm font-bold text-slate-800">Register New Panel</p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Panel Name" value={form.name} onChange={set("name")} placeholder="Rooftop Array A" />
            <FormInput label="Capacity (kW)" type="number" value={form.capacity} onChange={set("capacity")} placeholder="5.2" />
          </div>
          <ErrMsg msg={error} />
          <div className="flex gap-3">
            <PrimaryBtn onClick={add} disabled={loading || !form.name || !form.capacity} className="px-6 py-2">
              {loading ? "Registering…" : "Register Panel"}
            </PrimaryBtn>
            <GhostBtn onClick={() => { setShowForm(false); setError(""); }}>Cancel</GhostBtn>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {panels.length === 0 && (
          <div className="text-center py-14 text-slate-400">
            <Sun size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No panels yet — add your first solar panel above.</p>
          </div>
        )}
        {panels.map((p) => {
          const pct      = p.capacity_wh > 0 ? (p.accumulated_wh / p.capacity_wh) * 100 : 0;
          const barColor = pct >= 75 ? "#22c55e" : pct >= 30 ? "#f59e0b" : "#94a3b8";
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#fffbeb" }}>
                  <Sun size={19} style={{ color: "#f59e0b" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Registered {fmtDate(p.registered_at)}</p>
                </div>
                <div className="text-right shrink-0 mr-2">
                  <p className="text-xl font-black text-slate-900">
                    {(p.capacity_wh / 1000).toFixed(1)}{" "}
                    <span className="text-sm font-semibold text-slate-400">kW</span>
                  </p>
                  <p className="text-xs text-slate-400">peak capacity</p>
                </div>
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border"
                  style={{ background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }}
                >
                  <Check size={11} /> Active
                </span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold">Ready to log</span>
                  <span>
                    <span className="font-black" style={{ color: barColor }}>{fmtWh(p.accumulated_wh)}</span>
                    <span className="text-slate-400"> / {fmtWh(p.capacity_wh)} capacity</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {pct >= 100 ? "Full — log now to capture today's output" : `${pct.toFixed(0)}% of daily capacity generated`}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
