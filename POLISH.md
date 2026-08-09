# POLISH.md — polerings-kontrakt for agenter

Denne fil er kontrakten for enhver agent (eller person), der polerer en case
genereret fra dette template. Læs den, FØR du ændrer noget.

## MÅ poleres

- **`src/prosa.json`** — alle tekster (memo, marked, forbehold, risici,
  tidslinje, ordforklaring). Sprog, flow og præcision må gerne forbedres.
  **MEN:** `"udkast": true`-flag må KUN fjernes efter eksplicit menneskelig
  godkendelse af det konkrete afsnit. Flaget styrer den gyldne
  "UDKAST — IKKE GENNEMGÅET"-badge i UI'et — den er der, netop fordi ingen
  har læst korrektur endnu.
- **Billeder i `public/`** — hero.png, visualisering-1..3.png, ortofoto.jpg,
  skraafoto-n/s/e/w.jpg. Manglende filer skjules automatisk i UI'et, så det er
  altid sikkert at tilføje/udskifte dem.
- **Mikrocopy i `src/App.jsx`** — labels, TabIntro-tekster, KPI-undertekster
  og lignende formuleringer. Ikke logik.

## FREDET — må IKKE ændres

- **`src/calcModel.js`** — hele beregningsmotoren. Golden tests i
  `src/calcModel.test.js` beviser 1:1-paritet med LGV2628/NFV111; enhver
  ændring her kræver menneskelig beslutning + opdaterede tests.
- **Tallene i `src/case.spec.json`** — defaults, slider-grænser, thresholds og
  modelkontakter er casens økonomiske forudsætninger. De ændres via
  dashboardets sliders (delt state), ikke i koden.
- **`.github/workflows/pages.yml`** — deploy-pipelinen.
- **`API_STATE`-endpointet i `src/App.jsx`**
  (`https://lgv2628.vercel.app/api/state` + `?p=<slug>`-mønstret) — delt
  state-lager på tværs af cases. Skift aldrig querynøglen, og brug aldrig
  `?k=bc` (den er LGV2628's private nøgle).
- **`<meta name="robots" content="noindex">` i `index.html`** — casene skal
  ikke indekseres af søgemaskiner.

## Verifikation — altid før merge

```bash
npm test        # alle golden tests skal være grønne
npm run build   # vite build skal lykkes
```

Derefter et kort Chromium-tjek af `dist/` (fx `npm run preview`): åbn alle
faner, træk et par sliders, tjek at Gem-knappen og grafer virker, og at
UDKAST-badges vises på ikke-godkendte afsnit.
