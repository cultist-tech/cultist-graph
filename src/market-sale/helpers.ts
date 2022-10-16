import { JSONValue, BigInt } from "@graphprotocol/graph-ts";
import { MarketSaleCondition } from "../../generated/schema";
import { getOrCreateStatisticSystem } from "../api/statistic";
import {log, store} from "@graphprotocol/graph-ts/index";

export function getMarketSaleId(contractId: string, tokenId: string): string {
  return contractId + "||" + tokenId;
}
export function removeMarketSale(saleId: string): void {
  store.remove("MarketSale", saleId.toString());

  log.error("[market_sale_removed]: ", [saleId.toString()]);
}

export function saveMarketSaleConditions(saleId: string, obj: JSONValue): void {
    const royaltyObj = obj.toObject();

    for (let i = 0; i < royaltyObj.entries.length; i++) {
        const row = royaltyObj.entries[i];

        const rowId = saleId + "||" + row.key.toString();

        const saleCondition = new MarketSaleCondition(rowId);
        saleCondition.saleId = saleId.toString();
        saleCondition.sale = saleId.toString();
        saleCondition.ftTokenId = row.key;
        saleCondition.price = row.value.toString();

        if (saleCondition.ftTokenId === "near") {
            const stats = getOrCreateStatisticSystem();

            stats.marketSaleNearTotal++;
            stats.marketSaleNearSum = BigInt.fromString(stats.marketSaleNearSum)
                .plus(BigInt.fromString(saleCondition.price))
                .toString();

            if (
                BigInt.fromString(stats.marketSaleNearFloor).gt(
                    BigInt.fromString(saleCondition.price)
                )
            ) {
                stats.marketSaleNearFloor = saleCondition.price;

                stats.save();
            }
        }

        saleCondition.save();
    }
}
