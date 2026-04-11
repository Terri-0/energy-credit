import { X } from "lucide-react";
import { MINT_RATE, MINT_FEE, fmtWh } from "../constants";
import { PrimaryBtn, GhostBtn } from "./ui";

export default function MintModal({ batch, onConfirm, onCancel, loading }) {
  const ecGross = +(batch.wh_remaining * MINT_RATE).toFixed(4);
  const ecFee   = +(ecGross * MINT_FEE).toFixed(4);
  const ecNet   = +(ecGross - ecFee).toFixed(4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-lg font-black text-slate-900">Confirm Mint</p>
            <p className="text-sm text-slate-400 mt-0.5">
              Review the EC conversion for batch #{batch.id}
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4 border border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Energy Input</p>
          <p className="text-2xl font-black text-slate-900">{fmtWh(batch.wh_remaining)}</p>
        </div>

        <div className="rounded-xl p-4 mb-5 border space-y-3" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#0369a1" }}>
            EC Conversion
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">
                {batch.wh_remaining.toLocaleString()} Wh × {MINT_RATE} EC/Wh
              </span>
              <span className="font-semibold text-slate-800">{ecGross.toFixed(4)} EC gross</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Platform fee ({(MINT_FEE * 100).toFixed(0)}% burned)</span>
              <span className="font-semibold text-red-400">− {ecFee.toFixed(4)} EC</span>
            </div>
            <div
              className="flex justify-between items-center pt-3 mt-1 border-t"
              style={{ borderColor: "#bae6fd" }}
            >
              <span className="font-bold text-base" style={{ color: "#0369a1" }}>You receive</span>
              <span className="font-black text-2xl" style={{ color: "#38bdf8" }}>{ecNet.toFixed(4)} EC</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          This batch will be consumed. The EC is added to your balance immediately.
        </p>

        <div className="flex gap-3">
          <PrimaryBtn onClick={onConfirm} disabled={loading} className="flex-1 py-3 text-base">
            {loading ? "Minting…" : `Mint ${ecNet.toFixed(4)} EC`}
          </PrimaryBtn>
          <GhostBtn onClick={onCancel} className="px-6">Cancel</GhostBtn>
        </div>
      </div>
    </div>
  );
}
