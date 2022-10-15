import { JSONValue } from "@graphprotocol/graph-ts/index";
import { TokenRoyalty } from "../../generated/schema";

export function saveTokenRoyalties(tokenId: string, obj: JSONValue): void {
    const royaltyObj = obj.toObject();

    for (let i = 0; i < royaltyObj.entries.length; i++) {
        const row = royaltyObj.entries[i];

        const rowId = tokenId + "-" + row.key.toString();

        const royalty = new TokenRoyalty(rowId);
        royalty.tokenId = tokenId;
        royalty.token = tokenId;
        royalty.accountId = row.key;
        royalty.value = row.value.toI64() as i32;

        royalty.save();
    }
}
