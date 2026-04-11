import { AlertTriangle } from "lucide-react";

const warningStyle = {
  "":    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", label: "Active" },
  amber: { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "Expiring Soon" },
  red:   { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", label: "Expires Soon!" },
};

export const ExpiryBadge = ({ level = "" }) => {
  const c = warningStyle[level] ?? warningStyle[""];
  return (
    <span
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      {level === "red" && <AlertTriangle size={9} />}
      {c.label}
    </span>
  );
};

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 ${className}`}>
    {children}
  </div>
);

export const PrimaryBtn = ({ children, onClick, disabled, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    style={{ background: disabled ? "#7dd3fc" : "#38bdf8" }}
    onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "#0ea5e9")}
    onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "#38bdf8")}
  >
    {children}
  </button>
);

export const GhostBtn = ({ children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all ${className}`}
  >
    {children}
  </button>
);

export const FormInput = ({ label, ...props }) => (
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

export const FormSelect = ({ label, children, ...props }) => (
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

export const StatCard = ({ label, value, unit, accent }) =>
  accent ? (
    <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}>
      <p className="text-xs font-semibold mb-2 opacity-80 uppercase tracking-wider">{label}</p>
      <p className="text-4xl font-black tracking-tight">{value}</p>
      <p className="text-xs mt-1 opacity-70">{unit}</p>
    </div>
  ) : (
    <div className="rounded-2xl p-5 bg-white border border-slate-100">
      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs mt-1 text-slate-400">{unit}</p>
    </div>
  );

export const PageHeader = ({ title, sub }) => (
  <div className="mb-7">
    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
    {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

export const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
  </div>
);

export const ErrMsg = ({ msg }) =>
  msg ? <p className="text-sm text-red-600 font-medium">{msg}</p> : null;
