/**
 * @module main
 * Application bootstrap — registers routes, renders shell, starts router.
 */

import { router } from './router.ts';
import { createSidebar, createMobileHeader, createMobileOverlay } from './components/navbar.ts';
import { initCommandPaletteShortcut } from './components/command-palette.ts';
import type { Route } from './types.ts';

/** All application routes configured with code-splitting dynamic imports */
const routes: Route[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: '📊',
    section: '',
    render: async () => (await import('./pages/dashboard.ts')).renderDashboard(),
  },
  {
    path: '/usuaris',
    label: 'Gestió de Declarants',
    icon: '👥',
    section: 'Configuració',
    render: async () => (await import('./pages/users.ts')).renderUsersPage(),
  },
  {
    path: '/caselles',
    label: 'Mapa Caselles AEAT',
    icon: '🗺️',
    section: 'Fiscal',
    render: async () => (await import('./pages/caselles.ts')).renderCasellesPage(),
  },
  {
    path: '/calendari',
    label: 'Calendari Fiscal AEAT',
    icon: '📅',
    section: 'Fiscal',
    render: async () => (await import('./pages/calendari.ts')).renderCalendariPage(),
  },
  {
    path: '/iva',
    label: 'Gestió de l\'IVA (303/390)',
    icon: '🧾',
    section: 'Fiscal',
    render: async () => (await import('./pages/iva.ts')).renderIVA(),
  },
  {
    path: '/trimestrals',
    label: 'Trimestrals (130, 111, 347)',
    icon: '🗓️',
    section: 'Fiscal',
    render: async () => (await import('./pages/quarterly-taxes.ts')).renderQuarterlyTaxes(),
  },
  {
    path: '/projeccio',
    label: 'Projecció Multianual',
    icon: '🔮',
    section: 'Eines',
    render: async () => (await import('./pages/projeccio.ts')).renderProjeccioPage(),
  },
  {
    path: '/trading',
    label: 'Trading & Backtesting',
    icon: '📈',
    section: 'Eines',
    render: async () => (await import('./pages/trading-analytics.ts')).renderTradingAnalytics(),
  },
  {
    path: '/patrimoni',
    label: 'Impost Patrimoni (714)',
    icon: '🏰',
    section: 'Fiscal',
    render: async () => (await import('./pages/wealth-tax.ts')).renderWealthTax(),
  },
  {
    path: '/model720',
    label: 'Béns a l\'Estranger (720/721)',
    icon: '🌍',
    section: 'Fiscal',
    render: async () => (await import('./pages/foreign-assets.ts')).renderForeignAssets(),
  },
  {
    path: '/sucesiones',
    label: 'Sucesiones y Donaciones (650)',
    icon: '⚰️',
    section: 'Patrimonial',
    render: async () => (await import('./pages/inheritance-tax.ts')).renderInheritanceTax(),
  },
  {
    path: '/itp-plusvalia',
    label: 'ITP y Plusvalía Municipal (600)',
    icon: '🏢',
    section: 'Patrimonial',
    render: async () => (await import('./pages/real-estate-taxes.ts')).renderRealEstateTaxes(),
  },
  {
    path: '/estratega',
    label: 'Assessorament Estratègic',
    icon: '🧠',
    section: 'Optimització',
    render: async () => (await import('./pages/strategic-advisor.ts')).renderStrategicAdvisor(),
  },
  {
    path: '/cripto',
    label: 'Criptomonedes i DeFi (721)',
    icon: '₿',
    section: 'Patrimonial',
    render: async () => (await import('./pages/crypto-taxes.ts')).renderCryptoTaxes(),
  },
  {
    path: '/ingesta',
    label: 'Bústia Intel·ligent OCR',
    icon: '🤖',
    section: 'Sistema',
    render: async () => (await import('./pages/document-ingestion.ts')).renderDocumentIngestion(),
  },
  {
    path: '/compliance',
    label: 'Compliance Veri*Factu',
    icon: '🏛️',
    section: 'Sistema',
    render: async () => (await import('./pages/professional-compliance.ts')).renderProfessionalCompliance(),
  },
  {
    path: '/conciliacio',
    label: 'Conciliació & Cuadre Inter-Model',
    icon: '⚖️',
    section: 'Fiscal & Normativa',
    render: async () => (await import('./pages/tax-reconciliation.ts')).renderTaxReconciliation(),
  },
  {
    path: '/wizard',
    label: 'Assistent Guiat',
    icon: '🧙',
    section: 'Eines',
    render: async () => (await import('./pages/wizard.ts')).renderWizard(),
  },
  {
    path: '/assessor',
    label: 'Fiscal Advisor (Estalvi)',
    icon: '💡',
    section: 'Eines',
    render: async () => (await import('./pages/advisor.ts')).renderAdvisor(),
  },
  {
    path: '/comparador',
    label: 'Individual vs Conjunta',
    icon: '⚖️',
    section: 'Eines',
    render: async () => (await import('./pages/comparator.ts')).renderComparator(),
  },
  {
    path: '/treball',
    label: 'Rendiments del treball',
    icon: '💼',
    section: 'Ingressos',
    render: async () => (await import('./pages/work-income.ts')).renderWorkIncome(),
  },
  {
    path: '/capital',
    label: 'Rendiments del capital',
    icon: '🏦',
    section: 'Ingressos',
    render: async () => (await import('./pages/capital.ts')).renderCapital(),
  },
  {
    path: '/immobles',
    label: 'Immobles en lloguer',
    icon: '🏠',
    section: 'Ingressos',
    render: async () => (await import('./pages/properties.ts')).renderProperties(),
  },
  {
    path: '/activitats',
    label: 'Activitats econòmiques',
    icon: '🏢',
    section: 'Ingressos',
    render: async () => (await import('./pages/activities.ts')).renderActivities(),
  },
  {
    path: '/guanys',
    label: 'Guanys patrimonials',
    icon: '📊',
    section: 'Ingressos',
    render: async () => (await import('./pages/gains.ts')).renderGains(),
  },
  {
    path: '/personal',
    label: 'Situació Personal',
    icon: '👤',
    section: 'Fiscal',
    render: async () => (await import('./pages/personal.ts')).renderPersonal(),
  },
  {
    path: '/deduccions',
    label: 'Deduccions',
    icon: '🎯',
    section: 'Fiscal',
    render: async () => (await import('./pages/deductions.ts')).renderDeductions(),
  },
  {
    path: '/resultat',
    label: 'Resultat & Radar Risc',
    icon: '🧮',
    section: 'Fiscal',
    render: async () => (await import('./pages/result.ts')).renderResult(),
  },
  {
    path: '/simulador',
    label: 'Simulador Llei Beckham',
    icon: '⚖️',
    section: 'Eines',
    render: async () => (await import('./pages/simulator.ts')).renderSimulator(),
  },
  {
    path: '/importar',
    label: 'Importar Operacions',
    icon: '📥',
    section: 'Eines',
    render: async () => (await import('./pages/import.ts')).renderImport(),
  },
  {
    path: '/exportar',
    label: 'Exportar / Còpies',
    icon: '💾',
    section: 'Eines',
    render: async () => (await import('./pages/export.ts')).renderExport(),
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
