import { near, store } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { MarketSale, MarketSaleCondition, Account } from "../../generated/schema";
import { parseEvent } from "../utils";
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
import { BigInt } from "@graphprotocol/graph-ts/index";

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
    const timestamp = (receiptWithOutcome.block.header.timestampNanosec / 1_000_000) as i32;

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
            const tokenId = saleObj.get("token_id");
            const saleConditions = saleObj.get("sale_conditions");
            const isAuction = saleObj.get("is_auction");

            if (!ownerId || !ownerId || !contractId || !tokenId || !saleConditions) {
                log.error("[market_create_sale] - invalid args", []);
                return;
            }

            const saleId = getMarketSaleId(contractId.toString(), tokenId.toString());

            const sale = new MarketSale(saleId);

            sale.tokenId = tokenId.toString();
            sale.token = tokenId.toString();
            sale.ownerId = ownerId.toString();
            sale.owner = ownerId.toString();
            sale.contractId = contractId.toString();
            sale.createdAt = timestamp;
            sale.isAuction = isAuction ? isAuction.toBool() : false;

            if (saleConditions && !saleConditions.isNull()) {
                saveMarketSaleConditions(stats, saleId, ownerId.toString(), saleConditions);
            }

            sale.save();

            // acc
            getOrCreateAccount(ownerId.toString(), stats);

            // stats
            stats.marketSaleTotal++;

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.marketSaleTotal++;
            senderStats.transactionTotal++;
            senderStats.save();
        } else if (method == "market_update_sale") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const contractId = data.get("nft_contract_id");
            const ftTokenId = data.get("ft_token_id");
            const price = data.get("price");

            if (!tokenId || !ownerId || !contractId || !ftTokenId || !price) {
                log.error("[market_update_sale] - invalid args", []);
                return;
            }

            const saleId = getMarketSaleId(contractId.toString(), tokenId.toString());
            const saleConditionId = getMarketSaleConditionId(
                saleId.toString(),
                ftTokenId.toString()
            );

            let saleCondition = MarketSaleCondition.load(saleConditionId);

            if (!saleCondition) {
                saleCondition = new MarketSaleCondition(saleConditionId);
                saleCondition.saleId = saleId;
                saleCondition.sale = saleId;
            }

            saleCondition.ftTokenId = ftTokenId.toString();
            saleCondition.price = price.toString();

            saleCondition.save();

            // acc
            getOrCreateAccount(ownerId.toString(), stats);

            // stats
            if (ftTokenId.toString() == "near") {
                updateCreateMarketSaleStats(stats, saleId, ownerId.toString(), saleCondition);
            }

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.save();
        } else if (method == "market_remove_sale") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const contractId = data.get("nft_contract_id");

            if (!tokenId || !ownerId || !contractId) {
                log.error("[market_remove_sale] - invalid args", []);
                return;
            }

            const saleId = getMarketSaleId(contractId.toString(), tokenId.toString());
            const sale = MarketSale.load(saleId);

            if (!sale) {
                return;
            }

            removeMarketSale(saleId);

            // acc
            getOrCreateAccount(ownerId.toString(), stats);

            // stats
            stats.marketSaleTotal--;
            updateRemoveMarketSaleStats(stats, saleId, ownerId.toString());

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.marketSaleTotal--;
            senderStats.save();
        } else if (method == "market_offer") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const receiverId = data.get("receiver_id");
            const contractId = data.get("nft_contract_id");
            const payout = data.get("payout");
            const ftTokenId = data.get("ft_token_id");
            const price = data.get("price");

            if (
                !tokenId ||
                !ownerId ||
                !receiverId ||
                !contractId ||
                !payout ||
                !ftTokenId ||
                !price
            ) {
                log.error("[market_offer] - invalid args", []);
                return;
            }

            const saleId = getMarketSaleId(contractId.toString(), tokenId.toString());
            const sale = MarketSale.load(saleId);

            if (!sale) {
                return;
            }

            removeMarketSale(saleId.toString());

            // acc
            getOrCreateAccount(ownerId.toString(), stats);

            // stats
            stats.marketSaleTotal--;

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.marketSaleTotal--;
            senderStats.save();
        }

        stats.save();
    }
}
