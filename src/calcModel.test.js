// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN TESTS — beviser 1:1-paritet mellem calcModel(P, spec) og de originale
// beregningskæder i eksemplarerne:
//
//   (a) LGV2628_Business_Case.jsx (calcModel, ~linje 232-388) — apport/perSqm/
//       singleIO/mgmtPrefCarry, testet i alle tre exit-modes (sqm/cap/hold)
//   (b) NFV111_Business_Case.jsx (useMemo, ~linje 229-496 + fee-beregning
//       ~linje 642-651) — purchase/itemised/twoPhase/devAndFin
//   (c) kontakt-dækning: hver af de 5 model-kontakter flytter outputtet i den
//       forventede retning
//
// Referencerne herunder er håndporteret VERBATIM fra eksemplarerne (samme
// udtryk, samme rækkefølge), så testen beviser matematisk paritet — ikke bare
// et snapshot af calcModel selv.
//
// Bemærk de to bevidste rettelser i calcModel (se kommentar i calcModel.js):
//   1) annualiseret afkast hedder cagr/cagrLev (ikke "IRR") — VÆRDIEN er uændret,
//      så referencens annReturn/annRetLev sammenlignes med m.cagr/m.cagrLev.
//   2) purchase-mode læser advokat/DD fra spec.model.advokatDD — referencen
//      bruger NFV's hardcodede 150.000, og spec'en sættes til samme værdi.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { calcModel } from "./calcModel.js";

