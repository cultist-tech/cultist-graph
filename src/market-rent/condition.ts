import { JSONValue } from "@graphprotocol/graph-ts/index";
import { MarketRentCondition } from "../../generated/schema";

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

        saleCondition.save();
    }
}
