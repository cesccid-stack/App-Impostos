# AGENTS.md — Índice maestro del proyecto (Hacienda · Control de la Renda)

> **LEE ESTE FICHERO ANTES DE EXPLORAR CÓDIGO.**
> Es el índice del repositorio para agentes de IA (Cline, Cursor, Copilot, Claude Code).
> Evita recorrer el árbol de ficheros y leer archivos completos: aquí está el mapa,
> las convenciones, los comandos, las rutas y el índice de símbolos. Ahorra contexto y tokens.
>
> Índices generados automáticamente (`npm run index`): **`docs/CODE_INDEX.md`** (módulos y
> mapa de secciones) y **`docs/SYMBOLS.md`** (símbolo → fichero). Búscalos, no los leas enteros.

## 0. Reglas de trabajo para el agente

Las reglas operativas completas (ahorro de contexto, estilo, validación) están en
**`.clinerules`**. Resumen:

1. **Lee `AGENTS.md` antes de explorar código.** No leas ficheros completos: usa
   `search_codebase` y `read_files` por rangos (`start_line`/`end_line`).
2. Para ficheros > 800 líneas usa el **mapa de secciones** (§8 y `docs/CODE_INDEX.md`).
3. Antes de terminar: `npm run typecheck` y `npm run lint` → **0 errores**; si tocas
   lógica fiscal, `npm test`.
4. Convenciones de código: §5. Textos de UI en **catalán**. Si añades o renombras
   módulos/exportaciones, ejecuta `npm run index`.

## 1. Qué es

SPA (aplicación web de una sola página) para **gestionar, simular y auditar** la
Declaració de la Renda (IRPF / Model 100 AEAT) y el resto de obligaciones fiscales,
patrimoniales y de inversión de un contribuyente (IVA, trimestrales, patrimonio,
sucesiones, cripto, Modelos 720/721, Veri\*Factu…).

- **Todo el estado vive en el navegador** (`localStorage` + `IndexedDB`). No hay backend
  ni envío de datos a terceros. Las únicas llamadas de red son `api.frankfurter.app`
  (tipos de cambio) y la Sede Electrónica del Cadastre.
- Aviso legal: es una herramienta de estimación; no sustituye al asesor profesional.

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript 5 (`strict`, `noUnusedLocals`, `noUnusedParameters`) |
| Bundler | Vite 6 |
| UI | Vanilla TS + DOM, router hash propio, sin framework |
| Estado | Store reactivo propio (`src/store.ts`) + `localStorage` |
| PDF / ZIP | `jspdf`, `jspdf-autotable`, `jszip` |
| Calidad | ESLint 9 (flat config) + Prettier |
| Tests | `scripts/verify-renta.ts` (bucle headless con `node --experimental-strip-types`) |

## 3. Arquitectura y flujo de datos

```
index.html
  └─ src/main.ts                 Bootstrap: registra las 31 rutas y monta el shell
       ├─ components/navbar.ts          Sidebar + selector multi-perfil + 4 temas
       ├─ components/command-palette.ts Cmd/Ctrl+K (navegación, caselles, perfiles…)
       ├─ components/live-tax-hud.ts    HUD flotante (Casella 0610 en vivo)
       └─ router.ts (hash) ──► pages/*.ts  (import() dinámico, code-splitting)
                                   │
                                   ├─ leen/escriben estado vía src/store.ts
                                   └─ calculan vía src/fiscal/*.ts  (motores PUROS)
                                             └─ usan utils/exact-math.ts y fiscal/constants.ts

src/store.ts (singleton)
  • DeclaracionData por (perfil, ejercicio) → localStorage (prefijo `hacienda_`)
  • Perfiles multi-declarante, módulos habilitados, tema, ejercicio
  • Persistencia con debounce + flush en `beforeunload`
  • Integra IVA ⇄ Actividades ⇄ Immobles (fiscal/iva-integration.ts)
```

**Regla de oro:** los motores de `src/fiscal/` son **funciones puras** (datos → resultado).
No tocan el DOM ni el store. Las páginas orquestan: leen del store, llaman al motor,
renderizan el DOM. Los tipos de dominio viven en `src/types*.ts`.

## 4. Mapa de archivos

