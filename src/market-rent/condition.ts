import { JSONValue, BigInt } from "@graphprotocol/graph-ts/index";
import { MarketRentCondition } from "../../generated/schema";
import { getOrCreateStatisticSystem } from "../statistic/statistic";

export function saveMarketRentConditions(rentId: string, obj: JSONValue): void {
    const royaltyObj = obj.toObject();

    for (let i = 0; i < royaltyObj.entries.length; i++) {
        const row = royaltyObj.entries[i];

        const rowId = rentId + "||" + row.key.toString();

        const saleCondition = new MarketRentCondition(rowId);
        saleCondition.rent = rentId.toString();
        saleCondition.rentId = rentId.toString();
        saleCondition.ftTokenId = row.key;
        saleCondition.price = row.value.toString();

        if (saleCondition.ftTokenId == "near") {
            const stats = getOrCreateStatisticSystem();

            stats.marketRentNearTotal++;
            stats.marketRentNearSum = BigInt.fromString(stats.marketRentNearSum)
                .plus(BigInt.fromString(saleCondition.price))
                .toString();

            if (
                BigInt.fromString(stats.marketRentNearFloor).gt(
                    BigInt.fromString(saleCondition.price)
                )
            ) {
                stats.marketRentNearFloor = saleCondition.price;

                stats.save();
            }
        }

        saleCondition.save();
    }
}
