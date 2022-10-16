import { Statistic, Token, TokenMetadata } from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { log, JSONValue, TypedMap, BigDecimal } from "@graphprotocol/graph-ts/index";
import { convertRarity, getTokenId, removeToken, saveTokenRoyalties } from "./helpers";
import { getOrCreateAccount } from "../api/account";
import { getMarketSaleId, removeMarketSale } from "../market-sale/helpers";
import { getMarketRentId, removeMarketRent } from "../market-rent/helpers";

export class TokenMapper {
    protected stats: Statistic;
    protected contractId: string;

    constructor(contractId: string) {
        this.stats = getOrCreateStatisticSystem();
        this.contractId = contractId;

        this.stats.transactionTotal++;
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

        // const collection = tokenData.get('collection');
        // const tokenType = tokenData.get('token_type');
        // const tokenSubType = tokenData.get('token_sub_type');
        const rarity = tokenData.get("rarity");
        const royalty = tokenData.get("royalty");
        const bindToOwner = tokenData.get("bind_to_owner");

        if (!tokenIdRaw || !ownerId) {
            log.error("[nft_create] - invalid token args", []);
            return;
        }

        const tokenId = getTokenId(this.contractId, tokenIdRaw.toString());
        const token = new Token(tokenId);

        token.tokenId = tokenId;
        token.ownerId = ownerId.toString();
        token.owner = ownerId.toString();
        token.bindToOwner = bindToOwner && !bindToOwner.isNull() ? bindToOwner.toBool() : false;

        if (rarity && !rarity.isNull()) {
            token.rarity = convertRarity(rarity);
        }

        if (metadata && !metadata.isNull()) {
            const metaObj = metadata.toObject();
            const tokenMetadata = new TokenMetadata(tokenId);
            const metaTitle = metaObj.get("title");
            const metaDescription = metaObj.get("description");
            const metaMedia = metaObj.get("media");

            tokenMetadata.tokenId = tokenId.toString();
            tokenMetadata.title = metaTitle && !metaTitle.isNull() ? metaTitle.toString() : null;
            tokenMetadata.description =
                metaDescription && !metaDescription.isNull() ? metaDescription.toString() : null;
            tokenMetadata.media = metaMedia && !metaMedia.isNull() ? metaMedia.toString() : null;

            token.tokenMetadata = tokenId.toString();
            token.tokenMetadataId = tokenId.toString();

            tokenMetadata.save();
        }

        if (royalty && !royalty.isNull()) {
            saveTokenRoyalties(token.tokenId, royalty);
        }

        token.save();

        // acc
        getOrCreateAccount(ownerId.toString(), this.stats);

        // stats
        this.stats.nftTotal++;

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
        getOrCreateAccount(senderId.toString(), this.stats);
        getOrCreateAccount(receiverId.toString(), this.stats);

        // stats
        this.stats.nftTransferTotal++;

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
        getOrCreateAccount(senderId.toString(), this.stats);

        // stats
        this.stats.nftTotal--;
        this.stats.nftBurnTotal++;

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

        // acc
        getOrCreateAccount(receiverId.toString(), this.stats);

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

        let price = BigDecimal.fromString(balance.toString()).div(
            BigDecimal.fromString("1000000000000000000000000")
        );

        // acc
        getOrCreateAccount(senderId.toString(), this.stats);
        getOrCreateAccount(receiverId.toString(), this.stats);

        // stats
        this.stats.nftPayTotal++;

        // stats acc
        const senderStats = getOrCreateStatistic(senderId.toString());
        senderStats.transactionTotal++;
        senderStats.save();
    }

    public end(): void {
        this.stats.save();
    }

    // private
}