// ═════════════════════════════════════════════════════════════════════════════
// (a) LGV-REFERENCE — verbatim port af LGV2628_Business_Case.jsx linje 227-388
//     (GRUND = 2018 er LGV's ejendomskonstant; i template-modellen er den
//      parameteren P.grundAreal)
// ═════════════════════════════════════════════════════════════════════════════
function lgvReference(P) {
  var GRUND = 2018;
  var grundVaerdi = P.grundVaerdi, csqm = P.csqm, demo = P.demo, bpPct = P.bpPct, rdPct = P.rdPct,
      tilsl = P.tilsl, ufPct = P.ufPct, spSqm = P.spSqm, rent = P.rent, driftSqm = P.driftSqm, tyrs = P.tyrs,
      tomgang = P.tomgang, lejeStig = P.lejeStig, units = P.units, maeglerPct = P.maeglerPct,
      capRate = P.capRate, exitMode = P.exitMode,
      bankFee = P.bankFee, realLtv = P.realLtv, realRente = P.realRente;
  var AREA = Math.round(GRUND * P.bebygPct / 100);
  var AU = AREA / units;
  var capMode = exitMode === "cap";
  var holdMode = exitMode === "hold";
  var hw = csqm * AREA, bp = hw * bpPct / 100, rd = hw * rdPct / 100;
  var sub = demo + hw + bp + rd + tilsl + 150000;
  var uf = sub * ufPct / 100, cEx = sub + uf, moms = cEx * 0.25, cIn = cEx + moms;
  var bL = AREA * rent, tomKr = bL * tomgang / 100, effLeje = bL - tomKr;
  var dT = driftSqm * AREA, noi = effLeje - dT;
  var pI = cIn;
  var totalCapital = pI + grundVaerdi;
  var yoc = noi / totalCapital, bAf = effLeje / totalCapital, iv4 = noi / (capRate / 100);
  var cf = [], cumNoi = 0, solgt = 0, cumSalg = 0;
  var salgPrAar = tyrs > 0 ? units / tyrs : units;
  var noiAtExit = 0, cumNoiAtExit = 0;
  for (var y = 0; y <= Math.max(tyrs, 10); y++) {
    var rentY = rent * Math.pow(1 + lejeStig / 100, y);
    var remainUnits = Math.max(units - solgt, 0);
    var areaLeft = remainUnits * AU;
    var bLy = areaLeft * rentY;
    var tomY = bLy * tomgang / 100;
    var effY = bLy - tomY;
    var dTy = driftSqm * areaLeft * Math.pow(1 + lejeStig / 100, y);
    var noiY = effY - dTy;
    cumNoi += noiY;
    if (y === tyrs) { noiAtExit = noiY; cumNoiAtExit = cumNoi; }
    var soldThis = 0, salgThis = 0;
    if (solgt < units && !holdMode) {
      if (capMode) {
        if (y === tyrs) {
          soldThis = units - solgt;
          salgThis = (noiY / (capRate / 100)) * (1 - maeglerPct / 100);
        }
      } else {
        soldThis = Math.min(Math.round(salgPrAar), units - solgt);
        if (y === tyrs) soldThis = units - solgt;
        salgThis = soldThis * AU * spSqm;
        salgThis -= salgThis * maeglerPct / 100;
      }
    }
    solgt += soldThis;
    cumSalg += salgThis;
    cf.push({ year: y, salg: Math.round(salgThis), remain: units - solgt });
  }
  var exitValueHold = noiAtExit / (capRate / 100);
  var totalSalg = holdMode ? exitValueHold : cumSalg;
  var cumNoiEff = holdMode ? cumNoiAtExit : cumNoi;
  var totalReturn = cumNoiEff + totalSalg - totalCapital;
  var totalReturnPct = totalReturn / totalCapital;
  var pRetSafe = 1 + totalReturnPct;
  var annReturn = tyrs > 0 ? (pRetSafe > 0 ? Math.pow(pRetSafe, 1 / tyrs) - 1 : -1) : totalReturnPct;
  var exitValue = (capMode || holdMode) ? iv4 : AREA * spSqm;
  var gg = Math.min(Math.max(P.grundGaeld || 0, 0), grundVaerdi);
  var grundEK = grundVaerdi - gg;
  var loanAmt = Math.min(iv4 * realLtv / 100, pI);
  var r = realRente / 100;
  var cashEquity = Math.max(pI - loanAmt, 0);
  var bankFeeKr = loanAmt * bankFee / 100;
  var cashIndskud = cashEquity + bankFeeKr;
  var equityTotal = cashIndskud + grundEK;
  var debt0 = loanAmt + gg;
  var ydIO = debt0 * r;
  var cfLev = [], cumNoiLev = 0, cumDSLev = 0, cumRepay = 0, solgtLev = 0, cumSalgLev = 0, loanBal = debt0;
  var cumNoiLevAtExit = 0, loanBalAtExit = debt0;
  var cumBrutto = 0, cumMaegler = 0;
  for (var yy = 0; yy <= Math.max(tyrs, 10); yy++) {
    var rentYY = rent * Math.pow(1 + lejeStig / 100, yy);
    var remUn = Math.max(units - solgtLev, 0);
    var areaL = remUn * AU;
    var bLyy = areaL * rentYY, tomYY = bLyy * tomgang / 100, effYY = bLyy - tomYY;
    var dTyy = driftSqm * areaL * Math.pow(1 + lejeStig / 100, yy);
    var noiYY = effYY - dTyy;
    var dsYY = loanBal * r;
    var noiAfterDS = noiYY - dsYY;
    cumNoiLev += noiAfterDS;
    cumDSLev += dsYY;
    if (yy === tyrs) { cumNoiLevAtExit = cumNoiLev; loanBalAtExit = loanBal; }
    var soldLev = 0, salgLev = 0, loanRepay = 0;
    if (solgtLev < units && !holdMode) {
      if (capMode) {
        if (yy === tyrs) {
          soldLev = units - solgtLev;
          var bruttoC = noiYY / (capRate / 100);
          var maeglerC = bruttoC * maeglerPct / 100;
          salgLev = bruttoC - maeglerC;
          cumBrutto += bruttoC; cumMaegler += maeglerC;
          loanRepay = loanBal;
          loanBal = 0;
        }
      } else {
        soldLev = Math.min(Math.round(salgPrAar), units - solgtLev);
        if (yy === tyrs) soldLev = units - solgtLev;
        var bruttoS = soldLev * AU * spSqm;
        var maeglerS = bruttoS * maeglerPct / 100;
        salgLev = bruttoS - maeglerS;
        cumBrutto += bruttoS; cumMaegler += maeglerS;
        loanRepay = Math.min(loanBal, debt0 * soldLev / units);
        loanBal = Math.max(loanBal - loanRepay, 0);
      }
    }
    solgtLev += soldLev;
    cumSalgLev += salgLev;
    cumRepay += loanRepay;
    cfLev.push({ year: yy });
  }
  var levCumNoiExit = holdMode ? cumNoiLevAtExit : cumNoiLev;
  var levSalgNet = holdMode ? exitValueHold - loanBalAtExit : cumSalgLev - cumRepay - loanBal;
  var totalRetLev = levCumNoiExit + levSalgNet - equityTotal;
  var exitBrutto = holdMode ? exitValueHold : cumBrutto;
  var exitMaegler = holdMode ? 0 : cumMaegler;
  var exitRepay = holdMode ? loanBalAtExit : cumRepay + loanBal;
  var totalRetPctLev = equityTotal > 0 ? totalRetLev / equityTotal : 0;
  var pRetSafeLev = 1 + totalRetPctLev;
  var annRetLev = tyrs > 0 ? ((equityTotal > 0 && pRetSafeLev > 0) ? Math.pow(pRetSafeLev, 1 / tyrs) - 1 : -1) : totalRetPctLev;
  var eqMultLev = equityTotal > 0 ? (holdMode ? (cumNoiLevAtExit + exitValueHold - loanBalAtExit) / equityTotal : (cumNoiLev + cumSalgLev - cumRepay - loanBal) / equityTotal) : 0;
  var dscr = ydIO > 0 ? noi / ydIO : 99;
  var cocReturn = equityTotal > 0 ? (noi - ydIO) / equityTotal : 0;
  var equityMultiple = (totalSalg + cumNoiEff) / totalCapital;
  var breakEvenRent = (dT + totalCapital * capRate / 100) / (AREA * (1 - tomgang / 100));
  var breakEvenSale = (totalCapital - cumNoi) / (AREA * (1 - maeglerPct / 100));
  // fee-kæden fra LGV's Fee-struktur-fane (linje 1057-1072): MGMT_PCT=4, PREF_PCT=25, CARRY_PCT=20
  var MGMT_PCT = 4, CARRY_PCT = 20, PREF_PCT = 25;
  var projSum = totalCapital;
  var mgmtFee = projSum * MGMT_PCT / 100;
  var mgmtMoms = mgmtFee * 0.25;
  var mgmtInkl = mgmtFee + mgmtMoms;
  var netto = Math.max(totalReturn, 0);
  var grundPref = grundEK * PREF_PCT / 100;
  var wfTier1 = Math.min(netto, grundPref);
  var wfRest = Math.max(netto - grundPref, 0);
  var carry = wfRest * CARRY_PCT / 100;
  return {
    AREA: AREA, AU: AU, hw: hw, sub: sub, cEx: cEx, moms: moms, cIn: cIn,
    pI: pI, totalCapital: totalCapital, bL: bL, effLeje: effLeje, dT: dT, noi: noi,
    yoc: yoc, bAf: bAf, iv4: iv4, exitValue: exitValue, exitValueHold: exitValueHold,
    totalSalg: totalSalg, cumNoiEff: cumNoiEff, totalReturn: totalReturn, totalReturnPct: totalReturnPct,
    annReturn: annReturn, equityMultiple: equityMultiple,
    loanAmt: loanAmt, cashEquity: cashEquity, bankFeeKr: bankFeeKr, cashIndskud: cashIndskud,
    equityTotal: equityTotal, grundEK: grundEK, debt0: debt0, ydIO: ydIO,
    dscr: dscr, cocReturn: cocReturn,
    levCumNoiExit: levCumNoiExit, levSalgNet: levSalgNet, totalRetLev: totalRetLev,
    totalRetPctLev: totalRetPctLev, annRetLev: annRetLev, eqMultLev: eqMultLev,
    exitBrutto: exitBrutto, exitMaegler: exitMaegler, exitRepay: exitRepay,
    cumDSLev: cumDSLev, cumRepay: cumRepay,
    breakEvenRent: breakEvenRent, breakEvenSale: breakEvenSale,
    mgmtFee: mgmtFee, mgmtInkl: mgmtInkl, grundPref: grundPref, wfTier1: wfTier1, wfRest: wfRest, carry: carry,
    cf: cf,
  };
}

