/**
 * @module main
 * Application bootstrap — registers routes, renders shell, starts router.
 */

import { router } from './router.ts';
import { createSidebar, createMobileHeader, createMobileOverlay } from './components/navbar.ts';
import { initCommandPaletteShortcut } from './components/command-palette.ts';
import { createLiveTaxHUD } from './components/live-tax-hud.ts';
import type { Route } from './types.ts';

/**
 * Memoizes a dynamic module import so that predictive prefetch (`load`) and
 * page rendering (`render`) share a single in-flight fetch per page chunk.
 */
function lazy<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => (promise ??= loader());
}

/** Lazily-loaded page modules, one per route. */
const activitiesPage = lazy(() => import('./pages/activities.ts'));
const advisorPage = lazy(() => import('./pages/advisor.ts'));
const calendariPage = lazy(() => import('./pages/calendari.ts'));
const capitalPage = lazy(() => import('./pages/capital.ts'));
const casellesPage = lazy(() => import('./pages/caselles.ts'));
const comparatorPage = lazy(() => import('./pages/comparator.ts'));
const cryptoTaxesPage = lazy(() => import('./pages/crypto-taxes.ts'));
const dashboardPage = lazy(() => import('./pages/dashboard.ts'));
const deductionsPage = lazy(() => import('./pages/deductions.ts'));
const documentIngestionPage = lazy(() => import('./pages/document-ingestion.ts'));
const exportPage = lazy(() => import('./pages/export.ts'));
const foreignAssetsPage = lazy(() => import('./pages/foreign-assets.ts'));
const gainsPage = lazy(() => import('./pages/gains.ts'));
const importPage = lazy(() => import('./pages/import.ts'));
const inheritanceTaxPage = lazy(() => import('./pages/inheritance-tax.ts'));
const ivaPage = lazy(() => import('./pages/iva.ts'));
const personalPage = lazy(() => import('./pages/personal.ts'));
const professionalCompliancePage = lazy(() => import('./pages/professional-compliance.ts'));
const projeccioPage = lazy(() => import('./pages/projeccio.ts'));
const propertiesPage = lazy(() => import('./pages/properties.ts'));
const quarterlyTaxesPage = lazy(() => import('./pages/quarterly-taxes.ts'));
const realEstateTaxesPage = lazy(() => import('./pages/real-estate-taxes.ts'));
const resultPage = lazy(() => import('./pages/result.ts'));
const simulatorPage = lazy(() => import('./pages/simulator.ts'));
const strategicAdvisorPage = lazy(() => import('./pages/strategic-advisor.ts'));
const taxReconciliationPage = lazy(() => import('./pages/tax-reconciliation.ts'));
const tradingAnalyticsPage = lazy(() => import('./pages/trading-analytics.ts'));
const usersPage = lazy(() => import('./pages/users.ts'));
const wealthTaxPage = lazy(() => import('./pages/wealth-tax.ts'));
const wizardPage = lazy(() => import('./pages/wizard.ts'));
const workIncomePage = lazy(() => import('./pages/work-income.ts'));

