import { JSONValue } from "@graphprotocol/graph-ts/index";
import { MarketSaleCondition } from "../../generated/schema";

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

        saleCondition.save();
    }
}
