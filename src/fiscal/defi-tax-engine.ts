import type { CryptoTransaction, CryptoCapitalGain, CryptoData, Model721Data } from '../types-crypto.ts';
import { round2 } from '../utils/exact-math.ts';

export class DefiTaxEngine {
  /**
   * Processa un llistat de transaccions per calcular Guanys Patrimonials via FIFO
   * i ingressos de DeFi (Staking, Airdrops).
   */
  public static processTransactions(transactions: CryptoTransaction[]): CryptoData {
    // 1. Ordenar per data ascendent
    const sortedTxs = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // 2. Separar ingressos DeFi
    let defiIncome = 0;
    const inventory: Record<string, { amount: number; eurCost: number; date: string }[]> = {};
    const capitalGains: CryptoCapitalGain[] = [];

    for (const tx of sortedTxs) {
      // Ingressos DeFi (Staking, Airdrop, Hard Fork)
      if (['staking_reward', 'airdrop', 'hard_fork'].includes(tx.type)) {
        defiIncome += tx.fiatValueInEUR;
        // Aquests ingressos també entren a l'inventari a cost zero o cost de mercat
        // Segons DGT, s'imputen pel seu valor de mercat (fiatValueInEUR) en aquell moment.
        if (!inventory[tx.assetIn]) inventory[tx.assetIn] = [];
        inventory[tx.assetIn].push({
          amount: tx.amountIn,
          eurCost: tx.fiatValueInEUR,
          date: tx.date,
        });
        continue;
      }

      // Compres o Entrades
      if (tx.type === 'buy' || tx.type === 'transfer_in') {
        if (!inventory[tx.assetIn]) inventory[tx.assetIn] = [];
        // Cost d'adquisició = Valor Fiat pagat (+ comissions en fiat si hi hagués, aquí simplificat)
        inventory[tx.assetIn].push({
          amount: tx.amountIn,
          eurCost: tx.fiatValueInEUR,
          date: tx.date,
        });
      }

      // Vendes (inclou Intercanvis cripto a cripto)
      if (tx.type === 'sell' || tx.type === 'exchange') {
        const assetSold = tx.assetIn; // El que donem
        let amountToSell = tx.amountIn;
        const totalSellValue = tx.fiatValueInEUR; // Valor fiat obtingut per la venda

        const pool = inventory[assetSold] || [];

        while (amountToSell > 0 && pool.length > 0) {
          const firstIn = pool[0]; // FIFO
          if (firstIn.amount <= amountToSell) {
            // Esgota el lot sencer
            const proportionValue = (firstIn.amount / tx.amountIn) * totalSellValue;
            capitalGains.push({
              id: `cg-${crypto.randomUUID()}`,
              asset: assetSold,
              sellDate: tx.date,
              sellAmount: firstIn.amount,
              sellFiatValue: proportionValue,
              buyDate: firstIn.date,
              buyFiatValue: firstIn.eurCost,
              capitalGain: proportionValue - firstIn.eurCost,
            });
            amountToSell -= firstIn.amount;
            pool.shift(); // Elimina el lot
          } else {
            // Esgota només una part del lot
            const costProportion = (amountToSell / firstIn.amount) * firstIn.eurCost;
            const sellProportionValue = (amountToSell / tx.amountIn) * totalSellValue;

            capitalGains.push({
              id: `cg-${crypto.randomUUID()}`,
              asset: assetSold,
              sellDate: tx.date,
              sellAmount: amountToSell,
              sellFiatValue: sellProportionValue,
              buyDate: firstIn.date,
              buyFiatValue: costProportion,
              capitalGain: sellProportionValue - costProportion,
            });

            firstIn.amount -= amountToSell;
            firstIn.eurCost -= costProportion;
            amountToSell = 0;
          }
        }

        // Si és un 'exchange', entra el nou actiu a l'inventari
        if (tx.type === 'exchange' && tx.assetOut && tx.amountOut) {
          if (!inventory[tx.assetOut]) inventory[tx.assetOut] = [];
          inventory[tx.assetOut].push({
            amount: tx.amountOut,
            eurCost: totalSellValue, // El cost d'adquisició és el valor de mercat al moment de l'intercanvi
            date: tx.date,
          });
        }
      }
    }

    return {
      transactions: sortedTxs,
      capitalGains,
      defiIncome,
    };
  }

