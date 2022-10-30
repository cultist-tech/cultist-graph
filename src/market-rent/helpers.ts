import { JSONValue, BigInt, store, log } from "@graphprotocol/graph-ts/index";
import { MarketRentCondition, MarketSaleCondition, Statistic } from "../../generated/schema";
import { getOrCreateStatisticSystem } from "../api/statistic";
import { getMarketSaleConditionId } from "../market-sale/helpers";

export function getMarketRentId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}
export function getMarketRentConditionId(rentId: string, tokenId: string): string {
    return rentId + "||" + tokenId;
}

export function removeMarketRent(rentId: string): void {
    store.remove("MarketRent", rentId.toString());

    log.warning("[market_rent_removed]: ", [rentId.toString()]);
}

export function saveMarketRentConditions(
    stats: Statistic,
    rentId: string,
    accountId: string,
    obj: JSONValue
): void {
    const royaltyObj = obj.toObject();

    for (let i = 0; i < royaltyObj.entries.length; i++) {
        const row = royaltyObj.entries[i];

        const rowId = getMarketRentConditionId(rentId, row.key.toString());

        const saleCondition = new MarketRentCondition(rowId);
        saleCondition.rent = rentId.toString();
        saleCondition.rentId = rentId.toString();
        saleCondition.ftTokenId = row.key.toString();
        saleCondition.price = row.value.toString();

        if (saleCondition.ftTokenId == "near") {
            updateCreateMarketRentStats(stats, rentId, accountId, saleCondition);
        }

        saleCondition.save();
    }
}

export function updateCreateMarketRentStats(
    stats: Statistic,
    saleId: string,
    accountId: string,
    saleCondition: MarketRentCondition
): void {
    stats.marketRentNearTotal++;
    stats.marketRentNearSum = BigInt.fromString(stats.marketRentNearSum)
        .plus(BigInt.fromString(saleCondition.price))
        .toString();

    if (BigInt.fromString(stats.marketRentNearFloor).gt(BigInt.fromString(saleCondition.price))) {
        stats.marketRentNearFloor = saleCondition.price;
    }
}

export function updateRemoveMarketRentStats(
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
