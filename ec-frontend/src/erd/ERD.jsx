import { useState } from "react";

const TABLE_WIDTH = 260;
const ROW_H = 24;
const HEADER_H = 36;

const TABLES = {
  users: {
    label: "users", color: "#3B82F6", x: 400, y: 40,
    fields: [
      { name: "id",            type: "SERIAL",        pk: true },
      { name: "name",          type: "VARCHAR(100)" },
      { name: "email",         type: "VARCHAR(255)",   note: "unique" },
      { name: "password_hash", type: "TEXT" },
      { name: "ec_balance",    type: "NUMERIC(12,4)",  note: "default 50 — signup grant" },
      { name: "has_panels",    type: "BOOLEAN",        note: "unlocks energy logging" },
      { name: "created_at",    type: "TIMESTAMP" },
    ],
  },
  panels: {
    label: "panels", color: "#F59E0B", x: 760, y: 40,
    fields: [
      { name: "id",            type: "SERIAL",        pk: true },
      { name: "user_id",       type: "INTEGER",        fk: "users" },
      { name: "name",          type: "VARCHAR(100)" },
      { name: "capacity_wh",   type: "NUMERIC(10,2)",  note: "max Wh per log entry" },
      { name: "is_active",     type: "BOOLEAN" },
      { name: "registered_at", type: "TIMESTAMP" },
    ],
  },
  energy_logs: {
    label: "energy_logs", color: "#10B981", x: 760, y: 275,
    fields: [
      { name: "id",         type: "SERIAL",        pk: true },
      { name: "user_id",    type: "INTEGER",        fk: "users" },
      { name: "panel_id",   type: "INTEGER",        fk: "panels" },
      { name: "wh_amount",  type: "NUMERIC(10,2)" },
      { name: "ec_minted",  type: "NUMERIC(12,4)",  note: "EC received after mint fee" },
      { name: "fee_burned", type: "NUMERIC(12,4)",  note: "EC destroyed — only burn in system" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
  wh_batches: {
    label: "wh_batches", color: "#10B981", x: 760, y: 540,
    fields: [
      { name: "id",             type: "SERIAL",        pk: true },
      { name: "user_id",        type: "INTEGER",        fk: "users" },
      { name: "energy_log_id",  type: "INTEGER",        fk: "energy_logs" },
      { name: "wh_remaining",   type: "NUMERIC(10,2)" },
      { name: "status",         type: "VARCHAR(20)",    note: "available / reserved / listed / offset / expired" },
      { name: "warning_level",  type: "VARCHAR(10)",    note: "null → amber (day 20) → red (day 27)" },
      { name: "last_warned_at", type: "TIMESTAMP",      note: "when last notification was sent" },
      { name: "created_at",     type: "TIMESTAMP" },
      { name: "expires_at",     type: "TIMESTAMP",      note: "created_at + 30 days — pure loss on expiry" },
    ],
  },
  listings: {
    label: "listings", color: "#8B5CF6", x: 40, y: 275,
    fields: [
      { name: "id",         type: "SERIAL",        pk: true },
      { name: "seller_id",  type: "INTEGER",        fk: "users" },
      { name: "batch_id",   type: "INTEGER",        fk: "wh_batches", note: "listing tied to batch lifecycle" },
      { name: "wh_amount",  type: "NUMERIC(10,2)" },
      { name: "ec_price",   type: "NUMERIC(12,4)",  note: "full EC asked — no platform fee on trade" },
      { name: "status",     type: "VARCHAR(20)",    note: "open / filled / cancelled / expired" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "expires_at", type: "TIMESTAMP",      note: "mirrors wh_batches.expires_at" },
    ],
  },
  transactions: {
    label: "transactions", color: "#EF4444", x: 40, y: 580,
    fields: [
      { name: "id",         type: "SERIAL",        pk: true },
      { name: "buyer_id",   type: "INTEGER",        fk: "users" },
      { name: "seller_id",  type: "INTEGER",        fk: "users" },
      { name: "listing_id", type: "INTEGER",        fk: "listings" },
      { name: "wh_amount",  type: "NUMERIC(10,2)" },
      { name: "ec_amount",  type: "NUMERIC(12,4)",  note: "full amount transferred — no P2P fee" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
  ec_purchases: {
    label: "ec_purchases", color: "#3B82F6", x: 400, y: 290,
    fields: [
      { name: "id",          type: "SERIAL",        pk: true },
      { name: "user_id",     type: "INTEGER",        fk: "users" },
      { name: "ec_amount",   type: "NUMERIC(12,4)",  note: "drawn from platform reserve" },
      { name: "fiat_amount", type: "NUMERIC(10,2)",  note: "no entry fee — clean grid price" },
      { name: "rate_used",   type: "NUMERIC(8,4)",   note: "grid price snapshot at purchase time" },
      { name: "created_at",  type: "TIMESTAMP" },
    ],
  },
  platform_reserve: {
    label: "platform_reserve", color: "#64748B", x: 400, y: 500,
    fields: [
      { name: "id",              type: "SERIAL",        pk: true },
      { name: "ec_available",    type: "NUMERIC(12,4)",  note: "EC pool available to sell consumers" },
      { name: "total_ec_issued", type: "NUMERIC(12,4)",  note: "all-time minted across system" },
      { name: "total_ec_burned", type: "NUMERIC(12,4)",  note: "all-time burned via mint fees" },
      { name: "updated_at",      type: "TIMESTAMP" },
    ],
  },
  bill_offsets: {
    label: "bill_offsets", color: "#EC4899", x: 400, y: 700,
    fields: [
      { name: "id",            type: "SERIAL",        pk: true },
      { name: "user_id",       type: "INTEGER",        fk: "users" },
      { name: "batch_id",      type: "INTEGER",        fk: "wh_batches", note: "batch → offset status (irreversible)" },
      { name: "wh_amount",     type: "NUMERIC(10,2)" },
      { name: "ec_equivalent", type: "NUMERIC(12,4)",  note: "wh_amount × grid price for records" },
      { name: "created_at",    type: "TIMESTAMP",      note: "offset is permanent after this" },
    ],
  },
};

function tableHeight(t) {
  return HEADER_H + t.fields.length * ROW_H + 10;
}

const RELATIONSHIPS = [
  { from: "panels",           to: "users",            fromSide: "left",   toSide: "right" },
  { from: "energy_logs",      to: "users",            fromSide: "left",   toSide: "right" },
  { from: "energy_logs",      to: "panels",           fromSide: "top",    toSide: "bottom" },
  { from: "wh_batches",       to: "energy_logs",      fromSide: "top",    toSide: "bottom" },
  { from: "wh_batches",       to: "users",            fromSide: "left",   toSide: "right" },
  { from: "listings",         to: "users",            fromSide: "right",  toSide: "left" },
  { from: "listings",         to: "wh_batches",       fromSide: "right",  toSide: "left" },
  { from: "transactions",     to: "listings",         fromSide: "top",    toSide: "bottom" },
  { from: "transactions",     to: "users",            fromSide: "right",  toSide: "left" },
  { from: "bill_offsets",     to: "users",            fromSide: "top",    toSide: "bottom" },
  { from: "bill_offsets",     to: "wh_batches",       fromSide: "right",  toSide: "left" },
  { from: "ec_purchases",     to: "users",            fromSide: "top",    toSide: "bottom" },
  { from: "ec_purchases",     to: "platform_reserve", fromSide: "bottom", toSide: "top" },
];

function getEdgePoint(table, side) {
  const h = tableHeight(table);
  switch (side) {
    case "top":    return { x: table.x + TABLE_WIDTH / 2, y: table.y };
    case "bottom": return { x: table.x + TABLE_WIDTH / 2, y: table.y + h };
    case "left":   return { x: table.x,               y: table.y + h / 2 };
    case "right":  return { x: table.x + TABLE_WIDTH,  y: table.y + h / 2 };
    default:       return { x: table.x, y: table.y };
  }
}

function RelLine({ rel }) {
  const from = TABLES[rel.from];
  const to   = TABLES[rel.to];
  if (!from || !to) return null;
  const p1 = getEdgePoint(from, rel.fromSide);
  const p2 = getEdgePoint(to,   rel.toSide);
  let d;
  if (rel.fromSide === "left" || rel.fromSide === "right") {
    d = `M ${p1.x} ${p1.y} C ${(p1.x+p2.x)/2} ${p1.y} ${(p1.x+p2.x)/2} ${p2.y} ${p2.x} ${p2.y}`;
  } else {
    d = `M ${p1.x} ${p1.y} C ${p1.x} ${(p1.y+p2.y)/2} ${p2.x} ${(p1.y+p2.y)/2} ${p2.x} ${p2.y}`;
  }
  return <path d={d} fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arrow)" />;
}

function TableNode({ id, table, selected, onSelect }) {
  const h = tableHeight(table);
  return (
    <g transform={`translate(${table.x},${table.y})`} onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
      <rect x={3} y={3} width={TABLE_WIDTH} height={h} rx={8} fill="rgba(0,0,0,0.3)" />
      <rect width={TABLE_WIDTH} height={h} rx={8} fill="#1E293B"
        stroke={selected ? table.color : "#334155"} strokeWidth={selected ? 2.5 : 1} />
      <rect width={TABLE_WIDTH} height={HEADER_H} rx={8} fill={table.color} opacity={0.9} />
      <rect y={HEADER_H - 8} width={TABLE_WIDTH} height={8} fill={table.color} opacity={0.9} />
      <text x={TABLE_WIDTH/2} y={HEADER_H/2+5} textAnchor="middle"
        fill="white" fontSize={12} fontWeight="800" fontFamily="monospace">
        {table.label}
      </text>
      {table.fields.map((f, i) => (
        <g key={f.name} transform={`translate(0,${HEADER_H + 5 + i * ROW_H})`}>
          <text x={10} y={16} fontSize={9} fontFamily="monospace"
            fill={f.pk ? "#F59E0B" : f.fk ? "#94A3B8" : "#475569"}>
            {f.pk ? "PK" : f.fk ? "FK" : "  "}
          </text>
          <text x={32} y={16} fontSize={11} fontFamily="monospace"
            fill={f.pk ? "#FCD34D" : f.fk ? "#93C5FD" : "#E2E8F0"}
            fontWeight={f.pk ? "700" : "400"}>
            {f.name}
          </text>
          <text x={TABLE_WIDTH - 8} y={16} textAnchor="end" fontSize={9} fontFamily="monospace" fill="#475569">
            {f.type}
          </text>
          {f.note && <title>{f.note}</title>}
        </g>
      ))}
    </g>
  );
}

const CHANGES = [
  { label: "No P2P trade fee",        desc: "transactions has no fee_burned — EC moves freely user to user" },
  { label: "Mint fee is only burn",   desc: "energy_logs.fee_burned is the sole EC destruction mechanism" },
  { label: "wh_batches.status",       desc: "available → reserved → listed → offset → expired lifecycle" },
  { label: "30-day expiry",           desc: "Up from 7 days — pure loss on expiry mirrors physical waste" },
  { label: "Warning tiers",           desc: "warning_level: null → amber (day 20) → red (day 27)" },
  { label: "listings.batch_id + expiry", desc: "Listing tied to batch — auto-expires when batch expires" },
  { label: "platform_reserve table", desc: "Tracks EC pool for consumer fiat purchases + supply audit" },
  { label: "bill_offsets.batch_id",   desc: "Offset directly marks batch as consumed — irreversible" },
  { label: "No fiat entry fee",       desc: "ec_purchases has no fee — consumers pay clean grid price" },
];

export default function ERDDiagram() {
  const [selected, setSelected] = useState(null);
  const [showChanges, setShowChanges] = useState(false);
  const svgW = 1060;
  const svgH = 980;
  const selectedTable = selected ? TABLES[selected] : null;

  return (
    <div style={{ background: "#0F172A", minHeight: "100vh", fontFamily: "monospace", padding: "20px", color: "#E2E8F0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#F59E0B" }}>⚡ EnergyCredit</span>
              <span style={{ fontSize: 11, color: "#64748B", background: "#1E293B", padding: "2px 10px", borderRadius: 4, border: "1px solid #334155" }}>ERD v2.0</span>
              <span style={{ fontSize: 11, color: "#10B981", background: "#05231799", padding: "2px 10px", borderRadius: 4, border: "1px solid #065F46" }}>9 tables</span>
            </div>
            <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>Click table to inspect · Hover fields for notes · PK = Primary Key · FK = Foreign Key</p>
          </div>
          <button onClick={() => setShowChanges(v => !v)} style={{
            background: showChanges ? "#1E3A5F" : "#1E293B",
            border: `1px solid ${showChanges ? "#3B82F6" : "#334155"}`,
            color: showChanges ? "#93C5FD" : "#94A3B8",
            borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11,
          }}>
            {showChanges ? "▲ Hide" : "▼ Show"} v2.0 changes
          </button>
        </div>

        {/* Changelog */}
        {showChanges && (
          <div style={{ background: "#080F1A", border: "1px solid #1E3A5F", borderRadius: 10, padding: "14px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", marginBottom: 10, letterSpacing: 1 }}>CHANGES FROM v1.0</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {CHANGES.map(c => (
                <div key={c.label} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#10B981", flexShrink: 0, marginTop: 1 }}>+</span>
                  <div>
                    <div style={{ fontSize: 11, color: "#E2E8F0", fontWeight: 700 }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SVG ERD */}
        <div style={{ background: "#080F1A", border: "1px solid #1E293B", borderRadius: 12, overflow: "auto" }}>
          <svg width={svgW} height={svgH} style={{ display: "block" }}>
            <defs>
              <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill="#334155" />
              </marker>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F1A2B" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={svgW} height={svgH} fill="url(#grid)" />
            {RELATIONSHIPS.map((rel, i) => <RelLine key={i} rel={rel} />)}
            {Object.entries(TABLES).map(([id, table]) => (
              <TableNode key={id} id={id} table={table} selected={selected === id} onSelect={setSelected} />
            ))}
          </svg>
        </div>

        {/* Field inspector */}
        {selectedTable && (
          <div style={{ marginTop: 14, background: "#1E293B", border: `1px solid ${selectedTable.color}`, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: selectedTable.color }}>{selectedTable.label}</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 7 }}>
              {selectedTable.fields.map(f => (
                <div key={f.name} style={{ background: "#0F172A", borderRadius: 6, padding: "8px 12px", border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: f.pk ? "#FCD34D" : f.fk ? "#93C5FD" : "#E2E8F0" }}>
                      {f.pk ? "🔑 " : f.fk ? "🔗 " : ""}{f.name}
                    </span>
                    <span style={{ fontSize: 9, color: "#475569" }}>{f.type}</span>
                  </div>
                  {f.note && <div style={{ fontSize: 10, color: "#64748B", marginTop: 3 }}>{f.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Constants */}
        <div style={{ marginTop: 14, background: "#1E293B", borderRadius: 10, padding: "14px 18px", border: "1px solid #334155" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", marginBottom: 10 }}>⚙️ System Constants — config only, not stored in DB</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              ["GRID_PRICE_PER_WH", "$0.10 / Wh",  "EC fiat price ceiling"],
              ["MINT_RATE",         "0.05 EC / Wh", "EC earned per Wh logged"],
              ["MINT_FEE",          "6%",            "Only fee — burned at minting"],
              ["SIGNUP_GRANT_EC",   "50 EC",         "Consumer starting balance"],
              ["WH_EXPIRY_DAYS",    "30 days",       "Batch lifetime"],
              ["WARN_AMBER_DAY",    "Day 20",        "First expiry warning"],
              ["WARN_RED_DAY",      "Day 27",        "Urgent expiry warning"],
            ].map(([k, v, note]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "#93C5FD" }}>{k}</div>
                <div style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 10, color: "#64748B" }}>{note}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}