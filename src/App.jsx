// ─────────────────────────────────────────────────────────────────────────────
// case-template — generisk, spec-drevet business case-dashboard (Fairhomes)
// Tilpasning af LGV2628_Business_Case.jsx: al ejendomsspecifik viden bor i
// src/case.spec.json (tal + modelkontakter) og src/prosa.json (tekster).
// Beregningerne bor i src/calcModel.js — FREDET, se POLISH.md.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import {
  BL, CD, CB, GR, RD, OR, GY, GD, TL, LT, PCOL,
  f, fK, fP2 as fP,
  TabBar, Sec, Kp, DR, Sl, Hd, TotR, Crd, Note,
} from "./ui.jsx";
import { calcModel } from "./calcModel.js";
import spec from "./case.spec.json";
import prosa from "./prosa.json";

const SKEY = spec.slug + "-bc";
const AUTH_KEY = spec.slug + "-auth";
const BASE = import.meta.env.BASE_URL; // relative asset-stier (GitHub Pages-understi)
// FREDET: delt tilstand genbruger den deployede Vercel-funktion fra lgv2628 —
// hver case adskilles via ?p=<slug> (ALDRIG ?k=bc, som er LGV's egen nøgle).
const API_STATE = "https://lgv2628.vercel.app/api/state";
const GRID = "rgba(232,220,196,0.1)";
const REFL = "rgba(232,220,196,0.3)";
// de forudsætninger, casen er mest følsom over for — vises som calculator på memo-fanen
const MEMO_SLIDERS = ["pp", "csqm", "spSqm", "rent"];

