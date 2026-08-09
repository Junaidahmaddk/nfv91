# case-template

GitHub Template-repo for Fairhomes' ejendoms-business-cases: et generisk,
spec-drevet dashboard (React + Vite + Recharts) i Fairhomes' designsprog —
mørk teal/creme/guld, dansk sprog, live sliders og scenarieberegninger.

Beregningsmotoren (`src/calcModel.js`) er ekstraheret fra LGV2628 og NFV111 og
dækker begge model-generationer via 5 kontakter i spec'en: `landMode`
(apport/purchase), `opexMode` (perSqm/itemised), `debtMode`
(singleIO/twoPhase), `exitModes` (sqm/cap/hold) og `feeMode`
(mgmtPrefCarry/devAndFin). Golden tests (`npm test`) beviser 1:1-paritet med
eksemplarernes originale formler.

## Sådan genereres en ny case

1. **GitHub → "Use this template"** → nyt offentligt repo med casens navn
   (fx `abc123`). Repo-navnet bliver URL-stien.
2. **Udfyld `src/case.spec.json`** — adresse, slug (= repo-navn), modelkontakter,
   defaults, sliders, thresholds og følsomhedskonfiguration. Ingen kode-ændringer.
3. **Udfyld `src/prosa.json`** — memo-, markeds-, risiko- og forbeholdstekster.
   Nye/ugennemgåede afsnit markeres `"udkast": true` og får automatisk en
   "UDKAST — IKKE GENNEMGÅET"-badge i UI'et.
4. **Læg billeder i `public/`** — `hero.png`, `visualisering-1..3.png`,
   `ortofoto.jpg`, `skraafoto-n/s/e/w.jpg`. Manglende filer skjules automatisk.
5. **Aktivér Pages på det nye repo** — Settings → Pages → Build and deployment
   → Source: **GitHub Actions**. Dette trin kan workflowet ikke selv klare (se
   nedenfor), og uden det fejler den første deploy.
6. **Verificér og push:** `npm ci && npm test && npm run build` → push til
   `main`. Workflowet i `.github/workflows/pages.yml` kører testene, bygger og
   deployer.

Deploy-URL: **`https://cases.fairhomes.io/<repo-navn>/`** — custom-domænet er
sat på user-sitet, så hvert repo serveres automatisk på sin understi.

### Pages skal aktiveres uden for workflowet

Det indbyggede `GITHUB_TOKEN` kan **ikke** oprette et Pages-site:
`POST /repos/{owner}/{repo}/pages` kræver både `Pages` (write) og
`Administration` (write), og `administration` findes ikke som nøgle i et
workflows `permissions:`-blok. Derfor er `enablement: true` bevidst fjernet fra
`configure-pages` — den kan kun fejle med
`Resource not accessible by integration`.

Aktivering sker ét af to steder:

- **manuelt** ved klik (trin 5 ovenfor), eller
- **automatisk** fra generatoren:
  `POST /repos/{owner}/{repo}/pages` med `{"build_type":"workflow"}` og et
  fine-grained PAT der har `Administration: write` + `Pages: write`.

Bemærk rækkefølgen: `POST /generate` udløser straks et push-run, altså **før**
Pages er aktiveret — det første run fejler derfor i `deploy`. Generatoren skal
aktivere Pages og derefter køre workflowet igen (`workflow_dispatch` eller et
nyt push med spec/prosa/billeder).

**Custom domain-feltet skal stå tomt** på case-repos. `cases.fairhomes.io` er
claimet af user-sitet og arves automatisk til `/<repo-navn>/`; skrives det ind
på et case-repo, afvises det som "custom domain being taken". Der skal heller
ikke ligge en `CNAME`-fil — ved Actions-deploy ignoreres den.

## Vigtigt at vide

- **Adgangskoden er diskretion, ikke sikkerhed.** Sæt `adgangskode` i spec'en,
  og dashboardet får en login-gate — men koden ligger i klartekst i det
  offentlige repo/bundle. Den holder tilfældige forbi, intet mere. Læg aldrig
  noget fortroligt i repoet i tillid til gaten (`index.html` har desuden
  `noindex`, så siderne ikke indekseres).
- **GDPR — sitet er offentligt, også fra et privat repo.** GitHub Pages-sider
  er offentligt tilgængelige på internettet, uanset om repoet er privat
  (adgangsstyret Pages findes kun på GitHub Enterprise Cloud). Alt der havner i
  `dist/` skal derfor behandles som offentliggjort materiale. Spec-schemaet har
  bevidst INGEN felter til ejernavne, ejerforhold eller forhandlings-/
  salgssignaler — og den slags må heller aldrig tilføjes i prosa, kode, commits
  eller filnavne.
- **Delt tilstand:** Slider-justeringer gemmes med 💾 Gem-knappen (Cmd/Ctrl+S)
  via det fælles endpoint `https://lgv2628.vercel.app/api/state?p=<slug>` og
  deles på tværs af enheder; localStorage bruges som fallback. Der deployes
  ingen egen serverfunktion pr. case.
- **Polering:** Agenter der forbedrer tekster/billeder skal følge kontrakten i
  `POLISH.md` — beregningsmotor, spec-tal, workflow og endpoints er fredet.

## Kommandoer

```bash
npm ci          # installer
npm run dev     # udviklingsserver (port 5180)
npm test        # golden tests (vitest)
npm run build   # produktion → dist/
npm run preview # lokal preview af dist/
```
