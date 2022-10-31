import { getOrCreateAccountRoyalty } from "../api/account-royalty";
import { sumBigInt } from "../utils";
import { JSONValue, TypedMap } from "@graphprotocol/graph-ts";
import {log} from "@graphprotocol/graph-ts/index";
import {getTokenId} from "../nft/helpers";
import {
    getMarketSaleConditionId,
    getMarketSaleId,
    removeMarketSale, saveMarketSaleConditions,
    updateCreateMarketSaleStats,
    updateRemoveMarketSaleStats
} from "./helpers";
import {MarketSale, MarketSaleCondition, Statistic, Token} from "../../generated/schema";
import {getOrCreateStatistic, getOrCreateStatisticSystem} from "../api/statistic";
import {getOrCreateAccount} from "../api/account";
import {
    getOrCreateReferralContract,
    getOrCreateReferralContractVolume,
    referralIncrementPayout
} from "../referral/helpers";

export class SaleMapper {
    protected stats: Statistic;
    protected contractStats: Statistic | null = null;
    protected contractId: string | null = null;
    protected createdAt: i32;

    constructor(timestamp: i32) {
        this.stats = getOrCreateStatisticSystem();
        this.createdAt = timestamp;
    }

    public saveRoyalty(
        amount: string,
        payout: TypedMap<string, JSONValue>,
        ftTokenId: string,
        ownerId: string
    ): void {
        for (let i = 0; i < payout.entries.length; i++) {
            const row = payout.entries[i];
            const payoutAccount = row.key;

            if (payoutAccount == 'payout') {
                this.saveRoyalty(amount, row.value.toObject(), ftTokenId, ownerId);
                return;
            } else {
                const payoutValue = row.value.toString();

                // if (payoutAccount != ownerId) {
                const royalty = getOrCreateAccountRoyalty(payoutAccount, ftTokenId);
                royalty.amount = sumBigInt(royalty.amount, payoutValue);
                royalty.save();
                // }
            }
        }
    }

    public saveReferralStats(contractId: string, accountId: string, ftTokenId: string, price: string): void {
        const referralContractVolume = getOrCreateReferralContractVolume(contractId, ftTokenId);
        referralContractVolume.amount = sumBigInt(referralContractVolume.amount, price);
        referralContractVolume.save();

        referralIncrementPayout(contractId, accountId, ftTokenId == 'near' ? price : null);
    }

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        this.stats.transactionTotal++;

        if (method == "market_create_sale") {
            this.onCreate(data);
        } else if (method == "market_update_sale") {
            this.onUpdate(data);
        } else if (method == "market_remove_sale") {
            this.onRemove(data);
        } else if (method == "market_offer") {
            this.onPay(data);
        }

