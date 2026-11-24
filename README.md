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
| API | Node.js, Express |
| DB | SQLite (`better-sqlite3`), volume: `/data` |
| UI | Vite, React, Tailwind |
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

Együtt fut a backend (`node --watch`) és a frontend (Vite) a gyökér `concurrently` scriptjével.

## Állapot

- [x] Phase 1 – skeleton
- [x] Phase 2 – bulk PDF upload
- [x] Phase 3 – extraction (rule-based, no LLM)
- [ ] Phase 4 – MNB FX
- [ ] Phase 5 – report UI

### Adatkinyerés (Phase 3)

1. **Szabályok** (elsődleges): PDF szöveg → címke-szótárak + dátum/összeg parser + Nordwind irány + validáció.
2. **LLM tartalék** (csak ha a validáció elbukik): OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, default `google/gemini-2.5-flash`).
   - Már `done` számlát nem küldjük újra.
   - A listában látszik: *szabályok alapján* / *LLM tartalék*.
Részletes terv: `PLANNING.md`. AI napló: `AI_NAPLO.md`.
