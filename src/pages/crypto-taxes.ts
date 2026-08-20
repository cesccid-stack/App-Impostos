import { store } from '../store.ts';
import { DefiTaxEngine } from '../fiscal/defi-tax-engine.ts';
import type { CryptoTransaction, CryptoCapitalGain } from '../types-crypto.ts';

export function renderCryptoTaxes(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-container slide-in';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Criptomonedes & DeFi</h1>
      <p class="text-gray-500 mt-2">Càlcul automatitzat FIFO, Ingressos Staking, Airdrops i Model 721.</p>
    </div>
    <div class="flex gap-2">
      <button id="calc-crypto-btn" class="btn-primary">
        <span class="icon">⚡</span> Calcular FIFO
      </button>
      <button id="sync-irpf-btn" class="btn-secondary">
        <span class="icon">🔄</span> Sincronitzar amb IRPF
      </button>
    </div>
  `;
  container.appendChild(header);

  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';

  const summaryContainer = document.createElement('div');
  summaryContainer.className = 'col-span-1 lg:col-span-2 card p-6 border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10';
  summaryContainer.id = 'crypto-summary';
  contentGrid.appendChild(summaryContainer);

  const txContainer = document.createElement('div');
  txContainer.id = 'crypto-transactions';
  contentGrid.appendChild(txContainer);

  const gainsContainer = document.createElement('div');
  gainsContainer.id = 'crypto-gains';
  contentGrid.appendChild(gainsContainer);

  container.appendChild(contentGrid);

  function renderData() {
    const data = store.getData();
    const crypto = data.crypto;
    
    if (!crypto) return;

    // Summary
    const totalCapitalGains = crypto.capitalGains.reduce((sum, cg) => sum + cg.capitalGain, 0);
    summaryContainer.innerHTML = `
      <h2 class="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4">Resum Fiscal Cripto</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <span class="block text-sm text-gray-500">Guanys Patrimonials (FIFO)</span>
          <span class="text-2xl font-bold ${totalCapitalGains >= 0 ? 'text-emerald-600' : 'text-red-600'}">
            ${totalCapitalGains >= 0 ? '+' : ''}${totalCapitalGains.toFixed(2)} €
          </span>
        </div>
        <div>
          <span class="block text-sm text-gray-500">Ingressos DeFi (Staking/Airdrops)</span>
          <span class="text-2xl font-bold text-emerald-600">
            +${crypto.defiIncome.toFixed(2)} €
          </span>
        </div>
        <div>
          <span class="block text-sm text-gray-500">Estat Model 721</span>
          <span class="text-lg font-bold text-gray-800 dark:text-gray-200">
            ${crypto.model721?.requiresFiling ? '⚠️ Obligatori (>50k€)' : '✅ No Obligatori'}
          </span>
        </div>
      </div>
    `;

    // Transactions
    let txHtml = `<h3 class="text-lg font-bold mb-3 border-b pb-2">Transaccions (${crypto.transactions.length})</h3>`;
    if (crypto.transactions.length === 0) {
      txHtml += `<p class="text-gray-500 text-sm">Cap transacció registrada.</p>`;
    } else {
      txHtml += `<ul class="space-y-2 max-h-96 overflow-y-auto pr-2">`;
      crypto.transactions.forEach((tx: CryptoTransaction) => {
        let icon = '🔄';
        if (tx.type === 'buy') icon = '🟢';
        if (tx.type === 'sell') icon = '🔴';
        if (tx.type === 'staking_reward' || tx.type === 'airdrop') icon = '🎁';
        
        txHtml += `
          <li class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded flex justify-between items-center text-sm">
            <div>
              <span class="mr-2">${icon}</span>
              <span class="font-bold">${tx.type.toUpperCase()}</span>
              <span class="text-xs text-gray-500 block ml-6">${tx.date.split('T')[0]} - ${tx.walletOrExchange}</span>
            </div>
            <div class="text-right">
              <span class="font-bold">${tx.amountIn} ${tx.assetIn}</span>
              ${tx.assetOut ? `<span class="block text-xs text-gray-500">-> ${tx.amountOut} ${tx.assetOut}</span>` : ''}
              <span class="block text-xs text-blue-500 font-bold">${tx.fiatValueInEUR.toFixed(2)} €</span>
            </div>
          </li>
        `;
      });
      txHtml += `</ul>`;
    }
    txContainer.innerHTML = txHtml;

    // Capital Gains
    let cgHtml = `<h3 class="text-lg font-bold mb-3 border-b pb-2">Guanys/Pèrdues FIFO (${crypto.capitalGains.length})</h3>`;
    if (crypto.capitalGains.length === 0) {
      cgHtml += `<p class="text-gray-500 text-sm">Cap venda registrada per calcular FIFO.</p>`;
    } else {
      cgHtml += `<ul class="space-y-2 max-h-96 overflow-y-auto pr-2">`;
      crypto.capitalGains.forEach((cg: CryptoCapitalGain) => {
        const isGain = cg.capitalGain >= 0;
        cgHtml += `
          <li class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded flex justify-between items-center text-sm border-l-4 ${isGain ? 'border-emerald-500' : 'border-red-500'}">
            <div>
              <span class="font-bold">Venda de ${cg.sellAmount.toFixed(4)} ${cg.asset}</span>
              <span class="text-xs text-gray-500 block">Adquisició: ${cg.buyDate.split('T')[0]} (Cost: ${cg.buyFiatValue.toFixed(2)}€)</span>
              <span class="text-xs text-gray-500 block">Venda: ${cg.sellDate.split('T')[0]} (Valor: ${cg.sellFiatValue.toFixed(2)}€)</span>
            </div>
            <div class="text-right font-bold ${isGain ? 'text-emerald-600' : 'text-red-600'}">
              ${isGain ? '+' : ''}${cg.capitalGain.toFixed(2)} €
            </div>
          </li>
        `;
      });
      cgHtml += `</ul>`;
    }
    gainsContainer.innerHTML = cgHtml;
  }

  setTimeout(() => {
    document.getElementById('calc-crypto-btn')?.addEventListener('click', () => {
      // MOCK DATA: Simulem unes quantes transaccions
      const mockTxs: CryptoTransaction[] = [
        { id: '1', date: '2023-01-15T10:00:00Z', type: 'buy', assetIn: 'BTC', amountIn: 0.5, fiatValueInEUR: 10000, walletOrExchange: 'Kraken' },
        { id: '2', date: '2023-03-10T12:00:00Z', type: 'buy', assetIn: 'BTC', amountIn: 0.2, fiatValueInEUR: 5000, walletOrExchange: 'Kraken' },
        { id: '3', date: '2023-06-05T14:00:00Z', type: 'staking_reward', assetIn: 'ETH', amountIn: 1.5, fiatValueInEUR: 2500, walletOrExchange: 'Binance' },
        { id: '4', date: '2024-02-20T09:00:00Z', type: 'sell', assetIn: 'BTC', amountIn: 0.4, assetOut: 'EUR', amountOut: 20000, fiatValueInEUR: 20000, walletOrExchange: 'Kraken' },
        { id: '5', date: '2024-04-15T16:00:00Z', type: 'exchange', assetIn: 'BTC', amountIn: 0.2, assetOut: 'ETH', amountOut: 3, fiatValueInEUR: 12000, walletOrExchange: 'Kraken' }
      ];

      const processed = DefiTaxEngine.processTransactions(mockTxs);
      const mod721 = DefiTaxEngine.calculateModel721(new Date().getFullYear());

      store.update('crypto', {
        ...processed,
        model721: mod721
      });

      renderData();
    });

    document.getElementById('sync-irpf-btn')?.addEventListener('click', () => {
      const data = store.getData();
      const cryptoGains = data.crypto?.capitalGains || [];
      if (cryptoGains.length === 0) return;

      const currentGains = (data.gains?.items || []).filter(g => !g.id.startsWith('crypto_gain_'));
      
      const newGainItems = cryptoGains.map(cg => ({
        id: `crypto_gain_${cg.id}`,
        type: 'crypto' as const,
        description: `Criptomoneda: Venda ${cg.asset} (${cg.sellAmount.toFixed(4)} u.)`,
        acquisitionDate: cg.buyDate.split('T')[0],
        transferDate: cg.sellDate.split('T')[0],
        acquisitionValue: cg.buyFiatValue,
        transferValue: cg.sellFiatValue,
        expenses: 0,
        withholding: 0,
      }));

      store.update('gains', {
        ...data.gains,
        items: [...currentGains, ...newGainItems]
      });

      // També si hi ha ingressos de staking/airdrops, afegir-los a altres rendiments del capital
      if (data.crypto?.defiIncome && data.crypto.defiIncome > 0) {
        store.update('capitalIncome', {
          ...data.capitalIncome,
          otherMobiliary: (data.capitalIncome.otherMobiliary || 0) + data.crypto.defiIncome
        });
      }

      alert('Guanys i rendiments cripto sincronitzats amb èxit a la base de l\'estalvi de l\'IRPF!');
    });

    renderData();
  }, 0);

  return container;
}
