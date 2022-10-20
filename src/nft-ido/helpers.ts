import { JSONValue, store } from "@graphprotocol/graph-ts/index";

export function getTokenNftIdoId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function removeToken(id: string): void {
    store.remove("NftIdo", id);
}