> Los **símbolos exportados** por cada fichero no se listan aquí: están en
> `docs/SYMBOLS.md` (búscalos). Esta sección responde a «¿qué hace cada fichero?».

### 4.1 Raíz

| Fichero | Qué es |
|---|---|
| `index.html` | Shell HTML (monta `#app`) |
| `vite.config.ts` | Build + `manualChunks` (`vendor`, `vendor-zip`, `engine-reconciliation`) |
| `tsconfig.json` / `tsconfig.scripts.json` | TS estricto para `src/` y para `scripts/` |
| `eslint.config.js` | ESLint flat: `no-explicit-any` y `no-unused-vars` son **error** |
| `.prettierrc` | Prettier (comillas simples, `printWidth` 110, `trailingComma: all`) |
| `INICIAR_APP.bat` | Arranque en Windows (instala dependencias + abre navegador) |
| `scripts/verify-renta.ts` | Bucle de verificación fiscal end-to-end (headless) |
| `scripts/generate-index.ts` | Genera `docs/CODE_INDEX.md` + `docs/SYMBOLS.md` (`npm run index`) |

### 4.2 Núcleo `src/`

| Fichero | Responsabilidad |
|---|---|
| `main.ts` | Registro de rutas + bootstrap del shell |
| `router.ts` | Router hash con prefetch predictivo y cleanup al desmontar |
| `store.ts` | Estado reactivo singleton + persistencia + perfiles + IVA |
| `types.ts` | Tipos de dominio IRPF y contenedor `DeclaracionData` |
| `types-iva.ts` | Tipos IVA (303/390/349, prorrata, bienes de inversión) |
| `types-properties.ts` | Inmuebles en alquiler, inventario, amortización |
| `types-quarterly.ts` | Trimestrales 130/111/115/180/347 |
| `types-patrimonial.ts` | Patrimonio, sucesiones/donaciones, ITP |
| `types-crypto.ts` | Cripto/DeFi y Model 721 |
| `types-compliance.ts` | Veri\*Factu y libros oficiales |
| `types-portfolio.ts` | Importación masiva + FIFO |
| `types-ocr.ts` | Ingesta OCR |
| `types-strategy.ts` | Asesoramiento estratégico |

**API pública de `store` (métodos clave):**
`getData()`, `getSnapshot()`, `subscribe()`, `getYear()`/`setYear()`,
`getProfiles()`/`createProfile()`/`duplicateProfile()`/`deleteProfile()`/`updateProfile()`,
`getActiveProfile()`/`setActiveProfile()`/`getActiveProfileId()`,
`getTheme()`/`setTheme()`/`toggleTheme()`,
`getIVA()`/`updateIVA()`/`recalculateIVA()`/`addIssuedInvoice()`/`addReceivedInvoice()`,
`syncIVAFromActivities()`/`syncIVAFromProperties()`/`syncActivitiesFromIVA()`,
`getEnabledModules()`/`toggleModule()`/`setProfileModules()`/`applyModulePreset()`,
`loadDemoProfiles()`, `exportAll()`/`importData()`/`reset()`/`clearAllApplicationData()`.

### 4.3 Motores fiscales `src/fiscal/` (funciones puras · 46 módulos)

**Núcleo IRPF**

| Fichero | Qué hace |
|---|---|
| `irpf.ts` | Motor IRPF completo (bases, cuotas, 7.p, rentas irregulares, exenciones) |
| `constants.ts` | Tramos, mínimos, límites y % (2024–2026) |
| `deductions.ts` | Deducciones estatales/generales |
| `deductions-cat.ts` | Deducciones autonómicas de Catalunya |
| `autonomic-tax-scales.ts` | Escalas autonómicas de las 17 CCAA |
| `joint-taxation.ts` | Tributación conjunta vs individual |
| `loss-carryover-engine.ts` | Compensación de pérdidas y bolsa de 4 años |
| `declaration-factory.ts` | Declaración vacía |
| `year-end-optimizer.ts` | Tipos marginales + estrategias antes del 31/12 |

**IVA**

| Fichero | Qué hace |
|---|---|
| `iva-engine.ts` | Modelos 303/390/349, prorrata, bienes de inversión, riesgos |
| `iva-integration.ts` | Sincronización IVA ⇄ actividades/immobles/patrimonio |