/** All application routes configured with code-splitting dynamic imports */
const routes: Route[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: '📊',
    section: '',
    load: dashboardPage,
    render: async () => (await dashboardPage()).renderDashboard(),
  },
  {
    path: '/usuaris',
    label: 'Gestió de Declarants',
    icon: '👥',
    section: 'Configuració',
    load: usersPage,
    render: async () => (await usersPage()).renderUsersPage(),
  },
  {
    path: '/caselles',
    label: 'Mapa Caselles AEAT',
    icon: '🗺️',
    section: 'Fiscal',
    load: casellesPage,
    render: async () => (await casellesPage()).renderCasellesPage(),
  },
  {
    path: '/calendari',
    label: 'Calendari Fiscal AEAT',
    icon: '📅',
    section: 'Fiscal',
    load: calendariPage,
    render: async () => (await calendariPage()).renderCalendariPage(),
  },
  {
    path: '/iva',
    label: 'Gestió de l\'IVA (303/390)',
    icon: '🧾',
    section: 'Fiscal',
    load: ivaPage,
    render: async () => (await ivaPage()).renderIVA(),
  },
  {
    path: '/trimestrals',
    label: 'Trimestrals (130, 111, 347)',
    icon: '🗓️',
    section: 'Fiscal',
    load: quarterlyTaxesPage,
    render: async () => (await quarterlyTaxesPage()).renderQuarterlyTaxes(),
  },
  {
    path: '/projeccio',
    label: 'Projecció Multianual',
    icon: '🔮',
    section: 'Eines',
    load: projeccioPage,
    render: async () => (await projeccioPage()).renderProjeccioPage(),
  },
  {
    path: '/trading',
    label: 'Trading & Backtesting',
    icon: '📈',
    section: 'Eines',
    load: tradingAnalyticsPage,
    render: async () => (await tradingAnalyticsPage()).renderTradingAnalytics(),
  },
  {
    path: '/patrimoni',
    label: 'Impost Patrimoni (714)',
    icon: '🏰',
    section: 'Fiscal',
    load: wealthTaxPage,
    render: async () => (await wealthTaxPage()).renderWealthTax(),
  },
  {
    path: '/model720',
    label: 'Béns a l\'Estranger (720/721)',
    icon: '🌍',
    section: 'Fiscal',
    load: foreignAssetsPage,
    render: async () => (await foreignAssetsPage()).renderForeignAssets(),
  },
  {
    path: '/sucesiones',
    label: 'Sucesiones y Donaciones (650)',
    icon: '⚰️',
    section: 'Patrimonial',
    load: inheritanceTaxPage,
    render: async () => (await inheritanceTaxPage()).renderInheritanceTax(),
  },
  {
    path: '/itp-plusvalia',
    label: 'ITP y Plusvalía Municipal (600)',
    icon: '🏢',
    section: 'Patrimonial',
    load: realEstateTaxesPage,
    render: async () => (await realEstateTaxesPage()).renderRealEstateTaxes(),
  },
  {
    path: '/estratega',
    label: 'Assessorament Estratègic',
    icon: '🧠',
    section: 'Optimització',
    load: strategicAdvisorPage,
    render: async () => (await strategicAdvisorPage()).renderStrategicAdvisor(),
  },
  {
    path: '/cripto',
    label: 'Criptomonedes i DeFi (721)',
    icon: '₿',
    section: 'Patrimonial',
    load: cryptoTaxesPage,
    render: async () => (await cryptoTaxesPage()).renderCryptoTaxes(),
  },
  {
    path: '/ingesta',
    label: 'Bústia Intel·ligent OCR',
    icon: '🤖',
    section: 'Sistema',
    load: documentIngestionPage,
    render: async () => (await documentIngestionPage()).renderDocumentIngestion(),
  },
  {
    path: '/compliance',
    label: 'Compliance Veri*Factu',
    icon: '🏛️',
    section: 'Sistema',
    load: professionalCompliancePage,
    render: async () => (await professionalCompliancePage()).renderProfessionalCompliance(),
  },
  {
    path: '/conciliacio',
    label: 'Conciliació & Cuadre Inter-Model',
    icon: '⚖️',
    section: 'Fiscal & Normativa',
    load: taxReconciliationPage,
    render: async () => (await taxReconciliationPage()).renderTaxReconciliation(),
  },
  {
    path: '/wizard',
    label: 'Assistent Guiat',
    icon: '🧙',
    section: 'Eines',
    load: wizardPage,
    render: async () => (await wizardPage()).renderWizard(),
  },
  {
    path: '/assessor',
    label: 'Fiscal Advisor (Estalvi)',
    icon: '💡',
    section: 'Eines',
    load: advisorPage,
    render: async () => (await advisorPage()).renderAdvisor(),
  },
  {
    path: '/comparador',
    label: 'Individual vs Conjunta',
    icon: '⚖️',
    section: 'Eines',
    load: comparatorPage,
    render: async () => (await comparatorPage()).renderComparator(),
  },
  {
    path: '/treball',
    label: 'Rendiments del treball',
    icon: '💼',
    section: 'Ingressos',
    load: workIncomePage,
    render: async () => (await workIncomePage()).renderWorkIncome(),
  },
  {
    path: '/capital',
    label: 'Rendiments del capital',
    icon: '🏦',
    section: 'Ingressos',
    load: capitalPage,
    render: async () => (await capitalPage()).renderCapital(),
  },
  {
    path: '/immobles',
    label: 'Immobles en lloguer',
    icon: '🏠',
    section: 'Ingressos',
    load: propertiesPage,
    render: async () => (await propertiesPage()).renderProperties(),
  },
  {
    path: '/activitats',
    label: 'Activitats econòmiques',
    icon: '🏢',
    section: 'Ingressos',
    load: activitiesPage,
    render: async () => (await activitiesPage()).renderActivities(),
  },
  {
    path: '/guanys',
    label: 'Guanys patrimonials',
    icon: '📊',
    section: 'Ingressos',
    load: gainsPage,
    render: async () => (await gainsPage()).renderGains(),
  },
  {
    path: '/personal',
    label: 'Situació Personal',
    icon: '👤',
    section: 'Fiscal',
    load: personalPage,
    render: async () => (await personalPage()).renderPersonal(),
  },
  {
    path: '/deduccions',
    label: 'Deduccions',
    icon: '🎯',
    section: 'Fiscal',
    load: deductionsPage,
    render: async () => (await deductionsPage()).renderDeductions(),
  },
  {
    path: '/resultat',
    label: 'Resultat & Radar Risc',
    icon: '🧮',
    section: 'Fiscal',
    load: resultPage,
    render: async () => (await resultPage()).renderResult(),
  },
  {
    path: '/simulador',
    label: 'Simulador Llei Beckham',
    icon: '⚖️',
    section: 'Eines',
    load: simulatorPage,
    render: async () => (await simulatorPage()).renderSimulator(),
  },
  {
    path: '/importar',
    label: 'Importar Operacions',
    icon: '📥',
    section: 'Eines',
    load: importPage,
    render: async () => (await importPage()).renderImport(),
  },
  {
    path: '/exportar',
    label: 'Exportar / Còpies',
    icon: '💾',
    section: 'Eines',
    load: exportPage,
    render: async () => (await exportPage()).renderExport(),
  },
];

function init(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app container not found');

  // Register routes
  router.registerAll(routes);

  // Initialize global shortcuts (e.g. Cmd+K / Ctrl+K)
  initCommandPaletteShortcut();

  // Build shell
  const sidebar = createSidebar();
  const overlay = createMobileOverlay();
  const mobileHeader = createMobileHeader();

  const main = document.createElement('main');
  main.className = 'app-main';

  const pageContainer = document.createElement('div');
  pageContainer.id = 'page-container';
  pageContainer.style.transition = 'opacity 150ms ease, transform 150ms ease';

  main.appendChild(mobileHeader);
  main.appendChild(pageContainer);

  app.appendChild(overlay);
  app.appendChild(sidebar);
  app.appendChild(main);
  app.appendChild(createLiveTaxHUD());

  // Setup router
  router.setContainer(pageContainer);
  router.start();
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