// ── delt lagring: /api/state (Vercel Blob) med localStorage som fallback ──
async function remoteGet() {
  try {
    const r = await fetch(API_STATE + "?p=" + encodeURIComponent(spec.slug), { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}
function remoteSet(obj) {
  try {
    fetch(API_STATE + "?p=" + encodeURIComponent(spec.slug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    }).catch(() => {});
  } catch (e) {}
}

// formattering pr. fmt-nøgle i spec (JSON kan ikke indeholde funktioner)
const FMT = {
  dkk: f,
  kr: fK,
  pct: fP,
  pctRaw: function(v) { return v.toFixed(2).replace(".", ",") + "%"; },
  x: function(v) { return v.toFixed(2).replace(".", ",") + "x"; },
  aar: function(v) { return v + " år"; },
};
function fmtFn(key) { return FMT[key] || f; }

// kort formåls-/beskrivelsesboks øverst på hvert faneblad
function TabIntro(props) {
  return (
    <div style={{ background: "rgba(43,59,54,0.4)", border: "1px solid rgba(232,220,196,0.15)", borderLeft: "3px solid #D4C5A9", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(232,220,196,0.45)", marginBottom: 4 }}>FORMÅL</div>
      <div style={{ fontSize: 12.5, color: "rgba(232,220,196,0.8)", lineHeight: 1.6 }}>{props.children}</div>
    </div>
  );
}

// guld-pill på alle prosa-afsnit med udkast:true — fjernes KUN efter menneskelig godkendelse (se POLISH.md)
function UdkastBadge() {
  return (
    <span style={{ display: "inline-block", background: "rgba(212,197,169,0.12)", border: "1px solid " + GD, color: GD, borderRadius: 9999, fontSize: 9, letterSpacing: 1.5, fontWeight: 700, padding: "2px 10px", marginLeft: 8, verticalAlign: "middle", whiteSpace: "nowrap" }}>
      UDKAST — IKKE GENNEMGÅET
    </span>
  );
}

// prosa-sektion fra prosa.json: { titel, afsnit: [{ tekst, udkast }] }
function ProsaSec({ sektion, sub }) {
  if (!sektion || !sektion.afsnit || !sektion.afsnit.length) return null;
  return (
    <Sec title={sektion.titel} sub={sub}>
      <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(232,220,196,0.85)", maxWidth: 830 }}>
        {sektion.afsnit.map(function(a, i) {
          return (
            <p key={i} style={{ margin: i < sektion.afsnit.length - 1 ? "0 0 10px" : 0 }}>
              {a.tekst}
              {a.udkast ? <UdkastBadge /> : null}
            </p>
          );
        })}
      </div>
    </Sec>
  );
}

// ét fase-kort på finansieringsfanen: hvilken gæld bærer projektet hvornår
function Fase({ n, titel, aar, laan, laanTxt, rows, advar }) {
  return (
    <div style={{ background: CD, borderRadius: 8, overflow: "hidden", border: "1px solid " + (advar ? "rgba(245,158,11,0.45)" : CB) }}>
      <div style={{ background: advar ? "rgba(245,158,11,0.15)" : "rgba(232,220,196,0.12)", padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: BL }}>FASE {n} · {titel}</span>
        <span style={{ fontSize: 10, color: GY }}>{aar}</span>
      </div>
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: BL, fontVariantNumeric: "tabular-nums" }}>{f(laan)}</div>
        <div style={{ fontSize: 10, color: GY, marginBottom: 8 }}>{laanTxt}</div>
      </div>
      {rows.map(function(r, i) {
        return <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 12px", fontSize: 11, color: BL, background: i % 2 ? LT : "transparent" }}>
          <span style={{ color: GY }}>{r[0]}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{r[1]}</span>
        </div>;
      })}
    </div>
  );
}

// myndighedsscenarier: samme case regnet igennem ved forskellige udfald af
// plangrundlaget. Rene regneeksempler — spec.myndighedsscenarier, ikke rammer.
function Myndighed({ P, m }) {
  var scen = spec.myndighedsscenarier || [];
  if (!scen.length) return null;
  var auBase = m.AREA / P.units; // hold gennemsnitsboligen konstant på tværs af scenarier
  var rows = scen.map(function(sc) {
    var area = Math.round(P.grundAreal * sc.bebygPct / 100);
    var units = Math.max(1, Math.round(area / auBase));
    var r = calcModel(Object.assign({}, P, { bebygPct: sc.bebygPct, units: units }), spec);
    return { sc: sc, area: r.AREA, units: units, r: r, aktiv: sc.bebygPct === P.bebygPct };
  });
  var th = { background: "rgba(232,220,196,0.12)", padding: "7px 8px", whiteSpace: "nowrap" };
  return (
    <Sec title="Myndighedsscenarier" sub="Samme case regnet igennem, hvis kommunen lander et andet sted på udnyttelsen">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, color: BL }}>
          <thead><tr>
            <th style={Object.assign({ textAlign: "left" }, th)}>Scenarie</th>
            <th style={Object.assign({ textAlign: "right" }, th)}>Bebyg.%</th>
            <th style={Object.assign({ textAlign: "right" }, th)}>Etageareal</th>
            <th style={Object.assign({ textAlign: "right" }, th)}>Boliger</th>
            <th style={Object.assign({ textAlign: "right" }, th)}>Yield on cost</th>
            <th style={Object.assign({ textAlign: "right" }, th)}>Profit eft. renter</th>
            <th style={Object.assign({ textAlign: "right" }, th)}>Årligt afkast</th>
          </tr></thead>
          <tbody>
            {rows.map(function(row, i) {
              var td = { padding: "6px 8px", textAlign: "right", background: row.aktiv ? "rgba(245,158,11,0.15)" : i % 2 ? LT : "transparent", fontWeight: row.aktiv ? 700 : 400, fontVariantNumeric: "tabular-nums" };
              return <tr key={i}>
                <td style={Object.assign({}, td, { textAlign: "left" })}>
                  {row.sc.navn}{row.aktiv ? " •" : ""}
                  {row.sc.note ? <div style={{ fontSize: 10, color: GY, fontWeight: 400 }}>{row.sc.note}</div> : null}
                </td>
                <td style={td}>{row.sc.bebygPct} %</td>
                <td style={td}>{fK(row.area)} m²</td>
                <td style={td}>{row.units} stk.</td>
                <td style={Object.assign({}, td, { color: row.r.yoc >= 0.05 ? GR : row.r.yoc >= 0.04 ? BL : RD })}>{fP(row.r.yoc)}</td>
                <td style={Object.assign({}, td, { color: row.r.totalRetLev > 0 ? GR : RD })}>{f(row.r.totalRetLev)}</td>
                <td style={Object.assign({}, td, { color: row.r.cagrLev > 0 ? GR : RD })}>{fP(row.r.cagrLev)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <Note>
        Regneeksempler, ikke plangrundlag — ingen af scenarierne er bekræftet af kommunen.
        Boligstørrelsen holdes fast på ca. {Math.round(auBase)} m², så antallet af boliger følger etagearealet.
        Øvrige forudsætninger er som valgt på de andre faner. • markerer det scenarie, casen står på nu.
      </Note>
    </Sec>
  );
}

// billede med caption — skjules automatisk, hvis filen mangler i /public
function Billede({ src, alt, caption, height }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid " + CB, marginBottom: 16 }}>
      <img src={BASE + src} alt={alt} loading="lazy"
        style={{ width: "100%", display: "block", height: height, objectFit: height ? "cover" : undefined }}
        onError={function(e) { e.currentTarget.parentElement.style.display = "none"; }} />
      {caption ? <div style={{ padding: "8px 12px", fontSize: 11, color: GY, background: CD }}>{caption}</div> : null}
    </div>
  );
}

export default function App() {
  var s = useState;
  var _tab = s("memo"), tab = _tab[0], setTab = _tab[1];

  // ── forudsætninger som ét objekt (spec-drevet — LGV havde en state pr. slider) ──
  var _P = s(function() { return Object.assign({}, spec.defaults); });
  var P = _P[0], setP = _P[1];
  var setParam = function(id, v) { setP(function(prev) { var n = Object.assign({}, prev); n[id] = v; return n; }); };
  var applyData = function(d) {
    var n = Object.assign({}, spec.defaults);
    for (var k in spec.defaults) { if (d && d[k] !== undefined) n[k] = d[k]; }
    setP(n);
    return n;
  };

  // ── adgangskode-gate: kun hvis spec.adgangskode er sat (diskretion, ikke sikkerhed) ──
  var harKode = !!spec.adgangskode;
  var _auth = s(function() {
    if (!harKode) return true;
    try { return localStorage.getItem(AUTH_KEY) === "ok"; } catch (e) { return false; }
  });
  var authed = _auth[0], setAuthed = _auth[1];
  var _kode = s(""), kode = _kode[0], setKode = _kode[1];
  var _kfejl = s(false), kodeFejl = _kfejl[0], setKodeFejl = _kfejl[1];
  var provKode = function() {
    if (kode.trim().toLowerCase() === String(spec.adgangskode).toLowerCase()) {
      try { localStorage.setItem(AUTH_KEY, "ok"); } catch (e) {}
      setAuthed(true);
    } else { setKodeFejl(true); setKode(""); }
  };

  var _loaded = s(false), loaded = _loaded[0], setLoaded = _loaded[1];
  var _status = s(""), status = _status[0], setStatus = _status[1]; // "gemt" | ""
  var _saved = s(spec.defaults), savedData = _saved[0], setSavedData = _saved[1];
  var statusTimer = useRef(null);

  // ── indlæs gemt tilstand: delt lager (/api/state?p=slug) først, derefter lokal fallback ──
  useEffect(function() {
    (async function() {
      var d = await remoteGet();
      if (!d || Object.keys(d).length === 0) {
        try { var l = localStorage.getItem(SKEY); if (l) d = JSON.parse(l); } catch (e) {}
      }
      var merged;
      try {
        merged = applyData(d);
        if (d && d.tab !== undefined) setTab(d.tab);
      } catch (e) { merged = applyData(null); /* korrupt data — brug defaults */ }
      setSavedData(merged);
      setLoaded(true);
    })();
  }, []);

  var dirty = loaded && JSON.stringify(P) !== JSON.stringify(savedData);

  // ── GEM: skriv forudsætninger til delt lager + lokal fallback ──
  var gem = function() {
    var data = Object.assign({}, P, { tab: tab });
    try { localStorage.setItem(SKEY, JSON.stringify(data)); } catch (e) {}
    remoteSet(data);
    setSavedData(P);
    setStatus("gemt");
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(function() { setStatus(""); }, 2500);
  };

  // ── advar før man forlader siden med ugemte ændringer ──
  useEffect(function() {
    var h = function(e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return function() { window.removeEventListener("beforeunload", h); };
  }, [dirty]);

  // ── Cmd/Ctrl+S gemmer ──
  useEffect(function() {
    var h = function(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); if (dirty) gem(); }
    };
    window.addEventListener("keydown", h);
    return function() { window.removeEventListener("keydown", h); };
  });

  // ── beregning ──
  var m = useMemo(function() { return calcModel(P, spec); }, [JSON.stringify(P)]);
  var model = spec.model || {};
  var exitModes = model.exitModes || ["sqm"];
  var capMode = m.exitMode === "cap";
  var holdMode = m.exitMode === "hold";
  var purchase = m.landMode === "purchase";
  var twoPhase = m.debtMode === "twoPhase";
  var threePhase = m.debtMode === "threePhase";
  var FA = m.faser || {};
  var itemised = m.opexMode === "itemised";
  var units = P.units, tyrs = P.tyrs;
  var AREA = m.AREA, AU = m.AU;

  // ── følsomhedsmatrix: valgbare akser og nøgletal fra spec ──
  var SENS_PARAMS = spec.sensParams || [];
  var SENS_METRICS = spec.sensMetrics || [];
  var _sx = s(SENS_PARAMS[1] ? SENS_PARAMS[1].id : (SENS_PARAMS[0] ? SENS_PARAMS[0].id : "")), sensX = _sx[0], setSensX = _sx[1];
  var _sy = s(SENS_PARAMS[0] ? SENS_PARAMS[0].id : ""), sensY = _sy[0], setSensY = _sy[1];
  var _sm = s(SENS_METRICS[0] ? SENS_METRICS[0].id : ""), sensM = _sm[0], setSensM = _sm[1];
  var sens = useMemo(function() {
    var xP = SENS_PARAMS.find(function(p) { return p.id === sensX; });
    var yP = SENS_PARAMS.find(function(p) { return p.id === sensY; });
    var met = SENS_METRICS.find(function(p) { return p.id === sensM; });
    if (!xP || !yP || !met || sensX === sensY) return null;
    var pair = [sensX, sensY];
    // cap rate og salgspris er konkurrerende exit-metoder — kan ikke krydses
    if (pair.indexOf("capRate") >= 0 && pair.indexOf("spSqm") >= 0) return null;
    // aksens exit-parameter bestemmer metoden (hvis den er aktiveret i spec'en)
    var modeOv = {};
    if (pair.indexOf("spSqm") >= 0 && exitModes.indexOf("sqm") >= 0) modeOv = { exitMode: "sqm" };
    else if (pair.indexOf("capRate") >= 0 && exitModes.indexOf("cap") >= 0) modeOv = { exitMode: "cap" };
    var rows = yP.values.map(function(yv) {
      return { yVal: yv, cells: xP.values.map(function(xv) {
        var o = Object.assign({}, P, modeOv);
        o[sensX] = xv; o[sensY] = yv;
        return { xVal: xv, value: calcModel(o, spec)[sensM] };
      }) };
    });
    return { xP: xP, yP: yP, met: met, xVals: xP.values, yVals: yP.values, rows: rows, xCur: P[sensX], yCur: P[sensY] };
  }, [JSON.stringify(P), sensX, sensY, sensM]);

  // ── faner (skjul dem, der ikke er relevante for modelkontakterne) ──
  var tabs = [
    { id: "memo", label: "Investment memo" },
    { id: "overblik", label: "Overblik" },
    { id: "invest", label: "Investering" },
    { id: "drift", label: "Drift" },
    { id: "finans", label: "Finansiering" },
  ];
  if (exitModes.length > 0) tabs.push({ id: "exit", label: "Exit/Salg" });
  if (model.feeMode) tabs.push({ id: "fees", label: "Fee-struktur" });
  if (SENS_PARAMS.length > 1 && SENS_METRICS.length > 0) tabs.push({ id: "sens", label: "Følsomhed" });

  // ── KPI-farvetærskler fra spec ──
  var th = spec.thresholds || {};
  var thc = function(v, t, elseC) { return t ? (v >= t.good ? GR : v >= t.ok ? (elseC || BL) : RD) : BL; };
  var yocC = thc(m.yoc, th.yoc);
  var retC = m.totalReturn > 0 ? GR : RD;
  var retLC = m.totalRetLev > 0 ? GR : RD;
  var cagrC = thc(m.cagr, th.cagr);
  var levC = thc(m.cagrLev, th.cagrLev);
  var dscrC = m.dscr >= (th.dscr ? th.dscr.good : 1.3) ? GR : m.dscr >= (th.dscr ? th.dscr.ok : 1.0) ? OR : RD;
  var cocC = thc(m.cocReturn, th.coc);
  var ivC = m.iv4 > m.totalCapital ? GR : RD;
  var eqMC = thc(m.eqMultLev, th.eqMult);
  var levOn = m.loanAmt > 0;

  var tipStyle = { background: "#16302f", border: "1px solid rgba(232,220,196,0.25)", borderRadius: 6, fontSize: 11 };
  var tipItem = { color: BL };
  var cTip = function(p) {
    if (!p.active || !p.payload) return null;
    return React.createElement("div", { style: { background: "#16302f", border: "1px solid rgba(232,220,196,0.25)", borderRadius: 6, padding: 8, fontSize: 11, color: BL } },
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 4 } }, "År " + p.label),
      p.payload.map(function(x, i) { return React.createElement("div", { key: i, style: { color: x.color || BL } }, x.name + ": " + f(x.value)); })
    );
  };

  // ── sliders fra spec, grupperet pr. fane ──
  var slGruppe = function(g) { return (spec.sliders || []).filter(function(sl) { return sl.gruppe === g; }); };
  var renderSliders = function(list) {
    return list.map(function(sl) {
      return <Sl key={sl.id} label={sl.label} value={P[sl.id]} min={sl.min} max={sl.max} step={sl.step}
        unit={sl.unit} ff={sl.unit === "DKK" ? f : undefined}
        onChange={function(v) { setParam(sl.id, v); }} />;
    });
  };
  var _cd = s(false), showCD = _cd[0], setShowCD = _cd[1];
  var bygSliders = slGruppe("byggedetaljer");

  // segmenteret vælger til exit-beregningsmetode (kun aktiverede modes fra spec)
  var EXIT_LABELS = { sqm: "Stykvis salg (kr/m² pr. bolig)", cap: "Samlet salg (cap rate)", hold: "Drift (behold — urealiseret)" };
  var ExitModeSwitch = exitModes.length > 1 ? (
    <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 9999, padding: 4, width: "fit-content", marginBottom: 14 }}>
      {exitModes.map(function(id) {
        var on = m.exitMode === id;
        return <button key={id} onClick={function() { setParam("exitMode", id); }}
          style={{ padding: "8px 16px", fontSize: 12, fontWeight: on ? 700 : 500, background: on ? TL : "transparent", color: on ? BL : "rgba(232,220,196,0.7)", border: "none", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 9999, transition: "all 0.2s" }}>
          {EXIT_LABELS[id] || id}
        </button>;
      })}
    </div>
  ) : null;

  // ── login-gate (kun hvis spec.adgangskode er sat) ──
  if (!authed) return (
    <div style={{ fontFamily: "'Inter',system-ui,-apple-system,sans-serif", minHeight: "100vh", background: "#0F2626", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <img src={BASE + "hero.png"} alt="" aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, filter: "blur(3px)", transform: "scale(1.04)" }}
        onError={function(e) { e.currentTarget.style.display = "none"; }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,38,38,0.72) 0%, rgba(15,38,38,0.94) 100%)" }} />
      <div style={{ position: "relative", background: "rgba(22,48,47,0.94)", border: "1px solid " + CB, borderRadius: 18, padding: "44px 40px 34px", maxWidth: 430, width: "100%", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(232,220,196,0.45)", marginBottom: 10 }}>FAIRHOMES · BUSINESS CASE</div>
        <h1 style={{ margin: "0 0 4px", fontSize: 27, fontFamily: "'Playfair Display',Georgia,serif", color: BL }}>{spec.kortTitel}</h1>
        <div style={{ fontSize: 12.5, color: "rgba(232,220,196,0.6)", marginBottom: 22 }}>{spec.adresse} · {spec.postnrBy}</div>
        <div style={{ height: 1, background: "rgba(232,220,196,0.15)", margin: "0 auto 22px", width: 60 }} />
        <div style={{ fontSize: 12, color: "rgba(232,220,196,0.7)", marginBottom: 14 }}>Indtast adgangskode for at åbne investeringsværktøjet</div>
        <input type="password" value={kode} autoFocus placeholder="Adgangskode"
          onChange={function(e) { setKode(e.target.value); setKodeFejl(false); }}
          onKeyDown={function(e) { if (e.key === "Enter") provKode(); }}
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(15,38,38,0.85)", border: "1px solid " + (kodeFejl ? RD : CB), borderRadius: 10, padding: "13px 14px", color: BL, fontSize: 15, textAlign: "center", letterSpacing: 4, outline: "none", marginBottom: 10 }} />
        {kodeFejl && <div style={{ fontSize: 11, color: RD, marginBottom: 10, fontWeight: 600 }}>Forkert kode — prøv igen</div>}
        <button onClick={provKode}
          style={{ width: "100%", background: TL, color: BL, border: "1px solid " + TL, borderRadius: 10, padding: "13px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>
          Åbn dashboard →
        </button>
        <div style={{ fontSize: 9.5, color: "rgba(232,220,196,0.35)", marginTop: 22, letterSpacing: 0.5 }}>Fortroligt materiale · Fairhomes</div>
      </div>
    </div>
  );

  if (!loaded) return (
    <div style={{ fontFamily: "'Inter',system-ui,-apple-system,sans-serif", maxWidth: 960, margin: "0 auto", padding: "60px 14px", textAlign: "center", color: GY, background: "#0F2626", minHeight: "100vh" }}>
      <div style={{ fontSize: 14 }}>Indlæser gemt tilstand...</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter',system-ui,-apple-system,sans-serif", maxWidth: 960, margin: "0 auto", padding: "18px 16px 60px", color: BL, background: "#0F2626", minHeight: "100vh" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(232,220,196,0.4)", marginBottom: 2 }}>FAIRHOMES · BUSINESS CASE</div>
          <h1 style={{ margin: 0, fontSize: 26, fontFamily: "'Playfair Display',Georgia,serif", color: BL }}>{spec.titel}</h1>
          <div style={{ fontSize: 12, color: "rgba(232,220,196,0.55)" }}>{spec.postnrBy} · {spec.produkt} · Grund {fK(P.grundAreal)} m²</div>
          <div style={{ fontSize: 11, color: "rgba(232,220,196,0.4)", marginTop: 3, fontStyle: "italic" }}>{spec.tagline}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: status === "gemt" ? GR : dirty ? OR : "rgba(232,220,196,0.4)", minWidth: 78, textAlign: "right", transition: "color .2s" }}>
            {status === "gemt" ? "✓ Gemt" : dirty ? "● Ikke gemt" : "Alt gemt"}
          </span>
          <button onClick={gem} disabled={!dirty}
            title="Gem de aktuelle forudsætninger, så de er der næste gang (deles på tværs af enheder). Genvej: Cmd/Ctrl+S"
            style={{ background: dirty ? TL : "rgba(54,120,120,0.3)", color: BL, border: "1px solid " + (dirty ? TL : CB), borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: dirty ? "pointer" : "default", opacity: dirty ? 1 : 0.6 }}>
            💾 Gem
          </button>
          <button onClick={function() {
            if (dirty && !confirm("Nulstil alle forudsætninger til standard? Ikke-gemte ændringer går tabt. (Tryk Gem bagefter for at gøre det permanent.)")) return;
            applyData(null);
            setStatus("");
          }} style={{ fontSize: 11, color: "rgba(232,220,196,0.7)", background: "transparent", border: "1px solid " + CB, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}>
            ↺ Nulstil
          </button>
        </div>
      </div>

      {/* hero — /public/hero.png; skjules automatisk hvis filen mangler */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 16, border: "1px solid " + CB }}>
        <img src={BASE + "hero.png"} alt={"Visualisering — " + spec.titel}
          style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }}
          onError={function(e) { e.currentTarget.parentElement.style.display = "none"; }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,38,38,0) 55%, rgba(15,38,38,0.6) 100%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 14, bottom: 10, fontSize: 10, color: "rgba(232,220,196,0.75)", letterSpacing: 1.5 }}>VISUALISERING — UDKAST</div>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "memo" && <>
        <TabIntro>Letlæst introduktion til projektet — start her. Tallene i nøgletalskortene opdateres live med forudsætningerne fra de øvrige faner og er opgjort før skat. Afsnit markeret <b>UDKAST</b> er endnu ikke gennemgået af et menneske.</TabIntro>
        <ProsaSec sektion={prosa.memo} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24 }}>
          <Kp label={purchase ? "Samlet investering" : "Byggeriet koster"} value={f(m.pI)} sub={purchase ? "grundkøb + byggeri, alt inkl." : "alt inklusive (kontant behov)"} />
          <Kp label={purchase ? "Heraf grundkøb" : "Grundens værdi"} value={f(purchase ? m.land : m.grundVaerdi)} sub={purchase ? "inkl. tinglysning og advokat/DD" : "ejes allerede — apportindskud"} />
          <Kp label="Lån" value={f(m.loanAmt)} sub={twoPhase ? "byggelån (LTC) → realkredit" : "realkredit — afdragsfrit"} />
          <Kp label="Forventet gevinst" value={f(m.totalRetLev)} sub={"over ca. " + tyrs + " år — efter renter"} color={retLC} />
        </div>

        {/* calculator: de fire tal casen er mest følsom over for, direkte på memo-fanen */}
        <Sec title="Regn selv" sub="Træk i de fire forudsætninger, casen er mest følsom over for — alle tal på siden opdateres med det samme">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            {renderSliders(MEMO_SLIDERS.map(function(id) {
              return (spec.sliders || []).find(function(sl) { return sl.id === id; });
            }).filter(Boolean))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
            <Kp label="Yield on cost" value={fP(m.yoc)} sub="NOI / samlet kapital" color={yocC} />
            <Kp label="Årligt afkast (CAGR)" value={fP(m.cagrLev)} sub="efter renter" color={levC} />
            <Kp label="Equity Multiple" value={m.eqMultLev.toFixed(2) + "x"} sub="af egenkapital" color={eqMC} />
            <Kp label="Profit pr. bolig" value={f(m.totalRetLev / units)} sub={units + " boliger à ~" + Math.round(AU) + " m²"} color={retLC} />
          </div>
          <Note>
            Alle øvrige forudsætninger ligger på fanerne Overblik, Drift, Finansiering og Exit/Salg.
            Tryk <b>Gem</b> for at dele de valgte tal på tværs af enheder, eller <b>Nulstil</b> for at gå tilbage til casens udgangspunkt.
          </Note>
        </Sec>

        <Myndighed P={P} m={m} />

        {/* ortofoto + skråfotos — hver celle skjules, hvis filen mangler */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
          <Billede src="ortofoto.jpg" alt="Ortofoto af ejendommen" caption="Ortofoto — ejendommen set fra oven" />
          <Billede src="ortofoto-oversigt.jpg" alt="Ortofoto af kvarteret omkring ejendommen" caption="Ortofoto — kvarteret omkring ejendommen" />
          <Billede src="matrikelkort.png" alt="Matrikelkort med skel og vejlinjer" caption="Matrikelkort — skel og vejlinjer omkring ejendommen" />
          <Billede src="skraafoto-n.jpg" alt="Skråfoto set fra nord" caption="Skråfoto — set fra nord" />
          <Billede src="skraafoto-s.jpg" alt="Skråfoto set fra syd" caption="Skråfoto — set fra syd" />
          <Billede src="skraafoto-e.jpg" alt="Skråfoto set fra øst" caption="Skråfoto — set fra øst" />
          <Billede src="skraafoto-w.jpg" alt="Skråfoto set fra vest" caption="Skråfoto — set fra vest" />
        </div>
        <Billede src="visualisering-1.png" alt="Visualisering 1" caption="VISUALISERING — UDKAST" />
        <Billede src="visualisering-2.png" alt="Visualisering 2" caption="VISUALISERING — UDKAST" />
        <Billede src="visualisering-3.png" alt="Visualisering 3" caption="VISUALISERING — UDKAST" />

        <ProsaSec sektion={prosa.tidslinje} />
        <ProsaSec sektion={prosa.risici} />
        <ProsaSec sektion={prosa.marked} sub="Markedsgrundlaget bag casens forudsætninger — og hvad der mangler at blive dokumenteret" />
        <ProsaSec sektion={prosa.ordforklaring} sub="De vigtigste fagudtryk i dette værktøj — forklaret i almindeligt sprog" />
      </>}

      {tab === "overblik" && <>
        <TabIntro>Projektets maskinrum: Justér forudsætningerne, og se alle nøgletal, grafer og cashflows opdatere live. Tryk <b>Gem</b> for at dele de valgte forudsætninger på tværs af enheder.</TabIntro>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
          <Kp label="Samlet kapitalindsats" value={f(m.totalCapital)} sub={purchase ? f(m.land) + " grund + " + f(m.cIn) + " byg" : f(m.pI) + " byg (kontant) + " + f(m.grundVaerdi) + " grund (apport)"} />
          <Kp label={holdMode ? "Ejendomsværdi (drift)" : "Exit-værdi (salg)"} value={f(m.exitValue)} sub={holdMode ? P.capRate + "% cap — beholdes (urealiseret)" : capMode ? P.capRate + "% cap rate (samlet salg)" : fK(P.spSqm) + " kr/m² (stykvis salg)"} />
          <Kp label="Samlet profit" value={f(m.totalRetLev)} sub={"over " + tyrs + " år — efter renter"} color={retLC} />
          <Kp label="Årligt afkast (CAGR)" value={fP(m.cagrLev)} sub={fP(m.totalRetPctLev) + " total — efter renter"} color={levC} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
          <Kp label="Equity Multiple" value={m.eqMultLev.toFixed(2) + "x"} sub="af egenkapital" color={eqMC} />
          <Kp label="Yield on Cost" value={fP(m.yoc)} sub="NOI (før renter) / samlet kapital" color={yocC} />
          <Kp label={"Implied værdi (" + P.capRate + "% cap)"} value={f(m.iv4)} sub={(m.residualValue >= 0 ? "+" : "") + f(m.residualValue) + " vs kapital"} color={ivC} />
          <Kp label="Profit pr. bolig" value={f(m.totalRetLev / units)} sub={f(m.totalRetLev / AREA) + "/m² — efter renter"} color={retLC} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20, padding: 8, background: levOn ? "rgba(245,158,11,0.08)" : "transparent", borderRadius: 8 }}>
          <Kp label="Ulev. CAGR (før finansiering)" value={fP(m.cagr)} sub={"på samlet kapital " + f(m.totalCapital)} color={cagrC} />
          <Kp label="Cash-on-Cash" value={levOn ? fP(m.cocReturn) : "—"} sub={levOn ? "NOI eft. rente / EK" : ""} color={levOn ? cocC : GY} />
          <Kp label="DSCR" value={levOn ? m.dscr.toFixed(2) + "x" : "—"} sub={levOn ? (m.dscr >= 1.3 ? "Solid" : m.dscr >= 1.0 ? "Marginal" : "Under 1x") : ""} color={levOn ? dscrC : GY} />
          <Kp label="Egenkapital" value={f(m.equityTotal)} sub={twoPhase ? "inkl. stiftelse og evt. refi-gap" : purchase ? "kontant indskud" : "grunden udgør egenkapitalen"} />
        </div>

        <Sec title="Forudsætninger" sub="Juster parametrene — alle beregninger opdateres live">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            {renderSliders(slGruppe("overblik"))}
          </div>
          {bygSliders.length > 0 && <>
            <button onClick={function() { setShowCD(!showCD); }} style={{ marginTop: 4, background: "none", border: "1px solid " + TL, color: BL, padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {showCD ? "Skjul byggedetaljer" : "Juster byggeomkostninger"}
            </button>
            {showCD && <div style={{ marginTop: 10, padding: "12px 16px", background: LT, borderRadius: 8, border: "1px solid " + CB }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
                {renderSliders(bygSliders)}
              </div>
            </div>}
          </>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 10, padding: "8px 10px", background: LT, borderRadius: 6, fontSize: 11 }}>
            <div><span style={{ color: GY }}>Grundareal:</span> <b>{fK(P.grundAreal)} m²</b></div>
            <div><span style={{ color: GY }}>Etageareal:</span> <b>{AREA} m²</b></div>
            <div><span style={{ color: GY }}>Boliger:</span> <b>{units} stk. (~{Math.round(AU)} m²)</b></div>
            <div><span style={{ color: GY }}>Grund/bolig:</span> <b>{Math.round(P.grundAreal / units)} m²</b></div>
          </div>
        </Sec>

        <Sec title="Profit-vandfald" sub="Fra egenkapital til profit — efter renter">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={m.waterfall} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="name" tick={{ fill: GY, fontSize: 11 }} />
              <YAxis tick={{ fill: GY, fontSize: 10 }} tickFormatter={function(v) { return (v / 1e6).toFixed(0) + "m"; }} />
              <Tooltip formatter={function(v) { return f(v); }} contentStyle={tipStyle} labelStyle={tipItem} itemStyle={tipItem} />
              <ReferenceLine y={0} stroke={REFL} />
              <Bar dataKey="value" name="Beløb" radius={[4, 4, 0, 0]}>
                {m.waterfall.map(function(entry, i) { return <Cell key={i} fill={entry.fill} />; })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Sec>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Sec title="Kapital vs. Værdi" sub="Sammenligning: Kapitalindsats, implied markedsværdi og exit">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.valueComp} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="name" tick={{ fill: GY, fontSize: 11 }} />
                <YAxis tick={{ fill: GY, fontSize: 10 }} tickFormatter={function(v) { return (v / 1e6).toFixed(0) + "m"; }} />
                <Tooltip formatter={function(v) { return f(v); }} contentStyle={tipStyle} labelStyle={tipItem} itemStyle={tipItem} />
                <Bar dataKey="value" name="DKK" radius={[4, 4, 0, 0]}>
                  <Cell fill={RD} />
                  <Cell fill={GD} />
                  <Cell fill={GR} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Sec>

          <Sec title="Nøgletal" sub="Break-even og margin-analyse">
            <Crd>
              <Hd text="AFKAST" />
              <DR label="Equity Multiple (ulev.)" value={m.equityMultiple.toFixed(2) + "x"} />
              <DR label="Development margin" value={fP(m.devMargin)} bg={LT} />
              <DR label="Cap rate spread (YoC - cap)" value={(m.capSpread * 100).toFixed(2) + " pp"} />
              <Hd text="BREAK-EVEN" />
              <DR label="Break-even leje" value={fK(Math.round(m.breakEvenRent)) + " kr/m²/år"} bg={LT} />
              <DR label="Aktuel leje vs break-even" value={(P.rent > m.breakEvenRent ? "+" : "") + fK(Math.round(P.rent - m.breakEvenRent)) + " kr/m²"} />
              <DR label="Break-even salgspris" value={fK(Math.round(m.breakEvenSale)) + " kr/m²"} bg={LT} />
              <DR label="Aktuel salgspris vs break-even" value={(P.spSqm > m.breakEvenSale ? "+" : "") + fK(Math.round(P.spSqm - m.breakEvenSale)) + " kr/m²"} />
              <Hd text="DRIFT" />
              <DR label="NOI pr. måned" value={fK(Math.round(m.noiPerMdr)) + " kr"} bg={LT} />
              <DR label="NOI pr. m²/år" value={fK(Math.round(m.noi / AREA)) + " kr"} />
              <DR label="Grund-andel af kapital" value={m.landPct.toFixed(1) + "%"} bg={LT} />
              <DR label="Byg-andel af kapital" value={m.buildPct.toFixed(1) + "%"} />
            </Crd>
          </Sec>
        </div>

        <Sec title="Cashflow-tidslinje" sub={"Driftsresultat efter renter + salg (netto efter gældsindfrielse) fra år 0 til " + tyrs}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={m.cfLev.slice(0, tyrs + 1)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={{ fill: GY, fontSize: 11 }} />
              <YAxis tick={{ fill: GY, fontSize: 10 }} tickFormatter={function(v) { return (v / 1e6).toFixed(1) + "m"; }} />
              <Tooltip content={cTip} />
              <Legend wrapperStyle={{ fontSize: 11, color: BL }} />
              <ReferenceLine y={0} stroke={REFL} />
              <Bar dataKey="noiAfterDS" name="Driftsresultat eft. renter" fill={TL} radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="salgNet" name="Salg (netto)" fill={GR} radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </Sec>

        <Sec title="Akkumuleret afkast" sub="Efter renter">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={m.cfLev.slice(0, tyrs + 1)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={{ fill: GY, fontSize: 11 }} />
              <YAxis tick={{ fill: GY, fontSize: 10 }} tickFormatter={function(v) { return (v / 1e6).toFixed(1) + "m"; }} />
              <Tooltip content={cTip} />
              <ReferenceLine y={0} stroke={REFL} strokeDasharray="3 3" />
              <Legend wrapperStyle={{ fontSize: 11, color: BL }} />
              <Line type="monotone" dataKey="cumProfit" name="Kumuleret profit" stroke={GR} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cumNoi" name="Kum. driftsresultat" stroke={GD} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="cumSalg" name="Kum. salg (netto)" stroke={OR} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Sec>
      </>}

      {tab === "invest" && <>
        <TabIntro>Hvad koster projektet? Det fulde anlægsbudget {purchase ? "inkl. grundkøb med tinglysning og advokat/DD" : "for byggeriet (det kontante behov) samt grundens værdi, der indskydes som apport"} — tilsammen den samlede kapitalindsats, som afkastet måles på.</TabIntro>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Crd>
            {purchase ? <>
              <Hd text="Grundkøb (kontant)" />
              <DR label="Købspris, grund" value={f(P.pp)} />
              <DR label="Tinglysning (1.850 + 0,6%)" value={f(m.tAf)} bg={LT} />
              <DR label="Advokat/DD" value={f(m.advokatDD)} />
              <DR label="Grundkøb i alt" value={f(m.land)} bold bg={LT} />
            </> : <>
              <Hd text="Grund/byggeret (apportindskud — ingen kontanter)" />
              <DR label="Værdi af byggeret/grund" value={f(m.grundVaerdi)} />
              {m.grundGaeld > 0 && <DR label="Gæld i grunden (overtages)" value={"−" + f(m.grundGaeld)} bg={LT} />}
              <DR label="Kontant grundindskud" value="0 DKK" bg={m.grundGaeld > 0 ? undefined : LT} />
            </>}
            <Hd text="Byggeomkostninger (kontant)" />
            <DR label="Nedrivning (inkl. miljøsanering)" value={f(P.demo)} />
            <DR label={"Håndværker (" + fK(P.csqm) + " x " + AREA + ")"} value={f(m.hw)} bg={LT} />
            <DR label={"Byggeplads (" + P.bpPct + "%)"} value={f(m.bp)} />
            <DR label={"Rådgivere (" + P.rdPct + "%)"} value={f(m.rd)} bg={LT} />
            <DR label="Tilslutning" value={f(P.tilsl)} />
            <DR label="Gebyrer + landinspektør" value={f(m.gebyr)} bg={LT} />
            <DR label={"Uforudsete (" + P.ufPct + "%)"} value={f(m.uf)} />
            <DR label="Excl. moms" value={f(m.cEx)} bold bg={LT} />
            <DR label="Moms 25% (ikke fradrag)" value={f(m.moms)} />
            <DR label="Byggesum inkl. moms (kontant)" value={f(m.cIn)} bold bg={LT} />
            <TotR left="SAMLET KAPITALINDSATS" right={f(m.totalCapital)} />
          </Crd>
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <Kp label="Kapital pr. m²" value={fK(Math.round(m.totalCapital / AREA)) + " kr"} sub="inkl. grund" />
              <Kp label="Kapital pr. bolig" value={f(m.totalCapital / units)} sub="inkl. grund" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BL, marginBottom: 8 }}>Kapitalfordeling</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={m.costPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={2}>
                  {m.costPie.map(function(_, i) { return <Cell key={i} fill={PCOL[i % PCOL.length]} />; })}
                </Pie>
                <Tooltip formatter={function(v) { return f(v); }} contentStyle={tipStyle} labelStyle={tipItem} itemStyle={tipItem} />
                <Legend wrapperStyle={{ fontSize: 10, color: BL }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>}

      {tab === "drift" && <>
        <TabIntro>Ejendommen som udlejningsforretning: lejeindtægter, tomgang, driftsomkostninger og NOI (driftsoverskuddet før renter) — grundlaget for både værdiansættelsen og belåningen.</TabIntro>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Kp label="Yield on cost" value={fP(m.yoc)} sub="NOI / samlet kapital" color={yocC} />
          <Kp label="Bruttostartafkast" value={fP(m.bAf)} sub="effektiv leje / samlet kapital" />
          <Kp label={"Implied værdi (" + P.capRate + "% cap)"} value={f(m.iv4)} sub={(m.iv4 > m.totalCapital ? "+" : "-") + f(Math.abs(m.iv4 - m.totalCapital)) + " vs kapital"} color={ivC} />
          <Kp label="Månedsleje/bolig" value={fK(Math.round(P.rent * AU / 12)) + " kr"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Crd>
            <Hd text="Årligt driftsbudget (år 1)" />
            <DR label={"Bruttoleje (" + fK(P.rent) + " x " + AREA + ")"} value={f(m.bL)} />
            <DR label={"Tomgang (" + P.tomgang + "%)"} value={f(-m.tomKr)} bg={LT} />
            <DR label="Effektiv leje" value={f(m.effLeje)} bold />
            <Hd text="Driftsomkostninger" />
            {itemised ? <>
              <DR label="Grundskyld" value={f(-m.gs)} bg={LT} />
              <DR label="Forsikring" value={f(-m.fo)} />
              <DR label={"Administration (" + P.admPct + "% af eff. leje)"} value={f(-m.ad)} bg={LT} />
              <DR label={"Vedligehold (" + fK(P.vedlSqm) + " kr/m²)"} value={f(-m.ve)} />
              <DR label={"Diverse (" + fK(P.divSqm) + " kr/m²)"} value={f(-m.di)} bg={LT} />
            </> : <>
              <DR label={"Drift (" + fK(P.driftSqm) + " kr/m² × " + AREA + " m²)"} value={f(-m.dT)} bg={LT} />
              <DR label="   Dækker ejendomsskat, forsikring, administration, vedligehold og hensættelser" value="" />
            </>}
            <DR label="Driftsomk. i alt" value={f(-m.dT)} bold bg={LT} />
            <TotR left="NOI" right={f(m.noi) + "/år"} bg={GR} />
            {slGruppe("drift").length > 0 && <div style={{ padding: "14px 14px 4px", borderTop: "1px solid " + CB }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: GY, marginBottom: 8, fontWeight: 600 }}>DRIFTSPARAMETRE</div>
              {renderSliders(slGruppe("drift"))}
            </div>}
          </Crd>
          <div>
            <div style={{ background: "rgba(54,120,120,0.18)", border: "1px solid rgba(54,120,120,0.45)", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "rgba(232,220,196,0.85)", lineHeight: 1.6, marginBottom: 16 }}>
              {itemised
                ? <><b>Driftsomkostninger:</b> Specificeret post for post (grundskyld, forsikring, administration, vedligehold, diverse). Posterne holdes flade i cashflow-fremskrivningen og skaleres med den tilbageværende portefølje.</>
                : <><b>Driftsomkostninger:</b> Sat samlet til {fK(P.driftSqm)} kr/m²/år — alt inkl.: ejendomsskat, forsikring, administration, vedligehold og hensættelser. Driften prisreguleres med {P.lejeStig}% p.a. ligesom lejen, så NOI-marginen holdes konstant frem mod exit.</>}
            </div>
            <Crd>
              <Hd text="Nøgletal pr. bolig" />
              <DR label="Gns. størrelse" value={"~" + Math.round(AU) + " m²"} />
              <DR label="Månedsleje" value={fK(Math.round(P.rent * AU / 12)) + " kr"} bg={LT} />
              <DR label="Årsleje" value={f(P.rent * AU)} />
              <DR label="Driftsomk. pr. m²/år" value={fK(Math.round(m.dT / AREA)) + " kr"} bg={LT} />
              <DR label="NOI pr. m²/år" value={fK(Math.round(m.noi / AREA)) + " kr"} />
            </Crd>
          </div>
        </div>
      </>}

      {tab === "finans" && <>
        <TabIntro>{threePhase
          ? "Finansieringen er delt i tre faser med hver sin gældstype: grundkøbslån (LTV af grunden, afdragsfrit) → byggekredit (LTC af projektsummen, indfrier grundlånet, trækkes gradvist) → realkredit ved stabilisering (LTV af ejendomsværdien, annuitet). Ved refinansieringen trækkes hele realkreditkapaciteten: rækker den længere end byggekreditten, udbetales overskuddet til ejerkredsen og frigør bunden kapital — men det koster rente og trækker DSCR ned. Der er ingen lejeindtægt i fase 1 og 2; renterne dér er en negativ carry, projektet selv skal bære."
          : twoPhase
          ? "To-faset finansiering: byggelån (LTC med senior/junior-tranche og blended rente, afdragsfrit i byggeperioden) → realkredit-refinansiering ved stabilisering (LTV af ejendomsværdien, annuitet). Et evt. refi-gap skal dækkes med ekstra egenkapital."
          : "Realkreditlånet, der optages ved færdiggørelse: lånets størrelse (LTV af ejendomsværdien, dog højst byggesummen), rente, bankens nøgletal (DSCR) — og hvad gearingen betyder for afkastet på egenkapitalen."}</TabIntro>
        {threePhase && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
          <Fase n="1" titel="Grundkøb" aar={"år 0" + (FA.gYrs > 1 ? "–" + (FA.gYrs - 1) : "")} laan={FA.grundLaan} laanTxt={P.grundLtv + " % LTV af grundkøb " + f(m.land)}
            rows={[["Egenkapital ved købet", f(FA.grundEgen)], ["Rente " + P.grundRate + " % (afdragsfrit)", f(FA.ydGrund) + "/år"], ["Renter i fasen", f(FA.grundRenter)]]} />
          <Fase n="2" titel="Byggeri" aar={"år " + FA.gYrs + (FA.byggeYrs > 1 ? "–" + (FA.stabYear - 1) : "")} laan={m.loanAmt} laanTxt={P.ltcPct + " % LTC af projektsum — indfrier grundlånet"}
            rows={[["Gns. træk i byggefasen", f(FA.byggeGnsnit)], ["Blended rente " + fP(m.blendedRate), f(FA.ydByg) + "/år"], ["Renter i fasen", f(FA.byggeRenter)]]} />
          <Fase n="3" titel="Stabiliseret drift" aar={"fra år " + FA.stabYear} laan={m.rkLoan} laanTxt={P.rkLtv + " % LTV af værdi " + f(m.iv4)}
            rows={[
              m.rkCashOut > 0 ? ["Frigjort til ejerkredsen", f(m.rkCashOut)] : ["Refi-gap (egenkapital)", f(m.rkRefiGap)],
              ["EK bundet efter refi", f(m.eqEfterRefi)],
              ["Annuitet " + P.rkRate + " % / " + P.amorYrs + " år", f(m.ydRkAnnuitet) + "/år"],
              ["DSCR i driftsfasen", (m.dscrRk || 0).toFixed(2) + "x"]]}
            advar={m.rkRefiGap > 0 || (m.dscrRk || 0) < 1} />
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
          {threePhase ? <>
            {m.rkCashOut > 0
              ? <Kp label="Frigjort til ejerkredsen" value={f(m.rkCashOut)} sub={"cash-out ved refi i år " + FA.stabYear} color={GR} />
              : <Kp label="Samlet gæld ved færdiggørelse" value={f(m.loanAmt)} sub={"byggekredit, " + P.ltcPct + " % LTC"} />}
            <Kp label="Renter i fase 1–2" value={f(FA.carryIalt)} sub={"negativ carry over " + FA.stabYear + " år uden leje"} color={OR} />
            <Kp label="DSCR (byggekredit)" value={m.dscr.toFixed(2) + "x"} sub={"kan det færdige hus bære byggelånet?"} color={dscrC} />
            <Kp label="DSCR (realkredit)" value={(m.dscrRk || 0).toFixed(2) + "x"} sub={(m.dscrRk || 0) >= 1.2 ? "OK — bank kræver typisk 1,2x+" : (m.dscrRk || 0) >= 1 ? "Marginal" : "Under 1x — driften bærer ikke lånet"} color={(m.dscrRk || 0) >= 1.2 ? GR : (m.dscrRk || 0) >= 1 ? OR : RD} />
          </> : twoPhase ? <>
            <Kp label="Byggelån (LTC)" value={f(m.loanAmt)} sub={P.ltcPct + "% af projektsum " + f(m.pI)} />
            <Kp label="Blended rente" value={fP(m.blendedRate)} sub={"senior " + P.seniorRate + "% / junior " + P.juniorRate + "%"} />
            <Kp label="DSCR (byggefase, IO)" value={m.dscr.toFixed(2) + "x"} sub={m.dscr >= 1.3 ? "OK — bank kræver typisk 1,2x+" : m.dscr >= 1.0 ? "Marginal" : "Under 1x"} color={dscrC} />
            <Kp label="DSCR (realkredit)" value={(m.dscrRk || 0).toFixed(2) + "x"} sub={"annuitet over " + P.amorYrs + " år"} />
          </> : <>
            <Kp label="Realkredit (LTV)" value={f(m.loanAmt)} sub={P.realLtv + "% af ejendomsværdi " + f(m.iv4) + (m.loanAmt >= m.pI ? " · max byggesum" : "")} />
            <Kp label="LTV (af samlet kapital)" value={fP(m.loanAmt / m.totalCapital)} sub="lån ift. samlet kapitalindsats" color={GD} />
            <Kp label="DSCR" value={m.dscr.toFixed(2) + "x"} sub={m.dscr >= 1.3 ? "OK — bank kræver typisk 1,2x+" : m.dscr >= 1.0 ? "Marginal" : "Under 1x — kræver salg/sikkerhed"} color={dscrC} />
            <Kp label="Cash-on-Cash" value={fP(m.cocReturn)} sub="NOI efter rente / EK" color={cocC} />
          </>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
          <Kp label="Lev. CAGR (ann.)" value={fP(m.cagrLev)} sub={"Ulev. " + fP(m.cagr)} color={levC} />
          <Kp label="Lev. Equity Multiple" value={m.eqMultLev.toFixed(2) + "x"} sub={"Ulev. " + m.equityMultiple.toFixed(2) + "x"} color={eqMC} />
          <Kp label={threePhase ? "Ydelse, driftsfasen" : twoPhase ? "Ydelse byggefase (IO)" : "Årlig rente (afdragsfrit)"} value={f(threePhase ? m.ydRkAnnuitet : m.ydIO)} sub={fK(Math.round((threePhase ? m.ydRkAnnuitet : m.ydIO) / 12)) + " kr/mdr"} />
          <Kp label={threePhase && m.rkCashOut > 0 ? "Egenkapital — top / bundet" : "Egenkapital i alt"}
            value={threePhase && m.rkCashOut > 0 ? f(m.eqBrutto) + " → " + f(m.eqEfterRefi) : f(m.equityTotal)}
            sub={threePhase && m.rkCashOut > 0 ? "toppen skal stilles; resten er bundet efter refi" : (twoPhase || threePhase) ? (m.rkRefiGap > 0 ? "inkl. refi-gap " + f(m.rkRefiGap) : "inkl. stiftelsesomk.") : purchase ? "kontant indskud + stiftelse" : "grunden indskydes som apport"} />
        </div>

        <Sec title="Finansieringsparametre" sub={threePhase ? "Fase 1 sætter grundkøbslånet, fase 2 byggekreditten (senior op til 65 % — resten dyrere junior), fase 3 realkreditten. Fasernes længde styrer, hvor længe projektet bærer renter uden lejeindtægt." : twoPhase ? "Byggelån efter LTC; senior-tranche op til 65% — resten er dyrere junior. Refinansieres til realkredit efter IO-perioden." : "LTV af ejendomsværdien (NOI / cap rate), dog højst byggesummen. Afdragsfrit — indfries ved salg; i driftscasen bliver lånet stående"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            {renderSliders(slGruppe("finans"))}
          </div>
        </Sec>

        <Crd>
          <Hd text="LÅNEBEREGNING" />
          <DR label="Samlet kapitalindsats" value={f(m.totalCapital)} />
          <DR label="Byggesum inkl. moms (kontant behov)" value={f(m.cIn)} bg={LT} />
          {threePhase ? <>
            <Hd text={"FASE 1 — GRUNDKØBSFINANSIERING (ÅR 0" + (FA.gYrs > 1 ? "–" + (FA.gYrs - 1) : "") + ")"} />
            <DR label={"Grundkøb inkl. tinglysning og advokat/DD"} value={f(m.land)} />
            <DR label={"Grundkøbslån (" + P.grundLtv + "% LTV)"} value={f(FA.grundLaan)} bg={LT} />
            <DR label="Egenkapital ved købet" value={f(FA.grundEgen)} />
            <DR label={"Rente (" + P.grundRate + "%, afdragsfrit)"} value={f(FA.ydGrund) + "/år"} bg={LT} />
            <DR label={"Renter i fase 1 (" + FA.gYrs + " år uden leje)"} value={f(FA.grundRenter)} color={OR} />
            <Hd text={"FASE 2 — BYGGEFINANSIERING (ÅR " + FA.gYrs + (FA.byggeYrs > 1 ? "–" + (FA.stabYear - 1) : "") + ")"} />
            <DR label={"Byggekredit (" + P.ltcPct + "% LTC af projektsum)"} value={f(m.loanAmt)} bg={LT} />
            <DR label={"   Senior-tranche (op til 65% · " + P.seniorRate + "%)"} value={f(m.seniorAmt)} />
            {m.juniorAmt > 0 && <DR label={"   Junior-tranche (" + P.juniorRate + "%)"} value={f(m.juniorAmt)} bg={LT} />}
            <DR label="   Blended rente" value={fP(m.blendedRate)} bg={m.juniorAmt > 0 ? undefined : LT} />
            <DR label="Indfrier grundkøbslånet ved byggestart" value={"−" + f(FA.grundLaan)} />
            <DR label="Gns. træk over byggeperioden" value={f(FA.byggeGnsnit)} bg={LT} />
            <DR label={"Renter i fase 2 (" + FA.byggeYrs + " år uden leje)"} value={f(FA.byggeRenter)} color={OR} />
            <DR label="Stiftelsesomk. på begge lån" value={f(m.bankFeeKr)} bg={LT} />
            <TotR left={"Renter i alt, fase 1–2 (negativ carry)"} right={f(FA.carryIalt)} bg={OR} />
            <Hd text={"FASE 3 — STABILISERET DRIFT MED REALKREDIT (FRA ÅR " + FA.stabYear + ")"} />
            <DR label={"Max realkredit (" + P.rkLtv + "% af værdi " + f(m.iv4) + ")"} value={f(m.rkMaxLoan)} />
            <DR label="Realkreditlån ved refinansiering" value={f(m.rkLoan)} bg={LT} />
            <DR label="Indfrier byggekreditten" value={"−" + f(m.loanAmt)} />
            {m.rkRefiGap > 0 && <DR label="Refi-gap (dækkes af egenkapital)" value={f(m.rkRefiGap)} bold color={OR} bg={LT} />}
            {m.rkCashOut > 0 && <DR label="Frigjort til ejerkredsen (cash-out)" value={f(m.rkCashOut)} bold color={GR} bg={LT} />}
            <DR label={"Årlig ydelse, annuitet (" + P.rkRate + "% · " + P.amorYrs + " år)"} value={f(m.ydRkAnnuitet)} />
            <DR label={"Driftsår før exit (år " + FA.stabYear + "–" + FA.exitYear + ")"} value={FA.driftAar + " år"} bg={LT} />
            <DR label="Egenkapital på toppen (indskud + stiftelse + evt. refi-gap)" value={f(m.eqBrutto)} bold />
            {m.rkCashOut > 0 && <DR label={"Bundet egenkapital efter refi (år " + FA.stabYear + " og frem)"} value={f(m.eqEfterRefi)} bold bg={LT} color={GR} />}
          </> : twoPhase ? <>
            <DR label={"Byggelån (" + P.ltcPct + "% LTC)"} value={f(m.loanAmt)} />
            <DR label={"   Senior-tranche (op til 65% · " + P.seniorRate + "%)"} value={f(m.seniorAmt)} bg={LT} />
            {m.juniorAmt > 0 && <DR label={"   Junior-tranche (" + P.juniorRate + "%)"} value={f(m.juniorAmt)} />}
            <DR label={"   Blended rente"} value={fP(m.blendedRate)} bg={LT} />
            <DR label={"Stiftelsesomk. (" + P.bankFee + "%)"} value={f(m.bankFeeKr)} />
            <Hd text={"REALKREDIT-REFINANSIERING (EFTER " + P.ioPeriod + " ÅRS IO)"} />
            <DR label={"Max realkredit (" + P.rkLtv + "% af værdi " + f(m.iv4) + ")"} value={f(m.rkMaxLoan)} bg={LT} />
            <DR label="Realkreditlån ved refi" value={f(m.rkLoan)} />
            <DR label="Refi-gap (dækkes af egenkapital)" value={f(m.rkRefiGap)} bg={LT} bold={m.rkRefiGap > 0} color={m.rkRefiGap > 0 ? OR : undefined} />
            <DR label={"Årlig ydelse, annuitet (" + P.rkRate + "% · " + P.amorYrs + " år)"} value={f(m.ydRkAnnuitet)} />
            <DR label="Egenkapital i alt (indskud + stiftelse + refi-gap)" value={f(m.equityTotal)} bold bg={LT} />
          </> : <>
            <DR label={"Realkreditlån (" + P.realLtv + "% LTV af ejendomsværdi, max byggesum)"} value={f(m.loanAmt)} />
            <DR label={"Stiftelsesomk. (" + P.bankFee + "%)"} value={f(m.bankFeeKr)} bg={LT} />
            {!purchase && <DR label="Grund/byggeret (apport)" value={f(m.grundVaerdi)} />}
            {m.grundGaeld > 0 && <DR label="   − gæld i grunden (overtages)" value={"−" + f(m.grundGaeld)} bg={LT} />}
            {m.grundGaeld > 0 && <DR label="   = Grund netto" value={f(m.grundEK)} />}
            <DR label="Egenkapital i alt" value={f(m.equityTotal)} bold bg={LT} />
            <Hd text={holdMode ? "RENTE (AFDRAGSFRIT — BLIVENDE LÅN)" : "RENTE (AFDRAGSFRIT — INDFRIES VED SALG)"} />
            <DR label={"Rente (" + P.realRente + "% inkl. bidrag)"} value={f(m.ydIO) + "/år"} bg={LT} />
            <DR label={holdMode ? "Ydelse pr. måned" : "Rente pr. måned"} value={fK(Math.round(m.ydIO / 12)) + " kr"} />
            {holdMode && <DR label={"Restgæld ved horisont (år " + tyrs + ")"} value={f(m.loanBalExit)} bg={LT} />}
          </>}
          <Hd text="NØGLETAL" />
          <DR label={threePhase ? "DSCR byggekredit (stabil. NOI / IO-ydelse)" : twoPhase ? "DSCR byggefase (NOI / IO-ydelse)" : "DSCR (NOI / ydelse IO)"} value={m.dscr.toFixed(2) + "x"} bg={LT} />
          {(twoPhase || threePhase) && <DR label="DSCR realkredit (NOI / annuitet)" value={(m.dscrRk || 0).toFixed(2) + "x"} color={threePhase && (m.dscrRk || 0) < 1 ? RD : undefined} bold={threePhase && (m.dscrRk || 0) < 1} />}
          <DR label="Cash-on-Cash (NOI - rente) / EK" value={fP(m.cocReturn)} bg={twoPhase ? LT : undefined} />
          <DR label="NOI efter rente" value={f(m.noi - m.ydIO) + "/år"} bg={twoPhase ? undefined : LT} />
          <TotR left="Leveraged CAGR" right={fP(m.cagrLev)} bg={m.cagrLev > 0 ? GR : RD} />
        </Crd>

        <div style={{ height: 20 }} />
        <Sec title="Leveraged cashflow" sub={threePhase ? "Fase 1-2 (GRUND/BYG) har ingen lejeindtægt — kun renter. Drift og salg starter i år " + FA.stabYear + " (RK)." : twoPhase ? "IO-fase på byggelån → refi til realkredit (markeret RK) → salg/indfrielse" : holdMode ? "Driftscase: driftsresultat efter renter — lånet bliver stående, og friværdien opbygges" : "Driftsresultat efter renter + salgsprovenu efter låneindfrielse"}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={m.cfLev.slice(0, tyrs + 1)} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="year" tick={{ fill: GY, fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: GY, fontSize: 10 }} tickFormatter={function(v) { return (v / 1e6).toFixed(1) + "m"; }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: GY, fontSize: 10 }} tickFormatter={function(v) { return (v / 1e6).toFixed(1) + "m"; }} />
              <Tooltip formatter={function(v) { return f(v); }} contentStyle={tipStyle} labelStyle={tipItem} itemStyle={tipItem} />
              <Legend wrapperStyle={{ fontSize: 11, color: BL }} />
              <ReferenceLine yAxisId="left" y={0} stroke={REFL} />
              <Bar yAxisId="left" dataKey="noiAfterDS" name="NOI eft. ydelse" fill={TL} radius={[3, 3, 0, 0]} stackId="a" />
              <Bar yAxisId="left" dataKey="salgNet" name="Salg eft. indfrielse" fill={GR} radius={[3, 3, 0, 0]} stackId="a" />
              <Bar yAxisId="left" dataKey="repay" name="Låneindfrielse" fill={GD} radius={[3, 3, 0, 0]} stackId="a" />
              <Line yAxisId="right" type="monotone" dataKey="loanBal" name="Restgæld" stroke={RD} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Sec>
      </>}

      {tab === "exit" && <>
        <TabIntro>Sammenlign exit-strategierne{exitModes.length > 1 ? " — " + exitModes.map(function(id) { return EXIT_LABELS[id]; }).join(", ") : ""} — og følg pengene fra salgssum over gældsindfrielse til nettoprovenu.</TabIntro>
        {ExitModeSwitch}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px", marginBottom: 6 }}>
          {renderSliders(slGruppe("exit").filter(function(sl) {
            if (sl.id === "spSqm") return !capMode && !holdMode;
            if (sl.id === "maeglerPct") return !holdMode;
            return true;
          }))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          <Kp label="Samlet profit" value={f(m.totalRetLev)} sub="efter renter" color={retLC} />
          <Kp label="Equity Multiple" value={m.eqMultLev.toFixed(2) + "x"} sub="af egenkapital" color={eqMC} />
          <Kp label="Årligt afkast (CAGR)" value={fP(m.cagrLev)} sub="efter renter" color={levC} />
          <Kp label={holdMode ? "Friværdi (urealiseret)" : capMode ? "Salgsværdi (cap)" : "Profit/bolig"} value={holdMode ? f(m.levSalgNet) : capMode ? f(m.exitValue) : f(m.totalRetLev / units)} color={retLC} />
        </div>
        <Crd>
          <Hd text={holdMode ? "EXIT-BREAKDOWN — FRA EJENDOMSVÆRDI TIL FRIVÆRDI" : "EXIT-BREAKDOWN — FRA SALGSSUM TIL NETTOPROVENU"} />
          <DR label={holdMode ? "Ejendomsværdi ved horisont (" + P.capRate + "% cap, urealiseret)" : "Samlet salgssum, brutto (exit-værdi)"} value={f(m.exitBrutto)} bold />
          {!holdMode && <DR label={"− Mæglersalær (" + P.maeglerPct + "%)"} value={f(-m.exitMaegler)} bg={LT} />}
          {!holdMode && <DR label="= Salgsprovenu efter salgsomkostninger" value={f(m.exitBrutto - m.exitMaegler)} bold />}
          <DR label={holdMode ? "− Restgæld ved horisont" : "− Indfrielse af gæld"} value={f(-m.exitRepay)} bg={LT} />
          <TotR left={holdMode ? "FRIVÆRDI TIL EGENKAPITAL (UREALISERET)" : "NETTOPROVENU TIL EGENKAPITAL"} right={f(m.levSalgNet)} bg={m.levSalgNet >= 0 ? GR : RD} />
        </Crd>
        <div style={{ height: 20 }} />
        <Crd>
          <Hd text={"Samlet afkast over " + tyrs + " år (fra år 0) — efter renter"} />
          <DR label={holdMode ? "Friværdi ved horisont (værdi − restgæld)" : "Salgsprovenu efter mægler og låneindfrielse"} value={f(m.levSalgNet)} />
          <DR label={"Akkumuleret driftsresultat efter renter (" + tyrs + " år)"} value={f(m.levCumNoiExit)} bg={LT} />
          <DR label="I alt" value={f(m.levSalgNet + m.levCumNoiExit)} bold />
          <DR label="Egenkapital" value={f(-m.equityTotal)} bg={LT} />
          <TotR left={holdMode ? "PROFIT (INKL. UREALISERET FRIVÆRDI)" : "PROFIT"} right={f(m.totalRetLev)} bg={retLC} />
        </Crd>
        <div style={{ height: 20 }} />
        <Sec title="År-for-år cashflow" sub="Fra år 0 — driftsresultat efter renter, salg netto efter gældsindfrielse, kumuleret profit på egenkapitalen">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: BL }}>
              <thead><tr>
                {["År", "Driftsresultat eft. renter", "Salg (netto)", "Kum. profit", "Boliger ift."].map(function(h, i) {
                  return <th key={i} style={{ background: "rgba(232,220,196,0.12)", padding: "6px 8px", textAlign: i === 0 ? "left" : "right" }}>{h}</th>;
                })}
              </tr></thead>
              <tbody>
                {m.cfLev.slice(0, tyrs + 1).map(function(r0, i) {
                  var hasSalg = r0.salgNet > 0;
                  var profitColor = r0.cumProfit > 0 ? GR : RD;
                  return <tr key={i} style={{ background: i % 2 ? LT : "transparent" }}>
                    <td style={{ padding: "5px 8px", fontWeight: 600 }}>{r0.year}{r0.refi ? " (refi)" : ""}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{f(r0.noiAfterDS)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: hasSalg ? GR : GY }}>{hasSalg ? f(r0.salgNet) : "—"}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600, color: profitColor }}>{f(r0.cumProfit)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{r0.remain} stk.</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </Sec>
      </>}

      {tab === "fees" && m.fees && m.fees.mode === "mgmtPrefCarry" && (function() {
        var F = m.fees;
        return <>
        <TabIntro>Fairhomes' honorar for at udvikle og styre projektet: fast management fee ({P.mgmtPct}% af projektsummen) og en waterfall ved exit, hvor ejeren først får sit forlodsafkast ({P.prefPct}% af {purchase ? "egenkapitalen" : "grundens nettoværdi"}) — og Fairhomes derefter modtager profit share ({P.carryPct}%) af resten. Ejeren står først i køen.</TabIntro>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Kp label="Management fee" value={f(F.mgmtInkl)} sub={P.mgmtPct + "% fast + moms (" + f(F.mgmtMoms) + ")"} />
          <Kp label="Profit share (efter pref)" value={f(F.carry)} sub={P.carryPct + "% af resten (" + f(F.wfRest) + ")"} color={F.carry > 0 ? GR : GY} />
          <Kp label="Total fee + profit share" value={f(F.totalFees)} sub={fP(F.totalFees / F.projSum) + " af projektsum"} color={GD} />
        </div>
        <Sec title="Fee-opgørelse & waterfall" sub={"Projektsum: " + f(F.projSum) + " · Fee faktureres månedligt over " + P.projMdr + " mdr. (" + fK(Math.round(F.mgmtMdrInkl)) + " DKK/mdr inkl. moms)"}>
          <Crd>
            <Hd text="MANAGEMENT FEE (FAST)" />
            <DR label={"Management fee — " + P.mgmtPct + "% af projektsum (fast, samlet)"} value={f(F.mgmtFee)} />
            <DR label="   + moms 25%" value={f(F.mgmtMoms)} bg={LT} />
            <DR label="   = Inkl. moms" value={f(F.mgmtInkl)} bold bg={LT} />
            <TotR left="Management fee inkl. moms" right={f(F.mgmtInkl)} />
            <div style={{ height: 8 }} />
            <Hd text={"WATERFALL VED EXIT — EJEREN FØRST I KØEN (" + P.prefPct + "% FORLODS)"} bg="rgba(34,197,94,0.25)" />
            <DR label="Nettoprovenu ved exit (total return, før finansiering)" value={f(m.totalReturn)} />
            <DR label={"1. prioritet — ejer: forlodsafkast " + P.prefPct + "% af " + f(F.prefBase)} value={f(F.wfTier1)} bold bg={LT} />
            <DR label={"2. prioritet — Fairhomes profit share: " + P.carryPct + "% af gevinsten UD OVER forlodsafkastet (" + f(F.wfRest) + ")"} value={f(F.carry)} />
            <DR label={"3. prioritet — ejer: resten (" + (100 - P.carryPct) + "% af " + f(F.wfRest) + ")"} value={f(F.ejerRest)} bg={LT} />
            <TotR left="Ejer — profit i alt (forlods + rest)" right={f(F.ejerProfit)} />
            <TotR left="Fairhomes i alt (mgmt fee + profit share)" right={f(F.totalFees)} bg="rgba(212,197,169,0.25)" />
          </Crd>
        </Sec>
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#E8C989", lineHeight: 1.7 }}>
          <b>Fee-struktur:</b> Fast management fee på {P.mgmtPct}% af projektsummen + moms, faktureret månedligt over projektperioden på {P.projMdr} mdr. Ved exit fordeles gevinsten i en waterfall, hvor ejeren først får forlodsafkastet — giver projektet mindre end pref'en, får Fairhomes intet profit share. Struktur og satser aftales konkret pr. projekt.
        </div>
      </>;
      })()}

      {tab === "fees" && m.fees && m.fees.mode === "devAndCarry" && (function() {
        var F = m.fees;
        return <>
        <TabIntro>{"Fairhomes' honorar efter 20/2-modellen: " + P.devPctYr + " % p.a. i development- og management-fee af projektsummen (+ moms), faktureret månedligt over " + P.projMdr + " mdr., og " + P.carryPct + " % carry af nettoprovenuet. Carry'en ligger på det, egenkapitalen tjener efter renter, efter honorarer og efter at de oprindelige ejere har fået deres kapital tilbage" + (P.prefPct > 0 ? " og et forlodsafkast på " + P.prefPct + " %" : "") + "."}</TabIntro>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
          <Kp label={"Dev/mgmt fee (" + P.devPctYr + " % p.a.)"} value={f(F.devInkl)} sub={"inkl. moms · " + fK(Math.round(F.devMdrInkl)) + " kr/mdr"} />
          <Kp label={"Carry (" + P.carryPct + " %)"} value={f(F.carry)} sub={"af nettoprovenu " + f(F.nettoprovenu)} />
          <Kp label="Fairhomes i alt" value={f(F.jwgIalt)} sub={F.bruttoprovenu > 0 ? fP(F.jwgIalt / F.bruttoprovenu) + " af bruttoprovenuet" : "—"} color={GD} />
          <Kp label="Ejerne beholder" value={f(F.ejerProfit)} sub={fP(F.ejerAndel) + " af nettoprovenuet"} color={GR} />
        </div>
        {slGruppe("fees").length > 0 && <Sec title="Fee-parametre" sub="Satser, pref og projektperiode — alle beløb nedenfor følger med">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            {renderSliders(slGruppe("fees"))}
          </div>
        </Sec>}
        <Sec title="Fee-opgørelse & waterfall" sub={"Projektsum: " + f(F.projSum)}>
          <Crd>
            <Hd text={"DEVELOPMENT & MANAGEMENT FEE — " + P.devPctYr + " % P.A."} />
            <DR label={"Dev. & mgmt (" + P.devPctYr + " % p.a. × " + (P.projMdr / 12).toFixed(1) + " år af projektsummen)"} value={f(F.devFee)} />
            <DR label="   + moms 25 %" value={f(F.devMoms)} bg={LT} />
            <DR label="   = Inkl. moms" value={f(F.devInkl)} bold />
            <DR label="Pr. måned (inkl. moms)" value={fK(Math.round(F.devMdrInkl)) + " DKK"} bg={LT} />
            {F.finFee > 0 && <DR label={"Finansierings-fee (" + P.finFeePct + " % af lånesum, momsfri)"} value={f(F.finFee)} />}
            <div style={{ height: 8 }} />
            <Hd text={"WATERFALL VED EXIT — EJERNE FÅR KAPITALEN TILBAGE FØRST"} bg="rgba(34,197,94,0.25)" />
            <DR label="Provenu til egenkapitalen (efter renter og efter tilbagebetalt kapital)" value={f(F.bruttoprovenu)} />
            <DR label="   − Fairhomes' honorarer (projektomkostning)" value={"−" + f(F.devInkl + F.finFee)} bg={LT} />
            <DR label="   = Nettoprovenu til fordeling" value={f(F.nettoprovenu)} bold />
            {P.prefPct > 0 && <DR label={"1. prioritet — ejerne: forlodsafkast " + P.prefPct + " % af " + f(m.eqBrutto || m.equityTotal)} value={f(F.prefBetalt)} bg={LT} />}
            <DR label={"Fairhomes carry — " + P.carryPct + " % af " + f(F.carryBase)} value={f(F.carry)} bg={P.prefPct > 0 ? undefined : LT} />
            <DR label={"Ejerne — resten (" + (100 - P.carryPct) + " % af " + f(F.carryBase) + ")"} value={f(F.carryBase - F.carry)} />
            <TotR left="Ejerne — profit i alt" right={f(F.ejerProfit)} bg={GR} />
            <TotR left="Fairhomes i alt (fee + carry)" right={f(F.jwgIalt)} bg="rgba(212,197,169,0.25)" />
          </Crd>
        </Sec>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12, marginBottom: 12 }}>
          <Kp label="Ejernes multiple efter carry" value={F.ejerMultiple.toFixed(2) + "x"} sub={"projektets: " + m.eqMultLev.toFixed(2) + "x"} color={GR} />
          <Kp label="Ejernes profit pr. bolig" value={f(F.ejerProfit / units)} sub={units + " boliger"} />
          <Kp label="Fairhomes' andel af overskuddet" value={F.bruttoprovenu > 0 ? fP(F.jwgIalt / F.bruttoprovenu) : "—"} sub="fee + carry / provenu til EK" color={GD} />
        </div>
        <Note>
          Carry-grundlaget er det, egenkapitalen tjener <b>efter</b> renter, <b>efter</b> honorarer og <b>efter</b> at de oprindelige ejere har fået deres indskud tilbage
          {P.prefPct > 0 ? " og et forlodsafkast på " + P.prefPct + " %" : " — der er ikke sat et forlodsafkast (pref), så hele overskuddet indgår"}.
          Giver projektet underskud, er carry'en nul. Nøgletallene på de øvrige faner er opgjort på projektniveau, altså før carry; ejernes eget afkast efter carry står ovenfor.
          Struktur og satser aftales konkret pr. projekt.
        </Note>
      </>;
      })()}

      {tab === "fees" && m.fees && m.fees.mode === "devAndFin" && (function() {
        var F = m.fees;
        return <>
        <TabIntro>Fairhomes' honorarer: Development & Management fee ({P.devPctYr}% p.a. af projektsummen over {P.projMdr} mdr. + moms) og finansierings-fee ({P.finFeePct}% af lånesummen, momsfri) — begge faktureret månedligt over projektperioden.</TabIntro>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Kp label="Dev. fee (inkl. moms)" value={f(F.devInkl)} sub={P.devPctYr + "% p.a. × " + (P.projMdr / 12).toFixed(1) + " år"} />
          <Kp label="Fin. fee (momsfri)" value={f(F.finFee)} sub={P.finFeePct + "% af " + f(m.loanAmt)} />
          <Kp label="Total fees" value={f(F.totalFees)} sub={fP(F.totalFees / F.projSum) + " af projektsum"} color={GD} />
        </div>
        {slGruppe("fees").length > 0 && <Sec title="Fee-parametre" sub="Satser og projektperiode — alle beløb nedenfor følger med">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            {renderSliders(slGruppe("fees"))}
          </div>
        </Sec>}
        <Sec title="Fee-opgørelse" sub={"Projektsum: " + f(F.projSum)}>
          <Crd>
            <Hd text="DEVELOPMENT & MANAGEMENT FEE" />
            <DR label={"Dev. & Mgmt (" + P.devPctYr + "% p.a. × " + (P.projMdr / 12).toFixed(1) + " år)"} value={f(F.devFee)} />
            <DR label="   + moms 25%" value={f(F.devMoms)} bg={LT} />
            <DR label="   = Inkl. moms" value={f(F.devInkl)} bold />
            <DR label="   Pr. måned (inkl. moms)" value={fK(Math.round(F.devMdrInkl)) + " DKK"} bg={LT} />
            <Hd text="FINANSIERINGS-FEE" />
            <DR label={"Fee (" + P.finFeePct + "% af lånesum " + f(m.loanAmt) + ", momsfri)"} value={f(F.finFee)} />
            <DR label="   Pr. måned" value={fK(Math.round(F.finMdr)) + " DKK/mdr"} bg={LT} />
            <TotR left="TOTAL FEES" right={f(F.totalFees)} bg="rgba(212,197,169,0.25)" />
          </Crd>
        </Sec>
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#E8C989", lineHeight: 1.7 }}>
          <b>Development Fee:</b> {P.devPctYr}% p.a. + 25% moms af projektsum — dækker projektledelse, byggestyring, udlejningskoordinering og løbende asset management. <b>Finansierings-fee:</b> {P.finFeePct}% af lånesum (momsfri) — dækker låneformidling, kreditforhandling og dokumentation. Begge faktureres månedligt over {P.projMdr} mdr. Struktur og satser aftales konkret pr. projekt.
        </div>
      </>;
      })()}

      {tab === "sens" && (function() {
        var selStyle = { background: "#16302f", color: BL, border: "1px solid " + CB, borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 600 };
        var selLabel = { fontSize: 10, color: GY, marginBottom: 3, fontWeight: 600 };
        return <>
        <TabIntro>Stresstest af casen: Vælg to parametre og et nøgletal, og se hvor robust projektet er, når forudsætningerne skrider — fx højere byggepriser, lavere salgspriser eller stigende rente.</TabIntro>
        <Sec title="Følsomhedsmatrix" sub="Vælg to parametre og et nøgletal — matricen viser, hvordan projektet reagerer, når begge varieres samtidig. Øvrige forudsætninger holdes som valgt på Overblik.">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={selLabel}>LODRET (RÆKKER)</div>
              <select value={sensY} onChange={function(e) { setSensY(e.target.value); }} style={selStyle}>
                {SENS_PARAMS.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}
              </select>
            </div>
            <div>
              <div style={selLabel}>VANDRET (KOLONNER)</div>
              <select value={sensX} onChange={function(e) { setSensX(e.target.value); }} style={selStyle}>
                {SENS_PARAMS.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}
              </select>
            </div>
            <div>
              <div style={selLabel}>NØGLETAL</div>
              <select value={sensM} onChange={function(e) { setSensM(e.target.value); }} style={selStyle}>
                {SENS_METRICS.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}
              </select>
            </div>
          </div>
          {!sens && <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#E8C989" }}>
            {sensX === sensY ? "Vælg to forskellige parametre til akserne." : "Cap rate og salgspris kan ikke krydses — de er to konkurrerende exit-metoder. Vælg en anden kombination."}
          </div>}
          {sens && <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: BL }}>
              <thead><tr>
                <th style={{ background: "rgba(232,220,196,0.12)", padding: "7px 8px", textAlign: "left", whiteSpace: "nowrap" }}>{sens.yP.label + " \\ " + sens.xP.label}</th>
                {sens.xVals.map(function(xv, i) {
                  return <th key={i} style={{ background: "rgba(232,220,196,0.12)", padding: "7px 5px", textAlign: "right", fontWeight: xv === sens.xCur ? 800 : 600 }}>{fmtFn(sens.xP.fmt)(xv)}{xv === sens.xCur ? " •" : ""}</th>;
                })}
              </tr></thead>
              <tbody>
                {sens.rows.map(function(row, ri) {
                  return <tr key={ri}>
                    <td style={{ padding: "5px 8px", fontWeight: row.yVal === sens.yCur ? 800 : 600, background: ri % 2 ? LT : "transparent", whiteSpace: "nowrap" }}>{fmtFn(sens.yP.fmt)(row.yVal)}{row.yVal === sens.yCur ? " •" : ""}</td>
                    {row.cells.map(function(c, si) {
                      var v = c.value;
                      var cl = v >= sens.met.good ? GR : v >= sens.met.ok ? BL : RD;
                      var isB = c.xVal === sens.xCur && row.yVal === sens.yCur;
                      return <td key={si} style={{ padding: "6px 5px", textAlign: "right", background: isB ? "rgba(245,158,11,0.15)" : ri % 2 ? LT : "transparent", color: cl, fontWeight: isB ? 700 : 400, border: isB ? "2px solid " + GD : "none", fontVariantNumeric: "tabular-nums" }}>
                        {fmtFn(sens.met.fmt)(v)}
                      </td>;
                    })}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: GY, marginTop: 6, textAlign: "center" }}>
            • / markeret felt = nuværende forudsætninger · Grøn: {sens.met.label} ≥ {fmtFn(sens.met.fmt)(sens.met.good)} · Creme: ≥ {fmtFn(sens.met.fmt)(sens.met.ok)} · Rød: under
          </div>
          </>}
        </Sec>
      </>;
      })()}

      {/* Forbehold — vises på ALLE faner */}
      <ProsaSec sektion={prosa.forbehold} />

      <div style={{ marginTop: 40, paddingTop: 12, borderTop: "1px solid " + CB, fontSize: 9.5, color: "rgba(232,220,196,0.35)", lineHeight: 1.6, textAlign: "center" }}>
        Fairhomes — {spec.kortTitel} — {spec.dato} · Alle beregninger er vejledende og udgør ikke investeringsrådgivning. Tryk <b>Gem</b> (eller Cmd/Ctrl+S) for at gemme forudsætningerne — de deles på tværs af enheder og hentes frem næste gang.
      </div>
    </div>
  );
}
