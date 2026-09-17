# CODE_INDEX — Índice de módulos y mapa de secciones

> **Fichero generado automáticamente. No lo edites a mano: usa `npm run index`.**
> **Búscalo** (`search_codebase`) para localizar un módulo o una sección; **no lo leas entero.**
> Índice alfabético de símbolos: **`docs/SYMBOLS.md`**. Contexto y convenciones: **`AGENTS.md`**.

- Módulos indexados: **127**
- Símbolos exportados: **518**
- Líneas de código: **46548**

## Grupos

- `src (raíz)` — 13 módulos
- `src/components` — 15 módulos
- `src/fiscal` — 50 módulos
- `src/import` — 6 módulos
- `src/pages` — 31 módulos
- `src/utils` — 12 módulos

## src (raíz)

### `src/main.ts` · 347 líneas

Application bootstrap — registers routes, renders shell, starts router.

- *(sin exportaciones detectadas)*

### `src/router.ts` · 181 líneas

Minimal hash-based SPA router.

- **constantes:** `router`

### `src/store.ts` · 933 líneas

Reactive state management with localStorage persistence. Supports multiple fiscal years, multi-profile/multi-declarant and Dark/Light theme.

- **constantes:** `store`
- **reexportaciones:** `createEmptyDeclaracion`

### `src/types-compliance.ts` · 32 líneas

Data types for Professional Compliance (Veri*Factu, BOE Books, Certifications)

- **interfaces:** `VerifactuRecord`, `OfficialBook`, `ComplianceData`

### `src/types-crypto.ts` · 56 líneas

Data types for Crypto & DeFi taxes (FIFO, Staking, Mod 721)

- **interfaces:** `CryptoTransaction`, `CryptoCapitalGain`, `Model721Data`, `CryptoData`

### `src/types-iva.ts` · 287 líneas

Definició exhaustiva de tipus TypeScript per a la Gestió Integral de l'IVA (Llei 37/1992 i Ordre HAC/773/2019). Suporta autoliquidacions trimestrals (Model 303), resum anual (Mo…

- **interfaces:** `IVAInvoiceIssued`, `IVAInvoiceReceived`, `IVABienInversion`, `IVAProrrataConfig`, `Model303QuarterResult`, `ProrrataComparisonAudit`, `Model390AnnualSummary`, `Model349Entry`, `IVAIntegrationSummary`, `IVAData`
- **tipos:** `IVARate`, `RecargoEquivalenciaRate`, `WithholdingRate`, `FiscalQuarter`, `IssuedInvoiceCategory`, `ReceivedInvoiceCategory`

### `src/types-ocr.ts` · 24 líneas

Tipus per a l'ingesta intel·ligent (OCR i Data Entry)

- **interfaces:** `OCRDocument`, `IngestionBatch`

### `src/types-patrimonial.ts` · 112 líneas

Tipus per a la Tributació Patrimonial: Sucesiones (650), Donaciones (651), ITP/AJD (600), Plusvalía y Grandes Fortunas (718)

- **interfaces:** `InheritanceDonationData`, `ITPAndAJDData`, `MunicipalPlusvaliaData`, `WealthSolidarityTaxData`, `PatrimonialTaxesData`
- **tipos:** `AutonomousCommunity`, `KinshipGroup`

### `src/types-portfolio.ts` · 79 líneas

TypeScript interfaces for the mass import and FIFO engine with full AEAT compliance.

- **interfaces:** `TradeRecord`, `FIFOLot`, `FIFOMatch`, `AssetSummary`

### `src/types-properties.ts` · 202 líneas

Interfaces for individual rental real estate management, asset inventories, mixed usage and amortization. Conforme amb l'Art. 23 & 85 LIRPF, Taula Simplificada AEAT i la Llei 12…

- **interfaces:** `PropertyInventoryItem`, `PropertyImprovement`, `FurnitureItem`, `RentalProperty`, `InventoryAmortizationBreakdown`, `PropertyFinancialMetrics`, `PropertyFiscalResult`
- **tipos:** `AssetDisposalReason`, `RentalReductionType`

### `src/types-quarterly.ts` · 160 líneas

