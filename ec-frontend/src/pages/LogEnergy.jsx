import { useState } from "react";
import { Zap, Clock } from "lucide-react";
import client from "../api/client";
import { apiError, fmtWh } from "../constants";
import { Card, PrimaryBtn, FormSelect, PageHeader, ErrMsg } from "../components/ui";

export default function LogEnergy({ panels, setPanels, setBatches }) {
  const [panelId, setPanelId] = useState("");
  const [wh, setWh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedPanel = panels.find((p) => String(p.id) === panelId) ?? null;
  const accumulated   = selectedPanel?.accumulated_wh ?? 0;
  const capacity      = selectedPanel?.capacity_wh ?? 0;

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/energy/log", { panel_id: parseInt(panelId, 10), wh_amount: wh });
      const [batchRes, panelRes] = await Promise.all([client.get("/energy/batches"), client.get("/panels")]);
      setBatches(batchRes.data.batches ?? []);
      setPanels(panelRes.data.panels ?? []);
      setResult({ wh, batch: data.batch });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setPanelId(""); setWh(0); };

  if (result) {
    return (
      <div className="p-7 max-w-lg">
        <div className="flex flex-col items-center text-center py-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "#f0f9ff" }}>
            <Zap size={36} style={{ color: "#38bdf8" }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Energy Logged!</h2>
          <p className="text-slate-500 text-sm mb-1">Batch created for <strong>{fmtWh(result.wh)}</strong></p>
          <p className="text-sm text-slate-400 mt-3 mb-6 max-w-xs">
            Go to the Dashboard to mint EC, list on the marketplace, or apply to your bill.
          </p>
          <PrimaryBtn onClick={reset} className="w-full max-w-xs py-3">Log Another Batch</PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-lg">
      <PageHeader title="Log Energy" sub="Select a panel and choose how much energy to log from today's output" />

      <Card className="p-6 space-y-6">
        {panels.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 text-sm text-slate-500">
            No panels registered yet — go to My Panels to add one.
          </div>
        ) : (
          <>
            <FormSelect
              label="Solar Panel"
              value={panelId}
              onChange={(e) => { setError(""); setPanelId(e.target.value); setWh(0); }}
            >
              <option value="">— Select a panel —</option>
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {(p.capacity_wh / 1000).toFixed(2)} kW ({p.capacity_wh.toLocaleString()} Wh capacity)
                </option>
              ))}
            </FormSelect>

            {selectedPanel && (
              <>
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#f0f9ff", borderColor: "#bae6fd", border: "1px solid" }}>
                  <span className="font-semibold text-slate-700">Available to log: </span>
                  <span style={{ color: "#0284c7" }} className="font-black">{fmtWh(accumulated)}</span>
                  <span className="text-slate-400 ml-2 text-xs">of {fmtWh(capacity)} panel capacity</span>
                </div>

                {accumulated <= 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">Panel is still generating — check back later.</p>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Energy to Log</label>
                        <span className="text-sm font-black text-slate-900">{fmtWh(wh)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={accumulated}
                        step={Math.max(1, Math.round(accumulated / 200))}
                        value={wh}
                        onChange={(e) => { setError(""); setWh(Number(e.target.value)); }}
                        className="w-full accent-sky-400"
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>0 Wh</span>
                        <span className="font-semibold" style={{ color: "#38bdf8" }}>Max: {fmtWh(accumulated)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {[0.25, 0.5, 0.75, 1].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setWh(Math.round(accumulated * pct))}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all"
                          style={{
                            background:   wh === Math.round(accumulated * pct) ? "#38bdf8" : "#f8fafc",
                            color:        wh === Math.round(accumulated * pct) ? "#fff"    : "#475569",
                            borderColor:  wh === Math.round(accumulated * pct) ? "#38bdf8" : "#e2e8f0",
                          }}
                        >
                          {pct * 100}%
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Clock size={11} /> Batch expires 30 days after logging.
        </p>

        <ErrMsg msg={error} />

        <PrimaryBtn
          onClick={submit}
          disabled={loading || !panelId || wh <= 0 || accumulated <= 0}
          className="w-full py-3 text-base"
        >
          {loading ? "Logging…" : "Log Energy Output"}
        </PrimaryBtn>
      </Card>
    </div>
  );
}
