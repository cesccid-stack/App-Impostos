import type { CryptoTransaction, CryptoCapitalGain, CryptoData, Model721Data } from '../types-crypto.ts';

export class DefiTaxEngine {
  /**
   * Processa un llistat de transaccions per calcular Guanys Patrimonials via FIFO
   * i ingressos de DeFi (Staking, Airdrops).
   */
  public static processTransactions(transactions: CryptoTransaction[]): CryptoData {
    // 1. Ordenar per data ascendent
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
          date: tx.date
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
          date: tx.date
        });
      }

      // Vendes (inclou Intercanvis cripto a cripto)
      if (tx.type === 'sell' || tx.type === 'exchange') {
        const assetSold = tx.assetIn; // El que donem
        let amountToSell = tx.amountIn;
        const totalSellValue = tx.fiatValueInEUR; // Valor fiat obtingut per la venda
        
        let pool = inventory[assetSold] || [];
        
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
              capitalGain: proportionValue - firstIn.eurCost
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
              capitalGain: sellProportionValue - costProportion
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
            date: tx.date
          });
        }
      }
    }

    return {
      transactions: sortedTxs,
      capitalGains,
      defiIncome
    };
  }

  /**
   * Genera les dades del model 721 (declaració de criptomonedes a l'estranger)
   * Només obligatori si el saldo a l'estranger > 50.000 € a 31 de desembre.
   */
  public static calculateModel721(year: number): Model721Data {
    // Simulació per l'exemple (en la realitat necessitaríem els balanços a 31 de desembre a l'estranger per exchange)
    
    // Per l'exemple, suposarem un balanç agregat basat en les transaccions d'entrada menys les de sortida/venda per exchange estranger.
    // Aquí farem un mock raonable si hi ha moviments.
    
    // Mock de valor per a demostració:
    const mockAssets = [
      {
        asset: 'BTC',
        balance: 1.5,
        eurValueAtDec31: 65000,
        exchangeName: 'Binance',
        country: 'MT' // Malta
      },
      {
        asset: 'ETH',
        balance: 10,
        eurValueAtDec31: 25000,
        exchangeName: 'Kraken',
        country: 'IE' // Irlanda
      }
    ];

    const totalValue = mockAssets.reduce((sum, a) => sum + a.eurValueAtDec31, 0);

    return {
      year,
      assets: mockAssets,
      totalValue,
      requiresFiling: totalValue > 50000
    };
  }
}
