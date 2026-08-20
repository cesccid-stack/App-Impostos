/**
 * @module types-crypto
 * Data types for Crypto & DeFi taxes (FIFO, Staking, Mod 721)
 */

export interface CryptoTransaction {
  id: string;
  date: string; // ISO 8601
  type: 'buy' | 'sell' | 'exchange' | 'staking_reward' | 'airdrop' | 'hard_fork' | 'transfer_in' | 'transfer_out';
  
  assetIn: string;     // ex: "BTC"
  amountIn: number;
  
  assetOut?: string;   // ex: "EUR" (for sell) or "ETH" (for exchange)
  amountOut?: number;
  
  feeAsset?: string;   // ex: "EUR"
  feeAmount?: number;
  
  // Fiat value at the time of the transaction (required for taxes)
  fiatValueInEUR: number;
  
  walletOrExchange: string; // ex: "Binance", "Ledger"
}

export interface CryptoCapitalGain {
  id: string;
  asset: string;
  sellDate: string;
  sellAmount: number; // Crypto amount sold
  sellFiatValue: number; // EUR value of the sale
  buyDate: string; // Mapped buy date (FIFO)
  buyFiatValue: number; // EUR value of the purchase (cost basis)
  capitalGain: number; // Resulting gain/loss
}

export interface Model721Data {
  year: number;
  assets: {
    asset: string;
    balance: number;
    eurValueAtDec31: number;
    exchangeName: string;
    country: string; // ISO Code
  }[];
  totalValue: number;
  requiresFiling: boolean; // Si totalValue > 50.000€
}

export interface CryptoData {
  transactions: CryptoTransaction[];
  capitalGains: CryptoCapitalGain[]; // Calculated via FIFO
  defiIncome: number; // Staking, Airdrops (considered savings income or general base depending on type)
  model721?: Model721Data;
}
