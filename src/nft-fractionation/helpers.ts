import { JSONValue, store } from "@graphprotocol/graph-ts/index";

export function getTokenNftFractionationId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function removeNftFractionation(id: string): void {
    store.remove("NftFractionation", id);
}
