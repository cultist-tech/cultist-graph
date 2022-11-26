import {
    NftContract,
    Nft,
    NftBurner,
    NftMetadata,
    NftUpgrade,
} from "../../generated/schema";
import { BigInt, JSONValue, JSONValueKind, log, TypedMap } from "@graphprotocol/graph-ts/index";
import {
    getNftBurnerKey,
    getNftUpgradeKey,
    getTokenId, parseNftStats, parseRarity,
    removeNftBurner,
    removeNftUpgrade,
    removeToken,
    saveTokenRoyalties,
    saveTokenStats,
} from "./helpers";
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
        } else {

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

        const tokenIdJson = tokenData.get("token_id");
        const ownerId = tokenData.get("owner_id");
        const metadata = tokenData.get("metadata");

        const rarityJson = tokenData.get("rarity");
        const royalty = tokenData.get("royalty");
        const bindToOwner = tokenData.get("bind_to_owner");
        const revealAt = tokenData.get("reveal_at");
        const typesJson = parseNftStats(tokenData);

        if (!tokenIdJson || !ownerId) {
            log.error("[nft_create] - invalid token args", []);
            return;
        }

        const tokenId = tokenIdJson.toString();
        const contractTokenId = getTokenId(this.contractId, tokenId);
        const token = new Nft(contractTokenId);

        token.nftId = tokenId;
        token.ownerId = ownerId.toString();
        token.owner = ownerId.toString();
        token.bindToOwner = bindToOwner && !bindToOwner.isNull() ? bindToOwner.toBool() : false;
        token.createdAt = this.createdAt;
        token.contractId = this.contractId;

        if (revealAt && !revealAt.isNull()) {
            token.revealAt = revealAt.toU64() as i32;
        }
        if (rarityJson && !rarityJson.isNull()) {
            token.rarity = parseRarity(rarityJson)

            const upgradeKey = getNftBurnerKey(typesJson, token.rarity + 1);

            token.nftBurner = upgradeKey;
            token.nftUpgrade = upgradeKey;
            token.nftBurnerId = upgradeKey;
            token.nftUpgradeId = upgradeKey;
        }

        if (metadata && !metadata.isNull()) {
            const metaObj = metadata.toObject();
            const tokenMetadata = new NftMetadata(contractTokenId);
            const metaTitle = metaObj.get("title");
            const metaDescription = metaObj.get("description");
            const metaMedia = metaObj.get("media");

            tokenMetadata.nftId = tokenId;
            tokenMetadata.title = metaTitle && !metaTitle.isNull() ? metaTitle.toString() : null;
            tokenMetadata.description =
                metaDescription && !metaDescription.isNull() ? metaDescription.toString() : null;
            tokenMetadata.media = metaMedia && !metaMedia.isNull() ? metaMedia.toString() : null;

            token.nftMetadata = contractTokenId.toString();
            token.nftMetadataId = contractTokenId.toString();

            tokenMetadata.save();
        }

        if (royalty && !royalty.isNull()) {
            saveTokenRoyalties(token.nftId, royalty);
        }

        // save stats
        saveTokenStats(this.contractId, tokenId, typesJson);

        token.save();
    }

    public onTransfer(data: TypedMap<string, JSONValue>): void {
        const tokenIdsJson = data.get("token_ids");
        const senderIdJson = data.get("old_owner_id");
        const receiverIdJson = data.get("new_owner_id");

        if (!senderIdJson || !tokenIdsJson || !receiverIdJson) {
            log.error("[nft_transfer] - invalid args", []);
            return;
        }

        const tokenId = tokenIdsJson.toArray()[0].toString();
        const contractTokenId = getTokenId(this.contractId, tokenId);
        const receiverId = receiverIdJson.toString();
        const senderId = senderIdJson.toString();

        let token = Nft.load(contractTokenId);

        if (!token) {
            log.error("[nft_transfer] - Not found transferred token {}", [contractTokenId]);
            return;
        }

        token.owner = receiverId.toString();
        token.ownerId = receiverId.toString();

        token.save();

        // clear
        const saleId = getMarketSaleId(this.contractId, tokenId);
        const rentId = getMarketRentId(this.contractId, tokenId);
        removeMarketSale(saleId);
        removeMarketRent(rentId);

        // stats
        const senderStats = new AccountStatsApi(senderId);
        senderStats.nftSend();
        senderStats.save();
        const receiverStats = new AccountStatsApi(receiverId);
        receiverStats.nftReceive();
        receiverStats.save();
        this.stats.nftTransfer(senderId, receiverId);
    }

    public onBurn(data: TypedMap<string, JSONValue>): void {
        const tokenIdsJson = data.get("token_ids");
        const senderIdJson = data.get("owner_id");

        if (!tokenIdsJson || !senderIdJson) {
            log.error("[nft_burn] - invalid args", []);
            return;
        }

        const tokenId = tokenIdsJson.toArray()[0].toString();
        const senderId = senderIdJson.toString();

        const contractTokenId = getTokenId(this.contractId, tokenId);

        let token = Nft.load(contractTokenId);

        if (!token) {
            log.error("[nft_burn] - Not found token {}", [contractTokenId]);
            return;
        }

        removeToken(tokenId);

        // clear
        const contractSaleId = getMarketSaleId(this.contractId, tokenId);
        const contractRentId = getMarketRentId(this.contractId, tokenId);
        removeMarketSale(contractSaleId);
        removeMarketRent(contractRentId);

        // stats
        const senderStats = new AccountStatsApi(senderId);
        senderStats.nftBurn();
        senderStats.save();
        this.stats.nftBurn(senderId);
    }

    public onMint(data: TypedMap<string, JSONValue>): void {
        const tokenIdsJson = data.get("token_ids");
        const receiverIdJson = data.get("owner_id");

        if (!receiverIdJson || !tokenIdsJson) {
            log.error("[nft_mint] - invalid args", []);
            return;
        }

        const receiverId = receiverIdJson.toString();
        const tokenId = tokenIdsJson.toArray()[0].toString();

        const contractTokenId = getTokenId(this.contractId, tokenId);

        //
        const accountStats = new AccountStatsApi(receiverId);
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

        if (!rarityJson || !ftTokenJson || !priceJson || !typesJson) {
            log.error("[nft_set_upgrade_price] - invalid args", []);
            return;
        }

        const upgradeId = getNftUpgradeKey(typesJson.toObject(), rarityJson.toI64());

        const nftUpgrade = new NftUpgrade(upgradeId);
        nftUpgrade.ftTokenId = ftTokenJson.toString();
        nftUpgrade.price = priceJson.toString();
        nftUpgrade.rarity = rarityJson.toI64() as i32;

        nftUpgrade.save();
    }

    public onRemoveUpgradePrice(data: TypedMap<string, JSONValue>): void {
        const priceTypeJson = data.get("price_type");
        const typesJson = data.get("types"); // option
        const rarityJson = data.get("rarity");

        if (!rarityJson || !priceTypeJson || !typesJson) {
            log.error("[nft_remove_upgrade_price] - invalid args", []);
            return;
        }

        const priceType = priceTypeJson.toString();
        const upgradeId = getNftUpgradeKey(typesJson.toObject(), rarityJson.toI64());

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

        if (rarityJson.kind == JSONValueKind.STRING) {
            // SKIP DEPRECATED RARITY
            return;
        }

        const tokenId = tokenIdJson.toString();
        const ownerId = ownerIdJson.toString();
        const contractTokenId = getTokenId(this.contractId, tokenId);

        const token = this.get(contractTokenId);

        token.rarity = rarityJson.toI64() as i32;

        const nftBurner = token.nftBurner;
        if (nftBurner) {
            token.nftBurner = "r" + (token.rarity + 1).toString() + nftBurner.slice(2);
        }
        const nftUpgrade = token.nftUpgrade;
        if (nftUpgrade) {
            token.nftUpgrade = "r" + (token.rarity + 1).toString() + nftUpgrade.slice(2);
        }
        token.nftBurnerId = token.nftBurner;
        token.nftUpgradeId = token.nftUpgradeId;

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

        if (!rarityJson || !burningRaritySum || !typesJson) {
            log.error("[nft_set_burner_price] - invalid args", []);
            return;
        }

        const upgradeId = getNftBurnerKey(typesJson.toObject(), rarityJson.toI64());

        const nftBurner = new NftBurner(upgradeId);
        nftBurner.rarity = rarityJson.toI64() as i32;
        nftBurner.rarity_sum = burningRaritySum.toI64() as i32;

        nftBurner.save();
    }

    public end(): void {
        this.stats.save();
    }

    // private

    public get(contractNftId: string): Nft {
        const nft = Nft.load(contractNftId);

        if (!nft) {
            log.error("not found token {}", [contractNftId]);
            throw new Error("Not found token");
        }

        return nft;
    }
}
