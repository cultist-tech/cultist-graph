import { JSONValue, store } from "@graphprotocol/graph-ts/index";
import { TokenRoyalty } from "../../generated/schema";

export function getTokenId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function removeToken(id: string): void {
    store.remove("Token", id);
}

export function convertRarity(rarityValue: JSONValue): i32 {
    const rarity = rarityValue.toString();

    if (rarity == "Common") {
        return 0 as i32;
    } else if (rarity == "Uncommon") {
        return 1 as i32;
    } else if (rarity == "Rare") {
        return 2 as i32;
    } else if (rarity == "Uniq") {
        return 3 as i32;
    } else if (rarity == "Legendary") {
        return 4 as i32;
    } else if (rarity == "Artefact") {
        return 5 as i32;
    }

    return rarityValue.toI64() as i32;
}

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
