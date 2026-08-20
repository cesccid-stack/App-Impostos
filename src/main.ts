/**
 * @module main
 * Application bootstrap — registers routes, renders shell, starts router.
 */

import { router } from './router.ts';
import { createSidebar, createMobileHeader, createMobileOverlay } from './components/navbar.ts';
import { renderDashboard } from './pages/dashboard.ts';
import { renderWorkIncome } from './pages/work-income.ts';
import { renderCapital } from './pages/capital.ts';
import { renderActivities } from './pages/activities.ts';
import { renderGains } from './pages/gains.ts';
import { renderDeductions } from './pages/deductions.ts';
import { renderPersonal } from './pages/personal.ts';
import { renderSimulator } from './pages/simulator.ts';
import { renderResult } from './pages/result.ts';
import { renderExport } from './pages/export.ts';
import { renderImport } from './pages/import.ts';
import { renderProperties } from './pages/properties.ts';
import { renderComparator } from './pages/comparator.ts';
import { renderAdvisor } from './pages/advisor.ts';
import { renderWizard } from './pages/wizard.ts';
import { renderTradingAnalytics } from './pages/trading-analytics.ts';
import { renderWealthTax } from './pages/wealth-tax.ts';
import { renderForeignAssets } from './pages/foreign-assets.ts';
import { renderIVA } from './pages/iva.ts';
import { renderQuarterlyTaxes } from './pages/quarterly-taxes.ts';
import { renderInheritanceTax } from './pages/inheritance-tax.ts';
import { renderRealEstateTaxes } from './pages/real-estate-taxes.ts';
import { renderStrategicAdvisor } from './pages/strategic-advisor.ts';
import { renderCryptoTaxes } from './pages/crypto-taxes.ts';
import { renderDocumentIngestion } from './pages/document-ingestion.ts';
import { renderProfessionalCompliance } from './pages/professional-compliance.ts';
import { renderTaxReconciliation } from './pages/tax-reconciliation.ts';
import { renderUsersPage } from './pages/users.ts';
import { renderCasellesPage } from './pages/caselles.ts';
import { renderCalendariPage } from './pages/calendari.ts';
import { renderProjeccioPage } from './pages/projeccio.ts';
import { initCommandPaletteShortcut } from './components/command-palette.ts';
import type { Route } from './types.ts';

/** All application routes */
const routes: Route[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: '📊',
    section: '',
    render: renderDashboard,
  },
  {
    path: '/usuaris',
    label: 'Gestió de Declarants',
    icon: '👥',
    section: 'Configuració',
    render: renderUsersPage,
  },
  {
    path: '/caselles',
    label: 'Mapa Caselles AEAT',
    icon: '🗺️',
    section: 'Fiscal',
    render: renderCasellesPage,
  },
  {
    path: '/calendari',
    label: 'Calendari Fiscal AEAT',
    icon: '📅',
    section: 'Fiscal',
    render: renderCalendariPage,
  },
  {
    path: '/iva',
    label: 'Gestió de l\'IVA (303/390)',
    icon: '🧾',
    section: 'Fiscal',
    render: renderIVA,
  },
  {
    path: '/trimestrals',
    label: 'Trimestrals (130, 111, 347)',
    icon: '🗓️',
    section: 'Fiscal',
    render: renderQuarterlyTaxes,
  },
  {
    path: '/projeccio',
    label: 'Projecció Multianual',
    icon: '🔮',
    section: 'Eines',
    render: renderProjeccioPage,
  },
  {
    path: '/trading',
    label: 'Trading & Backtesting',
    icon: '📈',
    section: 'Eines',
    render: renderTradingAnalytics,
  },
  {
    path: '/patrimoni',
    label: 'Impost Patrimoni (714)',
    icon: '🏰',
    section: 'Fiscal',
    render: renderWealthTax,
  },
  {
    path: '/model720',
    label: 'Béns a l\'Estranger (720/721)',
    icon: '🌍',
    section: 'Fiscal',
    render: renderForeignAssets,
  },
  {
    path: '/sucesiones',
    label: 'Sucesiones y Donaciones (650)',
    icon: '⚰️',
    section: 'Patrimonial',
    render: renderInheritanceTax,
  },
  {
    path: '/itp-plusvalia',
    label: 'ITP y Plusvalía Municipal (600)',
    icon: '🏢',
    section: 'Patrimonial',
    render: renderRealEstateTaxes,
  },
  {
    path: '/estratega',
    label: 'Assessorament Estratègic',
    icon: '🧠',
    section: 'Optimització',
    render: renderStrategicAdvisor,
  },
  {
    path: '/cripto',
    label: 'Criptomonedes i DeFi (721)',
    icon: '₿',
    section: 'Patrimonial',
    render: renderCryptoTaxes,
  },
  {
    path: '/ingesta',
    label: 'Bústia Intel·ligent OCR',
    icon: '🤖',
    section: 'Sistema',
    render: renderDocumentIngestion,
  },
  {
    path: '/compliance',
    label: 'Compliance Veri*Factu',
    icon: '🏛️',
    section: 'Sistema',
    render: renderProfessionalCompliance,
  },
  {
    path: '/conciliacio',
    label: 'Conciliació & Cuadre Inter-Model',
    icon: '⚖️',
    section: 'Fiscal & Normativa',
    render: renderTaxReconciliation,
  },
  {
    path: '/wizard',
    label: 'Assistent Guiat',
    icon: '🧙',
    section: 'Eines',
    render: renderWizard,
  },
  {
    path: '/assessor',
    label: 'Fiscal Advisor (Estalvi)',
    icon: '💡',
    section: 'Eines',
    render: renderAdvisor,
  },
  {
    path: '/comparador',
    label: 'Individual vs Conjunta',
    icon: '⚖️',
    section: 'Eines',
    render: renderComparator,
  },
  {
    path: '/treball',
    label: 'Rendiments del treball',
    icon: '💼',
    section: 'Ingressos',
    render: renderWorkIncome,
  },
  {
    path: '/capital',
    label: 'Rendiments del capital',
    icon: '🏦',
    section: 'Ingressos',
    render: renderCapital,
  },
  {
    path: '/immobles',
    label: 'Immobles en lloguer',
    icon: '🏠',
    section: 'Ingressos',
    render: renderProperties,
  },
  {
    path: '/activitats',
    label: 'Activitats econòmiques',
    icon: '🏢',
    section: 'Ingressos',
    render: renderActivities,
  },
  {
    path: '/guanys',
    label: 'Guanys patrimonials',
    icon: '📊',
    section: 'Ingressos',
    render: renderGains,
  },
  {
    path: '/personal',
    label: 'Situació Personal',
    icon: '👤',
    section: 'Fiscal',
    render: renderPersonal,
  },
  {
    path: '/deduccions',
    label: 'Deduccions',
    icon: '🎯',
    section: 'Fiscal',
    render: renderDeductions,
  },
  {
    path: '/resultat',
    label: 'Resultat & Radar Risc',
    icon: '🧮',
    section: 'Fiscal',
    render: renderResult,
  },
  {
    path: '/simulador',
    label: 'Simulador Llei Beckham',
    icon: '⚖️',
    section: 'Eines',
    render: renderSimulator,
  },
  {
    path: '/importar',
    label: 'Importar Operacions',
    icon: '📥',
    section: 'Eines',
    render: renderImport,
  },
  {
    path: '/exportar',
    label: 'Exportar / Còpies',
    icon: '💾',
    section: 'Eines',
    render: renderExport,
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

