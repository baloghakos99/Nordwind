# Nordwind – számlafeldolgozó és cash-flow kimutatás

Dockerben futó webalkalmazás: PDF számlák feltöltése, mezőkinyerés, MNB árfolyam, forintos kimutatás.

## Indítás

```bash

docker compose up --build
```

Alkalmazás: **http://localhost:8080**

## Architektúra (Phase 1)

| Réteg | Tech |
|---|---|
| API | Node.js (TypeScript / `tsx`), Express |
| DB | SQLite (`better-sqlite3`), volume: `/data` |
| UI | Vite, React, TypeScript, Tailwind |
| Futtatás | egy konténer: API + built SPA |

```
backend/     Express + SQLite
frontend/    Vite React SPA
Dockerfile   multi-stage build
```

## Fejlesztés (lokális)

```bash
npm install
npm run dev
```

- UI: **http://localhost:5173** (Vite, `/api` → backend `:8080`)
- API: **http://localhost:8080**

Együtt fut a backend (`tsx --watch`) és a frontend (Vite) a gyökér `concurrently` scriptjével.

## Állapot

- [x] Phase 1 – skeleton
- [x] Phase 2 – bulk PDF upload
- [x] Phase 3 – extraction (rule-based + LLM fallback)
- [x] Phase 4 – MNB FX
- [x] Phase 5 – report UI

### Adatkinyerés (Phase 3)

1. **Szabályok** (elsődleges): PDF szöveg → címke-szótárak + dátum/összeg parser + Nordwind irány + validáció.
2. **LLM tartalék** (csak ha a validáció elbukik): OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`).
   - Már `done` számlát nem küldjük újra.
   - A listában látszik: *szabályok alapján* / *LLM tartalék*.
   - Párhuzamos feldolgozás: `LLM_CONCURRENCY` (alap 3) — egyszerre ennyi számla (rules/LLM/FX).
   - **LLM válasz ellenőrzése** (FELADAT):
     1. JSON parse + kötelező kulcsok (`assertLlmJsonShape`)
     2. normalizálás után ugyanaz a `validateExtraction` quality gate, mint a rulesnál
     3. forrásszöveg cross-check: számlaszám / pénznem / bruttó összeg megjelenik-e a PDF szövegben (`crossCheckLlmAgainstSource`)
     4. soft check: ha az LLM ad `line_item_amounts` (≥1 tétel), `sum(tételek) + vat_amount` ≈ `gross_amount` (tol: max 1 / 1%); `vat_amount` = külön ÁFA összesen, ha van; üres tömb → skip
     - Bármelyik fail → `error`, nem kerül a kimutatásba.

### MNB árfolyam (Phase 4)

- Teljesítés napjának (vagy utolsó megelőző) MNB árfolyama SOAP-on (`http://www.mnb.hu/arfolyamok.asmx`).
- Cache: `exchange_rates` tábla — ugyanaz a nap/deviza nem megy újra a hálózatra.
- HUF: rate 1; kerekítés számlánként egész forintra (0,5↑).
- Lista: eredeti összeg + `amount_huf` + felhasznált árfolyam/dátum.

### Kimutatás (Phase 5)

- `GET /api/report` — havi sorozat (due date), partner mátrix (adószám), forintosított számlák.
- UI sorrend: diagram → cégenkénti tábla → számlalista (SQLite-ból, frissítés után is megmarad).
- Hibás számla: lista alatt státusz + üzenet; **Újra** → `POST /api/invoices/:id/process` (kinyerés / FX újrafuttatás).

## Ismert korlátok

- Nincs OCR: csak szöveges PDF-ből nyerünk ki; szkennelt / kép alapú számla nem megy.
- Nincs rules-alapú tételsor-parse / UI tétellista; a sorösszeg↔végösszeg csak LLM soft check (`line_item_amounts` + opcionális `vat_amount`).
- A szabályalapú kinyerés sablon- / nyelvfüggő; teljesen új layoutnál gyakran LLM kell.
- Partner szűrés csak a kliens oldalon (nagy listánál tovább finomítható).

## Továbbfejlesztési ötletek

- Új, ismétlődő számlafajtánál: az LLM eredményből semi-automatikus rules-javaslat (label / dátum / parser), emberi jóváhagyással — a következő ugyanolyan layout már rules-szel megy, az OpenRouter költség csökken.
- OCR / image PDF támogatás.
- Confidence / „review” státusz: LLM sikerült, de soft check gyenge → manuális megerősítés, ne azonnal `error`.
- CSV / Excel export (partner mátrix, számlalista); diagram hónap-tartomány szűrő.
- Kimutatásoknál, szűrés időszakra

Részletes terv: `PLANNING.md`. AI napló: `AI_NAPLO.md`.