**Trimestrales e informativos**

| Fichero | Qué hace |
|---|---|
| `model130-engine.ts` | Modelo 130 (pago fraccionado IRPF) |
| `model111-engine.ts` | Modelo 111 (retenciones trabajo/profesionales) |
| `model115-180-engine.ts` | Modelos 115 y 180 (retenciones alquiler) |
| `model347-engine.ts` | Modelo 347 (operaciones > 3.005,06 €) |
| `model720-engine.ts` | Modelos 720/721 (bienes y cripto en el extranjero) |

**Patrimonio y patrimoniales**

| Fichero | Qué hace |
|---|---|
| `wealth-tax-engine.ts` | Patrimonio (714) e ISGF (718) |
| `inheritance-tax-engine.ts` | Sucesiones/Donaciones (650/651) |
| `itp-plusvalia-engine.ts` | ITP/AJD y plusvalía municipal (600) |
| `tax-prescription-engine.ts` | Prescripción tributaria a 4 años (Art. 66-68 LGT) |

**Inversión, trading y cripto**

| Fichero | Qué hace |
|---|---|
| `trading-analytics.ts` | Métricas de trading por año/día/activo |
| `investment-cockpit-engine.ts` | Analítica cuantitativa, post-mortem, fricción fiscal |
| `backtest-engine.ts` | Backtest institucional, grid search, walk-forward |
| `monte-carlo-engine.ts` | Simulación estocástica Monte Carlo |
| `tax-loss-harvesting.ts` | Recolección de pérdidas fiscales latentes |
| `defi-tax-engine.ts` | FIFO cripto + DeFi (staking, airdrops) |

**Inmobiliario**

| Fichero | Qué hace |
|---|---|
| `real-estate-engine.ts` | Rendimiento de capital inmobiliario (Art. 23 y 85 LIRPF) |
| `real-estate-analytics-engine.ts` | Rentabilidad y proyección multianual de cartera |
| `real-estate-automator.ts` | Parseo de gastos, planes a 4 años, auditoría |
| `amortization-tables.ts` | Tabla de amortización simplificada AEAT |
| `vehicle-deduction-engine.ts` | Desacoplamiento IVA/IRPF de vehículos (Art. 95 LIVA / 22 RIRPF) |

**Optimización y planificación**

| Fichero | Qué hace |
|---|---|
| `advisor-engine.ts` | Auditoría de ahorro fiscal en tiempo real |
| `tax-explainer-engine.ts` | Explicación didáctica paso a paso de la declaración |
| `beckham-engine.ts` | Ley Beckham (Model 151) vs régimen ordinario |
| `autonomo-vs-sl-engine.ts` | Comparativa autónomo vs S.L. |
| `pensions-optimizer.ts` | Escenarios de rescate de plan de pensiones |
| `social-security-engine.ts` | Coste laboral y cotización RETA |
| `energy-efficiency-engine.ts` | Deducciones por eficiencia energética |

**Cumplimiento y auditoría**

| Fichero | Qué hace |
|---|---|
| `auto-validator.ts` | Validaciones automáticas + autofix en 1 clic |
| `audit-risk-radar.ts` | Radar de riesgo de inspección de la AEAT |
| `audit-dossier-generator.ts` | Dossier de defensa justificado por casilla |
| `professional-compliance-engine.ts` | Registro Veri\*Factu de facturas emitidas |
| `verifactu-engine.ts` | Hash encadenado e integridad de facturas |
| `model-reconciliation-engine.ts` | Conciliación/cuadre inter-modelo (150+ reglas) |
| `complementary-engine.ts` | Complementarias/rectificativas y recargos |
| `schema-validator.ts` | Saneado runtime al cargar datos |
| `form-validator.ts` | Validadores de formulario en vivo y límites legales |
| `ocr-ingestion-engine.ts` | Ingesta de documentos (simulada) |

**Catálogo y presets**

| Fichero | Qué hace |
|---|---|
| `modules-catalog.ts` | Catálogo de módulos/eines activables por declarante |
| `user-presets.ts` | Presets y datos demo por tipo de contribuyente |

### 4.4 Rutas y páginas `src/pages/`

