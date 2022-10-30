import { JSONValue, BigInt } from "@graphprotocol/graph-ts";
import { MarketSaleCondition, Statistic } from "../../generated/schema";
import { getOrCreateStatisticSystem } from "../api/statistic";
import { log, store } from "@graphprotocol/graph-ts/index";

export function getMarketSaleId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}
export function getMarketSaleConditionId(saleId: string, ftTokenId: string): string {
    return saleId + "||" + ftTokenId;
}

export function removeMarketSale(saleId: string): void {
    store.remove("MarketSale", saleId.toString());

    log.info("[market_sale_removed]: ", [saleId.toString()]);
}

export function saveMarketSaleConditions(
    stats: Statistic,
    saleId: string,
    accountId: string,
    obj: JSONValue
): void {
    const royaltyObj = obj.toObject();

    for (let i = 0; i < royaltyObj.entries.length; i++) {
        const row = royaltyObj.entries[i];

        const rowId = getMarketSaleConditionId(saleId, row.key.toString());
        const saleCondition = new MarketSaleCondition(rowId);

        saleCondition.saleId = saleId.toString();
        saleCondition.sale = saleId.toString();
        saleCondition.ftTokenId = row.key.toString();
        saleCondition.price = row.value.toString();

        if (saleCondition.ftTokenId == "near") {
            updateCreateMarketSaleStats(stats, saleId, accountId, saleCondition);
        }

        saleCondition.save();
    }
}

export function updateCreateMarketSaleStats(
    stats: Statistic,
    saleId: string,
    accountId: string,
    saleCondition: MarketSaleCondition
): void {
    if (saleCondition.ftTokenId == "near") {
        stats.marketSaleNearTotal++;
        stats.marketSaleNearSum = BigInt.fromString(stats.marketSaleNearSum)
            .plus(BigInt.fromString(saleCondition.price))
            .toString();
    }
}

export function updateRemoveMarketSaleStats(
    stats: Statistic,
    saleId: string,
    accountId: string
): void {
    const saleConditionId = getMarketSaleConditionId(saleId, "near");
    const saleCondition = MarketSaleCondition.load(saleConditionId);

    if (saleCondition) {
        stats.marketSaleNearTotal--;
        stats.marketSaleNearSum = BigInt.fromString(stats.marketSaleNearSum)
            .minus(BigInt.fromString(saleCondition.price))
            .toString();
    }
}
