import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Zap,
  Sun,
  Receipt,
  CreditCard,
  Battery,
  AlertTriangle,
  Check,
  Plus,
  Info,
  Menu,
  Clock,
  LogOut,
  Coins,
  Tag,
  FileCheck,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import client from "./api/client";

/* ─── Constants ───────────────────────────────────────────────── */
const MINT_RATE = 0.0007; // 0.7 EC per kWh — 30% below grid parity to incentivise marketplace
const MINT_FEE = 0.06; // 6% burned to platform reserve
const GRID_PRICE_CAD = 0.1; // $0.10 CAD per kWh = $0.10 CAD per EC

/* ─── Helpers ─────────────────────────────────────────────────── */
function apiError(err) {
  const status = err.response?.status;
  if (status === 402) return "Insufficient EC balance";
  if (status === 403) return "You don't have permission to do this";
  if (status === 500) return "Something went wrong — please try again";
  return err.response?.data?.error || "Something went wrong — please try again";
}

// Shows Wh with kWh in parentheses for context: "1,234 Wh (1.23 kWh)"
function fmtWh(wh) {
  return `${wh.toLocaleString()} Wh (${(wh / 1000).toFixed(2)} kWh)`;
}

// Savings in CAD from Wh at grid rate (per kWh)
function whToCAD(wh) {
  return (wh / 1000) * GRID_PRICE_CAD;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ─── Micro-components ────────────────────────────────────────── */
const warningStyle = {
  "": { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", label: "Active" },
  amber: {
    bg: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
    label: "Expiring Soon",
  },
  red: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    label: "Expires Soon!",
  },
};

const ExpiryBadge = ({ level = "" }) => {
  const c = warningStyle[level] ?? warningStyle[""];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      {level === "red" && <AlertTriangle size={9} />}
      {c.label}
    </span>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 ${className}`}>
    {children}
  </div>
);

const PrimaryBtn = ({ children, onClick, disabled, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    style={{ background: disabled ? "#7dd3fc" : "#38bdf8" }}
    onMouseEnter={(e) =>
      !disabled && (e.currentTarget.style.background = "#0ea5e9")
    }
    onMouseLeave={(e) =>
      !disabled && (e.currentTarget.style.background = "#38bdf8")
    }
  >
    {children}
  </button>
);

const GhostBtn = ({ children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all ${className}`}
  >
    {children}
  </button>
);

const FormInput = ({ label, ...props }) => (
  <div>
    {label && (
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
    )}
    <input
      {...props}
      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
      style={{ "--tw-ring-color": "#38bdf8" }}
    />
  </div>
);

const FormSelect = ({ label, children, ...props }) => (
  <div>
    {label && (
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
    )}
    <select
      {...props}
      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all appearance-none"
    >
      {children}
    </select>
  </div>
);

const StatCard = ({ label, value, unit, accent }) =>
  accent ? (
    <div
      className="rounded-2xl p-5 text-white"
      style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}
    >
      <p className="text-xs font-semibold mb-2 opacity-80 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-4xl font-black tracking-tight">{value}</p>
      <p className="text-xs mt-1 opacity-70">{unit}</p>
    </div>
  ) : (
    <div className="rounded-2xl p-5 bg-white border border-slate-100">
      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-4xl font-black text-slate-900 tracking-tight">
        {value}
      </p>
      <p className="text-xs mt-1 text-slate-400">{unit}</p>
    </div>
  );

