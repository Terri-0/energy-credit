import { createPortal } from "react-dom";
import { X, ShoppingCart } from "lucide-react";
import { GRID_PRICE_CAD } from "../constants";
import { PrimaryBtn, GhostBtn } from "./ui";

export default function BuyModal({ listing, onConfirm, onCancel, loading }) {
  const ecCost   = (listing.wh_amount * listing.ec_price).toFixed(4);
  const cadValue = (listing.wh_amount / 1000 * GRID_PRICE_CAD).toFixed(4);
  const pricePerKwh = (listing.ec_price * 1000).toFixed(4);
  const discount = ((1 - listing.ec_price / 0.001) * 100).toFixed(1);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-lg font-black text-slate-900">Confirm Purchase</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {listing.wh_amount.toLocaleString()} Wh from {listing.seller_name ?? `Seller #${listing.seller_id}`}
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4 border border-slate-100 bg-slate-50 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Energy</span>
            <span className="font-semibold text-slate-800">{listing.wh_amount.toLocaleString()} Wh</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Asking price</span>
            <span className="font-semibold text-slate-800">{pricePerKwh} EC/kWh</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Grid value</span>
            <span className="font-semibold text-slate-800">{cadValue} EC at parity</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Your saving vs grid</span>
            <span className="font-semibold" style={{ color: "#16a34a" }}>{discount}% cheaper</span>
          </div>
        </div>

        <div className="rounded-xl p-4 mb-5 border" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-base" style={{ color: "#0369a1" }}>You pay</span>
            <span className="font-black text-2xl" style={{ color: "#38bdf8" }}>
              {ecCost} <span className="text-sm font-semibold">EC</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          EC is deducted from your balance immediately. The energy batch is added to your account.
        </p>

        <div className="flex gap-3">
          <PrimaryBtn onClick={onConfirm} disabled={loading} className="flex-1 py-3 text-base">
            <ShoppingCart size={15} /> {loading ? "Buying…" : `Buy for ${ecCost} EC`}
          </PrimaryBtn>
          <GhostBtn onClick={onCancel} className="px-6">Cancel</GhostBtn>
        </div>
      </div>
    </div>,
    document.body
  );
}
