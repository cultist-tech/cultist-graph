import { JSONValue } from "@graphprotocol/graph-ts/index";

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