const PageHeader = ({ title, sub }) => (
  <div className="mb-7">
    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
      {title}
    </h1>
    {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
  </div>
);

const ErrMsg = ({ msg }) =>
  msg ? <p className="text-sm text-red-600 font-medium">{msg}</p> : null;

/* ═══════════════════════════════════════════════════════════════
   PAGE: AUTH
════════════════════════════════════════════════════════════════ */
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => {
    setError("");
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const { data } = await client.post(path, body);
      onAuth(data.token, data.user);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const ready =
    mode === "login"
      ? form.email && form.password.length >= 8
      : form.name && form.email && form.password.length >= 8;

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}
          >
            <Battery size={20} className="text-white" />
          </div>
          <div>
            <p className="font-black text-slate-900 text-lg leading-none">
              EnergyCredit
            </p>
            <p className="text-xs text-slate-400">Solar Trading Platform</p>
          </div>
        </div>

        <Card className="p-7 space-y-5">
          <p className="text-lg font-black text-slate-900">
            {mode === "login" ? "Sign in" : "Create account"}
          </p>

          {mode === "register" && (
            <FormInput
              label="Full Name"
              value={form.name}
              onChange={set("name")}
              placeholder="Jane Smith"
            />
          )}
          <FormInput
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
          />
          <FormInput
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder={mode === "register" ? "Min 8 characters" : "••••••••"}
          />

          <ErrMsg msg={error} />

          <PrimaryBtn
            onClick={submit}
            disabled={loading || !ready}
            className="w-full py-3 text-base"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </PrimaryBtn>

          <p className="text-center text-sm text-slate-400">
            {mode === "login" ? "No account?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="font-semibold text-sky-500 hover:text-sky-600"
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINT CONFIRMATION MODAL
════════════════════════════════════════════════════════════════ */
function MintModal({ batch, onConfirm, onCancel, loading }) {
  const ecGross = +(batch.wh_remaining * MINT_RATE).toFixed(4);
  const ecFee = +(ecGross * MINT_FEE).toFixed(4);
  const ecNet = +(ecGross - ecFee).toFixed(4);

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
          <button
            onClick={onCancel}
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Energy input */}
        <div className="rounded-xl p-4 mb-4 border border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            Energy Input
          </p>
          <p className="text-2xl font-black text-slate-900">
            {fmtWh(batch.wh_remaining)}
          </p>
        </div>

        {/* Conversion breakdown */}
        <div
          className="rounded-xl p-4 mb-5 border space-y-3"
          style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#0369a1" }}
          >
            EC Conversion
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">
                {batch.wh_remaining.toLocaleString()} Wh × {MINT_RATE} EC/Wh
              </span>
              <span className="font-semibold text-slate-800">
                {ecGross.toFixed(4)} EC gross
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">
                Platform fee ({(MINT_FEE * 100).toFixed(0)}% burned)
              </span>
              <span className="font-semibold text-red-400">
                − {ecFee.toFixed(4)} EC
              </span>
            </div>
            <div
              className="flex justify-between items-center pt-3 mt-1 border-t"
              style={{ borderColor: "#bae6fd" }}
            >
              <span
                className="font-bold text-base"
                style={{ color: "#0369a1" }}
              >
                You receive
              </span>
              <span
                className="font-black text-2xl"
                style={{ color: "#38bdf8" }}
              >
                {ecNet.toFixed(4)} EC
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          This batch will be consumed. The EC is added to your balance
          immediately.
        </p>

        <div className="flex gap-3">
          <PrimaryBtn
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 text-base"
          >
            {loading ? "Minting…" : `Mint ${ecNet.toFixed(4)} EC`}
          </PrimaryBtn>
          <GhostBtn onClick={onCancel} className="px-6">
            Cancel
          </GhostBtn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
════════════════════════════════════════════════════════════════ */
function Dashboard({
  user,
  updateUser,
  batches,
  setBatches,
  reserve,
  setReserve,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [listingForm, setListingForm] = useState({});
  const [mintConfirm, setMintConfirm] = useState(null); // batch being confirmed
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([client.get("/energy/batches"), client.get("/economy/reserve")])
      .then(([batchRes, reserveRes]) => {
        if (cancelled) return;
        setBatches(batchRes.data.batches ?? []);
        setReserve(reserveRes.data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setBatches, setReserve]);

  const ACTIVE_STATUSES = ["available", "listed"];
  const ARCHIVE_STATUSES = ["minted", "offset", "expired"];

  const activeBatchList = batches.filter((b) =>
    ACTIVE_STATUSES.includes(b.status),
  );
  const archiveBatchList = batches.filter((b) =>
    ARCHIVE_STATUSES.includes(b.status),
  );
  const redCount = activeBatchList.filter(
    (b) => b.warning_level === "red",
  ).length;
  const availableWh = batches
    .filter((b) => b.status === "available")
    .reduce((s, b) => s + (b.wh_remaining ?? 0), 0);
  const ecBalanceCAD = ((user?.ec_balance ?? 0) * GRID_PRICE_CAD).toFixed(2);

  const setAct = (id, patch) =>
    setActionLoading((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const setErr = (id, msg) => setActionError((p) => ({ ...p, [id]: msg }));

  const doMint = async (batch) => {
    setAct(batch.id, { mint: true });
    try {
      const { data } = await client.post(`/energy/batches/${batch.id}/mint`);
      updateUser({ ec_balance: user.ec_balance + data.ec_minted });
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batch.id ? { ...b, status: "minted", wh_remaining: 0 } : b,
        ),
      );
      // Refresh reserve so monthly stats update immediately.
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
        batch_id: batch.id,
        wh_amount: batch.wh_remaining,
        ec_price: ecPricePerKwh / 1000, // API expects EC/Wh; user enters EC/kWh
      });
      setBatches((prev) =>
        prev.map((b) => (b.id === batch.id ? { ...b, status: "listed" } : b)),
      );
      setListingForm((p) => ({
        ...p,
        [batch.id]: { show: false, ecPrice: "" },
      }));
    } catch (err) {
      setErr(batch.id, apiError(err));
    } finally {
      setAct(batch.id, { list: false });
    }
  };

  const offsetBatch = async (batch) => {
    setErr(batch.id, "");
    setAct(batch.id, { offset: true });
    try {
      await client.post("/economy/offset", { batch_id: batch.id });
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batch.id ? { ...b, status: "offset", wh_remaining: 0 } : b,
        ),
      );
    } catch (err) {
      setErr(batch.id, apiError(err));
    } finally {
      setAct(batch.id, { offset: false });
    }
  };

  const STATUS_LABEL = {
    available: { bg: "#f0fdf4", color: "#15803d", text: "Available" },
    listed: { bg: "#f0f9ff", color: "#0369a1", text: "Listed" },
    minted: { bg: "#faf5ff", color: "#7c3aed", text: "Minted" },
    offset: { bg: "#ecfdf5", color: "#059669", text: "Offset" },
    expired: { bg: "#fef2f2", color: "#b91c1c", text: "Expired" },
  };

  const BatchRow = ({ b, archived = false }) => {
    const act = actionLoading[b.id] ?? {};
    const errMsg = actionError[b.id];
    const lf = listingForm[b.id] ?? {};
    const sl = STATUS_LABEL[b.status] ?? {
      bg: "#f8fafc",
      color: "#64748b",
      text: b.status,
    };
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
              {archived
                ? `${b.wh_remaining.toLocaleString()} Wh`
                : fmtWh(b.wh_remaining)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Logged {fmtDate(b.created_at)} · Expires {fmtDate(b.expires_at)}
            </p>
          </div>

          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{ background: sl.bg, color: sl.color }}
          >
            {sl.text}
          </span>

          {!archived && <ExpiryBadge level={b.warning_level} />}

          {/* Action buttons — available batches only */}
          {isAvail && (
            <div className="flex gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => setMintConfirm(b)}
                disabled={act.mint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40"
                style={{
                  background: "#faf5ff",
                  color: "#7c3aed",
                  borderColor: "#e9d5ff",
                }}
              >
                <Coins size={14} />
                Mint to EC
              </button>
              <button
                onClick={() =>
                  setListingForm((p) => ({
                    ...p,
                    [b.id]: lf.show
                      ? { show: false, ecPrice: "" }
                      : { show: true, ecPrice: "" },
                  }))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all"
                style={{
                  background: "#f0f9ff",
                  color: "#0369a1",
                  borderColor: "#bae6fd",
                }}
              >
                <Tag size={14} />
                {lf.show ? "Cancel" : "List on Market"}
              </button>
              <button
                onClick={() => offsetBatch(b)}
                disabled={act.offset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40"
                style={{
                  background: "#f0fdf4",
                  color: "#15803d",
                  borderColor: "#bbf7d0",
                }}
              >
                <FileCheck size={14} />
                {act.offset
                  ? "Applying…"
                  : `Offset Bill (~$${savingsPreview} CAD)`}
              </button>
            </div>
          )}
        </div>

        {/* Listing form */}
        {lf.show && (
          <div
            className="mt-3 ml-14 p-4 rounded-xl border flex items-end gap-3"
            style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
          >
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                Your asking price (EC per kWh)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={lf.ecPrice ?? ""}
                  onChange={(e) =>
                    setListingForm((p) => ({
                      ...p,
                      [b.id]: { ...p[b.id], ecPrice: e.target.value },
                    }))
                  }
                  placeholder="0.50"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                  EC/kWh
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ceiling: 1.00 EC/kWh (grid parity) ·
                Total:{" "}
                <strong>
                  {lf.ecPrice && parseFloat(lf.ecPrice) > 0
                    ? ((b.wh_remaining / 1000) * parseFloat(lf.ecPrice)).toFixed(4)
                    : "—"}{" "}
                  EC
                </strong>
              </p>
            </div>
            <PrimaryBtn
              onClick={() => submitListing(b)}
              disabled={act.list || !lf.ecPrice || parseFloat(lf.ecPrice) <= 0}
              className="shrink-0 py-2"
            >
              {act.list ? "Listing…" : "Confirm Listing"}
            </PrimaryBtn>
          </div>
        )}

        {errMsg && (
          <p className="mt-2 ml-14 text-xs text-red-500 font-medium">
            {errMsg}
          </p>
        )}
      </div>
    );
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
          {/* Stat row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div
              className="rounded-2xl p-5 text-white col-span-1"
              style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}
            >
              <p className="text-xs font-semibold mb-1 opacity-80 uppercase tracking-wider">
                EC Balance
              </p>
              <p className="text-4xl font-black tracking-tight">
                {(user?.ec_balance ?? 0).toFixed(2)}
              </p>
              <p className="text-xs mt-1 opacity-70">EnergyCredits</p>
              <p className="text-xs mt-2 font-semibold opacity-90">
                ≈ ${ecBalanceCAD} CAD
              </p>
            </div>
            <StatCard
              label="Energy Available"
              value={(availableWh / 1000).toFixed(2)}
              unit={`kWh  (${availableWh.toLocaleString()} Wh)`}
            />
            <StatCard
              label="EC Issued This Month"
              value={(reserve.month_ec_issued ?? 0).toFixed(2)}
              unit={`EC · ${(reserve.month_ec_burned ?? 0).toFixed(4)} EC burned in fees`}
            />
            <StatCard
              label="Active Batches"
              value={activeBatchList.length}
              unit={`${redCount} expiring soon`}
            />
          </div>

          {redCount > 0 && (
            <div
              className="flex items-start gap-3 rounded-xl p-4 mb-6 border"
              style={{ background: "#fffbeb", borderColor: "#fde68a" }}
            >
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: "#d97706" }}
              />
              <p className="text-sm" style={{ color: "#92400e" }}>
                <span className="font-bold">
                  {redCount} batch{redCount > 1 ? "es" : ""}
                </span>{" "}
                expiring within 3 days — mint, list, or offset before they
                lapse.
              </p>
            </div>
          )}

          {/* Active batches */}
          <Card className="overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">Active Batches</p>
              <span className="text-xs text-slate-400">
                {activeBatchList.length} batch
                {activeBatchList.length !== 1 ? "es" : ""}
              </span>
            </div>
            {activeBatchList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                No active batches — log energy to get started.
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {activeBatchList.map((b) => (
                  <BatchRow key={b.id} b={b} />
                ))}
              </div>
            )}
          </Card>

          {/* Archive (collapsible) */}
          {archiveBatchList.length > 0 && (
            <Card className="overflow-hidden">
              <button
                onClick={() => setShowArchive((v) => !v)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <p className="font-bold text-slate-500 text-sm">
                  Archived Batches ({archiveBatchList.length})
                </p>
                {showArchive ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </button>
              {showArchive && (
                <div className="divide-y divide-slate-50 border-t border-slate-100">
                  {archiveBatchList.map((b) => (
                    <BatchRow key={b.id} b={b} archived />
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

/* ═══════════════════════════════════════════════════════════════
   PAGE: MARKETPLACE
════════════════════════════════════════════════════════════════ */
function Marketplace({ user, updateUser, listings, setListings, setBatches }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buyingId, setBuyingId] = useState(null);
  const [buyErrors, setBuyErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [tab, setTab] = useState("market");

  useEffect(() => {
    client
      .get("/listings")
      .then((res) => setListings(res.data.listings ?? []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [setListings]);

  const buy = async (listing) => {
    setBuyErrors((e) => ({ ...e, [listing.id]: "" }));
    setSuccessMsg("");
    setBuyingId(listing.id);
    try {
      const { data } = await client.post(`/listings/${listing.id}/buy`);
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, status: "filled" } : l)),
      );
      updateUser({ ec_balance: user.ec_balance - data.transaction.ec_amount });
      // Add the new batch to state so Dashboard shows it immediately.
      if (data.batch) setBatches((prev) => [...prev, data.batch]);
      setSuccessMsg(
        `Purchased ${data.transaction.wh_amount.toLocaleString()} Wh for ${data.transaction.ec_amount.toFixed(2)} EC`,
      );
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
      // Restore the batch to available in state.
      setBatches((prev) =>
        prev.map((b) =>
          b.id === listing.batch_id ? { ...b, status: "available" } : b,
        ),
      );
    } catch (err) {
      setSuccessMsg("");
      setBuyErrors((e) => ({ ...e, [listing.id]: apiError(err) }));
    }
  };

  const market = listings.filter((l) => l.seller_id !== user.id);
  const mine = listings.filter((l) => l.seller_id === user.id);
  const visible = tab === "market" ? market : mine;

  const ListingCard = ({ l }) => {
    const isOwn = l.seller_id === user.id;
    const totalCost = (l.wh_amount * l.ec_price).toFixed(2);
    const isLoading = buyingId === l.id;
    return (
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#f0f9ff" }}
          >
            <Zap size={19} style={{ color: "#38bdf8" }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">
              {l.wh_amount.toLocaleString()} Wh
            </p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {isOwn ? "You" : (l.seller_name ?? `Seller #${l.seller_id}`)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {(l.ec_price * 1000).toFixed(4)} EC/kWh · Expires{" "}
              {fmtDate(l.expires_at)}
            </p>
            {buyErrors[l.id] && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                {buyErrors[l.id]}
              </p>
            )}
          </div>

          <div className="text-right shrink-0 mr-2">
            <p className="text-xl font-black text-slate-900">
              {totalCost}{" "}
              <span className="text-sm font-semibold" style={{ color: "#38bdf8" }}>
                EC
              </span>
            </p>
            <p className="text-xs text-slate-400">
              ≈ ${whToCAD(l.wh_amount).toFixed(3)} CAD grid value
            </p>
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
            <PrimaryBtn onClick={() => buy(l)} disabled={isLoading} className="shrink-0">
              {isLoading ? "…" : "Buy Now"}
            </PrimaryBtn>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="p-7 max-w-4xl">
      <PageHeader
        title="Marketplace"
        sub="Buy energy batches from other solar producers"
      />

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {successMsg && (
        <div
          className="mb-5 p-4 rounded-xl border flex items-center gap-3"
          style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
        >
          <Check size={16} style={{ color: "#16a34a" }} />
          <p className="text-sm font-semibold" style={{ color: "#15803d" }}>
            {successMsg}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-slate-100 w-fit">
        {[
          { key: "market", label: `Market (${market.length})` },
          { key: "mine", label: `My Listings (${mine.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === key ? "#fff" : "transparent",
              color: tab === key ? "#0f172a" : "#64748b",
              boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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

/* ═══════════════════════════════════════════════════════════════
   PAGE: LOG ENERGY
════════════════════════════════════════════════════════════════ */
function LogEnergy({ panels, setPanels, setBatches }) {
  const [panelId, setPanelId] = useState("");
  const [wh, setWh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedPanel = panels.find((p) => String(p.id) === panelId) ?? null;
  // Use accumulated_wh (simulated generation since last log) as the slider max.
  const accumulated = selectedPanel?.accumulated_wh ?? 0;
  const capacity = selectedPanel?.capacity_wh ?? 0;

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/energy/log", {
        panel_id: parseInt(panelId, 10),
        wh_amount: wh,
      });
      const [batchRes, panelRes] = await Promise.all([
        client.get("/energy/batches"),
        client.get("/panels"),
      ]);
      setBatches(batchRes.data.batches ?? []);
      setPanels(panelRes.data.panels ?? []);
      setResult({ wh, batch: data.batch });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPanelId("");
    setWh(0);
  };

  if (result) {
    return (
      <div className="p-7 max-w-lg">
        <div className="flex flex-col items-center text-center py-10">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "#f0f9ff" }}
          >
            <Zap size={36} style={{ color: "#38bdf8" }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Energy Logged!
          </h2>
          <p className="text-slate-500 text-sm mb-1">
            Batch created for <strong>{fmtWh(result.wh)}</strong>
          </p>
          <p className="text-sm text-slate-400 mt-3 mb-6 max-w-xs">
            Go to the Dashboard to mint EC, list on the marketplace, or apply to
            your bill.
          </p>
          <PrimaryBtn onClick={reset} className="w-full max-w-xs py-3">
            Log Another Batch
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-lg">
      <PageHeader
        title="Log Energy"
        sub="Select a panel and choose how much energy to log from today's output"
      />

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
              onChange={(e) => {
                setError("");
                setPanelId(e.target.value);
                setWh(0);
              }}
            >
              <option value="">— Select a panel —</option>
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {(p.capacity_wh / 1000).toFixed(2)} kW (
                  {p.capacity_wh.toLocaleString()} Wh capacity)
                </option>
              ))}
            </FormSelect>

            {selectedPanel && (
              <>
                {/* Accumulated generation info */}
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "#f0f9ff", borderColor: "#bae6fd", border: "1px solid" }}
                >
                  <span className="font-semibold text-slate-700">Available to log: </span>
                  <span style={{ color: "#0284c7" }} className="font-black">
                    {fmtWh(accumulated)}
                  </span>
                  <span className="text-slate-400 ml-2 text-xs">
                    of {fmtWh(capacity)} panel capacity
                  </span>
                </div>

                {accumulated <= 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">
                    Panel is still generating — check back later.
                  </p>
                ) : (
                  <>
                    {/* Slider capped at accumulated */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Energy to Log
                        </label>
                        <span className="text-sm font-black text-slate-900">
                          {fmtWh(wh)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={accumulated}
                        step={Math.max(1, Math.round(accumulated / 200))}
                        value={wh}
                        onChange={(e) => {
                          setError("");
                          setWh(Number(e.target.value));
                        }}
                        className="w-full accent-sky-400"
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>0 Wh</span>
                        <span className="font-semibold" style={{ color: "#38bdf8" }}>
                          Max: {fmtWh(accumulated)}
                        </span>
                      </div>
                    </div>

                    {/* Quick-fill buttons */}
                    <div className="flex gap-2">
                      {[0.25, 0.5, 0.75, 1].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setWh(Math.round(accumulated * pct))}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all"
                          style={{
                            background: wh === Math.round(accumulated * pct) ? "#38bdf8" : "#f8fafc",
                            color: wh === Math.round(accumulated * pct) ? "#fff" : "#475569",
                            borderColor: wh === Math.round(accumulated * pct) ? "#38bdf8" : "#e2e8f0",
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

/* ═══════════════════════════════════════════════════════════════
   PAGE: MY PANELS
════════════════════════════════════════════════════════════════ */
function MyPanels({ panels, setPanels, user, updateUser }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", capacity: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    setError("");
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const totalCapacityKw = panels.reduce((s, p) => s + p.capacity_wh / 1000, 0);

  const add = async () => {
    if (!form.name || !form.capacity) return;
    setError("");
    setLoading(true);
    try {
      await client.post("/panels/register", {
        name: form.name,
        capacity_wh: parseFloat(form.capacity) * 1000,
      });
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            My Panels
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {panels.length} panels · {totalCapacityKw.toFixed(1)} kW total
            capacity
          </p>
        </div>
        <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} /> Add Panel
        </PrimaryBtn>
      </div>

      {showForm && (
        <div
          className="rounded-2xl border p-6 mb-6 space-y-4"
          style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
        >
          <p className="text-sm font-bold text-slate-800">Register New Panel</p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Panel Name"
              value={form.name}
              onChange={set("name")}
              placeholder="Rooftop Array A"
            />
            <FormInput
              label="Capacity (kW)"
              type="number"
              value={form.capacity}
              onChange={set("capacity")}
              placeholder="5.2"
            />
          </div>
          <ErrMsg msg={error} />
          <div className="flex gap-3">
            <PrimaryBtn
              onClick={add}
              disabled={loading || !form.name || !form.capacity}
              className="px-6 py-2"
            >
              {loading ? "Registering…" : "Register Panel"}
            </PrimaryBtn>
            <GhostBtn
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
            >
              Cancel
            </GhostBtn>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {panels.length === 0 && (
          <div className="text-center py-14 text-slate-400">
            <Sun size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No panels yet — add your first solar panel above.
            </p>
          </div>
        )}
        {panels.map((p) => {
          const pct = p.capacity_wh > 0 ? (p.accumulated_wh / p.capacity_wh) * 100 : 0;
          const barColor = pct >= 75 ? "#22c55e" : pct >= 30 ? "#f59e0b" : "#94a3b8";
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#fffbeb" }}
                >
                  <Sun size={19} style={{ color: "#f59e0b" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Registered {fmtDate(p.registered_at)}
                  </p>
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

              {/* Accumulated generation bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold">Ready to log</span>
                  <span>
                    <span className="font-black" style={{ color: barColor }}>
                      {fmtWh(p.accumulated_wh)}
                    </span>
                    <span className="text-slate-400"> / {fmtWh(p.capacity_wh)} capacity</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {pct >= 100
                    ? "Full — log now to capture today's output"
                    : `${pct.toFixed(0)}% of daily capacity generated`}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: BILL OFFSET
════════════════════════════════════════════════════════════════ */
function BillOffset({ batches, setBatches }) {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const available = batches.filter((b) => b.status === "available");

  const toggle = (id) => {
    setError("");
    setSelected((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  };

  const sel = available.filter((b) => selected.includes(b.id));
  const totalWh = sel.reduce((s, b) => s + b.wh_remaining, 0);
  const savings = whToCAD(totalWh).toFixed(2);
  const ecEquiv = whToCAD(totalWh).toFixed(2);

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
      // Remove only the batches that were successfully offset before the failure.
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
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "#f0fdf4" }}
          >
            <Check size={36} style={{ color: "#16a34a" }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Offset Applied!
          </h2>
          <p className="text-slate-500 text-sm mb-1">
            {result.count} batch{result.count > 1 ? "es" : ""} ·{" "}
            {result.totalWh.toLocaleString()} Wh
          </p>
          <p
            className="text-5xl font-black mt-2 mb-1"
            style={{ color: "#16a34a" }}
          >
            ${result.savings}
          </p>
          <p className="text-sm text-slate-400 mb-6">credited to your bill</p>
          <PrimaryBtn
            onClick={() => setResult(null)}
            className="w-full max-w-xs py-3"
          >
            Start Over
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-5xl">
      <PageHeader
        title="Bill Offset"
        sub="Select energy batches to offset your electricity bill"
      />

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {available.length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            No available batches — log energy to create batches.
          </p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <div className="flex-1 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              Choose Batches
            </p>
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
                    background: on ? "#f0f9ff" : "#fff",
                    boxShadow: on ? "0 0 0 2px #bae6fd" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{
                        borderColor: on ? "#38bdf8" : "#cbd5e1",
                        background: on ? "#38bdf8" : "transparent",
                      }}
                    >
                      {on && (
                        <Check
                          size={11}
                          className="text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">
                        #{b.id}
                      </p>
                      <p className="text-xs text-slate-400">
                        Expires {fmtDate(b.expires_at)}
                      </p>
                    </div>
                    <div className="text-right mr-3">
                      <p className="font-black text-slate-900">
                        {b.wh_remaining.toLocaleString()}{" "}
                        <span className="text-xs font-semibold text-slate-400">
                          Wh
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        ≈ ${batchSavings} CAD savings
                      </p>
                    </div>
                    <ExpiryBadge level={b.warning_level} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="w-64 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Summary
            </p>
            <Card className="p-5 sticky top-6">
              <div className="space-y-3 mb-5">
                {[
                  { label: "Batches selected", value: selected.length },
                  {
                    label: "Total energy",
                    value: `${totalWh.toLocaleString()} Wh`,
                  },
                  { label: "EC equivalent", value: `$${ecEquiv} CAD` },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{r.label}</span>
                    <span className="font-bold text-slate-800">{r.value}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-slate-500">
                      Est. Bill Savings
                    </span>
                    <span
                      className="text-2xl font-black"
                      style={{ color: "#16a34a" }}
                    >
                      ${savings}
                    </span>
                  </div>
                </div>
              </div>
              <PrimaryBtn
                onClick={apply}
                disabled={selected.length === 0 || loading}
                className="w-full py-3"
              >
                {loading ? "Applying…" : "Apply Offset"}
              </PrimaryBtn>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: BUY EC
════════════════════════════════════════════════════════════════ */
function BuyEC({ user, updateUser }) {
  const [CAD, setCAD] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const TIERS = [10, 25, 50, 100];

  const fiat = CAD && parseFloat(CAD) > 0 ? parseFloat(CAD) : null;
  const ecPreview = fiat ? (fiat / GRID_PRICE_CAD).toFixed(2) : null;

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/economy/buy-ec", {
        fiat_amount: parseFloat(CAD),
      });
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
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "#f0f9ff" }}
          >
            <CreditCard size={36} style={{ color: "#38bdf8" }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Purchase Complete!
          </h2>
          <p className="text-slate-500 text-sm">
            You bought <strong>${result.fiat_amount.toFixed(2)} CAD</strong>{" "}
            worth of EnergyCredits
          </p>
          <p
            className="text-5xl font-black mt-3 mb-1"
            style={{ color: "#38bdf8" }}
          >
            {result.ec_amount.toFixed(2)} EC
          </p>
          <p className="text-xs text-slate-400 mb-6">added to your balance</p>
          <PrimaryBtn
            onClick={() => {
              setResult(null);
              setCAD("");
            }}
            className="w-full max-w-xs py-3"
          >
            Buy More EC
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-md">
      <PageHeader
        title="Buy EC"
        sub="Purchase EnergyCredits with fiat currency"
      />

      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3 mb-5 border"
        style={{ background: "#fffbeb", borderColor: "#fde68a" }}
      >
        <AlertTriangle
          size={14}
          style={{ color: "#d97706" }}
          className="shrink-0"
        />
        <p className="text-xs font-semibold" style={{ color: "#92400e" }}>
          Simulated — no real payment processed
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Quick Select
          </p>
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => {
              const active = CAD === String(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    setError("");
                    setCAD(String(t));
                  }}
                  className="py-2.5 rounded-xl text-sm font-bold border transition-all"
                  style={{
                    background: active ? "#38bdf8" : "#fff",
                    color: active ? "#fff" : "#475569",
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
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Custom Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
              $
            </span>
            <input
              type="number"
              value={CAD}
              onChange={(e) => {
                setError("");
                setCAD(e.target.value);
              }}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl pl-8 pr-16 py-2.5 text-sm text-slate-800 bg-white focus:outline-none transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              CAD
            </span>
          </div>
        </div>

        <div
          className="rounded-xl p-4 flex items-center justify-between border"
          style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
        >
          <div>
            <p
              className="text-xs font-semibold mb-0.5"
              style={{ color: "#0369a1" }}
            >
              EC You'll Receive
            </p>
            <p className="text-3xl font-black" style={{ color: "#38bdf8" }}>
              {ecPreview ? `${ecPreview} EC` : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">Rate</p>
            <p className="text-sm font-bold text-slate-700">$0.10 CAD per EC</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <Info size={11} className="shrink-0 mt-0.5" />
          Simulated purchase. No real funds are charged.
        </p>

        <ErrMsg msg={error} />

        <PrimaryBtn
          onClick={submit}
          disabled={loading || !ecPreview}
          className="w-full py-3 text-base"
        >
          {loading
            ? "Processing…"
            : `Purchase ${ecPreview ? `${ecPreview} EC` : "EC"}`}
        </PrimaryBtn>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════════ */
const NAV = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "marketplace", label: "Marketplace", Icon: ShoppingCart },
  { id: "log", label: "Log Energy", Icon: Zap },
  { id: "panels", label: "My Panels", Icon: Sun },
  { id: "offset", label: "Bill Offset", Icon: Receipt },
  { id: "buy", label: "Buy EC", Icon: CreditCard },
];

function Sidebar({ page, setPage, collapsed, setCollapsed, user, onLogout }) {
  return (
    <aside
      className="flex flex-col shrink-0 bg-white border-r border-slate-100 transition-all duration-200"
      style={{ width: collapsed ? 64 : 220 }}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}
        >
          <Battery size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-black text-slate-900 text-sm leading-none">
              EnergyCredit
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {user?.name ?? "Solar Trading"}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map((nav) => {
          const active = page === nav.id;
          return (
            <button
              key={nav.id}
              onClick={() => setPage(nav.id)}
              title={collapsed ? nav.label : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: active ? "#38bdf8" : "transparent",
                color: active ? "#fff" : "#64748b",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              onMouseEnter={(e) =>
                !active && (e.currentTarget.style.background = "#f8fafc")
              }
              onMouseLeave={(e) =>
                !active && (e.currentTarget.style.background = "transparent")
              }
            >
              <nav.Icon size={17} />
              {!collapsed && <span>{nav.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-100">
        {!collapsed && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center justify-center w-full p-4 text-slate-300 hover:text-slate-500 transition-colors"
        >
          <Menu size={16} />
        </button>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [panels, setPanels] = useState([]);
  const [batches, setBatches] = useState([]);
  const [listings, setListings] = useState([]);
  const [reserve, setReserve] = useState({
    ec_available: 0,
    total_ec_issued: 0,
    total_ec_burned: 0,
    month_ec_issued: 0,
    month_ec_burned: 0,
  });

  const updateUser = (patch) => {
    const updated = { ...user, ...patch };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  // Fetch panels on login and poll every 10s so accumulated Wh updates live.
  useEffect(() => {
    if (!token) return;
    const fetchPanels = () =>
      client.get("/panels").then((res) => setPanels(res.data.panels ?? []));
    fetchPanels();
    const id = setInterval(fetchPanels, 10_000);
    return () => clearInterval(id);
  }, [token]);

  const handleAuth = (tok, u) => {
    localStorage.setItem("token", tok);
    localStorage.setItem("user", JSON.stringify(u));
    setToken(tok);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setPanels([]);
    setBatches([]);
    setListings([]);
  };

  if (!token) {
    return <AuthPage onAuth={handleAuth} />;
  }

  const pageProps = {
    user,
    updateUser,
    panels,
    setPanels,
    batches,
    setBatches,
    listings,
    setListings,
    reserve,
    setReserve,
  };

  const PageMap = {
    dashboard: <Dashboard {...pageProps} />,
    marketplace: <Marketplace {...pageProps} />,
    log: <LogEnergy {...pageProps} />,
    panels: <MyPanels {...pageProps} />,
    offset: <BillOffset {...pageProps} />,
    buy: <BuyEC {...pageProps} />,
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#f8fafc",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-y-auto">{PageMap[page]}</main>
    </div>
  );
}