Todas las rutas se declaran en `src/main.ts` (array `routes`). Cada página exporta una
función `renderXxx(): HTMLElement` y se carga con `import()` dinámico (code-splitting).

| Ruta (hash) | Sección | Página | Función de render |
|---|---|---|---|
| `/` | — | `dashboard.ts` | `renderDashboard` |
| `/usuaris` | Configuració | `users.ts` | `renderUsersPage` |
| `/caselles` | Fiscal | `caselles.ts` | `renderCasellesPage` |
| `/calendari` | Fiscal | `calendari.ts` | `renderCalendariPage` |
| `/iva` | Fiscal | `iva.ts` | `renderIVA` |
| `/trimestrals` | Fiscal | `quarterly-taxes.ts` | `renderQuarterlyTaxes` |
| `/projeccio` | Eines | `projeccio.ts` | `renderProjeccioPage` |
| `/trading` | Eines | `trading-analytics.ts` | `renderTradingAnalytics` |
| `/patrimoni` | Fiscal | `wealth-tax.ts` | `renderWealthTax` |
| `/model720` | Fiscal | `foreign-assets.ts` | `renderForeignAssets` |
| `/sucesiones` | Patrimonial | `inheritance-tax.ts` | `renderInheritanceTax` |
| `/itp-plusvalia` | Patrimonial | `real-estate-taxes.ts` | `renderRealEstateTaxes` |
| `/estratega` | Optimització | `strategic-advisor.ts` | `renderStrategicAdvisor` |
| `/cripto` | Patrimonial | `crypto-taxes.ts` | `renderCryptoTaxes` |
| `/ingesta` | Sistema | `document-ingestion.ts` | `renderDocumentIngestion` |
| `/compliance` | Sistema | `professional-compliance.ts` | `renderProfessionalCompliance` |
| `/conciliacio` | Fiscal & Normativa | `tax-reconciliation.ts` | `renderTaxReconciliation` |
| `/wizard` | Eines | `wizard.ts` | `renderWizard` |
| `/assessor` | Eines | `advisor.ts` | `renderAdvisor` |
| `/comparador` | Eines | `comparator.ts` | `renderComparator` |
| `/treball` | Ingressos | `work-income.ts` | `renderWorkIncome` |
| `/capital` | Ingressos | `capital.ts` | `renderCapital` |
| `/immobles` | Ingressos | `properties.ts` | `renderProperties` |
| `/activitats` | Ingressos | `activities.ts` | `renderActivities` |
| `/guanys` | Ingressos | `gains.ts` | `renderGains` |
| `/personal` | Fiscal | `personal.ts` | `renderPersonal` |
| `/deduccions` | Fiscal | `deductions.ts` | `renderDeductions` |
| `/resultat` | Fiscal | `result.ts` | `renderResult` |
| `/simulador` | Eines | `simulator.ts` | `renderSimulator` |
| `/importar` | Eines | `import.ts` | `renderImport` |
| `/exportar` | Eines | `export.ts` | `renderExport` |

### 4.5 Componentes reutilizables `src/components/`

| Fichero | Qué hace |
|---|---|
| `navbar.ts` | Sidebar + multi-perfil + 4 temas + Command Palette + overlay móvil |
| `command-palette.ts` | Paleta Cmd/Ctrl+K (navegación, caselles, perfiles, temas) |
| `table-builder.ts` | Tabla de datos eficiente (DocumentFragment + anti-XSS) |
| `form-field.ts` | Constructores de campos de formulario |
| `modal.ts` | Diálogo modal genérico |
| `toast.ts` | Notificaciones flotantes |
| `chart.ts` | Gráficos en canvas sin dependencias |
| `info-tooltip.ts` | Tooltip fiscal + glosario de conceptos |
| `live-tax-hud.ts` | HUD fiscal flotante (Casella 0610 en vivo) |
| `tax-journey-visualizer.ts` | Visualizador “El viatge dels teus impostos” |
| `internal-breakdown-dashboards.ts` | Cuadros de desglose interno de la liquidación |
| `real-estate-dashboard.ts` | Dashboard de rentabilidad inmobiliaria |
| `compliance-modal.ts` | Modal de diagnóstico y compliance |
| `tool-manager-modal.ts` | Modal de activación de herramientas a la carta |
| `invoice-document-modal.ts` | Modal del PDF original de una factura |

