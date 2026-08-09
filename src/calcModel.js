// ─────────────────────────────────────────────────────────────────────────────
// case-template — generisk beregningsmotor for Fairhomes business cases
//
// Ren funktion: calcModel(P, spec) → nøgletal + cashflows. Ingen React, ingen
// side effects, ingen hardcodede ejendomstal — ALLE talparametre kommer fra P
// (live slider-værdier) eller spec.defaults. Strukturen styres af 5 kontakter
// i spec.model:
//
//   landMode:  "apport"   — grunden ejes og indskydes som værdi (LGV2628-stil):
//                           grundVaerdi/grundGaeld/grundEK, totalCapital = pI + grundVaerdi
//              "purchase" — grunden købes kontant (NFV111-stil):
//                           land = pp + tinglysning + advokat/DD, land indgår i pI
//   opexMode:  "perSqm"   — driftSqm kr/m²/år, prisreguleres med lejeStig (LGV)
//              "itemised" — grundskyld + forsikring (DKK) + admin (% af eff. leje)
//                           + vedligehold + diverse (kr/m²), fladt (NFV)
//   debtMode:  "singleIO" — ét afdragsfrit realkreditlån: min(iv4×LTV, pI) (LGV)
//              "threePhase" — grundkøbslån (LTV af grunden) → byggekredit (LTC, indfrier
//                             grundlånet) → realkredit. Ingen leje i fase 1-2; renterne
//                             dér er negativ carry. Drift og salg starter ved stabilisering.
//              "twoPhase" — byggelån (LTC, senior≤65/junior-split, blended rente,
//                           IO-periode) → realkredit-refi (rkLtv af iv4, refi-gap,
//                           annuitet over amorYrs), pro-rata indfrielse ved salg (NFV)
//   exitModes: delmængde af ["sqm","cap","hold"] — stykvis salg / samlet salg til
//              cap rate / behold i drift (urealiseret friværdi)
//   feeMode:   "mgmtPrefCarry" — fast mgmt-fee % af totalCapital + 25% moms;
//                                waterfall: ejer får pref (% af grund-EK) forlods,
//                                derefter carry % af resten (LGV)
//              "devAndFin"     — devFee % p.a. × projMdr/12 af projektsum + 25% moms
//                                + finansierings-fee % af lånesum, momsfri (NFV)
//
// BEVIDSTE RETTELSER ift. eksemplarerne (dokumenteret her, testet i calcModel.test.js):
//   1) Det annualiserede afkast hedder `cagr` / `cagrLev` (UI-label: "Årligt afkast
//      (CAGR)") — IKKE "IRR". Metrikken er ((1 + totalafkast%)^(1/år)) − 1 og tager
//      ikke højde for cashflow-timing, så IRR-betegnelsen i LGV/NFV var misvisende.
//   2) Purchase-mode bruger ÉN advokat/DD-konstant fra spec.model.advokatDD
//      (default 150.000), så UI-tekst og model aldrig kan divergere igen
//      (NFV111 havde 150k i modellen og 100k i teksten).
//
// Bevaret NFV-kvirk (for 1:1-paritet, se testene): i itemised-opex skaleres de
// faste poster (grundskyld/forsikring) i årsløkken OGSÅ med remainUnits/units.
// ─────────────────────────────────────────────────────────────────────────────

// Design-tokens til graf-serier (samme palet som ui.jsx — inlinet så modulet er rent)
var C_GR = "#22C55E", C_RD = "#EF4444", C_TL = "#367878";

