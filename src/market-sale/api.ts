import { getOrCreateAccountRoyalty } from "../api/account-royalty";
import { sumBigInt } from "../utils";
import { JSONValue, TypedMap } from "@graphprotocol/graph-ts";

export class SaleMapper {
    public saveRoyalty(payout: TypedMap<string, JSONValue>, ftTokenId: string, ownerId: string): void {
        for (let i = 0; i < payout.entries.length; i++) {
            const row = payout.entries[i];
            const payoutAccount = row.key;
            const payoutValue = row.value.toString();

            if (payoutAccount != ownerId) {
                const royalty = getOrCreateAccountRoyalty(payoutAccount, ftTokenId);
                royalty.amount = sumBigInt(royalty.amount, payoutValue);
                royalty.save();
            }
        }
    }
}
