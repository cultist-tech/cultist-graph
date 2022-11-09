import { NftContract, Statistic, Token, TokenMetadata } from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { BigInt, JSONValue, JSONValueKind, log, TypedMap } from "@graphprotocol/graph-ts/index";
import {
    convertStringRarity, deprecatedSaveTokenStats,
    getTokenId,
    removeToken,
    saveTokenRoyalties,
    saveTokenStats,
} from "./helpers";
import { getOrCreateAccount } from "../api/account";
import { getMarketSaleId, removeMarketSale } from "../market-sale/helpers";
import { getMarketRentId, removeMarketRent } from "../market-rent/helpers";

export class TokenMapper {
    protected stats: Statistic;
    protected contractStats: Statistic;
    protected contractId: string;
    protected createdAt: BigInt;

    constructor(contractId: string, timestamp: BigInt) {
        this.stats = getOrCreateStatisticSystem();
        this.contractStats = getOrCreateStatistic(contractId);
        this.contractId = contractId;
        this.createdAt = timestamp;

        let nftContract = NftContract.load(contractId);

        if (!nftContract) {
            nftContract = new NftContract(contractId);
            nftContract.save();
        }

        this.stats.transactionTotal++;
        this.contractStats.transactionTotal++;
    }

    public create(data: TypedMap<string, JSONValue>): void {
        const rawToken = data.get("token");

        if (!rawToken) {
            log.error("[nft_create] - invalid args", []);
            return;
        }
        const tokenData = rawToken.toObject();

        const tokenIdRaw = tokenData.get("token_id");
        const ownerId = tokenData.get("owner_id");
        const metadata = tokenData.get("metadata");

        const rarity = tokenData.get("rarity");
        const royalty = tokenData.get("royalty");
        const bindToOwner = tokenData.get("bind_to_owner");
        const revealAt = tokenData.get("reveal_at");
        const typesJson = tokenData.get("types");

        const deprecatedCollection = tokenData.get("collection");
        const deprecatedTokenType = tokenData.get("token_type");
        const deprecatedTokenSubType = tokenData.get("token_sub_type");

        if (!tokenIdRaw || !ownerId) {
            log.error("[nft_create] - invalid token args", []);
            return;
        }

        const tokenId = tokenIdRaw.toString();
        const contractTokenId = getTokenId(this.contractId, tokenId);
        const token = new Token(contractTokenId);

        token.tokenId = tokenId;
        token.ownerId = ownerId.toString();
        token.owner = ownerId.toString();
        token.bindToOwner = bindToOwner && !bindToOwner.isNull() ? bindToOwner.toBool() : false;
        token.createdAt = this.createdAt;
        token.contractId = this.contractId;

        if (revealAt && !revealAt.isNull()) {
            token.revealAt = revealAt.toU64() as i32;
        }
        if (rarity && !rarity.isNull()) {
            if (rarity.kind === JSONValueKind.STRING) {
                token.rarity = convertStringRarity(rarity);
            } else {
                token.rarity = rarity.toU64() as i32;
            }
        }

        if (metadata && !metadata.isNull()) {
            const metaObj = metadata.toObject();
            const tokenMetadata = new TokenMetadata(contractTokenId);
            const metaTitle = metaObj.get("title");
            const metaDescription = metaObj.get("description");
            const metaMedia = metaObj.get("media");

            tokenMetadata.tokenId = tokenId;
            tokenMetadata.title = metaTitle && !metaTitle.isNull() ? metaTitle.toString() : null;
            tokenMetadata.description =
                metaDescription && !metaDescription.isNull() ? metaDescription.toString() : null;
            tokenMetadata.media = metaMedia && !metaMedia.isNull() ? metaMedia.toString() : null;

            token.tokenMetadata = contractTokenId.toString();
            token.tokenMetadataId = contractTokenId.toString();

            tokenMetadata.save();
        }

        if (royalty && !royalty.isNull()) {
            saveTokenRoyalties(token.tokenId, royalty);
        }

        if (typesJson) {
            saveTokenStats(this.contractId, tokenIdRaw.toString(), typesJson);
        } else {
            if (deprecatedTokenType || deprecatedTokenSubType || deprecatedCollection) {
                deprecatedSaveTokenStats(this.contractId, tokenId, deprecatedTokenType, deprecatedTokenSubType, deprecatedCollection)
            }
        }

        token.save();

        // acc
        getOrCreateAccount(ownerId.toString(), this.stats, this.contractStats);

        // stats
        this.stats.nftTotal++;
        this.contractStats.nftTotal++;

        // stats acc
        const accStats = getOrCreateStatistic(ownerId.toString());
        accStats.nftTotal++;
        accStats.transactionTotal++;
        accStats.save();
    }

