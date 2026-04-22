import { useState, useEffect } from "react";
import { ShoppingCart, Zap, Check, X } from "lucide-react";
import client from "../api/client";
import { apiError, whToCAD, fmtDate } from "../constants";
import { Card, PrimaryBtn, PageHeader, Spinner } from "../components/ui";
import BuyModal from "../components/BuyModal";

export default function Marketplace({ user, updateUser, listings, setListings, setBatches }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buyingId, setBuyingId] = useState(null);
  const [buyErrors, setBuyErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [tab, setTab] = useState("market");
  const [confirmListing, setConfirmListing] = useState(null);

  useEffect(() => {
    client
      .get("/listings")
      .then((res) => setListings(res.data.listings ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [setListings]);

  const buy = async (listing) => {
    setConfirmListing(null);
    setBuyErrors((e) => ({ ...e, [listing.id]: "" }));
    setSuccessMsg("");
    setBuyingId(listing.id);
    try {
      const { data } = await client.post(`/listings/${listing.id}/buy`);
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, status: "filled" } : l));
      updateUser({ ec_balance: user.ec_balance - data.transaction.ec_amount });
      if (data.batch) setBatches((prev) => [...prev, data.batch]);
      setSuccessMsg(`Purchased ${data.transaction.wh_amount.toLocaleString()} Wh for ${data.transaction.ec_amount.toFixed(2)} EC`);
    } catch (err) {
      setBuyErrors((e) => ({ ...e, [listing.id]: apiError(err) }));
    } finally {
      setBuyingId(null);
    }
  };

  const cancel = async (listing) => {
    try {
      await client.delete(`/listings/${listing.id}`);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setBatches((prev) => prev.map((b) => b.id === listing.batch_id ? { ...b, status: "available" } : b));
    } catch (err) {
      setSuccessMsg("");
      setBuyErrors((e) => ({ ...e, [listing.id]: apiError(err) }));
    }
  };

  const market  = listings.filter((l) => l.seller_id !== user.id);
  const mine    = listings.filter((l) => l.seller_id === user.id);
  const visible = tab === "market" ? market : mine;

  const ListingCard = ({ l }) => {
    const isOwn      = l.seller_id === user.id;
    const totalCost  = (l.wh_amount * l.ec_price).toFixed(2);
    const isLoading  = buyingId === l.id;

    return (
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#f0f9ff" }}>
            <Zap size={19} style={{ color: "#38bdf8" }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">{l.wh_amount.toLocaleString()} Wh</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {isOwn ? "You" : (l.seller_name ?? `Seller #${l.seller_id}`)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {(l.ec_price * 1000).toFixed(4)} EC/kWh · Expires {fmtDate(l.expires_at)}
            </p>
            {buyErrors[l.id] && <p className="text-xs text-red-500 mt-1 font-medium">{buyErrors[l.id]}</p>}
          </div>

          <div className="text-right shrink-0 mr-2">
            <p className="text-xl font-black text-slate-900">
              {totalCost} <span className="text-sm font-semibold" style={{ color: "#38bdf8" }}>EC</span>
            </p>
            <p className="text-xs text-slate-400">≈ ${whToCAD(l.wh_amount).toFixed(3)} CAD grid value</p>
          </div>

          {isOwn ? (
            <button
              onClick={() => cancel(l)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all hover:bg-red-50"
              style={{ background: "#fff5f5", color: "#b91c1c", borderColor: "#fecaca" }}
            >
              <X size={13} /> Cancel
            </button>
          ) : (
            <PrimaryBtn onClick={() => setConfirmListing(l)} disabled={isLoading} className="shrink-0">
              {isLoading ? "…" : "Buy Now"}
            </PrimaryBtn>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="p-7 max-w-4xl">
      {confirmListing && (
        <BuyModal
          listing={confirmListing}
          loading={buyingId === confirmListing.id}
          onConfirm={() => buy(confirmListing)}
          onCancel={() => setConfirmListing(null)}
        />
      )}

      <PageHeader title="Marketplace" sub="Buy energy batches from other solar producers" />

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 p-4 rounded-xl border flex items-center gap-3" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <Check size={16} style={{ color: "#16a34a" }} />
          <p className="text-sm font-semibold" style={{ color: "#15803d" }}>{successMsg}</p>
        </div>
      )}

      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-slate-100 w-fit">
        {[
          { key: "market", label: `Market (${market.length})` },
          { key: "mine",   label: `My Listings (${mine.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background:  tab === key ? "#fff" : "transparent",
              color:       tab === key ? "#0f172a" : "#64748b",
              boxShadow:   tab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {tab === "market" ? "No open listings right now." : "You have no active listings."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
      )}
    </div>
  );
}
