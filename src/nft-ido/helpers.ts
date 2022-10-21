import { store } from "@graphprotocol/graph-ts/index";

export function getNftIdoId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function removeNftIdo(id: string): void {
    store.remove("NftIdo", id);
}
