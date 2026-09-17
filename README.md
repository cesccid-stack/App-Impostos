# Hacienda — Control de la Declaració de la Renda

Aplicació web (SPA) per gestionar, simular i auditar la declaració de la renda (IRPF / Model 100 AEAT)
i la resta d'obligacions fiscals, patrimonials i d'inversió d'un contribuent.

> ⚠️ **Avís legal:** és una eina d'estimació i suport a la decisió. No substitueix l'assessorament
> d'un professional ni la presentació oficial davant de l'AEAT. Els càlculs es basen en la normativa
> vigent (2024–2026) i poden variar segons la comunitat autònoma i la casuística personal.

## ✨ Què inclou

- **IRPF (Model 100):** rendiments del treball, capital, activitats econòmiques, immobles en lloguer,
  guanys i pèrdues patrimonials (FIFO), bases, quotes, mínims personals i familiars.
- **IVA:** gestió de factures emeses/rebudes, Model 303 trimestral i resum anual Model 390/349.
- **Trimestrals:** Models 130, 111, 115, 347 i 180.
- **Patrimoni:** Impost sobre el Patrimoni (Model 714), ISGF (718) i blindatge Renda-Patrimoni.
- **Patrimonials:** Successions i Donacions (650), ITP i Plusvàlua Municipal (600), STC 182/2021.
- **Béns a l'estranger:** Models 720/721 i criptomonedes/DeFi.
- **Optimització:** Llei Beckham, autònom vs. societat (SL), plans de pensions, tax-loss harvesting,
  projecció multianual, Monte Carlo i backtesting de trading.
- **Compliment:** radar de risc, validador automàtic, VeriFactu, llibres oficials i dossier de defensa.
- **Exportació:** PDF Model 100, CSV, fitxers ZIP i còpies de seguretat.

## 🧱 Stack

| Capa | Tecnologia |
|------|-----------|
| Llenguatge | TypeScript 5 (mode `strict`) |
| Bundler | Vite 6 |
| UI | Vanilla TS + DOM, router per hash propi (sense framework) |
| Estat | Store reactiu propi amb persistència a `localStorage` |
| PDF / ZIP | `jspdf` + `jspdf-autotable`, `jszip` |
| Qualitat | ESLint (flat config) + Prettier |

## 🚀 Posada en marxa

Requisits: **Node.js 20+** (el bucle de verificació usa `--experimental-strip-types`).

```bash
npm install     # instal·la dependències
npm run dev     # servidor de desenvolupament a http://localhost:5173
```

A Windows també pots fer doble clic a **`INICIAR_APP.bat`**, que instal·la dependències (només el
primer cop) i obre el navegador automàticament.

## 📜 Scripts

| Script | Descripció |
|--------|-----------|
| `npm run dev` | Servidor de desenvolupament amb HMR |
| `npm run build` | Type-check (`tsc`) + build de producció a `dist/` |
| `npm run preview` | Serveix el build de producció localment |
| `npm test` | Bucle de verificació fiscal integral (headless) |
| `npm run typecheck` | Comprovació estricta de tipus de `src/` **i** `scripts/` |
| `npm run lint` | ESLint (0 `any`, 0 codi mort; qualsevol infracció falla) |
| `npm run format` | Prettier sobre `src/` i `scripts/` |
| `npm run index` | Regenera `docs/CODE_INDEX.md` i `docs/SYMBOLS.md` (índexs per a la IA) |

## 🔍 Rigor i qualitat

El projecte manté un estàndard estricte perquè és una eina fiscal:

- **`npm run typecheck`** comprova `src/` i `scripts/verify-renta.ts` amb `strict`, `noUnusedLocals`
  i `noUnusedParameters`. Ha de donar **0 errors**.
- **`npm run lint`** tracta `@typescript-eslint/no-explicit-any` i `no-unused-vars` com a
  **errors**: no es permet cap `any` ni cap variable/import sense fer servir.
- Les comprovacions fiscals del bucle `npm test` inclouen aritmètica decimal exacta, límits legals
  (Art. 49, 51, 52, 59, 69.1, 81, 84 LIRPF; Art. 103-104 LIVA; STS 1130/2021 i STS 8/2024) i
  blindatges d'accessibilitat dels formularis.

## 📁 Estructura

```
src/
├─ main.ts                 # Arrencada i registre de rutes
├─ router.ts               # Router hash-based amb prefetch predictiu
├─ store.ts                # Estat reactiu + persistència multi-perfil i multi-exercici
├─ types*.ts               # Tipus de domini (IRPF, IVA, patrimoni, cripto, …)
├─ components/             # Navbar, modals, gràfics, HUD fiscal en directe, palette de comandes
├─ fiscal/                 # Motors de càlcul (IRPF, IVA, patrimoni, trading, validació, …)
├─ import/                 # Ingesta CSV, FIFO, multi-divisa, parsers de bròkers
├─ pages/                  # Una pàgina per ruta (code-splitting per `import()` dinàmic)
└─ utils/                  # Aritmètica exacta, PDF/CSV, sanetització DOM, AEAT
scripts/
└─ verify-renta.ts         # Bucle de verificació end-to-end headless
docs/
├─ CODE_INDEX.md           # Índex generat de mòduls i mapa de seccions (npm run index)
└─ SYMBOLS.md              # Índex alfabètic símbol → fitxer (npm run index)
styles/                    # CSS (index, components, pages)
```

## 🤖 Context per a agents d'IA

Per tal de reduir el consum de context (i de tokens) quan treballa un agent de codi,
el projecte manté un índex navegable:

- **`AGENTS.md`** — índex mestre: arquitectura, mapa de fitxers, rutes, convencions,
  comandaments i guia «on és cada cosa». **Llegeix-lo abans d'explorar codi.**
- **`.clinerules`** — regles de treball de l'agent (lectura mínima, validacions obligatòries).
- **`docs/CODE_INDEX.md`** — generat amb `npm run index`: mòduls (descripció + exportacions)
  i mapa de seccions (número de línia de cada bloc) dels fitxers grans.
- **`docs/SYMBOLS.md`** — generat amb `npm run index`: índex alfabètic `símbol → fitxer`.

## 🔒 Privacitat

Totes les dades es guarden **únicament al navegador** (`localStorage`). No hi ha cap servidor ni
enviament de dades a tercers (les fonts de Google Fonts són l'única càrrega externa).