        this.end();
    }

    protected onCreate(data: TypedMap<string, JSONValue>): void {
        const saleStr = data.get("sale");

        if (!saleStr) {
            log.error("[market_create_sale] - invalid args", []);
            return;
        }

        const saleObj = saleStr.toObject();
        const ownerId = saleObj.get("owner_id");
        const contractId = saleObj.get("nft_contract_id");
        const tokenIdJson = saleObj.get("token_id");
        const saleConditions = saleObj.get("sale_conditions");
        const isAuction = saleObj.get("is_auction");

        if (!ownerId || !ownerId || !contractId || !tokenIdJson || !saleConditions) {
            log.error("[market_create_sale] - invalid args", []);
            return;
        }

        const contractTokenId = getTokenId(contractId.toString(), tokenIdJson.toString());
        const contractSaleId = getMarketSaleId(contractId.toString(), tokenIdJson.toString());

        const sale = new MarketSale(contractSaleId);

        sale.tokenId = contractTokenId;
        sale.token = contractTokenId;
        sale.ownerId = ownerId.toString();
        sale.owner = ownerId.toString();
        sale.contractId = contractId.toString();
        sale.createdAt = this.createdAt;
        sale.isAuction = isAuction ? isAuction.toBool() : false;

        if (saleConditions && !saleConditions.isNull()) {
            saveMarketSaleConditions(this.stats, contractSaleId, ownerId.toString(), saleConditions);
        }

        sale.save();

        // token
        const token = Token.load(contractTokenId);

        if (token) {
            token.sale = contractSaleId;
            token.saleId = contractSaleId;
        }

        //
        const contractStats = getOrCreateStatistic(contractId.toString());

        // acc
        getOrCreateAccount(ownerId.toString(), this.stats, contractStats);

        // stats
        this.stats.marketSaleTotal++;

        // stats acc
        const senderStats = getOrCreateStatistic(ownerId.toString());
        senderStats.marketSaleTotal++;
        senderStats.transactionTotal++;
        senderStats.save();

        contractStats.save();
    }

    protected onPay(data: TypedMap<string, JSONValue>): void {
        const tokenIdJson = data.get("token_id");
        const ownerIdJson = data.get("owner_id");
        const receiverId = data.get("receiver_id");
        const contractId = data.get("nft_contract_id");
        const payoutJson = data.get("payout");
        const ftTokenIdJson = data.get("ft_token_id");
        const price = data.get("price");

        if (
            !tokenIdJson ||
            !ownerIdJson ||
            !receiverId ||
            !contractId ||
            !payoutJson ||
            !ftTokenIdJson ||
            !price
        ) {
            log.error("[market_offer] - invalid args", []);
            return;
        }

        const ftTokenId = ftTokenIdJson.toString();
        const ownerId = ownerIdJson.toString();
        const tokenContractId = getTokenId(contractId.toString(), tokenIdJson.toString());
        const contractSaleId = getMarketSaleId(contractId.toString(), tokenIdJson.toString());

        const sale = MarketSale.load(contractSaleId);

        if (!sale) {
            log.error("[market_offer] - not found sale", []);
            return;
        }

        removeMarketSale(contractSaleId);

        // token
        const token = Token.load(tokenContractId);

        if (token) {
            token.sale = null;
            token.saleId = null;
        }

        // royalty

        // TODO new field
        if (payoutJson) {
            this.saveRoyalty(price.toString(), payoutJson.toObject(), ftTokenId, ownerId);
        }

        this.saveReferralStats(contractId.toString(), ownerId.toString(), ftTokenId.toString(), price.toString());

        // contract stats
        const contractStats = getOrCreateStatistic(contractId.toString());

        // acc
        getOrCreateAccount(ownerId.toString(), this.stats, contractStats);

        // stats
        this.stats.marketSaleTotal--;

        // stats acc
        const senderStats = getOrCreateStatistic(ownerId.toString());
        senderStats.transactionTotal++;
        senderStats.marketSaleTotal--;
        senderStats.save();

        contractStats.save();
    }

    protected onRemove(data: TypedMap<string, JSONValue>): void {
        const tokenIdJson = data.get("token_id");
        const ownerId = data.get("owner_id");
        const contractId = data.get("nft_contract_id");

        if (!tokenIdJson || !ownerId || !contractId) {
            log.error("[market_remove_sale] - invalid args", []);
            return;
        }

        const tokenContractId = getTokenId(contractId.toString(), tokenIdJson.toString());
        const contractSaleId = getMarketSaleId(contractId.toString(), tokenIdJson.toString());

        const sale = MarketSale.load(contractSaleId);

        if (!sale) {
            log.error("[market_remove_sale] - not found", []);
            return;
        }

        sale.isDeleted = true;
        sale.save();

        // token
        const token = Token.load(tokenContractId);

        if (token) {
            token.sale = null;
            token.saleId = null;
        }

        //
        const contractStats = getOrCreateStatistic(contractId.toString());

        // acc
        getOrCreateAccount(ownerId.toString(), this.stats, contractStats);

        // stats
        if (this.stats.marketSaleTotal > 0) {
            this.stats.marketSaleTotal--;
            updateRemoveMarketSaleStats(this.stats, contractSaleId, ownerId.toString());
        }

        // stats acc
        const senderStats = getOrCreateStatistic(ownerId.toString());
        senderStats.transactionTotal++;
        senderStats.marketSaleTotal--;
        senderStats.save();

        contractStats.save();
    }

    protected onUpdate(data: TypedMap<string, JSONValue>): void {
        const tokenIdJson = data.get("token_id");
        const ownerId = data.get("owner_id");
        const contractId = data.get("nft_contract_id");
        const ftTokenId = data.get("ft_token_id");
        const price = data.get("price");

        if (!tokenIdJson || !ownerId || !contractId || !ftTokenId || !price) {
            log.error("[market_update_sale] - invalid args", []);
            return;
        }

        const contractSaleId = getMarketSaleId(contractId.toString(), tokenIdJson.toString());

        const saleConditionId = getMarketSaleConditionId(
            contractSaleId,
            ftTokenId.toString()
        );

        let saleCondition = MarketSaleCondition.load(saleConditionId);

        if (!saleCondition) {
            saleCondition = new MarketSaleCondition(saleConditionId);
            saleCondition.saleId = contractSaleId;
            saleCondition.sale = contractSaleId;
        }

        saleCondition.ftTokenId = ftTokenId.toString();
        saleCondition.price = price.toString();

        saleCondition.save();

        //
        const contractStats = getOrCreateStatistic(contractId.toString());

        // acc
        getOrCreateAccount(ownerId.toString(), this.stats, contractStats);

        // stats
        if (ftTokenId.toString() == "near") {
            updateCreateMarketSaleStats(this.stats, contractSaleId, ownerId.toString(), saleCondition);
        }

        // stats acc
        const senderStats = getOrCreateStatistic(ownerId.toString());
        senderStats.transactionTotal++;
        senderStats.save();

        contractStats.save();
    }

    protected end(): void {
        this.stats.save();
    }
}