Definició de tipus per als models fiscals trimestrals i anuals associats: 130/131 (Pagos fraccionados IRPF) 111/190 (Retencions treball i professionals) 115/180 (Retencions llog…

- **interfaces:** `Model130Quarterly`, `Model111Quarterly`, `Model115Quarterly`, `Model115LeaseInput`, `Model180PerceptorItem`, `Model180Annual`, `Model347Entity`, `Model347Yearly`, `QuarterlyTaxesData`
- **tipos:** `FiscalQuarter`

### `src/types-strategy.ts` · 56 líneas

Data types for Strategic Advising (Autónomo vs SL, Pension Rescue Optimization)

- **interfaces:** `AutonomoVsSLData`, `PensionRescueData`, `StrategicAdvisingData`

### `src/types.ts` · 430 líneas

Core TypeScript interfaces for the Declaració de la Renda application.

- **interfaces:** `UserProfile`, `PriorLossItem`, `ComplementaryIRPFData`, `DeclaracionData`, `LossCarryoversData`, `PersonalData`, `Descendant`, `Ascendant`, `EmployerItem`, `WorkIncomeData`, `CapitalIncomeData`, `ActivitiesData`, `GainsData`, `GainItem`, `DeductionsData`, `DonationItem`, `FiscalResult`, `Route`
- **tipos:** `UserType`, `ProfileStatus`, `IRPFComplementaryReason`, `AppTheme`, `StoreListener`
- **reexportaciones:** `RentalProperty`

## src/components

### `src/components/chart.ts` · 236 líneas

Canvas-based chart components (no external dependencies).

- **funciones:** `createDonutChart`, `createBarChart`, `createStackedBar`
- **interfaces:** `ChartDataItem`

### `src/components/command-palette.ts` · 547 líneas

Modern Command Palette (Cmd+K / Ctrl+K) for instant navigation, AEAT Caselles lookup, profile switching, theme switching, modular tools configuration and quick fiscal tools.

- **funciones:** `openCommandPalette`, `closeCommandPalette`, `initCommandPaletteShortcut`
- **interfaces:** `CommandItem`

### `src/components/compliance-modal.ts` · 158 líneas

Modal interactiu de Diagnòstic i Comprovacions Automàtiques de Conformitat Fiscal. Mostra l'auditoria en temps real i permet corregir inconsistències en 1 clic.

- **funciones:** `openComplianceModal`

### `src/components/form-field.ts` · 166 líneas

Form input builder utilities.

- **funciones:** `createField`, `createToggle`, `createFormSection`, `createFormRow`
- **interfaces:** `FieldConfig`

### `src/components/info-tooltip.ts` · 129 líneas

Micro-component d'explicació fiscal interactiva i ajuda contextual (Smart Tax Tooltip). Permet a qualsevol usuari entendre instantàniament conceptes tributaris avançats sense ab…

- **funciones:** `createInfoTooltip`
- **constantes:** `TAX_GLOSSARY`
- **interfaces:** `TaxConceptInfo`

### `src/components/internal-breakdown-dashboards.ts` · 445 líneas

Quadres Interns de Desglossament Avançat & Matrius de Liquidació Específica. Proporciona transparència total i precisió matemàtica per a cada bloc de la declaració: 1. Quadre d'…

- **funciones:** `createInternalBreakdownDashboards`

### `src/components/invoice-document-modal.ts` · 236 líneas

Modal interactiu per visualitzar, adjuntar, descarregar i gestionar el PDF original d'una factura amb la nomenclatura oficial normalitzada per a la inspecció de l'AEAT.

- **funciones:** `openInvoiceDocumentModal`

### `src/components/live-tax-hud.ts` · 100 líneas

Mini Liquidator Flotant & HUD Tributari en Temps Real. Mostra permanentment el resultat de la Casella 0610 (a ingressar / tornar), el tipus efectiu i la salut fiscal, actualitza…

- **funciones:** `createLiveTaxHUD`

### `src/components/modal.ts` · 70 líneas

Modal dialog component.

- **funciones:** `openModal`
- **interfaces:** `ModalOptions`

### `src/components/navbar.ts` · 343 líneas

Sidebar navigation component with multi-profile selector, modular tools activator, Command Palette (Cmd+K) and 4-theme toggle.

- **funciones:** `createSidebar`, `createMobileHeader`, `createMobileOverlay`

### `src/components/real-estate-dashboard.ts` · 406 líneas

Quadre de Comandament Integral de Rendibilitat, Tendència i Anàlisi per Explotació Immobiliària. Permet visualitzar la rendibilitat global de la cartera i fer zoom detallat a ca…

- **funciones:** `createRealEstateDashboard`

### `src/components/table-builder.ts` · 164 líneas

High-performance, memory-efficient reusable data table builder. Features: - Single DocumentFragment batch DOM insertion. - Automatic XSS protection with escapeHtml. - Delegated …

- **funciones:** `buildTable`
- **interfaces:** `TableColumn`, `TableAction`, `TableConfig`

### `src/components/tax-journey-visualizer.ts` · 426 líneas

Component visual avançat: El Viatge dels teus Impostos & Explicador Didàctic Integral. Desglossa qualsevol declaració de renda (per complexa que sigui) en una experiència visual…

- **funciones:** `createTaxJourneyVisualizer`

### `src/components/toast.ts` · 65 líneas

Módulo `src/components/toast.ts`.

- **funciones:** `showToast`

### `src/components/tool-manager-modal.ts` · 357 líneas

Modal interactiu per a la configuració i activació d'eines a la carta (Workspace Customizer). Permet a qualsevol declarant triar exactament quines eines vol veure i utilitzar.

- **funciones:** `openToolManagerModal`

## src/fiscal

### `src/fiscal/advisor-engine.ts` · 225 líneas

Assistent d'Estalvi i Planificació Fiscal (Fiscal Advisor). Audita la declaració i calcula oportunitats d'optimització fiscal en temps real, incloent Tax-Loss Harvesting, Impost…

- **funciones:** `auditTaxReturn`
- **interfaces:** `FiscalAdviceItem`, `FiscalAdvisorAudit`

### `src/fiscal/amortization-tables.ts` · 335 líneas

Taula d'amortització simplificada de l'Agència Tributària (AEAT) Conforme a l'Ordre de 27 de març de 1998, Art. 23.1.b LIRPF i Criteris DGT. Optimitza el coeficient màxim lineal…

- **funciones:** `getAEATAssetGroup`, `suggestAEATCategory`, `calculateItemAnnualAmortization`
- **constantes:** `AEAT_SIMPLIFIED_TABLE`
- **interfaces:** `AEATAssetGroupDefinition`
- **tipos:** `AEATAssetGroupId`

### `src/fiscal/audit-dossier-generator.ts` · 279 líneas

Generador de Dossier de Defensa Tributària i Justificació davant Requeriments de l'AEAT. Normativa aplicable: - Llei 58/2003 General Tributària (Art. 34 - Drets i garanties dels…

- **funciones:** `generateTaxDefenseDossier`
- **interfaces:** `AuditBoxJustification`, `TaxDefenseDossier`

### `src/fiscal/audit-risk-radar.ts` · 167 líneas

Radar de Risc d'Inspecció i Requeriments de l'AEAT (Audit Risk Radar). Avalua la declaració abans de presentar-la i identifica patrons que disparen comprovacions tributàries.

- **funciones:** `evaluateAuditRisk`
- **interfaces:** `AuditRiskAlert`, `AuditRiskReport`

### `src/fiscal/auto-validator.ts` · 1673 líneas

Motor Centralitzat de Comprovacions i Validacions Fiscals Automàtiques en Temps Real. Audita contínuament i de forma exhaustiva la coherència comptable i legal entre: 1. Mòdul d…

- **funciones:** `isValidSpanishTaxId`, `isValidCadastralReference`, `runAutomatedComplianceChecks`, `executeAutoFix`
- **interfaces:** `ValidationIssue`, `ValidationReport`
- **tipos:** `ValidationSeverity`

### `src/fiscal/autonomic-tax-scales.ts` · 294 líneas

Escales de Gravamen Autonòmiques de l'IRPF per a les 17 Comunitats Autònomes. Normativa: Art. 74 i Art. 77 de la Llei 35/2006 de l'IRPF. Cada Comunitat Autònoma té competència n…

- **funciones:** `getAutonomicBrackets`
- **constantes:** `MADRID_GENERAL_TAX_BRACKETS`, `ANDALUCIA_GENERAL_TAX_BRACKETS`, `VALENCIA_GENERAL_TAX_BRACKETS`, `GALICIA_GENERAL_TAX_BRACKETS`, `CATALUNYA_GENERAL_TAX_BRACKETS`, `DEFAULT_AUTONOMIC_BRACKETS`, `AUTONOMIC_COMMUNITIES_REGISTRY`
- **interfaces:** `AutonomicCommunityInfo`
- **tipos:** `SpanishAutonomousCommunity`

### `src/fiscal/autonomo-vs-sl-engine.ts` · 84 líneas

Càlcul bàsic per comparar la càrrega tributària d'un autònom vs S.L.

- **clases:** `AutonomoVsSLEngine`

### `src/fiscal/backtest-engine.ts` · 1289 líneas

Motor Institucional de Backtesting, Optimització Paramètrica (Grid Search), Validació Walk-Forward (In-Sample vs Out-of-Sample) i Anàlisi Estadístic Professional (SQN, K-Ratio, …

- **funciones:** `runInstitutionalBacktest`
- **constantes:** `BACKTEST_PRESETS`, `DEFAULT_BACKTEST_PARAMETERS`
- **interfaces:** `BacktestParameters`, `BacktestTradeResult`, `SensitivityMatrixCell`, `MonthlyReturnRow`, `AssetClassBacktestPerformance`, `RMultipleBucket`, `StressTestScenario`, `RollingMetricPoint`, `KellyCurvePoint`, `BacktestReport`
- **tipos:** `BacktestStrategyType`, `PositionSizingModel`

### `src/fiscal/beckham-engine.ts` · 86 líneas

Simulador comparatiu del Règim Especial de Treballadors Desplaçats (Llei Beckham / Art. 93 LIRPF - Model 151) vs Règim Ordinari d'IRPF (Model 100).

- **funciones:** `compareBeckhamRegime`
- **interfaces:** `BeckhamComparisonResult`

### `src/fiscal/complementary-engine.ts` · 248 líneas

Motor fiscal especialitzat per a Declaracions Complementàries i Autoliquidacions Rectificatives (Art. 120-122 LGT, Art. 14 LIRPF, Art. 70-71 Model 303). Inclou càlcul automàtic …

- **funciones:** `calculateExtemporaneousSurcharge`, `calculateComplementaryIRPF`, `calculateComplementaryIVAQuarter`
- **interfaces:** `ExtemporaneousSurchargeResult`, `ComplementaryIRPFCalculationResult`, `ComplementaryIVAQuarterCalculationResult`

### `src/fiscal/constants.ts` · 234 líneas

Tax brackets, limits, and percentages for Spanish IRPF and Autonomous Community of Catalonia. Based on current 2024/2025/2026 fiscal year regulations.

- **constantes:** `STATE_GENERAL_TAX_BRACKETS`, `CATALAN_GENERAL_TAX_BRACKETS`, `STATE_SAVINGS_TAX_BRACKETS`, `AUTONOMIC_SAVINGS_TAX_BRACKETS`, `PERSONAL_MINIMUM`, `PERSONAL_MINIMUM_OVER_65`, `PERSONAL_MINIMUM_OVER_75`, `DESCENDANT_MINIMUMS`, `DESCENDANT_UNDER_3_EXTRA`, `ASCENDANT_MINIMUM_OVER_65`, `ASCENDANT_MINIMUM_OVER_75_EXTRA`, `DISABILITY_MINIMUM_33`, `DISABILITY_MINIMUM_65`, `DISABILITY_ASSISTANCE_EXTRA`, `DISABILITY_MINIMUM_65_MOBILITY`, `WORK_OTHER_EXPENSES`, `WORK_REDUCTION_THRESHOLD_LOW`, `WORK_REDUCTION_THRESHOLD_HIGH`, `WORK_REDUCTION_MAX`, `WORK_REDUCTION_COEFFICIENT`, `WORK_REDUCTION_OTHER_RENTS_LIMIT`, `WORK_REDUCTION_DISABILITY_EXTRA`, `WORK_REDUCTION_DISABILITY_EXTRA_ENHANCED`, `PENSION_PLAN_LIMIT`, `PENSION_PLAN_COMPANY_LIMIT`, `JOINT_TAXATION_REDUCTION_MATRIMONY`, `JOINT_TAXATION_REDUCTION_SINGLE_PARENT`, `HOUSING_DEDUCTION_RATE`, `HOUSING_DEDUCTION_MAX_BASE`, `DONATION_FIRST_TIER`, `DONATION_FIRST_TIER_RATE`, `DONATION_REST_RATE`, `DONATION_REST_RECURRING_RATE`, `DONATION_PUBLIC_UTILITY_RATE`, `DONATION_POLITICAL_PARTY_RATE`, `DONATION_POLITICAL_PARTY_MAX_BASE`, `DONATION_CAPPED_BASE_LIMIT_RATE`, `MATERNITY_DEDUCTION_PER_MONTH`, `MATERNITY_DEDUCTION_MAX`, `MATERNITY_NURSERY_MAX`, `CAT_RENTAL_RATE`, `CAT_RENTAL_LIMIT_GENERAL`, `CAT_RENTAL_LIMIT_SPECIAL`, `CAT_RENTAL_INCOME_LIMIT_INDIVIDUAL`, `CAT_RENTAL_INCOME_LIMIT_SPECIAL`, `CAT_BIRTH_INDIVIDUAL`, `CAT_BIRTH_SPECIAL`, `CAT_STARTUP_GENERAL_RATE`, `CAT_STARTUP_GENERAL_MAX`, `CAT_STARTUP_RESEARCH_RATE`, `CAT_STARTUP_RESEARCH_MAX`, `CAT_WIDOWHOOD_GENERAL`, `CAT_WIDOWHOOD_WITH_DEPENDENTS`, `CAT_LANGUAGE_DONATION_RATE`, `CAT_BIOMEDICAL_DONATION_RATE`, `CAT_HOME_REHAB_RATE`, `CAT_HOME_REHAB_MAX_BASE`, `IMPUTED_INCOME_RATE_GENERAL`, `IMPUTED_INCOME_RATE_REVISED`, `SIMPLIFIED_EXPENSES_RATE`, `SIMPLIFIED_EXPENSES_MAX`, `AUTONOMOUS_COMMUNITIES`, `COMMUNITY_NAME_MAP`, `FISCAL_YEARS`
- **interfaces:** `TaxBracket`
- **tipos:** `FiscalYear`

### `src/fiscal/declaration-factory.ts` · 120 líneas

Factory for creating fresh, empty DeclaracionData instances.

- **funciones:** `createEmptyDeclaracion`

### `src/fiscal/deductions-cat.ts` · 118 líneas

Deduccions autonòmiques específiques de Catalunya (IRPF 2024-2026). Conforme al Text Refós de la Llei de Taxes i Preus Públics de la Generalitat de Catalunya i la normativa regu…

- **funciones:** `computeCatalanDeductions`

### `src/fiscal/deductions.ts` · 178 líneas

Computes applicable state and general tax deductions for the IRPF declaration.

- **funciones:** `computeDeductions`
- **interfaces:** `DeductionAmounts`

### `src/fiscal/defi-tax-engine.ts` · 147 líneas

Processa un llistat de transaccions per calcular Guanys Patrimonials via FIFO i ingressos de DeFi (Staking, Airdrops).

- **clases:** `DefiTaxEngine`

### `src/fiscal/energy-efficiency-engine.ts` · 95 líneas

Càlcul de les Deduccions Estatals per Obres de Millora de l'Eficiència Energètica en Habitatges Habituals o Llogats (Disposició addicional 50a de la LIRPF / RDL 19/2021).

- **funciones:** `calculateEnergyEfficiencyDeduction`
- **interfaces:** `EnergyEfficiencyWorkItem`, `EnergyEfficiencyResult`
- **tipos:** `EnergyEfficiencyType`

### `src/fiscal/form-validator.ts` · 133 líneas

Pure, high-performance real-time form validators and legal limit checkers. Provides immediate contextual warnings and suggestions for IRPF declarations.

- **funciones:** `validatePensionContributions`, `validateForeignWorkExemption`, `validateIrregularIncome`, `validateMileageRate`
- **interfaces:** `ValidationFeedback`

### `src/fiscal/inheritance-tax-engine.ts` · 95 líneas

Càlcul complet del Model 650 (Successions) / 651 (Donacions)

- **clases:** `InheritanceTaxEngine`

### `src/fiscal/investment-cockpit-engine.ts` · 1092 líneas

Motor Avançat d'Analítica Quantitativa, Diagnòstic de Tècniques Operatives, Avaluació de Biaixos Cognitius (Post-Mortem), Fricció Fiscal (Tax Drag), Criteri de Kelly, Anàlisi pe…

- **funciones:** `classifyAssetType`, `determineHoldingStyle`, `inferTradeSetup`, `inferEmotionTag`, `calculateSavingsTaxEUR`, `analyzeInvestmentCockpit`
- **interfaces:** `InvestmentCockpitOptions`, `EnrichedTradeItem`, `AssetClassAnalytics`, `StyleAnalytics`, `SetupAnalytics`, `ExecutionGradeAnalytics`, `DailyPnLEntry`, `DayOfWeekEntry`, `RiskManagementMetrics`, `PostMortemDiagnosis`, `WhatIfSimulationResult`, `MultiYearEvolutionItem`, `InvestmentCockpitReport`
- **tipos:** `InvestmentAssetClass`, `TradingHoldingStyle`

### `src/fiscal/irpf.ts` · 569 líneas

IRPF tax calculation engine. Computes the full tax result from a DeclaracionData, including 7.p, irregular income, capital gains exemptions, 25% cross-compensation, and 4-year l…

- **funciones:** `applyBrackets`, `effectiveRate`, `calculateIRPF`

### `src/fiscal/itp-plusvalia-engine.ts` · 90 líneas

Càlcul del Model 600 (ITP i AJD)

- **clases:** `ITPAndAJDEngine`

### `src/fiscal/iva-engine.ts` · 639 líneas

Motor fiscal especialitzat per al càlcul de l'IVA (Llei 37/1992 i Reglaments de Facturació i Gestió Tributària). Inclou: - Càlcul precís de les caselles oficials del Model 303 (…

- **funciones:** `calculateProrrataPercentage`, `calculateBienInversionAnnualRegularization`, `calculateModel303Quarter`, `calculateAllQuarters`, `computeAutoProrrataFromInvoices`, `calculateModel390Annual`, `calculateProrrataComparison`, `extractModel349Entries`, `auditIVARisks`
- **constantes:** `QUARTERS`, `IVA_FILING_DEADLINES`

### `src/fiscal/iva-integration.ts` · 411 líneas

Motor d'Integració i Sincronització Bidireccional de l'IVA amb: 1. Activitats Econòmiques (Autònoms en Estimació Directa / IRPF). 2. Gestió d'Immobles Arrendats (Arrendaments Co…

- **funciones:** `syncActivitiesToIVA`, `syncIVAToActivities`, `syncPropertiesToIVA`, `syncWealthToIVA`, `initializeEmptyIVAData`

### `src/fiscal/joint-taxation.ts` · 201 líneas

Motor de càlcul de Tributació Conjunta i Comparador Individual vs Conjunta (Art. 82-84 LIRPF).

- **funciones:** `combineDeclarationsForJoint`, `compareIndividualVsJoint`
- **interfaces:** `JointComparisonResult`

### `src/fiscal/loss-carryover-engine.ts` · 178 líneas

Motor de compensació de pèrdues patrimonials, rendiments mobiliaris negatius i bossa de 4 anys (Art. 48 & 49 LIRPF).

- **funciones:** `calculateSavingsCompensation`
- **interfaces:** `SavingsCompensationResult`

### `src/fiscal/model-reconciliation-engine.ts` · 4584 líneas

Motor de Conciliació i Cuadre Tributari Inter-Model Integral (AEAT / ATC / TGSS / Notariat / Bancs / Plataformes / Veri*Factu / Model 184 / Cadastre / CMAC / ICAA / ICAEN / Regi…

- **clases:** `ModelReconciliationEngine`
- **constantes:** `CROSS_CHECK_RULES`
- **interfaces:** `ModelDiscrepancy`, `ReconciliationReport`, `RuleEvaluationResult`, `CrossCheckRule`
- **tipos:** `DiscrepancyCategory`

### `src/fiscal/model111-engine.ts` · 56 líneas

Càlcul del Model 111 Trimestral. Agrupa les percepcions i retencions de treballadors i professionals.

- **clases:** `WithholdingsEngine`

### `src/fiscal/model115-180-engine.ts` · 267 líneas

Motor de Càlcul, Validació i Conciliació dels Models 115 i 180 de l'AEAT. Normativa: - Art. 75.2.a i Art. 100 del Reglament de l'IRPF (RD 439/2007). - Art. 58 a 62 del Reglament…

- **clases:** `Model115And180Engine`
- **constantes:** `LEASE_WITHHOLDING_RATE`, `LEASE_EXEMPTION_ANNUAL_THRESHOLD`
- **interfaces:** `LeaseObligationAudit`, `Model115vs180Reconciliation`

### `src/fiscal/model130-engine.ts` · 82 líneas

Càlcul del Model 130 per al trimestre indicat. Suposem una simplificació on s'arrosseguen els imports.

- **clases:** `Model130Engine`

### `src/fiscal/model347-engine.ts` · 92 líneas

Identifica les operacions amb terceres persones superiors a 3005.06€ a partir dels llibres de factures emeses i rebudes.

- **clases:** `Model347Engine`

### `src/fiscal/model720-engine.ts` · 128 líneas

Motor de verificació d'obligació de declarar els Models 720 i 721 de l'AEAT (Declaració informativa sobre béns, valors i criptoactius a l'estranger).

- **funciones:** `auditForeignAssetsObligation`
- **interfaces:** `ForeignAccountItem`, `ForeignSecurityItem`, `ForeignRealEstateItem`, `ForeignCryptoItem`, `ForeignAssetsData`, `Model720AuditResult`

### `src/fiscal/modules-catalog.ts` · 417 líneas

Catàleg centralitzat de mòduls i eines de l'aplicació. Permet a qualsevol declarant activar o desactivar eines a la carta segons les seves necessitats.

- **funciones:** `getActiveModuleIdsForProfile`, `isModuleActive`, `getModuleByPath`, `getModuleById`
- **constantes:** `ALL_APP_MODULES`, `MODULE_PRESETS`
- **interfaces:** `AppModuleItem`, `ModulePreset`
- **tipos:** `ModuleCategory`

### `src/fiscal/monte-carlo-engine.ts` · 153 líneas

Motor de simulació estocàstica de Monte Carlo (1.000 iteracions) per a projeccions de trading i gestió de patrimoni.

- **funciones:** `runMonteCarloSimulation`
- **interfaces:** `MonteCarloPercentilePoint`, `MonteCarloSimulationResult`

### `src/fiscal/ocr-ingestion-engine.ts` · 93 líneas

Simula el processament de documents (PDFs de factures, nòmines, etc) Extreu metadades simulades amb nivells de confiança i detecta duplicats.

- **clases:** `OCRIngestionEngine`

### `src/fiscal/pensions-optimizer.ts` · 95 líneas

Genera escenaris òptims de rescat d'un pla de pensions.

- **clases:** `PensionsOptimizerEngine`

### `src/fiscal/professional-compliance-engine.ts` · 80 líneas

Genera el registre Veri*Factu per a una factura emesa. Simula la generació del Hash Encadenat (blockchain-like) exigit pel reglament i prepara el payload de submission a l'AEAT.

- **clases:** `ProfessionalComplianceEngine`

### `src/fiscal/real-estate-analytics-engine.ts` · 283 líneas

Motor d'Anàlisi Financera, Rendibilitat Avançada i Projecció Multianual de Cartera Immobiliària. Conforme amb l'Art. 23 & 85 LIRPF i estàndards d'anàlisi d'inversió immobiliària…

- **funciones:** `analyzePropertyFinances`, `analyzePortfolioFinances`
- **interfaces:** `PropertyFinancialMetrics`, `MultiYearProjectionYear`, `PropertyAnalyticsReport`, `PortfolioAnalyticsReport`

### `src/fiscal/real-estate-automator.ts` · 844 líneas

Motor d'automatització avançada per a la gestió d'immobles en lloguer: - Parser i categoritzador heurístic de despeses, factures i extractes bancaris. - Motor d'actualització de…

- **funciones:** `parsePropertyExpenses`, `applyParsedExpensesToProperty`, `calculateRentAdjustment`, `calculateFourYearCarryoverPlan`, `calculatePropertyFinancialMetrics`, `getRealEstatePortfolioPresets`, `auditAndOptimizeProperties`
- **interfaces:** `ParsedExpenseItem`

### `src/fiscal/real-estate-engine.ts` · 330 líneas

Motor fiscal per al càlcul del Rendiment del Capital Immobiliari, Amortitzacions i Imputació de Rendes (Art. 23 & 85 LIRPF).

- **funciones:** `getRentalReductionRate`, `calculatePropertyFiscalResult`, `calculateAllProperties`
- **constantes:** `LEY_12_2023_EFFECTIVE_DATE`

### `src/fiscal/schema-validator.ts` · 263 líneas

Zero-dependency runtime schema validator and data sanitizer. Guarantees data integrity, prevents NaN corruptions, and ensures safe fallbacks when loading from localStorage or im…

- **funciones:** `sanitizeNumber`, `sanitizeBoolean`, `sanitizeString`, `validateAndSanitizeDeclaration`

### `src/fiscal/social-security-engine.ts` · 342 líneas

Motor fiscal i laboral especialitzat en Seguretat Social (Règim General i RETA). - Càlcul de Cost Total d'Empresa (Cost Laboral) vs Sou Brut vs Sou Net per a treballadors. - Des…

- **funciones:** `calculateEmployeeSalaryCost`, `calculateRETACotization`
- **constantes:** `GENERAL_REGIME_LIMITS`, `CLASSES_PASSIVES_QUOTAS`, `RETA_TABLE_2024_2025`
- **interfaces:** `EmployeeSalaryCostBreakdown`, `RETATramInfo`, `RETACalculationResult`
- **tipos:** `EmployeeRegimeType`

### `src/fiscal/tax-explainer-engine.ts` · 594 líneas

Motor d'Anàlisi Didàctica, Desglossament Integral i Explicador en Llenguatge Planer. Transforma declaracions de renda extremadament complexes en una narrativa visual, intuïtiva …

- **funciones:** `explainTaxReturn`
- **interfaces:** `TaxFlowStep`, `TaxDriverInsight`, `BracketDetail`, `TaxExplainerReport`

### `src/fiscal/tax-loss-harvesting.ts` · 133 líneas

Algorisme d'optimització de Tax-Loss Harvesting (Recol·lecció de pèrdues fiscals). Calcula quines posicions amb pèrdues latents convé tancar abans del 31 de desembre per compens…

- **funciones:** `calculateTaxLossHarvesting`
- **interfaces:** `OpenPosition`, `TaxLossHarvestingPlan`

### `src/fiscal/tax-prescription-engine.ts` · 60 líneas

Càlcul del termini de prescripció de 4 anys dels tributs estatals i autonòmics segons els Articles 66 a 68 de la Llei General Tributària (LGT / Llei 58/2003).

- **funciones:** `checkTaxPrescription`
- **interfaces:** `TaxPrescriptionStatus`

### `src/fiscal/trading-analytics.ts` · 517 líneas

Motor d'anàlisi quantitativa, backtesting multianual, mètriques històriques i comparatives de trading.

- **funciones:** `analyzeTradingPerformance`
- **interfaces:** `YearPerformance`, `DayOfWeekPerformance`, `PnLDistributionBucket`, `AssetComparison`, `TradePerformanceMetrics`

### `src/fiscal/user-presets.ts` · 505 líneas

Metadata, preset definitions, visual styles, and demo data generator for all taxpayer user types.

- **funciones:** `getUserTypeConfig`, `getStatusMeta`, `getDemoProfilesData`
- **constantes:** `USER_TYPE_CONFIGS`, `STATUS_CONFIGS`
- **interfaces:** `UserTypeMeta`

### `src/fiscal/vehicle-deduction-engine.ts` · 109 líneas

Motor de desacoblament i blindatge fiscal per a despeses de vehicles turisme (Art. 95 LIVA vs Art. 22 RIRPF). Marc Jurídic: - IVA (Art. 95.Tres Llei 37/1992): Presumpció legal d…

- **funciones:** `isExclusiveVehicleActivity`, `auditAndDecoupleVehicleExpenses`
- **constantes:** `EXCLUSIVE_VEHICLE_IAE_PREFIXES`
- **interfaces:** `VehicleExpenseInput`, `VehicleDeductionAuditResult`

### `src/fiscal/verifactu-engine.ts` · 194 líneas

Motor de Compliment Veri*Factu, Inalterabilitat de Registres i Traçabilitat de Factures. Normativa aplicable: - Llei 11/2021 de Mesures de Prevenció i Lluita contra el Frau Fisc…

- **funciones:** `buildVerifactuPayload`, `createChainedInvoiceRecord`, `verifyInvoiceChainIntegrity`
- **interfaces:** `VerifactuInvoiceRecord`, `VerifactuChainVerification`

### `src/fiscal/wealth-tax-engine.ts` · 204 líneas

Motor de càlcul de l'Impost sobre el Patrimoni (Model 714 - Catalunya) i de l'Impost Temporal de Solidaritat de les Grans Fortunes (ISGF - Model 718 / Art. 31 LIP).

- **funciones:** `calculateWealthTax`
- **constantes:** `CATALAN_WEALTH_TAX_BRACKETS`, `ISGF_TAX_BRACKETS`
- **interfaces:** `WealthAssetItem`, `WealthDebtItem`, `WealthTaxData`, `WealthTaxCalculationResult`

### `src/fiscal/year-end-optimizer.ts` · 145 líneas

Predicts and calculates marginal tax rates (IRPF) and generates year-end actionable tax saving strategies before December 31st.

- **funciones:** `calculateMarginalTaxRate`, `generateYearEndOptimization`
- **interfaces:** `MarginalRates`, `YearEndTip`, `YearEndOptimizationReport`

## src/import

### `src/import/csv-utils.ts` · 70 líneas

Helper function for parsing CSV strings.

- **funciones:** `parseCSV`, `parseNumber`

### `src/import/currency-service.ts` · 94 líneas

Currency conversion service using Frankfurter API (ECB rates).

- **funciones:** `getExchangeRate`, `convertToEUR`

### `src/import/fifo-engine.ts` · 306 líneas

Core logic for FIFO (First In, First Out) matching and capital gains calculation compliant with Spanish LIRPF (Art. 37.1.a & Art. 33.5.f/g).

- **funciones:** `calculateFIFO`, `matchesToGainItems`

### `src/import/parser-degiro.ts` · 72 líneas

Parser for DEGIRO transactions CSV.

- **funciones:** `parseDegiro`

### `src/import/parser-generic.ts` · 229 líneas

Parser universal intel·ligent per a qualsevol broker, exchange o aplicació de trading (Interactive Brokers, Degiro, Trade Republic, Revolut, eToro, Binance, Coinbase, etc.).

- **funciones:** `autoDetectMapping`, `parseGeneric`
- **interfaces:** `ColumnMapping`

### `src/import/portfolio-automator.ts` · 349 líneas

Hub universal d'automatització de carteres d'accions, bròkers i guanys patrimonials: - Auto-detecció de format de bròker (DEGIRO, IBKR, Trade Republic, Revolut, eToro, Scalable,…

- **funciones:** `detectBrokerFormat`, `autoParseBrokerCSV`, `extractDividendsFromCSV`, `syncTradesToStore`, `extractLiveOpenPositions`, `getStockPortfolioPresets`
- **interfaces:** `DividendExtractionResult`
- **tipos:** `DetectedBrokerType`

## src/pages

### `src/pages/activities.ts` · 607 líneas

Activitats econòmiques (autònoms) form page i generador de Llibres Registre Oficials AEAT.

- **funciones:** `renderActivities`

### `src/pages/advisor.ts` · 131 líneas

Pàgina interactiva de l'Assistent Fiscal i Planificació d'Estalvi (Fiscal Advisor).

- **funciones:** `renderAdvisor`

### `src/pages/calendari.ts` · 413 líneas

Calendari Fiscal Oficial AEAT 2025/2026 amb Alertes i Descàrrega d'Esdeveniments iCal (.ics). Informa de tots els terminis d'IRPF, IVA, Pagaments Fraccionats, Retencions, Model …

- **funciones:** `renderCalendariPage`
- **interfaces:** `TaxDeadline`

### `src/pages/capital.ts` · 333 líneas

Rendiments del capital (mobiliari nacional, estranger amb doble imposició + immobiliari).

- **funciones:** `renderCapital`

### `src/pages/caselles.ts` · 390 líneas

Mapa Oficial de Caselles AEAT 2025/2026 (Model 100 Renda, Model 303 IVA, Model 714 Patrimoni). Permet consultar, cercar, verificar i copiar directament cada valor cap a la Renta…

- **funciones:** `renderCasellesPage`
- **interfaces:** `CasellaItem`

### `src/pages/comparator.ts` · 236 líneas

Pàgina interactiva de comparació Tributació Individual vs Tributació Conjunta (Art. 82-84 LIRPF).

- **funciones:** `renderComparator`

### `src/pages/crypto-taxes.ts` · 196 líneas

Módulo `src/pages/crypto-taxes.ts`.

- **funciones:** `renderCryptoTaxes`

### `src/pages/dashboard.ts` · 1239 líneas

Quadre de Comandament Global & Hub d'Indicadors Claus 360° (Executive Tax Cockpit). Resum exhaustiu de liquidació IRPF, rendiments per origen, patrimoni, IVA, risc AEAT, simulad…

- **funciones:** `renderDashboard`

### `src/pages/deductions.ts` · 615 líneas

Deduccions form page — Estatals i Autonòmiques de Catalunya.

- **funciones:** `renderDeductions`

### `src/pages/document-ingestion.ts` · 140 líneas

Módulo `src/pages/document-ingestion.ts`.

- **funciones:** `renderDocumentIngestion`

### `src/pages/export.ts` · 389 líneas

Export page — PDF, CSV, JSON.

- **funciones:** `renderExport`

### `src/pages/foreign-assets.ts` · 262 líneas

Pàgina interactiva de control d'obligació de declarar els Models 720 i 721 (Béns i Cripto a l'estranger). Totalment integrada amb el magatzem reactiu per perfil i exercici fiscal.

- **funciones:** `renderForeignAssets`

### `src/pages/gains.ts` · 988 líneas

Gestió Avançada de Guanys i Pèrdues Patrimonials, Cartera de Valors, Bròkers i Compliment AEAT (Art. 33 a 38 LIRPF). Funcionalitats d'Automatització Total: - Hub Integrat de Brò…

- **funciones:** `renderGains`

### `src/pages/import.ts` · 274 líneas

Mass import page for parsing CSVs and calculating FIFO.

- **funciones:** `renderImport`

### `src/pages/inheritance-tax.ts` · 120 líneas

Módulo `src/pages/inheritance-tax.ts`.

- **funciones:** `renderInheritanceTax`

### `src/pages/iva.ts` · 2040 líneas

Mòdul Integral de Gestió de l'IVA (Models 303, 390, 349, Llibres Oficials i Vinculació). Conforme amb la Llei 37/1992, Ordre HAC/773/2019 i Seu Electrònica de l'AEAT.

- **funciones:** `renderIVA`

### `src/pages/personal.ts` · 329 líneas

Situació personal i familiar.

- **funciones:** `renderPersonal`

### `src/pages/professional-compliance.ts` · 191 líneas

Módulo `src/pages/professional-compliance.ts`.

- **funciones:** `renderProfessionalCompliance`

### `src/pages/projeccio.ts` · 384 líneas

Projecció Fiscal Multianual & Simulador de Creixement Patrimonial (5 Anys). Modela l'impacte de la inflació, increments salarials, fons indexats, lloguers i deduccions acumulades.

- **funciones:** `renderProjeccioPage`
- **interfaces:** `YearProjection`

### `src/pages/properties.ts` · 2207 líneas

Pàgina d'Explotació d'Immobles en Lloguer, Extracontable d'Actius, Gestió d'Altes/Baixes, Consulta al Cadastre i Amortitzacions AEAT. Conforme amb l'Art. 23 LIRPF, Taula Simplif…

- **funciones:** `renderProperties`

### `src/pages/quarterly-taxes.ts` · 240 líneas

Módulo `src/pages/quarterly-taxes.ts`.

- **funciones:** `renderQuarterlyTaxes`

### `src/pages/real-estate-taxes.ts` · 155 líneas

Módulo `src/pages/real-estate-taxes.ts`.

- **funciones:** `renderRealEstateTaxes`

### `src/pages/result.ts` · 543 líneas

Resultat final, liquidació Model 100 AEAT, bossa de pèrdues de 4 anys, Radar de Risc d'Inspecció i descàrrega PDF.

- **funciones:** `renderResult`

### `src/pages/simulator.ts` · 172 líneas

Comparador d'escenaris fiscals i Simulador Llei Beckham (Art. 93 LIRPF - Model 151).

- **funciones:** `renderSimulator`

### `src/pages/strategic-advisor.ts` · 187 líneas

Módulo `src/pages/strategic-advisor.ts`.

- **funciones:** `renderStrategicAdvisor`

### `src/pages/tax-reconciliation.ts` · 277 líneas

Módulo `src/pages/tax-reconciliation.ts`.

- **funciones:** `renderTaxReconciliation`

### `src/pages/trading-analytics.ts` · 2073 líneas

Quadre de Comandament d'Inversions, Trading, Laboratori de Backtest Institucional & Kaizen 360°. Avalua el rendiment, tècniques operatives (Borsa, Cripto, Fons), gestió de risc …

- **funciones:** `renderTradingAnalytics`

### `src/pages/users.ts` · 984 líneas

Pàgina de Gestió Integral de Declarants, Perfils Fiscals i Eines Modulars. Permet crear, editar, duplicar, filtrar i configurar les eines a la carta per a cada contribuent.

- **funciones:** `renderUsersPage`

### `src/pages/wealth-tax.ts` · 289 líneas

Pàgina interactiva de l'Impost sobre el Patrimoni (Model 714) i Grans Fortunes (Model 718). Totalment integrada amb el magatzem reactiu per perfil i exercici fiscal.

- **funciones:** `renderWealthTax`

### `src/pages/wizard.ts` · 258 líneas

Assistent Guiat Pas a Pas per a la Declaració de la Renda.

- **funciones:** `renderWizard`

### `src/pages/work-income.ts` · 510 líneas

Rendiments del treball form page amb múltiples pagadors, Art. 7.p i rendiments irregulars (Art. 18.2).

- **funciones:** `renderWorkIncome`

## src/utils

### `src/utils/activity-books-generator.ts` · 80 líneas

Generador dels 4 Llibres Registre Oficials d'Activitats Econòmiques de l'AEAT (Ordre HAC/773/2019 per a autònoms en estimació directa).

- **funciones:** `exportSalesBookCSV`, `exportExpensesBookCSV`
- **interfaces:** `SalesBookEntry`, `ExpensesBookEntry`

### `src/utils/aeat-export.ts` · 291 líneas

Utilitats per generar fitxers i guies de càrrega directa per a l'AEAT (Renta Web). Cobertura oficial de l'Annex F2 (Accions i Fons), l'Annex A (Capital Immobiliari) i el Llibre …

- **funciones:** `generateAEATAnnexF2`, `generateAEATAnnexA`, `generateAEATAmortizationBook`, `exportPropertiesInventoryCSV`

### `src/utils/cadastre-service.ts` · 97 líneas

Servei de validació i consulta de referències cadastrals a la Seu Electrònica del Cadastre (DGC).

- **funciones:** `validateCadastralReferenceFormat`, `lookupCadastreReference`
- **interfaces:** `CadastreLookupResult`

### `src/utils/currency.ts` · 83 líneas

Currency and number formatting utilities.

- **funciones:** `formatCurrency`, `formatCurrencyNoDecimals`, `formatPercent`, `formatNumber`, `formatCompact`, `parseCurrencyInput`

### `src/utils/document-vault.ts` · 221 líneas

Magatzem Digital Segur de Documents i Factures Originals per a Inspecció de l'AEAT. Utilitza IndexedDB per persistir documents PDF i imatges de gran volum al navegador, amb nome…

- **funciones:** `sanitizeForFilename`, `generateStandardizedAeatPdfName`, `fileToDataUrl`, `saveInvoiceDocument`, `getInvoiceDocument`, `deleteInvoiceDocument`, `getDocumentsForYear`, `downloadStoredDocument`
- **interfaces:** `StoredDocument`

### `src/utils/dom.ts` · 34 líneas

Safe DOM helpers, HTML sanitization, and delegation utilities.

- **funciones:** `escapeHtml`, `createElement`

### `src/utils/exact-math.ts` · 239 líneas

Motor d'Aritmètica Decimal Financera i Arrodoniments Oficials AEAT. Garanteix una precisió del 100% lliure d'errors de coma flotant IEEE-754 (com ara 0.1 + 0.2 !== 0.3 o pèrdues…

- **funciones:** `eurosToCents`, `centsToEuros`, `toFixedScaled`, `fromFixedScaled`, `exactAdd`, `exactSub`, `exactMultiply`, `exactDivide`, `applyTaxBracketsExact`, `calculateInvoiceLineTaxExact`, `round2`
- **interfaces:** `ExactBracketResult`, `ExactInvoiceLineTax`

### `src/utils/export-csv.ts` · 111 líneas

Generate CSV export of the fiscal result.

- **funciones:** `generateCSV`

### `src/utils/inspection-package-generator.ts` · 234 líneas

Generador del Dossier Complet d'Inspecció Tributària per a l'AEAT. Confecciona un paquet comprimit ZIP homologat que inclou: 1. Llibres Registre Oficials en CSV segons l'Ordre H…

- **funciones:** `generateAndDownloadInspectionPackage`

### `src/utils/iva-books-generator.ts` · 238 líneas

Generador i exportador dels Llibres Registre Oficials d'IVA exigits per l'AEAT (Ordre HAC/773/2019 i Llei 37/1992). Formats CSV normalitzats i desglossaments oficials de liquida…

- **funciones:** `exportIssuedInvoicesCSV`, `exportReceivedInvoicesCSV`, `exportInvestmentAssetsCSV`, `exportModel303SummaryCSV`

### `src/utils/math.ts` · 59 líneas

Pure, high-precision safe arithmetic utilities for financial calculations. Protects against IEEE-754 floating point inaccuracies and NaN/Infinity corruptions.

- **funciones:** `roundCurrency`, `roundDecimals`, `safeAdd`, `safeMultiply`, `safePercentage`

### `src/utils/pdf-generator.ts` · 272 líneas

Generador Oficial de Documents PDF de la Declaració de la Renda (Model 100 AEAT).

- **funciones:** `generateModel100PDF`

## Mapa de secciones — ficheros ≥ 800 líneas

> **No leas estos ficheros completos.** Salta a la línea indicada con
> `read_files` (`start_line`/`end_line`). Si un fichero tiene pocas anclas es
> porque concentra casi todo en una única función: busca dentro con `search_codebase`.

### `src/fiscal/auto-validator.ts` · 1673 líneas

- L24 · type ValidationSeverity
- L26 · iface ValidationIssue
- L38 · iface ValidationReport
- L52 · const EU_COUNTRY_CODES
- L61 · fn isValidSpanishTaxId
- L137 · fn isValidCadastralReference
- L144 · const complianceCache
- L150 · fn runAutomatedComplianceChecks
- L159 · fn runAutomatedComplianceChecksInternal
- L186 · § GRUP 1: COMPROVACIONS DETALLADES D'IRPF — RENDIMENTS DEL TREBALL (ARTS. 17-20 LIRPF)
- L188 · § 1.1 Aportacions a Plans de Pensions Individuals (> 1.500 € / Art. 51.1 LIRPF)
- L335 · § GRUP 2: RENDIMENTS DEL CAPITAL MOBILIARI I INTERNACIONAL (ARTS. 25, 26, 80 LIRPF)
- L337 · § 2.1 Deducció per Doble Imposició Internacional en Dividends Estrangers (Casella 0588)
- L352 · § GRUP 3: RENDIMENTS DEL CAPITAL IMMOBILIARI (ARTS. 22-24, 85 LIRPF)
- L354 · § 3.1 Manca de NIF de Llogater en Habitatge Habitual (Preceptiu per a la Casella 0065)
- L482 · § GRUP 4: ACTIVITATS ECONÒMIQUES & AUTÒNOMS (ARTS. 27-32 LIRPF)
- L484 · § 4.1 Desquadre d'Ingressos Facturats vs Ingressos IRPF
- L615 · § GRUP 5: GUANYS PATRIMONIALS & REGLA DELS 2 MESOS (ARTS. 33 A 49 LIRPF)
- L617 · § 5.1 Venda d'Habitatge Habitual per Majors de 65 Anys (100% Exempta)
- L700 · § GRUP 6: MÍNIMS PERSONALS, FAMILIARS I DISCAPACITAT (ARTS. 56-61 LIRPF)
- L702 · § 6.1 Mínim per Discapacitat del Contribuent no Informat
- L774 · § GRUP 7: DEDUCCIONS ESTATALS I AUTONÒMIQUES DE CATALUNYA (LLEI 31/2002)
- L776 · § 7.1 Límit Màxim Legal de Deducció per Inversió en Habitatge Habitual (9.040 € / Art. 68.1 LIRPF)
- L922 · § GRUP 8: COMPROVACIONS D'IVA & LLIBRES REGISTRE (LLEI 37/1992 & RD 1619/2012)
- L924 · § 8.1 Detecció de Factures Duplicades
- L1287 · § GRUP 9: BÉNS A L'ESTRANGER & CRIPTOACTIUS (MODELS 720 / 721)
- L1289 · § 9.1 Obligació de Declaració de Béns a l'Estranger (Model 720 - Llindar 50.000 €)
- L1321 · § GRUP 10: CONCILIACIÓ I CUADRE INTER-MODEL (AEAT)
- L1339 · § GRUP 11: ARRENDAMENTS TURÍSTICS I TEMPORALS (CRITERIS DGT V1187-24 & MODEL 179)
- L1358 · § GRUP 12: TELETREBALL I SUBMINISTRAMENTS D'HABITATGE D'AUTÒNOMS (ART. 30.2.5a.b LIRPF)
- L1382 · § GRUP 13: DESPESES DE GUARDERIA I CRIANÇA (ART. 81 LIRPF & STC 8/1/2024)
- L1399 · § GRUP 14: IMPOST SOBRE EL PATRIMONI (MODEL 714) & LÍMIT CONJUNT 60% (ART. 31 LIP)
- L1417 · § CÀLCUL DE LA PUNTUACIÓ DE CONFORMITAT FISCAL (0-100%)
- L1447 · fn executeAutoFix

### `src/fiscal/backtest-engine.ts` · 1289 líneas

- L13 · type BacktestStrategyType
- L21 · type PositionSizingModel
- L29 · iface BacktestParameters
- L46 · iface BacktestTradeResult
- L73 · iface SensitivityMatrixCell
- L83 · iface MonthlyReturnRow
- L96 · iface AssetClassBacktestPerformance
- L107 · iface RMultipleBucket
- L115 · iface StressTestScenario
- L123 · iface RollingMetricPoint
- L130 · iface KellyCurvePoint
- L137 · iface BacktestReport
- L257 · const BACKTEST_PRESETS
- L320 · const DEFAULT_BACKTEST_PARAMETERS
- L340 · fn runInstitutionalBacktest
- L995 · fn generateRMultipleDistribution
- L1032 · fn generateMonthlyReturnMatrix
- L1071 · fn generateAssetClassPerformance
- L1116 · fn calculateMonteCarloPermutationPValue
- L1142 · fn generateSensitivityMatrix
- L1206 · fn createEmptyBacktestReport

### `src/fiscal/investment-cockpit-engine.ts` · 1092 líneas

- L13 · type InvestmentAssetClass
- L14 · type TradingHoldingStyle
- L16 · iface InvestmentCockpitOptions
- L23 · iface EnrichedTradeItem
- L51 · iface AssetClassAnalytics
- L66 · iface StyleAnalytics
- L78 · iface SetupAnalytics
- L90 · iface ExecutionGradeAnalytics
- L98 · iface DailyPnLEntry
- L107 · iface DayOfWeekEntry
- L116 · iface RiskManagementMetrics
- L131 · iface PostMortemDiagnosis
- L159 · iface WhatIfSimulationResult
- L169 · iface MultiYearEvolutionItem
- L183 · iface InvestmentCockpitReport
- L264 · fn classifyAssetType
- L289 · fn determineHoldingStyle
- L299 · fn inferTradeSetup
- L316 · fn inferEmotionTag
- L323 · const TOTAL_SAVINGS_BRACKETS
- L334 · fn calculateSavingsTaxEUR
- L342 · fn analyzeInvestmentCockpit

### `src/fiscal/model-reconciliation-engine.ts` · 4584 líneas

- L14 · type DiscrepancyCategory
- L57 · iface ModelDiscrepancy
- L72 · iface ReconciliationReport
- L81 · iface RuleEvaluationResult
- L91 · iface CrossCheckRule
- L104 · const CROSS_CHECK_RULES
- L4500 · const reconciliationCache
- L4502 · class ModelReconciliationEngine

### `src/fiscal/real-estate-automator.ts` · 844 líneas

- L19 · iface ParsedExpenseItem
- L39 · fn parsePropertyExpenses
- L319 · fn extractSupplierName
- L331 · fn applyParsedExpensesToProperty
- L391 · fn calculateRentAdjustment
- L437 · fn calculateFourYearCarryoverPlan
- L511 · fn calculatePropertyFinancialMetrics
- L554 · fn getRealEstatePortfolioPresets
- L793 · fn auditAndOptimizeProperties

### `src/pages/dashboard.ts` · 1239 líneas

- L26 · iface DashboardContext
- L48 · fn renderDashboard

### `src/pages/gains.ts` · 988 líneas

- L28 · fn renderGains
- L285 · fn renderItemsList
- L609 · fn openHarvestingModal
- L715 · fn openStockPresetsModal
- L780 · fn openAEATBoxesModal
- L854 · fn openAddModal

### `src/pages/iva.ts` · 2040 líneas

- L45 · fn renderIVA

### `src/pages/properties.ts` · 2207 líneas

- L43 · fn renderProperties
- L392 · fn createPropertyCard
- L622 · fn openExpenseScannerModal
- L796 · fn openContractModal
- L937 · fn openCarryoverModal
- L1053 · fn openPresetsModal
- L1135 · fn openPropertyModal
- L1474 · fn openInventoryModal
- L1717 · fn openItemModal
- L1870 · fn openInvoiceBreakdownModal
- L2077 · fn openDisposalModal
- L2143 · fn saveProperty
- L2154 · fn importInventoryFromCSV
- L2198 · fn downloadFile

### `src/pages/trading-analytics.ts` · 2073 líneas

- L32 · fn renderTradingAnalytics
- L214 · § 1. PANELL PRINCIPAL 360° & RISC AVANÇAT
- L390 · § 2. LABORATORI DE BACKTESTING INSTITUCIONAL
- L1008 · § 3. CALENDARI & MAPA DE CALOR P&L DIARI
- L1085 · § 4. ANÀLISI PER SETUPS & ESTRATÈGIES
- L1144 · § 5. DIARI D'OPERACIONS & TAGGING
- L1228 · § 6. MILLORA KAIZEN & CHECKLIST
- L1305 · § 7. SIMULADOR WHAT-IF & MONTE CARLO
- L1418 · § 8. TAX-LOSS HARVESTING
- L1463 · § MODAL D'EDICIÓ DEL DIARI
- L1574 · § EXPORTACIONS MULTI-FORMAT (CSV, JSON & HTML AUTÒNOM)
- L1739 · § ATTACH LISTENERS
- L1919 · § SVG RENDERERS
- L1921 · fn renderEquityCurveSvg
- L1955 · fn renderBacktestEquityCurveSvg
- L2016 · fn renderRollingEdgeSvg
- L2044 · fn renderMonteCarloFanChartSvg

### `src/pages/users.ts` · 984 líneas

- L16 · fn renderUsersPage
- L587 · fn openProfileModal

### `src/store.ts` · 933 líneas

- L19 · const STORAGE_PREFIX
- L21 · const DEFAULT_PROFILES
- L41 · fn deepFreeze
- L54 · class Store
- L932 · const store
