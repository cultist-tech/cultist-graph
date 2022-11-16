import { NftContract, Statistic, Token, TokenMetadata, TokenUpgrade, TokenBurner } from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { BigInt, JSONValue, JSONValueKind, log, TypedMap } from "@graphprotocol/graph-ts/index";
import {
    convertStringRarity,
    deprecatedSaveTokenStats, getNftBurnerKey,
    getNftUpgradeKey,
    getTokenId, removeNftBurner,
    removeNftUpgrade,
    removeToken,
    saveTokenRoyalties,
    saveTokenStats,
} from "./helpers";
import { getOrCreateAccount } from "../api/account";
import { getMarketSaleId, removeMarketSale } from "../market-sale/helpers";
import { getMarketRentId, removeMarketRent } from "../market-rent/helpers";
import { AccountStatsApi } from "../stats/account-stats";
import { ContractStatsApi } from "../stats/contract-stats";

export class TokenMapper {
    protected contractId: string;
    protected createdAt: BigInt;
    protected stats: ContractStatsApi;

    constructor(contractId: string, timestamp: BigInt) {
        this.contractId = contractId;
        this.createdAt = timestamp;

        let nftContract = NftContract.load(contractId);

        if (!nftContract) {
            nftContract = new NftContract(contractId);
            nftContract.save();
        }

        this.stats = new ContractStatsApi(this.contractId);
    }

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        if (method == "nft_create") {
            this.onCreate(data);
        } else if (method == "nft_transfer") {
            this.onTransfer(data);
        } else if (method == "nft_burn") {
            this.onBurn(data);
        } else if (method == "nft_mint") {
            this.onMint(data);
        } else if (method == "nft_transfer_payout") {
            this.onTransferPayout(data);
        } else if (method == "nft_set_upgrade_price") {
            this.onSetUpgradePrice(data);
        } else if (method == "nft_remove_upgrade_price") {
            this.onRemoveUpgradePrice(data);
        } else if (method == "nft_upgrade") {
            this.onUpgrade(data);
        } else if (method == "nft_set_burner_price") {
            this.onSetBurnerPrice(data);
        }

        this.end();
    }

    public onCreate(data: TypedMap<string, JSONValue>): void {
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

            token.nftBurner = getNftBurnerKey(typesJson, rarity.toI64());
            token.nftUpgrade = getNftUpgradeKey(typesJson, rarity.toI64())
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
                deprecatedSaveTokenStats(
                    this.contractId,
                    tokenId,
                    deprecatedTokenType,
                    deprecatedTokenSubType,
                    deprecatedCollection
                );
            }
        }

        token.save();
    }

    public onTransfer(data: TypedMap<string, JSONValue>): void {
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

        // stats
        const senderStats = new AccountStatsApi(senderId.toString());
        senderStats.nftSend();
        senderStats.save();
        const receiverStats = new AccountStatsApi(receiverId.toString());
        receiverStats.nftReceive();
        receiverStats.save();
        this.stats.nftTransfer(senderId.toString(), receiverId.toString());
    }

    public onBurn(data: TypedMap<string, JSONValue>): void {
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

        // stats
        const senderStats = new AccountStatsApi(senderId.toString());
        senderStats.nftBurn();
        senderStats.save();
        this.stats.nftBurn(senderId.toString());
    }

    public onMint(data: TypedMap<string, JSONValue>): void {
        const tokenIds = data.get("token_ids");
        const receiverId = data.get("owner_id");

        if (!receiverId || !tokenIds) {
            log.error("[nft_mint] - invalid args", []);
            return;
        }

        const tokenIdRaw = tokenIds.toArray()[0].toString();
        const tokenId = getTokenId(this.contractId, tokenIdRaw.toString());

        //
        const accountStats = new AccountStatsApi(receiverId.toString());
        accountStats.nftReceive();
        accountStats.save();
    }

    public onTransferPayout(data: TypedMap<string, JSONValue>): void {
        const tokenIdRaw = data.get("token_id");
        const senderId = data.get("sender_id");
        const receiverId = data.get("receiver_id");
        const balance = data.get("balance");

        if (!receiverId || !balance || !senderId || !tokenIdRaw) {
            log.error("[nft_transfer_payout] - invalid args", []);
            return;
        }

        const tokenId = getTokenId(this.contractId.toString(), tokenIdRaw.toString());

        // stats
        const senderStats = new AccountStatsApi(senderId.toString());
        senderStats.nftSell();
        senderStats.save();
        const receverStats = new AccountStatsApi(receiverId.toString());
        receverStats.nftBuy();
        receverStats.save();
        this.stats.nftTransferPayout(senderId.toString(), receiverId.toString());
    }

    public onSetUpgradePrice(data: TypedMap<string, JSONValue>): void {
        const rarityJson = data.get("rarity");
        const typesJson = data.get("types"); // option
        const ftTokenJson = data.get("ft_token");
        const priceJson = data.get("price");

        if (!rarityJson || !ftTokenJson || !priceJson) {
            log.error("[nft_set_upgrade_price] - invalid args", []);
            return;
        }

        const upgradeId = getNftUpgradeKey(typesJson, rarityJson.toI64());

        const nftUpgrade = new TokenUpgrade(upgradeId);
        nftUpgrade.ftTokenId = ftTokenJson.toString();
        nftUpgrade.price = priceJson.toString();

        nftUpgrade.save();
    }

    public onRemoveUpgradePrice(data: TypedMap<string, JSONValue>): void {
        const priceTypeJson = data.get("price_type");
        const typesJson = data.get("types"); // option
        const rarityJson = data.get("rarity");

        if (!rarityJson || !priceTypeJson) {
            log.error("[nft_remove_upgrade_price] - invalid args", []);
            return;
        }

        const priceType = priceTypeJson.toString();
        const upgradeId = getNftUpgradeKey(typesJson, rarityJson.toI64());

        if (priceType == "Upgradable") {
            removeNftUpgrade(upgradeId);
        } else if (priceType == "Burner") {
            removeNftBurner(upgradeId);
        }
    }

    public onUpgrade(data: TypedMap<string, JSONValue>): void {
        const ownerIdJson = data.get("owner_id");
        const rarityJson = data.get("rarity");
        const tokenIdJson = data.get("token_id");

        if (!rarityJson || !ownerIdJson || !tokenIdJson) {
            log.error("[nft_upgrade] - invalid args", []);
            return;
        }

        const tokenId = tokenIdJson.toString();
        const ownerId = ownerIdJson.toString();
        const contractTokenId = getTokenId(this.contractId, tokenId);

        const token = this.get(contractTokenId);

        token.rarity = rarityJson.toI64() as i32;

        token.save();

        const senderStats = new AccountStatsApi(ownerId);
        senderStats.nftUpgrade();
        senderStats.save();
        this.stats.nftUpgrade(ownerId);
    }

    public onSetBurnerPrice(data: TypedMap<string, JSONValue>): void {
        const rarityJson = data.get("rarity");
        const typesJson = data.get("types"); // option
        const burningRaritySum = data.get("burning_rarity_sum");

        if (!rarityJson || !burningRaritySum) {
            log.error("[nft_set_burner_price] - invalid args", []);
            return;
        }

        const upgradeId = getNftBurnerKey(typesJson, rarityJson.toI64());

        const nftBurner = new TokenBurner(upgradeId);
        nftBurner.rarity =rarityJson.toI64() as i32;
        nftBurner.rarity_sum = burningRaritySum.toI64() as i32;

        nftBurner.save();
    }

    public end(): void {
        this.stats.save();
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