export function calcModel(P, spec) {
  var model = (spec && spec.model) || {};
  var landMode = model.landMode || "apport";
  var opexMode = model.opexMode || "perSqm";
  var debtMode = model.debtMode || "singleIO";
  var exitModes = (model.exitModes && model.exitModes.length) ? model.exitModes : ["sqm"];
  var feeMode = model.feeMode || "mgmtPrefCarry";
  var advokatDD = model.advokatDD !== undefined ? model.advokatDD : 150000; // rettelse #2

  // Parametre: spec.defaults som bund, live-værdier (P) ovenpå
  var Q = Object.assign({}, (spec && spec.defaults) || {}, P || {});

  // Exit-metode skal være aktiveret i spec — ellers første aktiverede
  var exitMode = exitModes.indexOf(Q.exitMode) >= 0 ? Q.exitMode : exitModes[0];
  var capMode = exitMode === "cap";
  var holdMode = exitMode === "hold";

  var AREA = Math.round(Q.grundAreal * Q.bebygPct / 100);
  var AU = AREA / Q.units;

  // ── GRUND: apport (LGV) eller kontant køb (NFV) ──
  var tAf = 0, land = 0, grundVaerdi = 0, gg = 0, grundEK = 0;
  if (landMode === "purchase") {
    tAf = 1850 + Q.pp * 0.006; // tinglysningsafgift: fast gebyr + 0,6% af købesum (lovbestemt sats)
    land = Q.pp + tAf + advokatDD;
  } else {
    grundVaerdi = Q.grundVaerdi;
    // gæld i grunden: eksisterende pant, der overtages — reducerer grundens netto-egenkapital
    gg = Math.min(Math.max(Q.grundGaeld || 0, 0), grundVaerdi);
    grundEK = grundVaerdi - gg;
  }

  // ── BYGGEOMKOSTNINGER ──
  var hw = Q.csqm * AREA, bp = hw * Q.bpPct / 100, rd = hw * Q.rdPct / 100;
  var gebyr = Q.gebyr !== undefined ? Q.gebyr : 150000; // gebyrer + landinspektør
  var sub = Q.demo + hw + bp + rd + Q.tilsl + gebyr;
  var uf = sub * Q.ufPct / 100, cEx = sub + uf, moms = cEx * 0.25, cIn = cEx + moms;

  // kontant investering + samlet kapitalindsats
  var pI = landMode === "purchase" ? land + cIn : cIn;
  var totalCapital = landMode === "apport" ? pI + grundVaerdi : pI;

  // ── DRIFT ÅR 1 ──
  var bL = AREA * Q.rent, tomKr = bL * Q.tomgang / 100, effLeje = bL - tomKr;
  var dT, gs = 0, fo = 0, ad = 0, ve = 0, di = 0;
  if (opexMode === "itemised") {
    gs = Q.grundskyld; fo = Q.forsikring;
    ad = effLeje * Q.admPct / 100; ve = AREA * Q.vedlSqm; di = AREA * Q.divSqm;
    dT = gs + fo + ad + ve + di;
  } else {
    dT = Q.driftSqm * AREA; // alt inkl.: ejendomsskat, forsikring, admin, vedligehold, hensættelser
  }
  var noi = effLeje - dT;
  var yoc = noi / totalCapital, bAf = effLeje / totalCapital, iv4 = noi / (Q.capRate / 100);

  // driftsomkostninger i et givet år for den tilbageværende portefølje
  var opexYear = function(y, areaLeft, effY, remainUnits) {
    if (opexMode === "itemised") {
      // NFV-kvirk bevaret 1:1: hele posten (også faste gs/fo) skaleres med remainUnits/units
      return remainUnits > 0 ? (gs + fo + effY * Q.admPct / 100 + areaLeft * Q.vedlSqm + areaLeft * Q.divSqm) * remainUnits / Q.units : 0;
    }
    return Q.driftSqm * areaLeft * Math.pow(1 + Q.lejeStig / 100, y); // drift prisreguleres som lejen
  };

  // ── ULEVERAGED CASHFLOW (år 0..max(tyrs,10)) ──
  var cf = [], cumNoi = 0, solgt = 0, cumSalg = 0;
  var salgPrAar = Q.tyrs > 0 ? Q.units / Q.tyrs : Q.units; // tyrs = 0 → alt sælges i år 0
  var noiAtExit = 0, cumNoiAtExit = 0; // driftscase: værdi/NOI opgøres ved horisonten
  for (var y = 0; y <= Math.max(Q.tyrs, 10); y++) {
    var rentY = Q.rent * Math.pow(1 + Q.lejeStig / 100, y);
    var remainUnits = Math.max(Q.units - solgt, 0);
    var areaLeft = remainUnits * AU;
    var bLy = areaLeft * rentY;
    var tomY = bLy * Q.tomgang / 100;
    var effY = bLy - tomY;
    var dTy = opexYear(y, areaLeft, effY, remainUnits);
    var noiY = effY - dTy;
    cumNoi += noiY;
    if (y === Q.tyrs) { noiAtExit = noiY; cumNoiAtExit = cumNoi; }
    var soldThis = 0, salgThis = 0;
    if (solgt < Q.units && !holdMode) {
      if (capMode) {
        // samlet salg som investeringsejendom i exit-året til cap rate af årets NOI
        if (y === Q.tyrs) {
          soldThis = Q.units - solgt;
          salgThis = (noiY / (Q.capRate / 100)) * (1 - Q.maeglerPct / 100);
        }
      } else {
        soldThis = Math.min(Math.round(salgPrAar), Q.units - solgt);
        if (y === Q.tyrs) soldThis = Q.units - solgt;
        salgThis = soldThis * AU * Q.spSqm;
        salgThis -= salgThis * Q.maeglerPct / 100;
      }
    }
    solgt += soldThis;
    cumSalg += salgThis;
    cf.push({ year: y, noi: Math.round(noiY), cumNoi: Math.round(cumNoi), salg: Math.round(salgThis), cumSalg: Math.round(cumSalg), cumProfit: Math.round(cumNoi + cumSalg - totalCapital), remain: Q.units - solgt });
  }
  var exitValueHold = noiAtExit / (Q.capRate / 100); // ejendomsværdi ved horisonten (urealiseret)
  var totalSalg = holdMode ? exitValueHold : cumSalg;
  var cumNoiEff = holdMode ? cumNoiAtExit : cumNoi;
  var totalReturn = cumNoiEff + totalSalg - totalCapital;
  var totalReturnPct = totalReturn / totalCapital;
  var pRetSafe = 1 + totalReturnPct;
  // rettelse #1: annualiseret afkast hedder cagr (label "Årligt afkast (CAGR)"), ikke "IRR"
  var cagr = Q.tyrs > 0 ? (pRetSafe > 0 ? Math.pow(pRetSafe, 1 / Q.tyrs) - 1 : -1) : totalReturnPct;
  var exitValue = (capMode || holdMode) ? iv4 : AREA * Q.spSqm;

  var costPie = [
    landMode === "purchase" ? { name: "Grundkøb", value: Math.round(land) } : { name: "Grund/byggeret", value: Math.round(grundVaerdi) },
    { name: "Håndværker", value: Math.round(hw) },
    { name: "Byggeplads", value: Math.round(bp) },
    { name: "Rådgivere", value: Math.round(rd) },
    { name: "Tilslut.+geb.", value: Math.round(Q.tilsl + gebyr) },
    { name: "Nedrivning", value: Math.round(Q.demo) },
    { name: "Uforudsete", value: Math.round(uf) },
    { name: "Moms", value: Math.round(moms) },
  ].filter(function(x) { return x.value > 0; });
  var driftPie = opexMode === "itemised"
    ? [{ name: "Grundskyld", value: gs }, { name: "Forsikring", value: fo }, { name: "Admin.", value: Math.round(ad) }, { name: "Vedligehold", value: Math.round(ve) }, { name: "Diverse", value: Math.round(di) }]
    : [{ name: "Drift (alt inkl.)", value: Math.round(dT) }];

  // ── FINANSIERING + LEVERAGED CASHFLOW ──
  var cfLev = [], loanAmt = 0, bankFeeKr = 0, cashEquity = 0, cashIndskud = 0, equityTotal = 0, eqInvested = 0;
  var debt0 = 0, ydIO = 0, seniorAmt = 0, juniorAmt = 0, blendedRate = 0;
  var rkLoan = 0, rkMaxLoan = 0, rkRefiGap = 0, ydRkAnnuitet = 0, ydAnnuitet = 0, dscrRk = null;
  var faser = null; // kun sat i threePhase: fasernes lån, renter og årstal
  var cumNoiLev = 0, cumDSLev = 0, cumRepay = 0, cumSalgLev = 0, cumBrutto = 0, cumMaegler = 0;
  var levCumNoiExit = 0, levSalgNet = 0, totalRetLev = 0, totalRetPctLev = 0, cagrLev = 0, eqMultLev = 0;
  var dscr = 99, cocReturn = 0, loanBalExit = 0, exitBrutto = 0, exitMaegler = 0, exitRepay = 0;

  if (debtMode === "twoPhase") {
    // ── NFV-model: byggelån (LTC, senior/junior) → realkredit-refi (annuitet) ──
    loanAmt = pI * Q.ltcPct / 100;
    var seniorPct = Math.min(65, Q.ltcPct);
    var juniorPct = Math.max(0, Q.ltcPct - 65);
    seniorAmt = pI * seniorPct / 100;
    juniorAmt = pI * juniorPct / 100;
    blendedRate = loanAmt > 0 ? (seniorAmt * Q.seniorRate / 100 + juniorAmt * Q.juniorRate / 100) / loanAmt : 0;
    var equity = pI - loanAmt;
    bankFeeKr = loanAmt * Q.bankFee / 100;
    var rkR = Q.rkRate / 100;
    rkMaxLoan = iv4 * Q.rkLtv / 100; // LTV af stabiliseret værdi
    ydIO = loanAmt * blendedRate;
    rkLoan = Math.min(loanAmt, rkMaxLoan);
    rkRefiGap = Math.max(0, loanAmt - rkMaxLoan); // gap dækkes af egenkapital/kontanter
    ydRkAnnuitet = Q.amorYrs > 0 && rkLoan > 0 ? rkLoan * (rkR * Math.pow(1 + rkR, Q.amorYrs)) / (Math.pow(1 + rkR, Q.amorYrs) - 1) : 0;
    ydAnnuitet = ydRkAnnuitet;
    var loanBal = loanAmt;
    var isRefi = false, rkBal = 0;
    var solgtLev = 0;
    var cumNoiLevAtExit = 0, cumSalgLevAtExit = 0, cumRepayAtExit = 0, finalBalAtExit = 0;
    for (var yy = 0; yy <= Math.max(Q.tyrs, 10); yy++) {
      var rentYY = Q.rent * Math.pow(1 + Q.lejeStig / 100, yy);
      var remUn = Math.max(Q.units - solgtLev, 0);
      var areaL = remUn * AU;
      var bLyy = areaL * rentYY, tomYY = bLyy * Q.tomgang / 100, effYY = bLyy - tomYY;
      var dTyy = opexYear(yy, areaL, effYY, remUn);
      var noiYY = effYY - dTyy;
      var dsYY = 0, interestYY = 0, amorYY = 0, refiEvent = false;
      if (yy < Q.ioPeriod) {
        // byggefase: afdragsfrit på blended rente
        dsYY = loanBal > 0 ? loanBal * blendedRate : 0;
        interestYY = dsYY;
        amorYY = 0;
      } else if (!isRefi && yy === Q.ioPeriod) {
        // REFI-EVENT: byggelån → realkredit (kun restgælden refinansieres)
        isRefi = true;
        refiEvent = true;
        rkRefiGap = Math.max(0, loanBal - rkMaxLoan);
        rkBal = Math.min(loanBal, rkMaxLoan);
        ydRkAnnuitet = Q.amorYrs > 0 && rkBal > 0 ? rkBal * (rkR * Math.pow(1 + rkR, Q.amorYrs)) / (Math.pow(1 + rkR, Q.amorYrs) - 1) : 0;
        ydAnnuitet = ydRkAnnuitet;
        loanBal = 0; // byggelånet indfries fuldt via refi
        dsYY = rkBal > 0 ? Math.min(ydRkAnnuitet, rkBal * (1 + rkR)) : 0;
        interestYY = rkBal * rkR;
        amorYY = Math.min(dsYY - interestYY, rkBal);
        rkBal = Math.max(rkBal - amorYY, 0);
      } else {
        // efter refi: annuitet på realkredit
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
      if (solgtLev < Q.units && !holdMode) {
        if (capMode) {
          // samlet salg i exit-året — al gæld indfries
          if (yy === Q.tyrs) {
            soldLev = Q.units - solgtLev;
            var bruttoC = noiYY / (Q.capRate / 100);
            var maeglerC = bruttoC * Q.maeglerPct / 100;
            salgLev = bruttoC - maeglerC;
            cumBrutto += bruttoC; cumMaegler += maeglerC;
            loanRepay = activeBal;
            if (isRefi) rkBal = 0; else loanBal = 0;
          }
        } else {
          soldLev = Math.min(Math.round(salgPrAar), Q.units - solgtLev);
          if (yy === Q.tyrs) soldLev = Q.units - solgtLev;
          var bruttoS = soldLev * AU * Q.spSqm;
          var maeglerS = bruttoS * Q.maeglerPct / 100;
          salgLev = bruttoS - maeglerS;
          cumBrutto += bruttoS; cumMaegler += maeglerS;
          // pro-rata indfrielse ift. oprindelig lånefordeling pr. enhed
          if (isRefi) {
            loanRepay = Math.min(activeBal, rkLoan * soldLev / Q.units);
            rkBal = Math.max(rkBal - loanRepay, 0);
          } else {
            loanRepay = Math.min(activeBal, loanAmt * soldLev / Q.units);
            loanBal = Math.max(loanBal - loanRepay, 0);
          }
        }
      }
      solgtLev += soldLev;
      cumSalgLev += salgLev;
      cumRepay += loanRepay;
      var salgEfterRepay = salgLev - loanRepay;
      var finalBal = isRefi ? rkBal : loanBal;
      var cumEqCF = cumNoiLev + cumSalgLev - cumRepay - equity - bankFeeKr - rkRefiGap;
      cfLev.push({ year: yy, noi: Math.round(noiYY), ds: Math.round(dsYY), noiAfterDS: Math.round(noiAfterDS), salg: Math.round(salgLev), salgNet: Math.round(salgEfterRepay), repay: Math.round(loanRepay), cumNoi: Math.round(cumNoiLev), cumSalg: Math.round(cumSalgLev - cumRepay), cumProfit: Math.round(cumEqCF), loanBal: Math.round(finalBal), remain: Q.units - solgtLev, refi: refiEvent, phase: yy < Q.ioPeriod ? "IO" : "RK" });
      if (yy === Q.tyrs) {
        cumNoiLevAtExit = cumNoiLev;
        cumSalgLevAtExit = cumSalgLev;
        cumRepayAtExit = cumRepay;
        finalBalAtExit = isRefi ? rkBal : loanBal;
      }
    }
    eqInvested = equity + bankFeeKr + rkRefiGap; // rkRefiGap er den faktiske (evt. genberegnet ved refi)
    cashEquity = equity;
    cashIndskud = equity + bankFeeKr;
    equityTotal = eqInvested;
    debt0 = loanAmt;
    levCumNoiExit = cumNoiLevAtExit;
    levSalgNet = holdMode ? exitValueHold - finalBalAtExit : cumSalgLevAtExit - cumRepayAtExit - finalBalAtExit;
    totalRetLev = levCumNoiExit + levSalgNet - eqInvested;
    totalRetPctLev = equity > 0 ? totalRetLev / (equity + rkRefiGap) : 0; // NFV-basis: ekskl. bankFee
    var pRetSafeLev2 = 1 + totalRetPctLev;
    cagrLev = Q.tyrs > 0 ? ((eqInvested > 0 && pRetSafeLev2 > 0) ? Math.pow(pRetSafeLev2, 1 / Q.tyrs) - 1 : -1) : totalRetPctLev;
    eqMultLev = eqInvested > 0 ? (holdMode ? (cumNoiLevAtExit + exitValueHold - finalBalAtExit) / eqInvested : (cumNoiLevAtExit + cumSalgLevAtExit - cumRepayAtExit - finalBalAtExit) / eqInvested) : 0;
    dscr = ydIO > 0 ? noi / ydIO : 99;              // byggefase (IO, blended)
    dscrRk = ydRkAnnuitet > 0 ? noi / ydRkAnnuitet : 99; // driftsfase (realkredit-annuitet)
    cocReturn = equity > 0 ? (noi - ydIO) / equity : 0;
    loanBalExit = finalBalAtExit;
    exitBrutto = holdMode ? exitValueHold : cumBrutto;
    exitMaegler = holdMode ? 0 : cumMaegler;
    exitRepay = holdMode ? finalBalAtExit : cumRepayAtExit + finalBalAtExit;
  } else if (debtMode === "threePhase") {
    // ── Faseopdelt: grundkøbslån → byggekredit → realkredit ──
    // Fase 1 (grundkøb) og fase 2 (byggeri) har INGEN lejeindtægt. Renterne i de to
    // faser er en negativ carry, der løber på det akkumulerede driftsresultat — de
    // indgår altså én gang, ikke også i egenkapitalen. Drift og salg starter først,
    // når byggeriet står færdigt.
    var gYrs = Math.max(0, Math.round(Q.grundYrs || 0));
    var bYrs = Math.max(0, Math.round(Q.byggeYrs || 0));
    var stabYear = gYrs + bYrs;                 // første driftsår
    var exitYear = Math.max(Q.tyrs, stabYear);  // exit kan ikke ligge før stabilisering
    var driftAar = exitYear - stabYear + 1;
    var salgPrAar3 = driftAar > 0 ? Q.units / driftAar : Q.units;

    // Fase 1 — grundkøbsfinansiering: lån på grundkøbet, afdragsfrit
    var grundLaan = land * Q.grundLtv / 100;
    var gRate = Q.grundRate / 100;
    var ydGrund = grundLaan * gRate;
    var grundRenter = ydGrund * gYrs;

    // Fase 2 — byggekredit: LTC af hele projektsummen, senior ≤65 % / junior derover.
    // Kreditten indfrier grundkøbslånet ved byggestart og trækkes derefter lineært,
    // så den gennemsnitlige restgæld i byggefasen er midt mellem de to.
    loanAmt = pI * Q.ltcPct / 100;
    var seniorPct3 = Math.min(65, Q.ltcPct);
    var juniorPct3 = Math.max(0, Q.ltcPct - 65);
    seniorAmt = pI * seniorPct3 / 100;
    juniorAmt = pI * juniorPct3 / 100;
    blendedRate = loanAmt > 0 ? (seniorAmt * Q.seniorRate / 100 + juniorAmt * Q.juniorRate / 100) / loanAmt : 0;
    var byggeGnsnit = (grundLaan + loanAmt) / 2;
    var ydByg = byggeGnsnit * blendedRate;
    var byggeRenter = ydByg * bYrs;
    ydIO = loanAmt * blendedRate;               // fuld byggekredit ved færdiggørelse
    bankFeeKr = (grundLaan + loanAmt) * Q.bankFee / 100; // stiftelse på begge lån

    // Fase 3 — realkredit ved stabilisering: LTV af ejendomsværdien, annuitet
    var rkR3 = Q.rkRate / 100;
    rkMaxLoan = iv4 * Q.rkLtv / 100;
    rkLoan = Math.min(loanAmt, rkMaxLoan);
    rkRefiGap = Math.max(0, loanAmt - rkMaxLoan);
    ydRkAnnuitet = Q.amorYrs > 0 && rkLoan > 0 ? rkLoan * (rkR3 * Math.pow(1 + rkR3, Q.amorYrs)) / (Math.pow(1 + rkR3, Q.amorYrs) - 1) : 0;
    ydAnnuitet = ydRkAnnuitet;

    var egenIndskud = pI - loanAmt;             // egenkapital i selve projektsummen
    eqInvested = egenIndskud + bankFeeKr + rkRefiGap;
    cashEquity = egenIndskud;
    cashIndskud = egenIndskud + bankFeeKr;
    equityTotal = eqInvested;
    debt0 = grundLaan;

    var rkBal3 = rkLoan, solgt3 = 0;
    var cumNoi3Exit = 0, cumSalg3Exit = 0, cumRepay3Exit = 0, finalBal3Exit = 0;
    for (var y3 = 0; y3 <= Math.max(exitYear, 10); y3++) {
      var fase3 = y3 < gYrs ? "GRUND" : (y3 < stabYear ? "BYG" : "RK");
      var noi3 = 0, ds3 = 0, salg3 = 0, repay3 = 0, sold3 = 0, refi3 = false;
      if (fase3 === "GRUND") {
        ds3 = ydGrund;
      } else if (fase3 === "BYG") {
        ds3 = ydByg;
      } else {
        if (y3 === stabYear) refi3 = true;
        var rent3 = Q.rent * Math.pow(1 + Q.lejeStig / 100, y3);
        var rem3 = Math.max(Q.units - solgt3, 0);
        var area3 = rem3 * AU;
        var bl3 = area3 * rent3, tom3 = bl3 * Q.tomgang / 100, eff3 = bl3 - tom3;
        noi3 = eff3 - opexYear(y3, area3, eff3, rem3);
        ds3 = rkBal3 > 0 ? Math.min(ydRkAnnuitet, rkBal3 * (1 + rkR3)) : 0;
        var int3 = rkBal3 * rkR3;
        rkBal3 = Math.max(rkBal3 - Math.min(ds3 - int3, rkBal3), 0);
        if (solgt3 < Q.units && !holdMode) {
          if (capMode) {
            if (y3 === exitYear) {
              sold3 = Q.units - solgt3;
              var br3 = noi3 / (Q.capRate / 100), mg3 = br3 * Q.maeglerPct / 100;
              salg3 = br3 - mg3; cumBrutto += br3; cumMaegler += mg3;
              repay3 = rkBal3; rkBal3 = 0;
            }
          } else {
            sold3 = Math.min(Math.round(salgPrAar3), Q.units - solgt3);
            if (y3 === exitYear) sold3 = Q.units - solgt3;
            var brs3 = sold3 * AU * Q.spSqm, mgs3 = brs3 * Q.maeglerPct / 100;
            salg3 = brs3 - mgs3; cumBrutto += brs3; cumMaegler += mgs3;
            repay3 = Math.min(rkBal3, rkLoan * sold3 / Q.units);
            rkBal3 = Math.max(rkBal3 - repay3, 0);
          }
        }
      }
      solgt3 += sold3;
      var efterDS3 = noi3 - ds3;
      cumNoiLev += efterDS3;
      cumDSLev += ds3;
      cumSalgLev += salg3;
      cumRepay += repay3;
      var bal3 = fase3 === "GRUND" ? grundLaan : (fase3 === "BYG" ? byggeGnsnit : rkBal3);
      cfLev.push({ year: y3, noi: Math.round(noi3), ds: Math.round(ds3), noiAfterDS: Math.round(efterDS3), salg: Math.round(salg3), salgNet: Math.round(salg3 - repay3), repay: Math.round(repay3), cumNoi: Math.round(cumNoiLev), cumSalg: Math.round(cumSalgLev - cumRepay), cumProfit: Math.round(cumNoiLev + cumSalgLev - cumRepay - eqInvested), loanBal: Math.round(bal3), remain: Q.units - solgt3, refi: refi3, phase: fase3 });
      if (y3 === exitYear) { cumNoi3Exit = cumNoiLev; cumSalg3Exit = cumSalgLev; cumRepay3Exit = cumRepay; finalBal3Exit = rkBal3; }
    }
    levCumNoiExit = cumNoi3Exit;
    levSalgNet = holdMode ? exitValueHold - finalBal3Exit : cumSalg3Exit - cumRepay3Exit - finalBal3Exit;
    totalRetLev = levCumNoiExit + levSalgNet - eqInvested;
    totalRetPctLev = eqInvested > 0 ? totalRetLev / eqInvested : 0;
    var pRetSafe3 = 1 + totalRetPctLev;
    cagrLev = exitYear > 0 ? ((eqInvested > 0 && pRetSafe3 > 0) ? Math.pow(pRetSafe3, 1 / exitYear) - 1 : -1) : totalRetPctLev;
    eqMultLev = eqInvested > 0 ? (holdMode ? (cumNoi3Exit + exitValueHold - finalBal3Exit) / eqInvested : (cumNoi3Exit + cumSalg3Exit - cumRepay3Exit - finalBal3Exit) / eqInvested) : 0;
    dscr = ydIO > 0 ? noi / ydIO : 99;                   // kan det færdige hus bære byggekreditten?
    dscrRk = ydRkAnnuitet > 0 ? noi / ydRkAnnuitet : 99; // driftsfasen
    cocReturn = eqInvested > 0 ? (noi - ydRkAnnuitet) / eqInvested : 0;
    loanBalExit = finalBal3Exit;
    exitBrutto = holdMode ? exitValueHold : cumBrutto;
    exitMaegler = holdMode ? 0 : cumMaegler;
    exitRepay = holdMode ? finalBal3Exit : cumRepay3Exit + finalBal3Exit;
    faser = {
      grundLaan: grundLaan, grundEgen: land - grundLaan, ydGrund: ydGrund, grundRenter: grundRenter,
      byggeGnsnit: byggeGnsnit, ydByg: ydByg, byggeRenter: byggeRenter,
      carryIalt: grundRenter + byggeRenter,
      gYrs: gYrs, byggeYrs: bYrs, stabYear: stabYear, exitYear: exitYear, driftAar: driftAar
    };
  } else {
    // ── LGV-model: ét afdragsfrit realkreditlån, optages ved færdiggørelse ──
    // LTV af ejendomsværdien (NOI/cap), dog højst byggesummen; evt. grundgæld ligger ovenpå
    loanAmt = Math.min(iv4 * Q.realLtv / 100, pI);
    var r = Q.realRente / 100;
    cashEquity = Math.max(pI - loanAmt, 0);
    bankFeeKr = loanAmt * Q.bankFee / 100;
    cashIndskud = cashEquity + bankFeeKr; // kontant indskud i alt
    equityTotal = cashIndskud + grundEK;  // EK = kontant + grundens nettoværdi (apport − gæld)
    debt0 = loanAmt + gg;                 // samlet gæld: nyt lån + overtaget gæld i grunden
    ydIO = debt0 * r;                     // afdragsfrit — renter alene; indfries ved salg
    var loanBal2 = debt0, solgtLev2 = 0;
    var cumNoiLevAtExit2 = 0, loanBalAtExit2 = debt0;
    for (var y2 = 0; y2 <= Math.max(Q.tyrs, 10); y2++) {
      var rentY2 = Q.rent * Math.pow(1 + Q.lejeStig / 100, y2);
      var remUn2 = Math.max(Q.units - solgtLev2, 0);
      var areaL2 = remUn2 * AU;
      var bLy2 = areaL2 * rentY2, tomY2 = bLy2 * Q.tomgang / 100, effY2 = bLy2 - tomY2;
      var dTy2 = opexYear(y2, areaL2, effY2, remUn2);
      var noiY2 = effY2 - dTy2;
      var dsY2 = loanBal2 * r; // afdragsfrit — kun renter; nedbringes ved salg
      var noiAfterDS2 = noiY2 - dsY2;
      cumNoiLev += noiAfterDS2;
      cumDSLev += dsY2;
      if (y2 === Q.tyrs) { cumNoiLevAtExit2 = cumNoiLev; loanBalAtExit2 = loanBal2; }
      var soldLev2 = 0, salgLev2 = 0, loanRepay2 = 0;
      if (solgtLev2 < Q.units && !holdMode) {
        if (capMode) {
          if (y2 === Q.tyrs) {
            soldLev2 = Q.units - solgtLev2;
            var bruttoC2 = noiY2 / (Q.capRate / 100);
            var maeglerC2 = bruttoC2 * Q.maeglerPct / 100;
            salgLev2 = bruttoC2 - maeglerC2;
            cumBrutto += bruttoC2; cumMaegler += maeglerC2;
            loanRepay2 = loanBal2;
            loanBal2 = 0;
          }
        } else {
          soldLev2 = Math.min(Math.round(salgPrAar), Q.units - solgtLev2);
          if (y2 === Q.tyrs) soldLev2 = Q.units - solgtLev2;
          var bruttoS2 = soldLev2 * AU * Q.spSqm;
          var maeglerS2 = bruttoS2 * Q.maeglerPct / 100;
          salgLev2 = bruttoS2 - maeglerS2;
          cumBrutto += bruttoS2; cumMaegler += maeglerS2;
          loanRepay2 = Math.min(loanBal2, debt0 * soldLev2 / Q.units);
          loanBal2 = Math.max(loanBal2 - loanRepay2, 0);
        }
      }
      solgtLev2 += soldLev2;
      cumSalgLev += salgLev2;
      cumRepay += loanRepay2;
      var salgEfterRepay2 = salgLev2 - loanRepay2;
      var cumEqCF2 = cumNoiLev + cumSalgLev - cumRepay - equityTotal;
      cfLev.push({ year: y2, noi: Math.round(noiY2), ds: Math.round(dsY2), noiAfterDS: Math.round(noiAfterDS2), salg: Math.round(salgLev2), salgNet: Math.round(salgEfterRepay2), repay: Math.round(loanRepay2), cumNoi: Math.round(cumNoiLev), cumSalg: Math.round(cumSalgLev - cumRepay), cumProfit: Math.round(cumEqCF2), loanBal: Math.round(loanBal2), remain: Q.units - solgtLev2, refi: false, phase: "IO" });
    }
    levCumNoiExit = holdMode ? cumNoiLevAtExit2 : cumNoiLev;
    levSalgNet = holdMode ? exitValueHold - loanBalAtExit2 : cumSalgLev - cumRepay - loanBal2;
    totalRetLev = levCumNoiExit + levSalgNet - equityTotal;
    exitBrutto = holdMode ? exitValueHold : cumBrutto;
    exitMaegler = holdMode ? 0 : cumMaegler;
    exitRepay = holdMode ? loanBalAtExit2 : cumRepay + loanBal2;
    totalRetPctLev = equityTotal > 0 ? totalRetLev / equityTotal : 0;
    var pRetSafeLev1 = 1 + totalRetPctLev;
    cagrLev = Q.tyrs > 0 ? ((equityTotal > 0 && pRetSafeLev1 > 0) ? Math.pow(pRetSafeLev1, 1 / Q.tyrs) - 1 : -1) : totalRetPctLev;
    eqMultLev = equityTotal > 0 ? (holdMode ? (cumNoiLevAtExit2 + exitValueHold - loanBalAtExit2) / equityTotal : (cumNoiLev + cumSalgLev - cumRepay - loanBal2) / equityTotal) : 0;
    dscr = ydIO > 0 ? noi / ydIO : 99;
    cocReturn = equityTotal > 0 ? (noi - ydIO) / equityTotal : 0;
    eqInvested = equityTotal;
    loanBalExit = loanBalAtExit2;
  }

  // ── ØVRIGE NØGLETAL ──
  var equityMultiple = (totalSalg + cumNoiEff) / totalCapital;
  var profitPerUnit = totalReturn / Q.units;
  var profitPerSqm = totalReturn / AREA;
  var noiPerMdr = noi / 12;
  var residualValue = iv4 - totalCapital;
  var devMargin = totalReturn / totalCapital;
  var breakEvenRent = (dT + totalCapital * Q.capRate / 100) / (AREA * (1 - Q.tomgang / 100));
  var breakEvenSale = (totalCapital - cumNoi) / (AREA * (1 - Q.maeglerPct / 100));
  var capSpread = yoc - Q.capRate / 100;
  var landVal = landMode === "purchase" ? land : grundVaerdi;
  var landPct = landVal / totalCapital * 100;
  var buildPct = cIn / totalCapital * 100;

  // ── FEES ──
  var fees;
  var projSum = totalCapital; // projektsum = kontant byg + grund (købt eller apport)
  if (feeMode === "devAndFin") {
    var devYears = Q.projMdr / 12;
    var devFee = projSum * Q.devPctYr / 100 * devYears;
    var devMoms = devFee * 0.25;
    var devInkl = devFee + devMoms;
    var finFee = loanAmt * Q.finFeePct / 100; // momsfri
    fees = {
      mode: "devAndFin", projSum: projSum,
      devFee: devFee, devMoms: devMoms, devInkl: devInkl,
      devMdrInkl: Q.projMdr > 0 ? devInkl / Q.projMdr : 0,
      finFee: finFee, finMdr: Q.projMdr > 0 ? finFee / Q.projMdr : 0,
      totalFees: devInkl + finFee,
    };
  } else {
    var mgmtFee = projSum * Q.mgmtPct / 100;
    var mgmtMoms = mgmtFee * 0.25;
    var mgmtInkl = mgmtFee + mgmtMoms;
    // waterfall ved exit: ejeren står først i køen med pref-afkast, derefter carry af resten.
    // pref-basis: grundens netto-EK i apport-mode; i purchase-mode hele egenkapitalen.
    var prefBase = landMode === "apport" ? grundEK : equityTotal;
    var grundPref = prefBase * Q.prefPct / 100;
    var netto = Math.max(totalReturn, 0);
    var wfTier1 = Math.min(netto, grundPref);
    var wfRest = Math.max(netto - grundPref, 0);
    var carry = wfRest * Q.carryPct / 100;
    var ejerRest = wfRest - carry;
    fees = {
      mode: "mgmtPrefCarry", projSum: projSum,
      mgmtFee: mgmtFee, mgmtMoms: mgmtMoms, mgmtInkl: mgmtInkl,
      mgmtMdrInkl: Q.projMdr > 0 ? mgmtInkl / Q.projMdr : 0,
      prefBase: prefBase, grundPref: grundPref, netto: netto,
      wfTier1: wfTier1, wfRest: wfRest, carry: carry,
      ejerRest: ejerRest, ejerProfit: wfTier1 + ejerRest,
      totalFees: mgmtInkl + carry,
    };
  }

  // ── GRAF-DATA ──
  var waterfall = [
    { name: "Egenkapital", value: -equityTotal, fill: C_RD },
    { name: "Driftsresultat eft. renter", value: levCumNoiExit, fill: C_TL },
    { name: holdMode ? "Friværdi (urealiseret)" : "Salg eft. gældsindfrielse", value: levSalgNet, fill: C_GR },
    { name: "Profit", value: totalRetLev, fill: totalRetLev >= 0 ? C_GR : C_RD },
  ];
  var valueComp = [
    { name: "Kapitalindsats", value: Math.round(totalCapital) },
    { name: "Implied (cap)", value: Math.round(iv4) },
    { name: "Exit-værdi", value: Math.round(exitValue) },
  ];

  return {
    // struktur
    exitMode: exitMode, landMode: landMode, opexMode: opexMode, debtMode: debtMode, feeMode: feeMode,
    AREA: AREA, AU: AU,
    // grund
    tAf: tAf, land: land, grundVaerdi: grundVaerdi, grundGaeld: gg, grundEK: grundEK, advokatDD: advokatDD,
    // byg
    hw: hw, bp: bp, rd: rd, uf: uf, sub: sub, cEx: cEx, moms: moms, cIn: cIn, gebyr: gebyr,
    pI: pI, totalCapital: totalCapital,
    // drift
    bL: bL, tomKr: tomKr, effLeje: effLeje, dT: dT, gs: gs, fo: fo, ad: ad, ve: ve, di: di,
    noi: noi, yoc: yoc, bAf: bAf, iv4: iv4, noiPerMdr: noiPerMdr,
    // uleveraged
    cf: cf, totalSalg: totalSalg, cumNoi: cumNoiEff, totalReturn: totalReturn, totalReturnPct: totalReturnPct,
    cagr: cagr, equityMultiple: equityMultiple, exitValue: exitValue, exitValueHold: exitValueHold,
    // finansiering
    loanAmt: loanAmt, bankFeeKr: bankFeeKr, cashEquity: cashEquity, cashIndskud: cashIndskud,
    equityTotal: equityTotal, eqInvested: eqInvested, debt0: debt0, ydIO: ydIO,
    seniorAmt: seniorAmt, juniorAmt: juniorAmt, blendedRate: blendedRate,
    rkLoan: rkLoan, rkMaxLoan: rkMaxLoan, rkRefiGap: rkRefiGap, ydRkAnnuitet: ydRkAnnuitet, ydAnnuitet: ydAnnuitet,
    faser: faser,
    dscr: dscr, dscrRk: dscrRk, cocReturn: cocReturn,
    // leveraged
    cfLev: cfLev, totalRetLev: totalRetLev, totalRetPctLev: totalRetPctLev, cagrLev: cagrLev, eqMultLev: eqMultLev,
    levCumNoiExit: levCumNoiExit, levSalgNet: levSalgNet, loanBalExit: loanBalExit,
    exitBrutto: exitBrutto, exitMaegler: exitMaegler, exitRepay: exitRepay,
    cumDSLev: cumDSLev, cumNoiLev: cumNoiLev, cumRepay: cumRepay,
    // øvrige nøgletal
    profitPerUnit: profitPerUnit, profitPerSqm: profitPerSqm, residualValue: residualValue,
    devMargin: devMargin, breakEvenRent: breakEvenRent, breakEvenSale: breakEvenSale,
    capSpread: capSpread, landPct: landPct, buildPct: buildPct,
    // fees + grafer
    fees: fees, waterfall: waterfall, valueComp: valueComp, costPie: costPie, driftPie: driftPie,
  };
}
