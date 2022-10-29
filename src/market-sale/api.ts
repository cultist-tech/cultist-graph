import { getOrCreateAccountRoyalty } from "../api/account-royalty";
import { sumBigInt } from "../utils";
import { JSONValue } from "@graphprotocol/graph-ts";

export class SaleMapper {
    public saveRoyalty(payout: JSONValue, ftTokenId: string, ownerId: string) {
        if (payout && !payout.isNull()) {
            const payoutObj = payout.toObject();

            for (let i = 0; i < payoutObj.entries.length; i++) {
                const row = payoutObj.entries[i];
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
}