// LGV2628's DEFAULTS — aflæst direkte i eksemplarfilen (linje 33-38)
const LGV_P = {
  grundVaerdi: 10000000, grundGaeld: 0, csqm: 25000, demo: 600000, bpPct: 10, rdPct: 12, tilsl: 800000,
  ufPct: 10, spSqm: 45000, rent: 2400, driftSqm: 450, tyrs: 4, tomgang: 1, lejeStig: 2.0, units: 8,
  maeglerPct: 1.0, capRate: 4.0, bebygPct: 40, exitMode: "sqm",
  bankFee: 1.0, realLtv: 80, realRente: 4.5,
  // template-parametre (samme værdier som LGV's konstanter GRUND=2018 og gebyr=150.000)
  grundAreal: 2018, gebyr: 150000,
  mgmtPct: 4, prefPct: 25, carryPct: 20, projMdr: 36,
};

const LGV_SPEC = {
  model: { landMode: "apport", opexMode: "perSqm", debtMode: "singleIO", exitModes: ["sqm", "cap", "hold"], feeMode: "mgmtPrefCarry" },
  defaults: {},
};

function expectLgvParity(m, ref) {
  expect(m.AREA).toBe(ref.AREA);
  expect(m.hw).toBeCloseTo(ref.hw, 6);
  expect(m.cIn).toBeCloseTo(ref.cIn, 6);
  expect(m.pI).toBeCloseTo(ref.pI, 6);
  expect(m.totalCapital).toBeCloseTo(ref.totalCapital, 6);
  expect(m.effLeje).toBeCloseTo(ref.effLeje, 6);
  expect(m.dT).toBeCloseTo(ref.dT, 6);
  expect(m.noi).toBeCloseTo(ref.noi, 6);
  expect(m.yoc).toBeCloseTo(ref.yoc, 6);
  expect(m.bAf).toBeCloseTo(ref.bAf, 6);
  expect(m.iv4).toBeCloseTo(ref.iv4, 6);
  expect(m.exitValue).toBeCloseTo(ref.exitValue, 6);
  expect(m.totalSalg).toBeCloseTo(ref.totalSalg, 6);
  expect(m.cumNoi).toBeCloseTo(ref.cumNoiEff, 6);
  expect(m.totalReturn).toBeCloseTo(ref.totalReturn, 6);
  expect(m.cagr).toBeCloseTo(ref.annReturn, 6);            // rettelse #1: samme værdi, nyt navn
  expect(m.equityMultiple).toBeCloseTo(ref.equityMultiple, 6);
  expect(m.loanAmt).toBeCloseTo(ref.loanAmt, 6);
  expect(m.cashEquity).toBeCloseTo(ref.cashEquity, 6);
  expect(m.bankFeeKr).toBeCloseTo(ref.bankFeeKr, 6);
  expect(m.equityTotal).toBeCloseTo(ref.equityTotal, 6);
  expect(m.grundEK).toBeCloseTo(ref.grundEK, 6);
  expect(m.debt0).toBeCloseTo(ref.debt0, 6);
  expect(m.ydIO).toBeCloseTo(ref.ydIO, 6);
  expect(m.dscr).toBeCloseTo(ref.dscr, 6);
  expect(m.cocReturn).toBeCloseTo(ref.cocReturn, 6);
  expect(m.levCumNoiExit).toBeCloseTo(ref.levCumNoiExit, 6);
  expect(m.levSalgNet).toBeCloseTo(ref.levSalgNet, 6);
  expect(m.totalRetLev).toBeCloseTo(ref.totalRetLev, 6);
  expect(m.cagrLev).toBeCloseTo(ref.annRetLev, 6);          // rettelse #1
  expect(m.eqMultLev).toBeCloseTo(ref.eqMultLev, 6);
  expect(m.exitBrutto).toBeCloseTo(ref.exitBrutto, 6);
  expect(m.exitMaegler).toBeCloseTo(ref.exitMaegler, 6);
  expect(m.exitRepay).toBeCloseTo(ref.exitRepay, 6);
  expect(m.cumDSLev).toBeCloseTo(ref.cumDSLev, 6);
  expect(m.cumRepay).toBeCloseTo(ref.cumRepay, 6);
  expect(m.breakEvenRent).toBeCloseTo(ref.breakEvenRent, 6);
  expect(m.breakEvenSale).toBeCloseTo(ref.breakEvenSale, 6);
}

