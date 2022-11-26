import {
    NftFractionation,
    NftFractionationPart,
    NftIdo,
    Statistic,
    Nft,
} from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { JSONValue } from "@graphprotocol/graph-ts";
import { BigInt, log, TypedMap } from "@graphprotocol/graph-ts/index";
import { getNftFractionationEntryId, getNftFractionationId } from "./helpers";
import { getTokenId } from "../nft/helpers";

export class NftFractionationMapper {
    protected stats: Statistic;
    protected contractId: string;
    protected createdAt: BigInt;

    constructor(contractId: string, timestamp: BigInt) {
        this.stats = getOrCreateStatisticSystem();
        this.contractId = contractId;
        this.createdAt = timestamp;

        this.stats.transactionTotal++;
    }

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        if (method == "fractionation_create") {
            this.onCreate(data);
        } else if (method == "fractionation_complete") {
            this.onCompete(data);
        } else if (method == "fractionation_process") {
            this.onProcess(data);
        }

        this.end();
    }

    public onCreate(obj: TypedMap<string, JSONValue>): void {
        const tokenId = obj.get("token_id");
        const contractId = obj.get("contract_id");
        const entries = obj.get("entries");

        if (!tokenId || !contractId || !entries) {
            log.error("[nft_fractionation_create] - invalid args", []);
            return;
        }

        const entriesArr = entries.toArray();

        const contractTokenId = getTokenId(contractId.toString(), tokenId.toString());
        const contractFractionationId = getNftFractionationId(
            contractId.toString(),
            tokenId.toString()
        );
        const fractionation = new NftFractionation(contractFractionationId);

        fractionation.contractId = contractId.toString();
        fractionation.nftId = tokenId.toString();
        fractionation.nft = contractTokenId;
        fractionation.createdAt = this.createdAt;

        fractionation.save();

        //

        this.addFractionationMain(contractTokenId, contractFractionationId);

        //

        for (let i = 0; i < entriesArr.length; i++) {
            const entryId = entriesArr[i];

            this.addFractionationEntry(
                contractId.toString(),
                tokenId.toString(),
                entryId.toString()
            );
        }
    }

    public onProcess(obj: TypedMap<string, JSONValue>): void {
        const fractionationId = obj.get("fractionation_id");
        const tokenId = obj.get("token_id");
        const contractId = obj.get("contract_id");
        const accountId = obj.get("account_id");

        if (!tokenId || !contractId || !accountId || !fractionationId) {
            log.error("[nft_fractionation_process] - invalid args", []);
            return;
        }

        const fractionationEntryId = getNftFractionationEntryId(
            contractId.toString(),
            fractionationId.toString(),
            tokenId.toString()
        );
        const entry = NftFractionationPart.load(fractionationEntryId);

        if (!entry) {
            log.error("[nft_fractionation_process] - not found entry", []);
            return;
        }

        entry.ownerId = accountId.toString();

        entry.save();
    }

    public onCompete(obj: TypedMap<string, JSONValue>): void {
        const tokenId = obj.get("token_id");
        const contractId = obj.get("contract_id");
        const receiverId = obj.get("receiver_id");

        if (!tokenId || !contractId || !receiverId) {
            log.error("[nft_fractionation_complete] - invalid args", []);
            return;
        }

        const contractFractionationId = getNftFractionationId(
            contractId.toString(),
            tokenId.toString()
        );
        const fractionation = this.get(contractFractionationId);

        fractionation.competedAt = this.createdAt;
        fractionation.competedBy = receiverId.toString();

        fractionation.save();
    }

    public end(): void {
        this.stats.save();
    }

    // private

    protected get(contractFractionationId: string): NftFractionation {
        const fractionation = NftFractionation.load(contractFractionationId);

        if (!fractionation) {
            log.error("[fractionation] - not found", []);

            throw new Error("Not found");
        }

        return fractionation;
    }

    protected addFractionationMain(contractTokenId: string, contractFractionationId: string): void {
        const token = Nft.load(contractTokenId);

        if (token) {
            token.fractionation = contractFractionationId;
            token.fractionationId = contractFractionationId;

            token.save();
        }
    }

    protected addFractionationEntry(contractId: string, tokenId: string, entryId: string): void {
        const contractTokenId = getTokenId(contractId, entryId);

        const fractionationId = getNftFractionationId(contractId, tokenId);
        const fractionationEntryId = getNftFractionationEntryId(contractId, tokenId, entryId);
        const entry = new NftFractionationPart(fractionationEntryId);

        entry.contractId = contractId;
        entry.fractionation = fractionationId;
        entry.ownerId = null;
        entry.nftId = entryId;
        entry.nft = contractTokenId;

        entry.save();

        const token = Nft.load(contractTokenId);

        if (token) {
            token.fractionation = fractionationId;
            token.fractionationId = fractionationId;

            token.save();
        }
    }
}
