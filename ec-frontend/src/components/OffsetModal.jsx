import { createPortal } from "react-dom";
import { X, Leaf } from "lucide-react";
import { GRID_PRICE_CAD, fmtWh } from "../constants";
import { PrimaryBtn, GhostBtn } from "./ui";

export default function OffsetModal({ batches, onConfirm, onCancel, loading }) {
  const totalWh  = batches.reduce((s, b) => s + b.wh_remaining, 0);
  const totalCAD = (totalWh / 1000 * GRID_PRICE_CAD).toFixed(2);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-lg font-black text-slate-900">Confirm Bill Offset</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {batches.length} batch{batches.length !== 1 ? "es" : ""} will be applied to your bill
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4 border border-slate-100 bg-slate-50 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Batches</p>
          {batches.map((b) => (
            <div key={b.id} className="flex justify-between text-sm">
              <span className="text-slate-500">Batch #{b.id}</span>
              <span className="font-semibold text-slate-800">{fmtWh(b.wh_remaining)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-4 mb-5 border space-y-3" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#15803d" }}>
            Offset Summary
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total energy</span>
              <span className="font-semibold text-slate-800">{totalWh.toLocaleString()} Wh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Grid rate</span>
              <span className="font-semibold text-slate-800">${GRID_PRICE_CAD.toFixed(2)}/kWh</span>
            </div>
            <div className="flex justify-between items-baseline pt-3 mt-1 border-t" style={{ borderColor: "#bbf7d0" }}>
              <span className="font-bold text-base" style={{ color: "#15803d" }}>Est. bill credit</span>
              <span className="font-black text-2xl" style={{ color: "#16a34a" }}>${totalCAD} CAD</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          These batches will be consumed. No EC is charged — the energy value is credited directly to your electricity bill.
        </p>

        <div className="flex gap-3">
          <PrimaryBtn
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 text-base"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
          >
            <Leaf size={15} /> {loading ? "Applying…" : `Apply $${totalCAD} Offset`}
          </PrimaryBtn>
          <GhostBtn onClick={onCancel} className="px-6">Cancel</GhostBtn>
        </div>
      </div>
    </div>,
    document.body
  );
}
