/**
 * @module pages/foreign-assets
 * Pàgina interactiva de control d'obligació de declarar els Models 720 i 721 (Béns i Cripto a l'estranger).
 * Totalment integrada amb el magatzem reactiu per perfil i exercici fiscal.
 */

import { store } from '../store.ts';
import { auditForeignAssetsObligation, type ForeignAssetsData } from '../fiscal/model720-engine.ts';
import { formatCurrency } from '../utils/currency.ts';
import { showToast } from '../components/toast.ts';

export function renderForeignAssets(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page-container form-page';

  const data = store.getData();

  let foreignState: ForeignAssetsData = data.foreignAssets && data.foreignAssets.accounts && data.foreignAssets.accounts.length > 0
    ? data.foreignAssets
    : {
        accounts: [
          { id: '1', bankName: 'Trade Republic Bank GmbH', countryCode: 'DE', ibanOrNumber: 'DE89...', balanceYearEnd: 15400, averageBalanceQ4: 14200 },
          { id: '2', bankName: 'Revolut Bank UAB', countryCode: 'LT', ibanOrNumber: 'LT45...', balanceYearEnd: 4800, averageBalanceQ4: 5100 },
        ],
        securities: [
          { id: 's1', brokerName: 'Interactive Brokers Ireland', countryCode: 'IE', assetDescription: 'Accions Apple, Microsoft & ETF S&P 500', units: 150, totalValueYearEnd: 42000 },
        ],
        realEstate: [],
        crypto: [
          { id: 'c1', exchangeName: 'Binance (No Resident)', cryptoSymbol: 'BTC / ETH', units: 0.85, valueYearEndEUR: 32000 },
        ],
      };

  function saveAndRender() {
    store.update('foreignAssets', foreignState);
    renderView();
  }

  function renderView() {
    const audit = auditForeignAssetsObligation(foreignState);

    page.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:var(--space-md);">
        <div>
          <div style="display:flex; align-items:center; gap:var(--space-sm);">
            <h1 class="page-header__title" style="margin:0;">🌍 Béns i Criptomonedes a l'Estranger</h1>
            <span class="badge badge--primary">Models 720 & 721 AEAT</span>
          </div>
          <p class="page-header__subtitle" style="margin:4px 0 0 0;">
            Control automàtic del llindar de 50.000 € en comptes bancaris (Revolut, Trade Republic), brokers (IBKR, Degiro) i exchanges
          </p>
        </div>
        <div style="display:flex; gap:var(--space-sm);">
          <span class="badge ${audit.model720Obligation || audit.model721MustDeclare ? 'badge--warning' : 'badge--success'}" style="font-size:0.85rem; padding:6px 14px;">
            ${audit.model720Obligation || audit.model721MustDeclare ? '⚠️ OBLIGACIÓ DE DECLARAR ACTIVA' : '✅ Cap bloc supera 50.000 €'}
          </span>
        </div>
      </div>

      <!-- Alertes i Dictamen -->
      <div style="display:flex; flex-direction:column; gap:var(--space-sm); margin-bottom:var(--space-xl);">
        ${audit.summaryAlerts.map(a => `
          <div style="background:var(--bg-surface-elevated); border-left:4px solid ${audit.model720Obligation || audit.model721MustDeclare ? 'var(--color-warning)' : 'var(--color-success)'}; padding:12px 16px; border-radius:var(--radius-sm); font-size:var(--text-sm);">
            ${a}
          </div>
        `).join('')}
      </div>

      <!-- 4 Cards dels Blocs de 50.000 € -->
      <div class="dashboard-stats" style="margin-bottom:var(--space-xl);">
        <!-- Bloc 1 -->
        <div class="stat-card">
          <div class="stat-card__label">1. Comptes Bancaris (Model 720)</div>
          <div class="stat-card__value ${audit.block1MustDeclare ? 'text-warning' : 'text-primary'}">
            ${formatCurrency(audit.block1AccountsTotal)}
          </div>
          <div class="stat-card__hint">
            ${audit.block1MustDeclare ? '⚠️ Supera 50.000 €' : `Pendent: ${formatCurrency(Math.max(0, 50000 - audit.block1AccountsTotal))}`}
          </div>
        </div>

        <!-- Bloc 2 -->
        <div class="stat-card">
          <div class="stat-card__label">2. Valors i Brokers (Model 720)</div>
          <div class="stat-card__value ${audit.block2MustDeclare ? 'text-warning' : 'text-info'}">
            ${formatCurrency(audit.block2SecuritiesTotal)}
          </div>
          <div class="stat-card__hint">
            ${audit.block2MustDeclare ? '⚠️ Supera 50.000 €' : `Pendent: ${formatCurrency(Math.max(0, 50000 - audit.block2SecuritiesTotal))}`}
          </div>
        </div>

        <!-- Bloc 3 -->
        <div class="stat-card">
          <div class="stat-card__label">3. Immobles Estranger (Model 720)</div>
          <div class="stat-card__value ${audit.block3MustDeclare ? 'text-warning' : 'text-secondary'}">
            ${formatCurrency(audit.block3RealEstateTotal)}
          </div>
          <div class="stat-card__hint">
            ${audit.block3MustDeclare ? '⚠️ Supera 50.000 €' : 'Cap immoble declarat'}
          </div>
        </div>

        <!-- Model 721 -->
        <div class="stat-card">
          <div class="stat-card__label">Criptoactius (Model 721)</div>
          <div class="stat-card__value ${audit.model721MustDeclare ? 'text-warning' : 'text-success'}">
            ${formatCurrency(audit.model721CryptoTotal)}
          </div>
          <div class="stat-card__hint">
            ${audit.model721MustDeclare ? '⚠️ Supera 50.000 €' : `Pendent: ${formatCurrency(Math.max(0, 50000 - audit.model721CryptoTotal))}`}
          </div>
        </div>
      </div>

      <!-- Llista de Comptes Bancaris Estrangers -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div class="card__title">🏦 Bloc 1: Comptes Bancaris Estrangers (Revolut, N26, Trade Republic...)</div>
          <button class="btn btn--secondary btn--sm" id="btn-add-account">＋ Afegir Compte</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${foreignState.accounts.map(acc => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default); font-size:var(--text-sm);">
              <div>
                <strong>${acc.bankName}</strong> <span class="badge badge--secondary">${acc.countryCode}</span>
                <div style="font-size:0.75rem; color:var(--text-muted);">${acc.ibanOrNumber} | Saldo mitjà Q4: ${formatCurrency(acc.averageBalanceQ4)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:var(--space-md);">
                <strong class="mono">${formatCurrency(acc.balanceYearEnd)}</strong>
                <button class="btn btn--ghost btn--sm btn--icon" data-del-account="${acc.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Llista de Valors i Brokers Estrangers -->
      <div class="card" style="margin-bottom:var(--space-xl);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div class="card__title">📈 Bloc 2: Valors, Accions i Fons en Brokers Estrangers (IBKR, Degiro...)</div>
          <button class="btn btn--secondary btn--sm" id="btn-add-security">＋ Afegir Valor</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${foreignState.securities.map(sec => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default); font-size:var(--text-sm);">
              <div>
                <strong>${sec.brokerName}</strong> <span class="badge badge--secondary">${sec.countryCode}</span>
                <div style="font-size:0.75rem; color:var(--text-muted);">${sec.assetDescription}</div>
              </div>
              <div style="display:flex; align-items:center; gap:var(--space-md);">
                <strong class="mono">${formatCurrency(sec.totalValueYearEnd)}</strong>
                <button class="btn btn--ghost btn--sm btn--icon" data-del-sec="${sec.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Llista de Criptoactius (Model 721) -->
      <div class="card">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
          <div class="card__title">₿ Model 721: Criptomonedes en Exchanges No Residents (Binance, Kraken...)</div>
          <button class="btn btn--secondary btn--sm" id="btn-add-crypto">＋ Afegir Cripto</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${foreignState.crypto.map(cr => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); border:1px solid var(--border-default); font-size:var(--text-sm);">
              <div>
                <strong>${cr.exchangeName}</strong> <span class="badge badge--warning">${cr.cryptoSymbol}</span>
                <div style="font-size:0.75rem; color:var(--text-muted);">${cr.units} unitats</div>
              </div>
              <div style="display:flex; align-items:center; gap:var(--space-md);">
                <strong class="mono">${formatCurrency(cr.valueYearEndEUR)}</strong>
                <button class="btn btn--ghost btn--sm btn--icon" data-del-crypto="${cr.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Listeners
    page.querySelector('#btn-add-account')?.addEventListener('click', () => {
      const name = prompt('Nom de l\'entitat bancària (ex: Revolut Bank UAB):');
      if (name) {
        const bal = parseFloat(prompt('Saldo a 31 de desembre (€):') || '0') || 0;
        foreignState.accounts.push({
          id: crypto.randomUUID(),
          bankName: name,
          countryCode: 'UE',
          ibanOrNumber: 'IBAN...',
          balanceYearEnd: bal,
          averageBalanceQ4: bal,
        });
        saveAndRender();
        showToast('Compte estranger afegit i guardat', 'success');
      }
    });

    page.querySelector('#btn-add-security')?.addEventListener('click', () => {
      const broker = prompt('Nom del broker estranger (ex: Interactive Brokers):');
      if (broker) {
        const val = parseFloat(prompt('Valoració total a 31 de desembre (€):') || '0') || 0;
        foreignState.securities.push({
          id: crypto.randomUUID(),
          brokerName: broker,
          countryCode: 'IE',
          assetDescription: 'Cartera de valors',
          units: 1,
          totalValueYearEnd: val,
        });
        saveAndRender();
        showToast('Valor estranger afegit i guardat', 'success');
      }
    });

    page.querySelector('#btn-add-crypto')?.addEventListener('click', () => {
      const exch = prompt('Nom de l\'exchange no resident (ex: Binance):');
      if (exch) {
        const val = parseFloat(prompt('Valoració a 31 de desembre (€):') || '0') || 0;
        foreignState.crypto.push({
          id: crypto.randomUUID(),
          exchangeName: exch,
          cryptoSymbol: 'CRYPTO',
          units: 1,
          valueYearEndEUR: val,
        });
        saveAndRender();
        showToast('Posició cripto afegida i guardada', 'success');
      }
    });

    page.querySelectorAll('[data-del-account]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delAccount;
        foreignState.accounts = foreignState.accounts.filter(a => a.id !== id);
        saveAndRender();
      });
    });

    page.querySelectorAll('[data-del-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delSec;
        foreignState.securities = foreignState.securities.filter(s => s.id !== id);
        saveAndRender();
      });
    });

    page.querySelectorAll('[data-del-crypto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delCrypto;
        foreignState.crypto = foreignState.crypto.filter(c => c.id !== id);
        saveAndRender();
      });
    });
  }

  renderView();
  return page;
}