  /**
   * Genera les dades oficials del Model 721 (declaració informativa de criptomonedes a l'estranger).
   * Obligatori només si el saldo conjunt en exchanges o custòdia a l'estranger supera els 50.000 € a 31 de desembre.
   */
  public static calculateModel721(year: number, transactions: CryptoTransaction[] = []): Model721Data {
    if (!transactions || transactions.length === 0) {
      return {
        year,
        assets: [],
        totalValue: 0,
        requiresFiling: false,
      };
    }

    const endOfYear = new Date(`${year}-12-31T23:59:59Z`).getTime();
    const relevantTxs = transactions.filter((tx) => new Date(tx.date).getTime() <= endOfYear);

    const foreignBalances: Record<
      string,
      { balance: number; eurValueAtDec31: number; exchangeName: string; country: string }
    > = {};

    for (const tx of relevantTxs) {
      const exchange = tx.walletOrExchange || 'Desconegut';
      const isSpanish =
        exchange.toLowerCase().includes('bit2me') || exchange.toLowerCase().includes('ledger_es');
      if (isSpanish) continue;

      const country = exchange.toLowerCase().includes('binance')
        ? 'MT'
        : exchange.toLowerCase().includes('kraken')
          ? 'IE'
          : exchange.toLowerCase().includes('coinbase')
            ? 'IE'
            : exchange.toLowerCase().includes('kucoin')
              ? 'SC'
              : 'XX';

      if (['buy', 'transfer_in', 'staking_reward', 'airdrop', 'hard_fork'].includes(tx.type)) {
        const key = `${exchange}_${tx.assetIn}`;
        if (!foreignBalances[key]) {
          foreignBalances[key] = { balance: 0, eurValueAtDec31: 0, exchangeName: exchange, country };
        }
        foreignBalances[key].balance += tx.amountIn;
        foreignBalances[key].eurValueAtDec31 += tx.fiatValueInEUR;
      }

      if (['sell', 'transfer_out'].includes(tx.type)) {
        const key = `${exchange}_${tx.assetIn}`;
        if (foreignBalances[key]) {
          const ratio =
            tx.amountIn > 0 && foreignBalances[key].balance > 0
              ? Math.min(1, tx.amountIn / foreignBalances[key].balance)
              : 0;
          foreignBalances[key].balance = Math.max(0, foreignBalances[key].balance - tx.amountIn);
          foreignBalances[key].eurValueAtDec31 = Math.max(
            0,
            foreignBalances[key].eurValueAtDec31 * (1 - ratio),
          );
        }
      }

      if (tx.type === 'exchange') {
        const keyOut = `${exchange}_${tx.assetIn}`;
        if (foreignBalances[keyOut]) {
          const ratio =
            tx.amountIn > 0 && foreignBalances[keyOut].balance > 0
              ? Math.min(1, tx.amountIn / foreignBalances[keyOut].balance)
              : 0;
          foreignBalances[keyOut].balance = Math.max(0, foreignBalances[keyOut].balance - tx.amountIn);
          foreignBalances[keyOut].eurValueAtDec31 = Math.max(
            0,
            foreignBalances[keyOut].eurValueAtDec31 * (1 - ratio),
          );
        }
        if (tx.assetOut && tx.amountOut) {
          const keyIn = `${exchange}_${tx.assetOut}`;
          if (!foreignBalances[keyIn]) {
            foreignBalances[keyIn] = { balance: 0, eurValueAtDec31: 0, exchangeName: exchange, country };
          }
          foreignBalances[keyIn].balance += tx.amountOut;
          foreignBalances[keyIn].eurValueAtDec31 += tx.fiatValueInEUR;
        }
      }
    }

    const assets = Object.entries(foreignBalances)
      .filter(([_, b]) => b.balance > 0.000001)
      .map(([key, b]) => ({
        asset: key.split('_')[1] || key,
        balance: round2(b.balance),
        eurValueAtDec31: round2(b.eurValueAtDec31),
        exchangeName: b.exchangeName,
        country: b.country,
      }));

    const totalValue = assets.reduce((sum, a) => sum + a.eurValueAtDec31, 0);

    return {
      year,
      assets,
      totalValue: round2(totalValue),
      requiresFiling: totalValue > 50000,
    };
  }
}