### 4.6 Ingesta de datos `src/import/`

| Fichero | Qué hace |
|---|---|
| `portfolio-automator.ts` | Hub universal de carteras (autodetección de formato de bróker) |
| `csv-utils.ts` | Parser CSV básico (soporta comillas) |
| `fifo-engine.ts` | Emparejamiento FIFO y ganancias patrimoniales (Art. 37.1.a LIRPF) |
| `parser-degiro.ts` | Parser de transacciones DEGIRO (CSV) |
| `parser-generic.ts` | Parser universal para IB, DEGIRO, Trade Republic, etc. |
| `currency-service.ts` | Tipos de cambio vía Frankfurter API (BCE) |

### 4.7 Utilidades `src/utils/`

| Fichero | Qué hace |
|---|---|
| `exact-math.ts` | **Aritmética decimal exacta** (obligatoria para dinero) |
| `math.ts` | Redondeos y aritmética segura (anti-NaN/Infinity) |
| `dom.ts` | Helpers DOM y saneado HTML (anti-XSS) |
| `currency.ts` | Formateo de moneda/números/porcentajes |
| `pdf-generator.ts` | PDF oficial del Model 100 |
| `export-csv.ts` | CSV del resultado fiscal |
| `aeat-export.ts` | Ficheros y anexos para carga en Renta Web |
| `iva-books-generator.ts` | Libros registro de IVA (Ordre HAC/773/2019) |
| `activity-books-generator.ts` | Libros registro de actividades económicas |
| `inspection-package-generator.ts` | ZIP del dossier de inspección |
| `document-vault.ts` | Bóveda de documentos en IndexedDB |
| `cadastre-service.ts` | Consulta a la Sede del Cadastre |

## 5. Convenciones de código (obligatorias)

- **TypeScript `strict`.** Prohibido `any` (error de lint). Prohibidas variables/imports
  sin usar (se permite prefijo `_` para descartes intencionados).
- **Dinero: siempre aritmética exacta.** Usa `utils/exact-math.ts`
  (`exactAdd`, `exactSub`, `exactMultiply`, `exactDivide`, `applyTaxBracketsExact`, `round2`).
  Nunca operes importes con `+ - * /` directos ni `toFixed` sobre flotantes.
  Para redondeos genéricos, `utils/math.ts`.
- **DOM:** construye con `document.createElement`. Nunca incrustes datos del usuario en
  `innerHTML` sin `escapeHtml` (anti-XSS). Tablas: usa `components/table-builder.ts`.
- **Persistencia:** escribe el estado **solo** vía `store` (`update`, setters de sección,
  `setYear`, `addIssuedInvoice`…). `store.getData()` devuelve una **referencia viva**: es
  de solo lectura, no la mutes. Para copias usa `getSnapshot()`.
- **Motores `src/fiscal/`:** funciones puras o clases con métodos estáticos. Sin DOM, sin
  store, sin efectos secundarios. Nombres de fichero en **kebab-case**.
- **Nueva página:** exporta `renderXxx(): HTMLElement`, regístrala en `src/main.ts`
  (array `routes`, con `load`/`render` lazy) y, si es una herramienta activable, añádela a
  `fiscal/modules-catalog.ts`.
- **Documentación:** bloque de cabecera `@module <nombre>` + descripción en cada fichero.
- **Formato:** Prettier (`printWidth` 110, comillas simples, `trailingComma: all`, 2 espacios).
- **Accesibilidad:** mantén `label`/`aria` en los formularios (hay comprobaciones en `npm test`).
- **No rompas `npm test`**: valida aritmética exacta y límites legales (Art. 49, 51, 52, 59,
  69.1, 81, 84 LIRPF; Art. 103-104 LIVA; STS 1130/2021 y STS 8/2024).

## 6. Comandos

```bash
npm install        # instala dependencias
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # type-check (tsc) + build de producción en dist/
npm run preview    # sirve el build de producción
npm run typecheck  # tsc --noEmit (src) + tsc --noEmit -p tsconfig.scripts.json  → 0 errores
npm run lint       # eslint .  → 0 errores (no-any, no-unused-vars)
npm run format     # prettier --write sobre src/ y scripts/
npm test           # bucle de verificación fiscal headless (scripts/verify-renta.ts)
npm run index      # regenera docs/CODE_INDEX.md (índice de símbolos)
```

