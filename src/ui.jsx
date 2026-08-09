// Fælles UI-primitiver og formattering — samme visuelle identitet som NFV111-værktøjet
import React from "react";

// ─── farver ───
export const BL = "#E8DCC4";                    // creme (tekst)
export const BG = "#0F2626";                    // mørk grøn (baggrund)
export const CD = "rgba(43,59,54,0.4)";         // kort
export const CB = "rgba(232,220,196,0.15)";     // kant
export const GR = "#22C55E", RD = "#EF4444", OR = "#F59E0B";
export const GY = "rgba(232,220,196,0.5)";
export const GD = "#D4C5A9", TL = "#367878", LT = "rgba(43,59,54,0.3)";
export const PCOL = ["#D4C5A9", "#22C55E", "#367878", "#EF4444", "#9333EA", "#0F766E", "#F59E0B", "#E8DCC4"];

// ─── formattering (da-DK) ───
export const f = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(".", ",") + " mDKK";
  return Math.round(n).toLocaleString("da-DK") + " DKK";
};
export const fK = (n) => (n === null || n === undefined || isNaN(n)) ? "—" : Math.round(n).toLocaleString("da-DK");
export const fP = (n) => (n === null || n === undefined || isNaN(n)) ? "—" : (n * 100).toFixed(1).replace(".", ",") + "%";
export const fP2 = (n) => (n === null || n === undefined || isNaN(n)) ? "—" : (n * 100).toFixed(2).replace(".", ",") + "%";
export const fX = (n) => (n === null || n === undefined || isNaN(n)) ? "—" : n.toFixed(2).replace(".", ",") + "x";

// ─── komponenter ───
export function TabBar({ tabs, active, onChange, extra }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 9999, padding: 4, marginBottom: 20, overflowX: "auto", alignItems: "center" }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ padding: "10px 16px", fontSize: 12, fontWeight: isActive ? 700 : 500, background: isActive ? "rgba(255,255,255,0.12)" : "transparent", color: isActive ? BL : "rgba(232,220,196,0.7)", border: "none", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 9999, transition: "all 0.2s" }}>
            {t.label}
          </button>
        );
      })}
      {extra || null}
    </div>
  );
}

export function Sec({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ color: BL, fontSize: 17, borderBottom: "2px solid rgba(232,220,196,0.2)", paddingBottom: 5, marginBottom: 4, borderLeft: "3px solid " + GD, paddingLeft: 10, fontFamily: "'Playfair Display',Georgia,serif" }}>{title}</h2>
      {sub ? <p style={{ fontSize: 11, color: "rgba(232,220,196,0.5)", margin: "0 0 12px" }}>{sub}</p> : null}
      {children}
    </div>
  );
}

export function Kp({ label, value, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: CD, border: "1px solid " + CB, borderRadius: 16, padding: "12px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "rgba(232,220,196,0.6)", marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color || BL }}>{value}</div>
      {sub ? <div style={{ fontSize: 10, color: "rgba(232,220,196,0.4)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export function DR({ label, value, bg, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: bg || "transparent", fontWeight: bold ? 700 : 400, fontSize: 12.5, borderBottom: "1px solid " + CB, color: BL }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", color: color || BL }}>{value}</span>
    </div>
  );
}

export function Sl({ label, value, min, max, step, onChange, unit, ff }) {
  const display = ff ? ff(value)
    : unit === "%" ? value.toFixed(step < 1 ? (step < 0.5 ? 2 : 1) : 0).replace(".", ",") + " %"
    : fK(value) + " " + (unit || "");
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
        <span style={{ fontWeight: 600, color: "rgba(232,220,196,0.7)" }}>{label}</span>
        <span style={{ fontWeight: 700, color: BL }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: TL, height: 5 }} />
    </div>
  );
}

export function Hd({ text, bg }) {
  return <div style={{ background: bg || "rgba(232,220,196,0.12)", color: "#E8DCC4", padding: "7px 12px", fontSize: 11.5, fontWeight: 600 }}>{text}</div>;
}

export function TotR({ left, right, bg }) {
  return (
    <div style={{ background: bg || "rgba(232,220,196,0.12)", color: "#E8DCC4", padding: "9px 12px", fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
      <span>{left}</span><span>{right}</span>
    </div>
  );
}

export function Crd({ children }) {
  return <div style={{ background: CD, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(232,220,196,0.15)" }}>{children}</div>;
}

export function Note({ children }) {
  return <div style={{ fontSize: 10.5, color: "rgba(232,220,196,0.45)", lineHeight: 1.5, marginTop: 8, fontStyle: "italic" }}>{children}</div>;
}

export function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11.5, color: "rgba(232,220,196,0.75)", fontWeight: 600, marginBottom: 12 }}>
      <span onClick={(e) => { e.preventDefault(); onChange(!value); }}
        style={{ width: 34, height: 18, borderRadius: 9999, background: value ? TL : "rgba(232,220,196,0.15)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: BL, transition: "left 0.2s" }} />
      </span>
      {label}
    </label>
  );
}

// tooltip til grafer
export function makeTip(fmt) {
  return function Tip(p) {
    if (!p.active || !p.payload) return null;
    return (
      <div style={{ background: "#16302f", border: "1px solid rgba(232,220,196,0.25)", borderRadius: 6, padding: 8, fontSize: 11, color: BL }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
        {p.payload.map((x, i) => <div key={i} style={{ color: x.color || BL }}>{x.name}: {(fmt || f)(x.value)}</div>)}
      </div>
    );
  };
}
