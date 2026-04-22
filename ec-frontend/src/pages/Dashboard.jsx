import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Coins, Tag, FileCheck, Clock } from "lucide-react";
import client from "../api/client";
import { apiError, fmtWh, whToCAD, fmtDate, GRID_PRICE_CAD } from "../constants";
import { Card, PrimaryBtn, StatCard, PageHeader, Spinner, ExpiryBadge } from "../components/ui";
import MintModal from "../components/MintModal";
import OffsetModal from "../components/OffsetModal";

const STATUS_LABEL = {
  available: { bg: "#f0fdf4", color: "#15803d", text: "Available" },
  listed:    { bg: "#f0f9ff", color: "#0369a1", text: "Listed" },
  minted:    { bg: "#faf5ff", color: "#7c3aed", text: "Minted" },
  offset:    { bg: "#ecfdf5", color: "#059669", text: "Offset" },
  expired:   { bg: "#fef2f2", color: "#b91c1c", text: "Expired" },
};

function BatchRow({ b, archived = false, act, errMsg, lf, onMintClick, onToggleListing, onPriceChange, onSubmitListing, onOffsetBatch }) {
  const sl = STATUS_LABEL[b.status] ?? { bg: "#f8fafc", color: "#64748b", text: b.status };
  const isAvail = b.status === "available";
  const savingsPreview = isAvail ? whToCAD(b.wh_remaining).toFixed(3) : null;

  return (
    <div className={`px-6 py-4 ${archived ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg shrink-0">
          #{b.id}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm">
            {archived ? `${b.wh_remaining.toLocaleString()} Wh` : fmtWh(b.wh_remaining)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Logged {fmtDate(b.created_at)} · Expires {fmtDate(b.expires_at)}
          </p>
        </div>

        <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: sl.bg, color: sl.color }}>
          {sl.text}
        </span>

        {!archived && <ExpiryBadge level={b.warning_level} />}

        {isAvail && (
          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              onClick={onMintClick}
              disabled={act.mint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40"
              style={{ background: "#faf5ff", color: "#7c3aed", borderColor: "#e9d5ff" }}
            >
              <Coins size={14} /> Mint to EC
            </button>
            <button
              onClick={onToggleListing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all"
              style={{ background: "#f0f9ff", color: "#0369a1", borderColor: "#bae6fd" }}
            >
              <Tag size={14} /> {lf.show ? "Cancel" : "List on Market"}
            </button>
            <button
              onClick={onOffsetBatch}
              disabled={act.offset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40"
              style={{ background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }}
            >
              <FileCheck size={14} />
              {act.offset ? "Applying…" : `Offset Bill (~$${savingsPreview} CAD)`}
            </button>
          </div>
        )}
      </div>

      {lf.show && (
        <div className="mt-3 ml-14 p-4 rounded-xl border flex items-end gap-3" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
              Your asking price (EC per kWh)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={lf.ecPrice ?? ""}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder="0.50"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">EC/kWh</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ceiling: 1.00 EC/kWh (grid parity) · Total:{" "}
              <strong>
                {lf.ecPrice && parseFloat(lf.ecPrice) > 0
                  ? ((b.wh_remaining / 1000) * parseFloat(lf.ecPrice)).toFixed(4)
                  : "—"}{" "}
                EC
              </strong>
            </p>
          </div>
          <PrimaryBtn
            onClick={onSubmitListing}
            disabled={act.list || !lf.ecPrice || parseFloat(lf.ecPrice) <= 0}
            className="shrink-0 py-2"
          >
            {act.list ? "Listing…" : "Confirm Listing"}
          </PrimaryBtn>
        </div>
      )}

      {errMsg && <p className="mt-2 ml-14 text-xs text-red-500 font-medium">{errMsg}</p>}
    </div>
  );
}

export default function Dashboard({ user, updateUser, batches, setBatches, reserve, setReserve }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [listingForm, setListingForm] = useState({});
  const [mintConfirm, setMintConfirm] = useState(null);
  const [offsetConfirm, setOffsetConfirm] = useState(null);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([client.get("/energy/batches"), client.get("/economy/reserve")])
      .then(([batchRes, reserveRes]) => {
        if (cancelled) return;
        setBatches(batchRes.data.batches ?? []);
        setReserve(reserveRes.data);
      })
      .catch((err) => { if (!cancelled) setError(apiError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [setBatches, setReserve]);

  const ACTIVE_STATUSES  = ["available", "listed"];
  const ARCHIVE_STATUSES = ["minted", "offset", "expired"];

  const activeBatchList  = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const archiveBatchList = batches.filter((b) => ARCHIVE_STATUSES.includes(b.status));
  const redCount         = activeBatchList.filter((b) => b.warning_level === "red").length;
  const availableWh      = batches.filter((b) => b.status === "available").reduce((s, b) => s + (b.wh_remaining ?? 0), 0);
  const ecBalanceCAD     = ((user?.ec_balance ?? 0) * GRID_PRICE_CAD).toFixed(2);

  const setAct = (id, patch) => setActionLoading((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const setErr = (id, msg)   => setActionError((p) => ({ ...p, [id]: msg }));

  const doMint = async (batch) => {
    setAct(batch.id, { mint: true });
    try {
      const { data } = await client.post(`/energy/batches/${batch.id}/mint`);
      updateUser({ ec_balance: user.ec_balance + data.ec_minted });
      setBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, status: "minted", wh_remaining: 0 } : b));
      client.get("/economy/reserve").then((r) => setReserve(r.data));
      setMintConfirm(null);
    } catch (err) {
      setErr(batch.id, apiError(err));
      setMintConfirm(null);
    } finally {
      setAct(batch.id, { mint: false });
    }
  };

  const submitListing = async (batch) => {
    const lf = listingForm[batch.id] ?? {};
    const ecPricePerKwh = parseFloat(lf.ecPrice);
    if (!ecPricePerKwh || ecPricePerKwh <= 0) return;
    setErr(batch.id, "");
    setAct(batch.id, { list: true });
    try {
      await client.post("/listings", {
        batch_id:  batch.id,
        wh_amount: batch.wh_remaining,
        ec_price:  ecPricePerKwh / 1000,
      });
      setBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, status: "listed" } : b));
      setListingForm((p) => ({ ...p, [batch.id]: { show: false, ecPrice: "" } }));
    } catch (err) {
      setErr(batch.id, apiError(err));
    } finally {
      setAct(batch.id, { list: false });
    }
  };

  const offsetBatch = async (batch) => {
    setOffsetConfirm(null);
    setErr(batch.id, "");
    setAct(batch.id, { offset: true });
    try {
      await client.post("/economy/offset", { batch_id: batch.id });
      setBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, status: "offset", wh_remaining: 0 } : b));
    } catch (err) {
      setErr(batch.id, apiError(err));
    } finally {
      setAct(batch.id, { offset: false });
    }
  };

  return (
    <div className="p-7 max-w-5xl">
      {mintConfirm && (
        <MintModal
          batch={mintConfirm}
          loading={!!actionLoading[mintConfirm.id]?.mint}
          onConfirm={() => doMint(mintConfirm)}
          onCancel={() => setMintConfirm(null)}
        />
      )}

      {offsetConfirm && (
        <OffsetModal
          batches={[offsetConfirm]}
          loading={!!actionLoading[offsetConfirm.id]?.offset}
          onConfirm={() => offsetBatch(offsetConfirm)}
          onCancel={() => setOffsetConfirm(null)}
        />
      )}

      <PageHeader title="Dashboard" sub="Your energy credit overview" />

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl p-5 text-white col-span-1" style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}>
              <p className="text-xs font-semibold mb-1 opacity-80 uppercase tracking-wider">EC Balance</p>
              <p className="text-4xl font-black tracking-tight">{(user?.ec_balance ?? 0).toFixed(2)}</p>
              <p className="text-xs mt-1 opacity-70">EnergyCredits</p>
              <p className="text-xs mt-2 font-semibold opacity-90">≈ ${ecBalanceCAD} CAD</p>
            </div>
            <StatCard label="Energy Available" value={(availableWh / 1000).toFixed(2)} unit={`kWh  (${availableWh.toLocaleString()} Wh)`} />
            <StatCard
              label="EC Issued This Month"
              value={(reserve.month_ec_issued ?? 0).toFixed(2)}
              unit={`EC · ${(reserve.month_ec_burned ?? 0).toFixed(4)} EC burned in fees`}
            />
            <StatCard label="Active Batches" value={activeBatchList.length} unit={`${redCount} expiring soon`} />
          </div>

          {redCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl p-4 mb-6 border" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "#d97706" }} />
              <p className="text-sm" style={{ color: "#92400e" }}>
                <span className="font-bold">{redCount} batch{redCount > 1 ? "es" : ""}</span>{" "}
                expiring within 3 days — mint, list, or offset before they lapse.
              </p>
            </div>
          )}

          <Card className="overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">Active Batches</p>
              <span className="text-xs text-slate-400">{activeBatchList.length} batch{activeBatchList.length !== 1 ? "es" : ""}</span>
            </div>
            {activeBatchList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No active batches — log energy to get started.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {activeBatchList.map((b) => (
                  <BatchRow
                    key={b.id}
                    b={b}
                    act={actionLoading[b.id] ?? {}}
                    errMsg={actionError[b.id]}
                    lf={listingForm[b.id] ?? {}}
                    onMintClick={() => setMintConfirm(b)}
                    onToggleListing={() =>
                      setListingForm((p) => ({
                        ...p,
                        [b.id]: p[b.id]?.show ? { show: false, ecPrice: "" } : { show: true, ecPrice: "" },
                      }))
                    }
                    onPriceChange={(val) =>
                      setListingForm((p) => ({ ...p, [b.id]: { ...p[b.id], ecPrice: val } }))
                    }
                    onSubmitListing={() => submitListing(b)}
                    onOffsetBatch={() => setOffsetConfirm(b)}
                  />
                ))}
              </div>
            )}
          </Card>

          {archiveBatchList.length > 0 && (
            <Card className="overflow-hidden">
              <button
                onClick={() => setShowArchive((v) => !v)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <p className="font-bold text-slate-500 text-sm">Archived Batches ({archiveBatchList.length})</p>
                {showArchive ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {showArchive && (
                <div className="divide-y divide-slate-50 border-t border-slate-100">
                  {archiveBatchList.map((b) => (
                  <BatchRow
                    key={b.id}
                    b={b}
                    archived
                    act={{}}
                    errMsg={null}
                    lf={{}}
                    onMintClick={() => {}}
                    onToggleListing={() => {}}
                    onPriceChange={() => {}}
                    onSubmitListing={() => {}}
                    onOffsetBatch={() => {}}
                  />
                ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
