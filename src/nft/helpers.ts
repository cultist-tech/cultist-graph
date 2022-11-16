import {JSONValue, store, TypedMap} from "@graphprotocol/graph-ts/index";
import {TokenRoyalty, TokenStat} from "../../generated/schema";

export function getTokenId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function getTokenStatId(contractIdTokenId: string, statKey: string): string {
    return contractIdTokenId + "||" + statKey;
}

export function removeToken(id: string): void {
    store.remove("Token", id);
}

export function convertStringRarity(rarityValue: JSONValue): i32 {
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
    } else {
        return 0 as i32;
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

export function saveTokenStats(contractId: string, tokenId: string, types: JSONValue): void {
    const contractTokenId = getTokenId(contractId, tokenId);
    const typesObj = types.toObject();

    for (let i = 0; i < typesObj.entries.length; i++) {
        const row = typesObj.entries[i];

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
export function deprecatedSaveTokenStats(contractId: string, tokenId: string, type: JSONValue | null, subType: JSONValue | null, collection: JSONValue | null): void {
    const contractTokenId = getTokenId(contractId, tokenId);

    if (type && !type.isNull()) {
        const tokenTypeStatId = getTokenStatId(contractTokenId, 'type');
        const typeStat = new TokenStat(tokenTypeStatId);
        typeStat.token = contractTokenId;
        typeStat.tokenId = tokenId;
        typeStat.key = 'type'
        typeStat.value = type.toString();
        typeStat.save();
    }
    if (subType && !subType.isNull()) {
        const tokenTypeStatId = getTokenStatId(contractTokenId, 'subType');
        const typeStat = new TokenStat(tokenTypeStatId);
        typeStat.token = contractTokenId;
        typeStat.tokenId = tokenId;
        typeStat.key = 'subType'
        typeStat.value = subType.toString();
        typeStat.save();
    }
    if (collection && !collection.isNull()) {
        const tokenTypeStatId = getTokenStatId(contractTokenId, 'collection');
        const typeStat = new TokenStat(tokenTypeStatId);
        typeStat.token = contractTokenId;
        typeStat.tokenId = tokenId;
        typeStat.key = 'collection'
        typeStat.value = collection.toString();
        typeStat.save();
    }

}

// upgrade

export function getNftUpgradeKey(types: JSONValue | null, rarity: i64): string {
    if (!types) {
        return rarity.toString();
    }

    return types.toString() + '||' + rarity.toString();
}
export function removeNftUpgrade(id: string): void {
    store.remove('TokenUpgrade', id);
}
