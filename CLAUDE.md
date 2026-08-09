# case-template — arbejdsregler for Claude

## Hvad repoet er

GitHub Template-repo for Fairhomes' ejendoms-business-cases: ét generisk,
spec-drevet dashboard (React + Vite + Recharts, dansk UI). En ny case = generér
repo fra templaten, udfyld `src/case.spec.json` + `src/prosa.json`, læg billeder
i `public/` — koden røres som udgangspunkt ikke. Deployes på GitHub Pages under
`https://cases.fairhomes.io/<repo-navn>/`.

## Kommandoer

```bash
npm ci          # installer (kræver package-lock.json — ligger i repoet)
npm test        # golden tests for beregningsmotoren (vitest)
npm run build   # produktion (vite build → dist/)
npm run dev     # udviklingsserver på port 5180
```

Verificér ALTID `npm test && npm run build` før merge — uanset ændringens
størrelse.

## Fredninger

Se **POLISH.md** for den fulde polerings-kontrakt. Kort version:

- `src/calcModel.js` er FREDET (golden tests beviser paritet med LGV2628/NFV111)
- tallene i `src/case.spec.json` er FREDET (casens økonomiske forudsætninger)
- `.github/workflows/pages.yml`, `API_STATE`-endpointet og `noindex`-metatagget
  er FREDET
- `"udkast": true`-flag i `src/prosa.json` fjernes KUN efter menneskelig
  godkendelse

## GDPR-regel (offentligt repo!)

Repoet er offentligt (krav for GitHub Pages). Derfor: **ALDRIG ejernavne,
ejerforhold, personhenvisninger eller forhandlings-/salgssignaler** i spec,
prosa, kode, commits eller filnavne. Spec-schemaet har bevidst INGEN felter til
den slags — tilføj dem ikke. Adgangskode-gaten er diskretion, ikke sikkerhed.

## Design-tokens

Mørk teal `#0F2626` (baggrund) · creme `#E8DCC4` (tekst) · guld `#D4C5A9`
(accenter) · teal `#367878` (interaktion) · Playfair Display (overskrifter) +
Inter (brødtekst) · dansk sprog og da-DK-talformat hele vejen. Alle tokens
ligger i `src/ui.jsx` — genbrug dem, opfind ikke nye farver.
