import {
  LayoutDashboard, ShoppingCart, Zap, Sun, Receipt,
  CreditCard, Battery, LogOut, Menu,
} from "lucide-react";

export const NAV = [
  { id: "dashboard",   label: "Dashboard",   Icon: LayoutDashboard },
  { id: "marketplace", label: "Marketplace", Icon: ShoppingCart },
  { id: "log",         label: "Log Energy",  Icon: Zap },
  { id: "panels",      label: "My Panels",   Icon: Sun },
  { id: "offset",      label: "Bill Offset", Icon: Receipt },
  { id: "buy",         label: "Buy EC",      Icon: CreditCard },
];

export default function Sidebar({ page, setPage, collapsed, setCollapsed, user, onLogout }) {
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
            <p className="font-black text-slate-900 text-sm leading-none">EnergyCredit</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.name ?? "Solar Trading"}</p>
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
              onMouseEnter={(e) => !active && (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
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