> En Windows también existe `INICIAR_APP.bat` (instala dependencias la primera vez y abre el navegador).

## 7. Dónde está X (atajos no evidentes)

> El resto de módulos es identificable desde §4. Para un símbolo concreto,
> búscalo en `docs/SYMBOLS.md`.

| Necesito… | Ve a |
|---|---|
| Añadir o corregir una casilla AEAT | `pages/caselles.ts` |
| Añadir una ruta o página nueva | `src/main.ts` (§4.4) + `pages/<nueva>.ts` (`renderXxx`) |
| Activar/desactivar herramientas por perfil | `fiscal/modules-catalog.ts` |
| Sumar/restar importes con precisión | `utils/exact-math.ts` → `exactAdd` / `exactSub` |
| Exportar PDF / CSV / ZIP | `utils/pdf-generator.ts` · `utils/export-csv.ts` · `utils/inspection-package-generator.ts` |
| Parsear un CSV de bróker | `import/portfolio-automator.ts` · `import/parser-*.ts` |
| Estilos | `styles/index.css` · `styles/components.css` · `styles/pages.css` |

## 8. Ficheros grandes — leer por rangos, no completos

Estos ficheros superan las ~800 líneas. **No los leas enteros**: usa el
**mapa de secciones** generado en `docs/CODE_INDEX.md` (sección «Mapa de secciones»),
que da el número de línea de cada título de sección y de cada declaración de nivel
superior. Salta directo al rango con `read_files` (`start_line`/`end_line`) y, si hace
falta localizar algo dentro, usa `search_codebase`.

| Fichero | Líneas | Contenido |
|---|---|---|
| `fiscal/model-reconciliation-engine.ts` | 4584 | 150+ reglas `CROSS_CHECK_RULES` + `ModelReconciliationEngine` |
| `pages/properties.ts` | 2207 | Formulario de inmuebles, inventario, amortizaciones, cadastre |
| `pages/trading-analytics.ts` | 2073 | Dashboard de trading + laboratorio de backtest |
| `pages/iva.ts` | 2040 | Gestión de IVA (303/390/349, libros, prorrata) |
| `fiscal/auto-validator.ts` | 1673 | Comprobaciones automáticas de coherencia y autofix |
| `fiscal/backtest-engine.ts` | 1289 | Backtest institucional (grid search, walk-forward, estrés) |
| `pages/dashboard.ts` | 1239 | Panel global (IRPF, rendimientos, patrimonio, alertas) |
| `fiscal/investment-cockpit-engine.ts` | 1092 | Analítica cuantitativa, post-mortem, fricción fiscal |
| `pages/gains.ts` | 988 | Ganancias/pérdidas patrimoniales, cartera y brókers |
| `pages/users.ts` | 984 | Gestión de declarantes, perfiles y herramientas modulares |
| `src/store.ts` | 933 | Estado reactivo, persistencia, IVA, perfiles |
| `fiscal/real-estate-automator.ts` | 844 | Parseo de gastos, planes a 4 años, auditoría de inmuebles |

> El detalle exacto de líneas y secciones está en `docs/CODE_INDEX.md`.

## 9. Mantenimiento del índice

- **Índice de módulos:** `docs/CODE_INDEX.md` (`npm run index`): cada módulo con su
  descripción y sus exportaciones, más el **mapa de secciones** (`L<línea> · § título` /
  `L<línea> · fn nombre`) de los ficheros ≥ 800 líneas.
- **Índice de símbolos:** `docs/SYMBOLS.md` (mismo comando): `símbolo → fichero(s)`,
  en orden alfabético. Búscalo, no lo leas entero.
- **Regla:** si añades, renombras o eliminas un módulo o una exportación relevante,
  actualiza las tablas de la sección 4 y ejecuta `npm run index`.
- **Orden de lectura recomendado:** `AGENTS.md` → `docs/CODE_INDEX.md` o `docs/SYMBOLS.md`
  (búscalos) → fichero concreto, por rango de líneas.

---

*Índice mantenido manualmente + generado (sección 9). Última revisión: 2026-09-17.*
