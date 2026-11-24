# Nordwind – számlafeldolgozó és cash-flow kimutatás

Dockerben futó webalkalmazás: PDF számlák feltöltése, mezőkinyerés, MNB árfolyam, forintos kimutatás.

## Indítás

```bash
cp .env.example .env
# opcionális: OPENROUTER_API_KEY kitöltése (Phase 3+)

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
cp .env.example .env   # ha még nincs
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

### MNB árfolyam (Phase 4)

- Teljesítés napjának (vagy utolsó megelőző) MNB árfolyama SOAP-on (`http://www.mnb.hu/arfolyamok.asmx`).
- Cache: `exchange_rates` tábla — ugyanaz a nap/deviza nem megy újra a hálózatra.
- HUF: rate 1; kerekítés számlánként egész forintra (0,5↑).
- Lista: eredeti összeg + `amount_huf` + felhasznált árfolyam/dátum.

### Kimutatás (Phase 5)

- `GET /api/report` — havi sorozat (due date), partner mátrix (adószám), forintosított számlák.
- UI sorrend: diagram → cégenkénti tábla → számlalista (SQLite-ból, frissítés után is megmarad).

Részletes terv: `PLANNING.md`. AI napló: `AI_NAPLO.md`.