describe("(a) LGV2628 golden — apport/perSqm/singleIO/mgmtPrefCarry", () => {
  it("matcher LGV's originale formelkæde 1:1 med DEFAULTS (exitMode=sqm)", () => {
    const ref = lgvReference(LGV_P);
    const m = calcModel(LGV_P, LGV_SPEC);
    // fastlåste kontrolværdier (regnet fra LGV's formler med DEFAULTS):
    // AREA = round(2018 * 40/100) = 807 m²
    expect(m.AREA).toBe(807);
    expectLgvParity(m, ref);
  });

  it("matcher LGV 1:1 ved samlet salg (exitMode=cap)", () => {
    const P = { ...LGV_P, exitMode: "cap" };
    expectLgvParity(calcModel(P, LGV_SPEC), lgvReference(P));
  });

  it("matcher LGV 1:1 i driftscasen (exitMode=hold)", () => {
    const P = { ...LGV_P, exitMode: "hold" };
    const ref = lgvReference(P);
    const m = calcModel(P, LGV_SPEC);
    expectLgvParity(m, ref);
    expect(m.exitValueHold).toBeCloseTo(ref.exitValueHold, 6);
  });

  it("matcher LGV 1:1 med gæld i grunden (grundGaeld > 0)", () => {
    const P = { ...LGV_P, grundGaeld: 3000000 };
    expectLgvParity(calcModel(P, LGV_SPEC), lgvReference(P));
  });

  it("fee-kæden (mgmtPrefCarry) matcher LGV's Fee-struktur-fane 1:1", () => {
    const ref = lgvReference(LGV_P);
    const m = calcModel(LGV_P, LGV_SPEC);
    expect(m.fees.mode).toBe("mgmtPrefCarry");
    expect(m.fees.projSum).toBeCloseTo(ref.totalCapital, 6);
    expect(m.fees.mgmtFee).toBeCloseTo(ref.mgmtFee, 6);
    expect(m.fees.mgmtInkl).toBeCloseTo(ref.mgmtInkl, 6);
    expect(m.fees.grundPref).toBeCloseTo(ref.grundPref, 6);
    expect(m.fees.wfTier1).toBeCloseTo(ref.wfTier1, 6);
    expect(m.fees.wfRest).toBeCloseTo(ref.wfRest, 6);
    expect(m.fees.carry).toBeCloseTo(ref.carry, 6);
    expect(m.fees.totalFees).toBeCloseTo(ref.mgmtInkl + ref.carry, 6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (b) NFV-REFERENCE — verbatim port af NFV111_Business_Case.jsx useMemo
//     (linje 229-376: land/byg/drift/uleveraged/twoPhase-lån) + fee-beregningen
//     (linje 642-651: devFee/finFee). Kun nøglefelter.
// ═════════════════════════════════════════════════════════════════════════════
function nfvReference(P) {
  var GRUND = 663;
  var pp = P.pp, csqm = P.csqm, demo = P.demo, bpPct = P.bpPct, rdPct = P.rdPct, tilsl = P.tilsl,
      ufPct = P.ufPct, spSqm = P.spSqm, rent = P.rent, tyrs = P.tyrs, tomgang = P.tomgang,
      lejeStig = P.lejeStig, units = P.units, maeglerPct = P.maeglerPct, capRate = P.capRate,
      ltcPct = P.ltcPct, seniorRate = P.seniorRate, juniorRate = P.juniorRate, rkRate = P.rkRate,
      rkLtv = P.rkLtv, amorYrs = P.amorYrs, ioPeriod = P.ioPeriod, bankFee = P.bankFee;
  var AREA = Math.round(GRUND * P.bebygPct / 100);
  var AU = AREA / units;
  var tAf = 1850 + pp * 0.006, land = pp + tAf + 150000;
  var hw = csqm * AREA, bp = hw * bpPct / 100, rd = hw * rdPct / 100;
  var sub = demo + hw + bp + rd + tilsl + 150000;
  var uf = sub * ufPct / 100, cEx = sub + uf, moms = cEx * 0.25, cIn = cEx + moms;
  var bL = AREA * rent, tomKr = bL * tomgang / 100, effLeje = bL - tomKr;
  var gs = 72900, fo = 40095, ad = effLeje * 0.03, ve = AREA * 50, di = AREA * 80;
  var dT = gs + fo + ad + ve + di, noi = effLeje - dT;
  var pI = land + cIn, yoc = noi / pI, bAf = effLeje / pI, iv4 = noi / (capRate / 100);
  var cumNoi = 0, solgt = 0, cumSalg = 0;
  var salgPrAar = units / tyrs;
  for (var y = 0; y <= Math.max(tyrs, 10); y++) {
    var rentY = rent * Math.pow(1 + lejeStig / 100, y);
    var remainUnits = Math.max(units - solgt, 0);
    var areaLeft = remainUnits * AU;
    var bLy = areaLeft * rentY;
    var tomY = bLy * tomgang / 100;
    var effY = bLy - tomY;
    var dTy = remainUnits > 0 ? (gs + fo + effY * 0.03 + areaLeft * 50 + areaLeft * 80) * remainUnits / units : 0;
    var noiY = effY - dTy;
    cumNoi += noiY;
    var soldThis = 0, salgThis = 0;
    if (solgt < units) {
      soldThis = Math.min(Math.round(salgPrAar), units - solgt);
      if (y === tyrs) soldThis = units - solgt;
      salgThis = soldThis * AU * spSqm;
      salgThis -= salgThis * maeglerPct / 100;
    }
    solgt += soldThis;
    cumSalg += salgThis;
  }
  var totalSalg = cumSalg;
  var totalReturn = cumNoi + totalSalg - pI;
  var totalReturnPct = totalReturn / pI;
  var pRetSafe = 1 + totalReturnPct;
  var annReturn = pRetSafe > 0 ? Math.pow(pRetSafe, 1 / tyrs) - 1 : -1;
  var loanAmt = pI * ltcPct / 100;
  var seniorPct = Math.min(65, ltcPct);
  var juniorPct = Math.max(0, ltcPct - 65);
  var seniorAmt = pI * seniorPct / 100;
  var juniorAmt = pI * juniorPct / 100;
  var blendedRate = loanAmt > 0 ? (seniorAmt * seniorRate / 100 + juniorAmt * juniorRate / 100) / loanAmt : 0;
  var equity = pI - loanAmt;
  var bankFeeKr = loanAmt * bankFee / 100;
  var rkR = rkRate / 100;
  var rkMaxLoan = iv4 * rkLtv / 100;
  var ydIO = loanAmt * blendedRate;
  var rkLoan = Math.min(loanAmt, rkMaxLoan);
  var rkRefiGap = Math.max(0, loanAmt - rkMaxLoan);
  var ydRkAnnuitet = amorYrs > 0 && rkLoan > 0 ? rkLoan * (rkR * Math.pow(1 + rkR, amorYrs)) / (Math.pow(1 + rkR, amorYrs) - 1) : 0;
  var cumNoiLev = 0, cumDSLev = 0, cumRepay = 0, solgtLev = 0, cumSalgLev = 0;
  var loanBal = loanAmt;
  var isRefi = false, rkBal = 0;
  var cumNoiLevAtExit = 0, cumSalgLevAtExit = 0, cumRepayAtExit = 0, finalBalAtExit = 0;
  for (var yy = 0; yy <= Math.max(tyrs, 10); yy++) {
    var rentYY = rent * Math.pow(1 + lejeStig / 100, yy);
    var remUn = Math.max(units - solgtLev, 0);
    var areaL = remUn * AU;
    var bLyy = areaL * rentYY, tomYY = bLyy * tomgang / 100, effYY = bLyy - tomYY;
    var dTyy = remUn > 0 ? (gs + fo + effYY * 0.03 + areaL * 50 + areaL * 80) * remUn / units : 0;
    var noiYY = effYY - dTyy;
    var dsYY = 0, interestYY = 0, amorYY = 0;
    if (yy < ioPeriod) {
      dsYY = loanBal > 0 ? loanBal * blendedRate : 0;
      interestYY = dsYY;
      amorYY = 0;
    } else if (!isRefi && yy === ioPeriod) {
      isRefi = true;
      rkRefiGap = Math.max(0, loanBal - rkMaxLoan);
      rkBal = Math.min(loanBal, rkMaxLoan);
      ydRkAnnuitet = amorYrs > 0 && rkBal > 0 ? rkBal * (rkR * Math.pow(1 + rkR, amorYrs)) / (Math.pow(1 + rkR, amorYrs) - 1) : 0;
      loanBal = 0;
      dsYY = rkBal > 0 ? Math.min(ydRkAnnuitet, rkBal * (1 + rkR)) : 0;
      interestYY = rkBal * rkR;
      amorYY = Math.min(dsYY - interestYY, rkBal);
      rkBal = Math.max(rkBal - amorYY, 0);
    } else {
      dsYY = rkBal > 0 ? Math.min(ydRkAnnuitet, rkBal * (1 + rkR)) : 0;
      interestYY = rkBal * rkR;
      amorYY = Math.min(dsYY - interestYY, rkBal);
      rkBal = Math.max(rkBal - amorYY, 0);
    }
    var activeBal = isRefi ? rkBal : loanBal;
    var noiAfterDS = noiYY - dsYY;
    cumNoiLev += noiAfterDS;
    cumDSLev += dsYY;
    var soldLev = 0, salgLev = 0, loanRepay = 0;
    if (solgtLev < units) {
      soldLev = Math.min(Math.round(units / tyrs), units - solgtLev);
      if (yy === tyrs) soldLev = units - solgtLev;
      salgLev = soldLev * AU * spSqm;
      salgLev -= salgLev * maeglerPct / 100;
      if (isRefi) {
        loanRepay = Math.min(activeBal, rkLoan * soldLev / units);
        rkBal = Math.max(rkBal - loanRepay, 0);
      } else {
        loanRepay = Math.min(activeBal, loanAmt * soldLev / units);
        loanBal = Math.max(loanBal - loanRepay, 0);
      }
    }
    solgtLev += soldLev;
    cumSalgLev += salgLev;
    cumRepay += loanRepay;
    if (yy === tyrs) {
      cumNoiLevAtExit = cumNoiLev;
      cumSalgLevAtExit = cumSalgLev;
      cumRepayAtExit = cumRepay;
      finalBalAtExit = isRefi ? rkBal : loanBal;
    }
  }
  var totalRetLev = cumNoiLevAtExit + cumSalgLevAtExit - cumRepayAtExit - equity - bankFeeKr - rkRefiGap - finalBalAtExit;
  var totalRetPctLev = equity > 0 ? totalRetLev / (equity + rkRefiGap) : 0;
  var pRetSafeLev = 1 + totalRetPctLev;
  var eqInvested = equity + bankFeeKr + rkRefiGap;
  var annRetLev = (eqInvested > 0 && pRetSafeLev > 0) ? Math.pow(pRetSafeLev, 1 / tyrs) - 1 : -1;
  var eqMultLev = eqInvested > 0 ? (cumNoiLevAtExit + cumSalgLevAtExit - cumRepayAtExit - finalBalAtExit) / eqInvested : 0;
  var dscr = ydIO > 0 ? noi / ydIO : 99;
  var dscrRk = ydRkAnnuitet > 0 ? noi / ydRkAnnuitet : 99;
  var cocReturn = equity > 0 ? (noi - ydIO) / equity : 0;
  // fee-beregningen (NFV linje 642-651)
  var projSum = pI;
  var devYears = P.projMdr / 12;
  var devFee = projSum * P.devPctYr / 100 * devYears;
  var devMoms = devFee * 0.25;
  var devInkl = devFee + devMoms;
  var finFeeTop = loanAmt * P.finFeePct / 100;
  return {
    AREA: AREA, tAf: tAf, land: land, cIn: cIn, pI: pI, dT: dT, noi: noi, yoc: yoc, iv4: iv4,
    totalSalg: totalSalg, totalReturn: totalReturn, annReturn: annReturn,
    loanAmt: loanAmt, seniorAmt: seniorAmt, juniorAmt: juniorAmt, blendedRate: blendedRate,
    equity: equity, bankFeeKr: bankFeeKr, ydIO: ydIO,
    rkLoan: rkLoan, rkMaxLoan: rkMaxLoan, rkRefiGap: rkRefiGap, ydRkAnnuitet: ydRkAnnuitet,
    dscr: dscr, dscrRk: dscrRk, cocReturn: cocReturn,
    totalRetLev: totalRetLev, annRetLev: annRetLev, eqMultLev: eqMultLev, eqInvested: eqInvested,
    cumDSLev: cumDSLev, cumRepay: cumRepay,
    devFee: devFee, devMoms: devMoms, devInkl: devInkl, finFee: finFeeTop,
  };
}

// NFV111's default-parametre — aflæst direkte i eksemplarfilen (useState-init, linje 71-105)
const NFV_P = {
  pp: 13000000, csqm: 22000, demo: 500000, bpPct: 10, rdPct: 12, tilsl: 600000, ufPct: 10,
  spSqm: 100000, rent: 2800, tyrs: 4, tomgang: 1, lejeStig: 2.0, units: 8, maeglerPct: 1.0,
  capRate: 2.5, bebygPct: 110, exitMode: "sqm",
  ltcPct: 65, seniorRate: 4.0, juniorRate: 8.0, rkRate: 4.5, rkLtv: 70, amorYrs: 30, ioPeriod: 3, bankFee: 2.0,
  // template-parametre (samme værdier som NFV's konstanter)
  grundAreal: 663, gebyr: 150000,
  grundskyld: 72900, forsikring: 40095, admPct: 3, vedlSqm: 50, divSqm: 80,
  devPctYr: 2.0, finFeePct: 1.5, projMdr: 36,
};

const NFV_SPEC = {
  model: { landMode: "purchase", opexMode: "itemised", debtMode: "twoPhase", exitModes: ["sqm"], feeMode: "devAndFin", advokatDD: 150000 },
  defaults: {},
};

describe("(b) NFV111 golden — purchase/itemised/twoPhase/devAndFin", () => {
  it("matcher NFV's originale formelkæde 1:1 med defaults", () => {
    const ref = nfvReference(NFV_P);
    const m = calcModel(NFV_P, NFV_SPEC);
    // AREA = round(663 * 110/100) = 729 m²
    expect(m.AREA).toBe(729);
    expect(m.tAf).toBeCloseTo(ref.tAf, 6);      // 1850 + 13.000.000 × 0,006 = 79.850
    expect(m.tAf).toBeCloseTo(79850, 6);
    expect(m.land).toBeCloseTo(ref.land, 6);    // pp + tinglysning + 150.000 advokat/DD
    expect(m.cIn).toBeCloseTo(ref.cIn, 6);
    expect(m.pI).toBeCloseTo(ref.pI, 6);
    expect(m.totalCapital).toBeCloseTo(ref.pI, 6); // purchase: totalCapital = pI
    expect(m.dT).toBeCloseTo(ref.dT, 6);
    expect(m.noi).toBeCloseTo(ref.noi, 6);
    expect(m.yoc).toBeCloseTo(ref.yoc, 6);
    expect(m.iv4).toBeCloseTo(ref.iv4, 6);
    expect(m.totalSalg).toBeCloseTo(ref.totalSalg, 6);
    expect(m.totalReturn).toBeCloseTo(ref.totalReturn, 6);
    expect(m.cagr).toBeCloseTo(ref.annReturn, 6);
    expect(m.loanAmt).toBeCloseTo(ref.loanAmt, 6);
    expect(m.seniorAmt).toBeCloseTo(ref.seniorAmt, 6);
    expect(m.juniorAmt).toBeCloseTo(ref.juniorAmt, 6);
    expect(m.blendedRate).toBeCloseTo(ref.blendedRate, 10);
    expect(m.cashEquity).toBeCloseTo(ref.equity, 6);
    expect(m.bankFeeKr).toBeCloseTo(ref.bankFeeKr, 6);
    expect(m.ydIO).toBeCloseTo(ref.ydIO, 6);
    expect(m.rkLoan).toBeCloseTo(ref.rkLoan, 6);
    expect(m.rkMaxLoan).toBeCloseTo(ref.rkMaxLoan, 6);
    expect(m.rkRefiGap).toBeCloseTo(ref.rkRefiGap, 6);
    expect(m.ydRkAnnuitet).toBeCloseTo(ref.ydRkAnnuitet, 6);
    expect(m.dscr).toBeCloseTo(ref.dscr, 6);
    expect(m.dscrRk).toBeCloseTo(ref.dscrRk, 6);
    expect(m.cocReturn).toBeCloseTo(ref.cocReturn, 6);
    expect(m.eqInvested).toBeCloseTo(ref.eqInvested, 6);
    expect(m.totalRetLev).toBeCloseTo(ref.totalRetLev, 6);
    expect(m.cagrLev).toBeCloseTo(ref.annRetLev, 6);
    expect(m.eqMultLev).toBeCloseTo(ref.eqMultLev, 6);
    expect(m.cumDSLev).toBeCloseTo(ref.cumDSLev, 6);
    expect(m.cumRepay).toBeCloseTo(ref.cumRepay, 6);
  });

  it("matcher NFV 1:1 med junior-tranche (ltcPct=80) og lav rkLtv (refi-gap)", () => {
    const P = { ...NFV_P, ltcPct: 80, rkLtv: 40 };
    const ref = nfvReference(P);
    const m = calcModel(P, NFV_SPEC);
    expect(m.blendedRate).toBeCloseTo(ref.blendedRate, 10);
    expect(m.rkRefiGap).toBeCloseTo(ref.rkRefiGap, 6);
    expect(m.eqInvested).toBeCloseTo(ref.eqInvested, 6);
    expect(m.totalRetLev).toBeCloseTo(ref.totalRetLev, 6);
    expect(m.cagrLev).toBeCloseTo(ref.annRetLev, 6);
    expect(m.dscrRk).toBeCloseTo(ref.dscrRk, 6);
  });

  it("fee-kæden (devAndFin) matcher NFV's fee-beregning 1:1", () => {
    const ref = nfvReference(NFV_P);
    const m = calcModel(NFV_P, NFV_SPEC);
    expect(m.fees.mode).toBe("devAndFin");
    expect(m.fees.projSum).toBeCloseTo(ref.pI, 6); // NFV: projSum = pI
    expect(m.fees.devFee).toBeCloseTo(ref.devFee, 6);
    expect(m.fees.devMoms).toBeCloseTo(ref.devMoms, 6);
    expect(m.fees.devInkl).toBeCloseTo(ref.devInkl, 6);
    expect(m.fees.finFee).toBeCloseTo(ref.finFee, 6);
    expect(m.fees.totalFees).toBeCloseTo(ref.devInkl + ref.finFee, 6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (c) KONTAKT-DÆKNING — hver af de 5 kontakter flytter outputtet som forventet
// ═════════════════════════════════════════════════════════════════════════════
describe("(c) kontakt-dækning", () => {
  const basP = { ...LGV_P, pp: 6500000 }; // pp kun brugt i purchase-mode
  const spec = (model) => ({ model: { ...LGV_SPEC.model, ...model }, defaults: {} });

  it("landMode: purchase medregner grundkøb+tinglysning+advokat i pI; apport lægger grunden oven på pI", () => {
    const mA = calcModel(basP, spec({ landMode: "apport" }));
    const mP = calcModel(basP, spec({ landMode: "purchase" }));
    expect(mA.land).toBe(0);
    expect(mA.totalCapital).toBeCloseTo(mA.pI + basP.grundVaerdi, 6);
    expect(mP.tAf).toBeCloseTo(1850 + 6500000 * 0.006, 6);
    expect(mP.land).toBeCloseTo(6500000 + (1850 + 6500000 * 0.006) + 150000, 6);
    expect(mP.pI).toBeCloseTo(mA.pI + mP.land, 6); // samme byggesum + grundkøb
    expect(mP.totalCapital).toBeCloseTo(mP.pI, 6);
    expect(mP.totalCapital).not.toBeCloseTo(mA.totalCapital, 0);
  });

  it("landMode: advokatDD kommer fra spec — 100k vs 150k flytter land med præcis 50k (rettelse #2)", () => {
    const m150 = calcModel(basP, spec({ landMode: "purchase", advokatDD: 150000 }));
    const m100 = calcModel(basP, spec({ landMode: "purchase", advokatDD: 100000 }));
    expect(m150.land - m100.land).toBeCloseTo(50000, 6);
    expect(m150.advokatDD).toBe(150000);
    expect(m100.advokatDD).toBe(100000);
  });

  it("opexMode: itemised giver anden driftsomkostning end perSqm", () => {
    const P = { ...basP, grundskyld: 72900, forsikring: 40095, admPct: 3, vedlSqm: 50, divSqm: 80 };
    const mS = calcModel(P, spec({ opexMode: "perSqm" }));
    const mI = calcModel(P, spec({ opexMode: "itemised" }));
    expect(mS.dT).toBeCloseTo(P.driftSqm * mS.AREA, 6);
    expect(mI.dT).toBeCloseTo(72900 + 40095 + mI.effLeje * 0.03 + mI.AREA * 50 + mI.AREA * 80, 6);
    expect(mI.dT).not.toBeCloseTo(mS.dT, 0);
  });

  it("debtMode: twoPhase bruger LTC-lån med senior/junior — junior-tranche løfter blended rente", () => {
    const P = { ...basP, ltcPct: 65, seniorRate: 4.0, juniorRate: 8.0, rkRate: 4.5, rkLtv: 70, amorYrs: 30, ioPeriod: 3 };
    const m65 = calcModel(P, spec({ debtMode: "twoPhase" }));
    const m80 = calcModel({ ...P, ltcPct: 80 }, spec({ debtMode: "twoPhase" }));
    const mIO = calcModel(P, spec({ debtMode: "singleIO" }));
    expect(m65.blendedRate).toBeCloseTo(0.04, 10);   // ren senior ved LTC ≤ 65
    expect(m80.blendedRate).toBeGreaterThan(m65.blendedRate); // junior-tranche = dyrere blended
    expect(m65.juniorAmt).toBe(0);
    expect(m80.juniorAmt).toBeGreaterThan(0);
    expect(m65.loanAmt).toBeCloseTo(m65.pI * 0.65, 6); // LTC af pI — ikke LTV af værdi
    expect(mIO.loanAmt).toBeCloseTo(Math.min(mIO.iv4 * P.realLtv / 100, mIO.pI), 6);
    expect(m65.dscrRk).not.toBeNull();               // twoPhase har DSCR i begge faser
    expect(mIO.dscrRk).toBeNull();                   // singleIO har kun IO-fasen
  });

  it("exitModes: hold sælger intet (urealiseret friværdi); cap og sqm giver forskellige salgssummer", () => {
    const mSqm = calcModel({ ...basP, exitMode: "sqm" }, spec({}));
    const mCap = calcModel({ ...basP, exitMode: "cap" }, spec({}));
    const mHold = calcModel({ ...basP, exitMode: "hold" }, spec({}));
    const solgtHold = mHold.cf.reduce((s, r) => s + r.salg, 0);
    expect(solgtHold).toBe(0);                         // hold: ingen salg i cashflowet
    expect(mHold.totalSalg).toBeCloseTo(mHold.exitValueHold, 6); // ...men urealiseret værdi ved horisont
    expect(mSqm.totalSalg).not.toBeCloseTo(mCap.totalSalg, 0);
    expect(mSqm.totalSalg).toBeGreaterThan(0);
    // exitMode uden for spec.model.exitModes falder tilbage til første aktiverede
    const mLocked = calcModel({ ...basP, exitMode: "cap" }, spec({ exitModes: ["sqm"] }));
    expect(mLocked.exitMode).toBe("sqm");
  });

  it("feeMode: mgmtPrefCarry vs devAndFin giver forskellige fee-strukturer; carry kun over pref", () => {
    const P = { ...basP, devPctYr: 2.0, finFeePct: 1.5 };
    const mM = calcModel(P, spec({ feeMode: "mgmtPrefCarry" }));
    const mD = calcModel(P, spec({ feeMode: "devAndFin" }));
    expect(mM.fees.mode).toBe("mgmtPrefCarry");
    expect(mD.fees.mode).toBe("devAndFin");
    expect(mM.fees.mgmtInkl).toBeCloseTo(mM.totalCapital * 0.04 * 1.25, 6);
    expect(mD.fees.devInkl).toBeCloseTo(mD.totalCapital * 0.02 * 3 * 1.25, 6); // 2% p.a. × 3 år + moms
    expect(mD.fees.finFee).toBeCloseTo(mD.loanAmt * 0.015, 6);
    // carry er 0, når projektgevinsten ikke overstiger pref'en
    const mLavt = calcModel({ ...P, spSqm: 20000, rent: 1200 }, spec({ feeMode: "mgmtPrefCarry" }));
    expect(mLavt.fees.wfRest).toBe(0);
    expect(mLavt.fees.carry).toBe(0);
  });
});
