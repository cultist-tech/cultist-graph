import { getOrCreateAccountRoyalty } from "../api/account-royalty";
import { sumBigInt } from "../utils";
import { JSONValue, TypedMap, BigInt } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts/index";
import { getTokenId } from "../nft/helpers";
import {
    getMarketSaleConditionId,
    getMarketSaleId,
    removeMarketSale,
    saveMarketSaleConditions,
    updateCreateMarketSaleStats,
    updateRemoveMarketSaleStats,
} from "./helpers";
import { MarketSale, MarketSaleCondition, Statistic, Token } from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { getOrCreateAccount } from "../api/account";
import {
    getOrCreateReferralContract,
    getOrCreateReferralContractVolume,
    referralIncrementPayout,
} from "../referral/helpers";
import { ContractStatsApi } from "../stats/contract-stats";
import { AccountStatsApi } from "../stats/account-stats";
import { ReputationService } from "../reputation";

const MARKET_ACCOUNT_ID = "mfight-market.testnet";

export class SaleMapper {
    protected stats: Statistic;
    protected contractId: string | null = null;
    protected createdAt: BigInt;

    constructor(timestamp: BigInt) {
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

            if (payoutAccount == "payout") {
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
        } else {
            const rep = new ReputationService(MARKET_ACCOUNT_ID);

            if (rep.isEvent(method)) {
                rep.handle(method, data);
            }
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
        const saleConditionsJson = saleObj.get("sale_conditions");
        const isAuction = saleObj.get("is_auction");

        if (!ownerId || !ownerId || !contractId || !tokenIdJson || !saleConditionsJson) {
            log.error("[market_create_sale] - invalid args", []);
            return;
        }

        // args
        const contractTokenId = getTokenId(contractId.toString(), tokenIdJson.toString());
        const contractSaleId = getMarketSaleId(contractId.toString(), tokenIdJson.toString());

        // structures
        const contractStats = new ContractStatsApi(contractId.toString());

        // sale
        const sale = new MarketSale(contractSaleId);

        sale.tokenId = contractTokenId;
        sale.token = contractTokenId;
        sale.ownerId = ownerId.toString();
        sale.owner = ownerId.toString();
        sale.contractId = contractId.toString();
        sale.createdAt = this.createdAt;
        sale.isAuction = isAuction ? isAuction.toBool() : false;
        sale.save();

        // sale conditions
        if (saleConditionsJson && !saleConditionsJson.isNull()) {
            const saleConditions = saleConditionsJson.toObject();

            for (let i = 0; i < saleConditions.entries.length; i++) {
                const row = saleConditions.entries[i];

                const rowId = getMarketSaleConditionId(contractSaleId, row.key.toString());
                const saleCondition = new MarketSaleCondition(rowId);

                saleCondition.saleId = contractSaleId;
                saleCondition.sale = contractSaleId;
                saleCondition.ftTokenId = row.key.toString();
                saleCondition.price = row.value.toString();

                if (saleCondition.ftTokenId === "near") {
                    contractStats.marketAddSaleNear(saleCondition.price);
                }

                saleCondition.save();
            }
        }

        // token
        const token = Token.load(contractTokenId);

        if (token) {
            token.sale = contractSaleId;
            token.saleId = contractSaleId;
        }

        // stats
        const senderStats = new AccountStatsApi(ownerId.toString());
        senderStats.marketCreate();
        senderStats.save();

        contractStats.marketCreate(ownerId.toString());
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

        referralIncrementPayout(
            contractId.toString(),
            ownerIdJson.toString(),
            ftTokenId,
            price.toString()
        );
        referralIncrementPayout(
            contractId.toString(),
            receiverId.toString(),
            ftTokenId,
            price.toString()
        );

        // stats
        const senderStats = new AccountStatsApi(ownerId.toString());
        senderStats.marketSell();
        senderStats.save();
        const receiverStats = new AccountStatsApi(receiverId.toString());
        receiverStats.marketBuy();
        receiverStats.save();
        const contractStats = new ContractStatsApi(contractId.toString());
        contractStats.marketPay(ownerId.toString(), receiverId.toString());
        contractStats.save();
    }

    protected onRemove(data: TypedMap<string, JSONValue>): void {
        const tokenIdJson = data.get("token_id");
        const ownerIdJson = data.get("owner_id");
        const contractIdJson = data.get("nft_contract_id");

        if (!tokenIdJson || !ownerIdJson || !contractIdJson) {
            log.error("[market_remove_sale] - invalid args", []);
            return;
        }

        const contractId = contractIdJson.toString();
        const ownerId = ownerIdJson.toString();
        const tokenId = tokenIdJson.toString();
        const tokenContractId = getTokenId(contractId, tokenId);
        const contractSaleId = getMarketSaleId(contractId, tokenId);

        const sale = MarketSale.load(contractSaleId);

        if (!sale) {
            log.error("[market_remove_sale] - not found", []);
            return;
        }

        sale.isDeleted = true;

        // token
        const token = Token.load(tokenContractId);

        if (token) {
            token.sale = null;
            token.saleId = null;
            token.save();
        }

        // stats
        const senderStats = new AccountStatsApi(ownerId.toString());
        senderStats.marketRemove();
        senderStats.save();
        const contractStats = new ContractStatsApi(contractId.toString());
        contractStats.marketRemove(ownerId.toString(), contractSaleId);
        contractStats.save();

        sale.save();
    }

    protected onUpdate(data: TypedMap<string, JSONValue>): void {
        const tokenIdJson = data.get("token_id");
        const ownerIdJson = data.get("owner_id");
        const contractIdJson = data.get("nft_contract_id");
        const ftTokenIdJson = data.get("ft_token_id");
        const priceJson = data.get("price");

        if (!tokenIdJson || !ownerIdJson || !contractIdJson || !ftTokenIdJson || !priceJson) {
            log.error("[market_update_sale] - invalid args", []);
            return;
        }

        const contractId = contractIdJson.toString();
        const tokenId = tokenIdJson.toString();
        const ftTokenId = ftTokenIdJson.toString();
        const ownerId = ownerIdJson.toString();
        const price = priceJson.toString();
        const contractSaleId = getMarketSaleId(contractId, tokenId);

        const saleConditionId = getMarketSaleConditionId(contractSaleId, ftTokenId);

        let saleCondition = MarketSaleCondition.load(saleConditionId);

        if (!saleCondition) {
            saleCondition = new MarketSaleCondition(saleConditionId);
            saleCondition.saleId = contractSaleId;
            saleCondition.sale = contractSaleId;
        }

        saleCondition.ftTokenId = ftTokenId;
        saleCondition.price = price;

        // stats
        const senderStats = new AccountStatsApi(ownerId);
        senderStats.marketUpdate();
        senderStats.save();
        const contractStats = new ContractStatsApi(contractId);
        contractStats.marketUpdate(contractSaleId, ftTokenId, price);
        contractStats.save();

        saleCondition.save();
    }

    protected end(): void {
        this.stats.save();
    }
}
