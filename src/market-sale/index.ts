import { store } from "@graphprotocol/graph-ts/index";

export function getMarketSaleId(contractId: string, tokenId: string): string {
  return contractId + '||' + tokenId;
}
export function removeMarketSale(saleId: string): void {
    store.remove("MarketSale", saleId.toString());
}
