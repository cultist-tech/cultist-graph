import {JSONValue, JSONValueKind, store, TypedMap} from "@graphprotocol/graph-ts/index";
import { TokenRoyalty, TokenStat } from "../../generated/schema";

export function getTokenId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function getTokenStatId(contractIdTokenId: string, statKey: string): string {
    return contractIdTokenId + "||" + statKey;
}

export function removeToken(id: string): void {
    store.remove("Token", id);
}

export function parseRarity(value: JSONValue): i32 {
    if (value.kind === JSONValueKind.STRING) {
        const rarity = value.toString();

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
        } else {
            return 0 as i32;
        }
    } else {
        return value.toU64() as i32;
    }
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

export function saveTokenStats(contractId: string, tokenId: string, types: TypedMap<string, JSONValue>): void {
    const contractTokenId = getTokenId(contractId, tokenId);

    for (let i = 0; i < types.entries.length; i++) {
        const row = types.entries[i];

        const tokenStatId = getTokenStatId(contractTokenId, row.key);
        const value = row.value.toString();

        const stat = new TokenStat(tokenStatId);

        stat.token = contractTokenId;
        stat.tokenId = tokenId;
        stat.key = row.key;
        stat.value = value;

        stat.save();
    }
}
export function parseNftStats(token: TypedMap<string, JSONValue>): TypedMap<string, JSONValue> {
    const typesJson = token.get("types");

    if (typesJson) {
        return typesJson.toObject();
    }

    const deprecatedCollection = token.get("collection");
    const deprecatedTokenType = token.get("token_type");
    const deprecatedTokenSubType = token.get("token_sub_type");


    const deprecated = new TypedMap<string, JSONValue>();

    if (deprecatedCollection && !deprecatedCollection.isNull()) {
        deprecated.set("collection", deprecatedCollection);
    }
    if (deprecatedTokenSubType && !deprecatedTokenSubType.isNull()) {
        deprecated.set("sub_type", deprecatedTokenSubType);
    }
    if (deprecatedTokenType && !deprecatedTokenType.isNull()) {
        deprecated.set("type", deprecatedTokenType);
    }

    return deprecated;
}

// upgrade

export function getNftUpgradeKey(types: TypedMap<string, JSONValue>, rarity: i64): string {
    let id = "r" + rarity.toString();

    for (let i = 0; i < types.entries.length; i++) {
        const row = types.entries[i];

        id = id + "||" + row.key + ":" + row.value.toString();
    }

    return id;
}
export function removeNftUpgrade(id: string): void {
    store.remove("TokenUpgrade", id);
}

// burner

export function getNftBurnerKey(types: TypedMap<string, JSONValue>, rarity: i64): string {
    return getNftUpgradeKey(types, rarity);
}
export function removeNftBurner(id: string): void {
    store.remove("TokenBurner", id);
}