    public transfer(data: TypedMap<string, JSONValue>): void {
        const tokenIds = data.get("token_ids");
        const senderId = data.get("old_owner_id");
        const receiverId = data.get("new_owner_id");

        if (!tokenIds || !senderId || !receiverId) {
            log.error("[nft_transfer] - invalid args", []);
            return;
        }
        const tokenIdRaw = tokenIds.toArray()[0];

        const tokenId = getTokenId(this.contractId.toString(), tokenIdRaw.toString());
        let token = Token.load(tokenId);

        if (!token) {
            log.error("[nft_transfer] - Not found transferred token {}", [tokenId.toString()]);
            return;
        }

        token.owner = receiverId.toString();
        token.ownerId = receiverId.toString();

        token.save();

        // clear
        const saleId = getMarketSaleId(this.contractId, tokenId.toString());
        const rentId = getMarketRentId(this.contractId, tokenId.toString());
        removeMarketSale(saleId);
        removeMarketRent(rentId);

        // acc
        getOrCreateAccount(senderId.toString(), this.stats, this.contractStats);
        getOrCreateAccount(receiverId.toString(), this.stats, this.contractStats);

        // stats
        this.stats.nftTransferTotal++;
        this.contractStats.nftTransferTotal++;

        // stats acc
        const senderStats = getOrCreateStatistic(senderId.toString());
        senderStats.nftTotal--;
        senderStats.transactionTotal++;
        senderStats.save();
        const receiverStats = getOrCreateStatistic(receiverId.toString());
        receiverStats.nftTotal++;
        receiverStats.transactionTotal++;
        receiverStats.save();
    }

    public burn(data: TypedMap<string, JSONValue>): void {
        const tokenIds = data.get("token_ids");
        const senderId = data.get("owner_id");

        if (!tokenIds || !senderId) {
            log.error("[nft_burn] - invalid args", []);
            return;
        }
        const tokenIdRaw = tokenIds.toArray()[0];
        const tokenId = getTokenId(this.contractId.toString(), tokenIdRaw.toString());

        let token = Token.load(tokenId.toString());

        if (!token) {
            log.error("[nft_burn] - Not found token {}", [tokenId.toString()]);
            return;
        }

        removeToken(tokenId);

        // clear
        const saleId = getMarketSaleId(this.contractId, tokenId.toString());
        const rentId = getMarketRentId(this.contractId, tokenId.toString());
        removeMarketSale(saleId);
        removeMarketRent(rentId);

        // acc
        getOrCreateAccount(senderId.toString(), this.stats, this.contractStats);

        // stats
        this.stats.nftTotal--;
        this.stats.nftBurnTotal++;
        this.contractStats.nftTotal--;
        this.contractStats.nftBurnTotal++;

        // stats acc
        const senderStats = getOrCreateStatistic(senderId.toString());
        senderStats.nftTotal--;
        senderStats.transactionTotal++;
        senderStats.save();
    }

    public mint(data: TypedMap<string, JSONValue>): void {
        const tokenIds = data.get("token_ids");
        const receiverId = data.get("owner_id");

        if (!receiverId || !tokenIds) {
            log.error("[nft_mint] - invalid args", []);
            return;
        }

        const tokenIdRaw = tokenIds.toArray()[0].toString();
        const tokenId = getTokenId(this.contractId, tokenIdRaw.toString());

        // acc
        getOrCreateAccount(receiverId.toString(), this.stats, this.contractStats);

        const senderStats = getOrCreateStatistic(receiverId.toString());
        senderStats.transactionTotal++;
        senderStats.save();
    }

    public transferPayout(data: TypedMap<string, JSONValue>): void {
        const tokenIdRaw = data.get("token_id");
        const senderId = data.get("sender_id");
        const receiverId = data.get("receiver_id");
        const balance = data.get("balance");

        if (!receiverId || !balance || !senderId || !tokenIdRaw) {
            log.error("[nft_transfer_payout] - invalid args", []);
            return;
        }

        const tokenId = getTokenId(this.contractId.toString(), tokenIdRaw.toString());

        // acc
        getOrCreateAccount(senderId.toString(), this.stats, this.contractStats);
        getOrCreateAccount(receiverId.toString(), this.stats, this.contractStats);

        // stats
        this.stats.nftPayTotal++;
        this.contractStats.nftPayTotal++;

        // stats acc
        const senderStats = getOrCreateStatistic(senderId.toString());
        senderStats.transactionTotal++;
        senderStats.save();
    }

    public end(): void {
        this.stats.save();
        this.contractStats.save();
    }

    // private

    public get(contractNftId: string): Token {
        const nft = Token.load(contractNftId);

        if (!nft) {
            log.error("not found token {}", [contractNftId]);
            throw new Error("Not found token");
        }

        return nft;
    }
}
