import { near, store } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { MarketSale, MarketSaleCondition, Account, Token, Statistic } from "../../generated/schema";
import { getReceiptDate, parseEvent, sumBigInt } from "../utils";
import { createAccount, getAccount, getOrCreateAccount } from "../api/account";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import {
    saveMarketSaleConditions,
    removeMarketSale,
    updateCreateMarketSaleStats,
    updateRemoveMarketSaleStats,
    getMarketSaleId,
    getMarketSaleConditionId,
} from "./helpers";
import { getTokenId } from "../nft/helpers";
import { SaleMapper } from "./api";

export function handleMarket(receipt: near.ReceiptWithOutcome): void {
    const actions = receipt.receipt.actions;
    for (let i = 0; i < actions.length; i++) {
        handleAction(actions[i], receipt);
    }
}

function handleAction(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        return;
    }

    const outcome = receiptWithOutcome.outcome;
    const timestamp = getReceiptDate(receiptWithOutcome);

    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
        const ev = parseEvent(outcome.logs[logIndex]);
        const eventDataArr = ev.get("data");
        const eventMethod = ev.get("event");

        if (!eventDataArr || !eventMethod) {
            continue;
        }

        const eventData = eventDataArr.toArray()[0];

        if (!eventData) {
            continue;
        }

        const data = eventData.toObject();
        const method = eventMethod.toString();
        const api = new SaleMapper();

        const stats = getOrCreateStatisticSystem();
        stats.transactionTotal++;

        if (method == "market_create_sale") {
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
            sale.createdAt = timestamp;
            sale.isAuction = isAuction ? isAuction.toBool() : false;

            if (saleConditions && !saleConditions.isNull()) {
                saveMarketSaleConditions(stats, contractSaleId, ownerId.toString(), saleConditions);
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
            getOrCreateAccount(ownerId.toString(), stats, contractStats);

            // stats
            stats.marketSaleTotal++;

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.marketSaleTotal++;
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        } else if (method == "market_update_sale") {
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
            getOrCreateAccount(ownerId.toString(), stats, contractStats);

            // stats
            if (ftTokenId.toString() == "near") {
                updateCreateMarketSaleStats(stats, contractSaleId, ownerId.toString(), saleCondition);
            }

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        } else if (method == "market_remove_sale") {
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
                return;
            }

            removeMarketSale(contractSaleId);

            // token
            const token = Token.load(tokenContractId);

            if (token) {
                token.sale = null;
                token.saleId = null;
            }

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(ownerId.toString(), stats, contractStats);

            // stats
            if (stats.marketSaleTotal > 0) {
                stats.marketSaleTotal--;
                updateRemoveMarketSaleStats(stats, contractSaleId, ownerId.toString());
            }

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.marketSaleTotal--;
            senderStats.save();

            contractStats.save();
        } else if (method == "market_offer") {
            const tokenIdJson = data.get("token_id");
            const ownerIdJson = data.get("owner_id");
            const receiverId = data.get("receiver_id");
            const contractId = data.get("nft_contract_id");
            const payoutJson = data.get("payout");
            const ftTokenIdJson = data.get("ft_token_id");
            const price = data.get("price");

            log.info('TEST_DEBUG market_offer', []);

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

            if (payoutJson) {
                log.info('TEST_DEBUG payout market_offer', []);
                api.saveRoyalty(payoutJson.toObject(), ftTokenId, ownerId);
            }

            // contract stats
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(ownerId.toString(), stats, contractStats);

            // stats
            stats.marketSaleTotal--;

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.marketSaleTotal--;
            senderStats.save();

            contractStats.save();
        }

        stats.save();
    }
}
