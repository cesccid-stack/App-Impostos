/**
 * @module fiscal/model720-engine
 * Motor de verificació d'obligació de declarar els Models 720 i 721 de l'AEAT
 * (Declaració informativa sobre béns, valors i criptoactius a l'estranger).
 */

export interface ForeignAccountItem {
  id: string;
  bankName: string;          // Ex: "Revolut Bank UAB", "Trade Republic Bank GmbH", "N26 Bank AG"
  countryCode: string;       // Ex: "LT", "DE", "FR"
  ibanOrNumber: string;
  balanceYearEnd: number;    // Saldo a 31 de desembre (€)
  averageBalanceQ4: number;  // Saldo mitjà de l'últim trimestre (€)
}

export interface ForeignSecurityItem {
  id: string;
  brokerName: string;        // Ex: "Interactive Brokers Ireland", "Degiro (FlatexDEGIRO Bank AG)", "eToro Europe"
  countryCode: string;
  assetDescription: string;  // Ex: "Accions Apple Inc, ETF Vanguard S&P 500"
  isin?: string;
  units: number;
  totalValueYearEnd: number; // Valor liquidatiu / cotització a 31 de desembre (€)
}

export interface ForeignRealEstateItem {
  id: string;
  countryCode: string;
  address: string;
  acquisitionDate: string;
  acquisitionCostEUR: number;
}

export interface ForeignCryptoItem {
  id: string;
  exchangeName: string;      // Ex: "Binance", "Kraken (Payward)", "Coinbase Europe", "Bybit"
  cryptoSymbol: string;      // Ex: "BTC", "ETH", "SOL", "USDC"
  units: number;
  valueYearEndEUR: number;   // Valor de cotització a 31 de desembre (€)
}

export interface ForeignAssetsData {
  accounts: ForeignAccountItem[];
  securities: ForeignSecurityItem[];
  realEstate: ForeignRealEstateItem[];
  crypto: ForeignCryptoItem[];
}

export interface Model720AuditResult {
  block1AccountsTotal: number;
  block1MustDeclare: boolean;

  block2SecuritiesTotal: number;
  block2MustDeclare: boolean;

  block3RealEstateTotal: number;
  block3MustDeclare: boolean;

  model720Obligation: boolean; // Si algun dels 3 blocs supera 50.000 €

  model721CryptoTotal: number;
  model721MustDeclare: boolean; // Si cripto a l'estranger supera 50.000 €

  summaryAlerts: string[];
}

/**
 * Avalua el compliment dels llindars de 50.000 € dels Models 720 i 721.
 */
export function auditForeignAssetsObligation(data: ForeignAssetsData): Model720AuditResult {
  const accounts = data.accounts || [];
  const securities = data.securities || [];
  const realEstate = data.realEstate || [];
  const crypto = data.crypto || [];

  // Bloc 1: Comptes bancaris estrangers (es pren el major entre saldo 31/12 i saldo mitjà Q4)
  const block1AccountsTotal = accounts.reduce((sum, acc) => {
    return sum + Math.max(acc.balanceYearEnd || 0, acc.averageBalanceQ4 || 0);
  }, 0);
  const block1MustDeclare = block1AccountsTotal > 50000;

  // Bloc 2: Valors, accions i fons dipositats a l'estranger
  const block2SecuritiesTotal = securities.reduce((sum, sec) => sum + (sec.totalValueYearEnd || 0), 0);
  const block2MustDeclare = block2SecuritiesTotal > 50000;

  // Bloc 3: Immobles a l'estranger
  const block3RealEstateTotal = realEstate.reduce((sum, re) => sum + (re.acquisitionCostEUR || 0), 0);
  const block3MustDeclare = block3RealEstateTotal > 50000;

  const model720Obligation = block1MustDeclare || block2MustDeclare || block3MustDeclare;

  // Model 721: Criptomonedes en exchanges no residents
  const model721CryptoTotal = crypto.reduce((sum, c) => sum + (c.valueYearEndEUR || 0), 0);
  const model721MustDeclare = model721CryptoTotal > 50000;

  const summaryAlerts: string[] = [];

  if (block1MustDeclare) {
    summaryAlerts.push(`⚠️ OBLIGACIÓ MODEL 720 (Bloc 1 - Comptes): Tens ${block1AccountsTotal.toFixed(2)} € en comptes bancaris estrangers (>50.000 €). Has de presentar el Model 720 abans del 31 de març.`);
  }
  if (block2MustDeclare) {
    summaryAlerts.push(`⚠️ OBLIGACIÓ MODEL 720 (Bloc 2 - Valors/Brokers): Tens ${block2SecuritiesTotal.toFixed(2)} € en accions i fons en brokers estrangers (>50.000 €).`);
  }
  if (block3MustDeclare) {
    summaryAlerts.push(`⚠️ OBLIGACIÓ MODEL 720 (Bloc 3 - Immobles): Tens ${block3RealEstateTotal.toFixed(2)} € en immobles a l'estranger (>50.000 €).`);
  }
  if (model721MustDeclare) {
    summaryAlerts.push(`⚠️ OBLIGACIÓ MODEL 721 (Criptoactius a l'estranger): Tens ${model721CryptoTotal.toFixed(2)} € en criptomonedes en plataformes no residents (>50.000 €). Has de presentar el Model 721.`);
  }

  if (!model720Obligation && !model721MustDeclare) {
    summaryAlerts.push('✅ No estàs obligat a presentar ni el Model 720 ni el Model 721 (cap bloc supera els 50.000 € a 31 de desembre).');
  }

  return {
    block1AccountsTotal,
    block1MustDeclare,
    block2SecuritiesTotal,
    block2MustDeclare,
    block3RealEstateTotal,
    block3MustDeclare,
    model720Obligation,
    model721CryptoTotal,
    model721MustDeclare,
    summaryAlerts,
  };
}
