import { store } from "@graphprotocol/graph-ts/index";

export function getNftFractionationId(contractId: string, tokenId: string): string {
    return contractId + "||" + tokenId;
}

export function getNftFractionationEntryId(
    contractId: string,
    tokenId: string,
    entryId: string
): string {
    return contractId + "||" + tokenId + "||" + entryId;
}

export function removeNftFractionation(id: string): void {
    store.remove("NftFractionation", id);
}
