import { near, store } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { MarketRent, MarketRentCondition, Nft } from "../../generated/schema";
import { getReceiptDate, parseEvent } from "../utils";
import { getOrCreateAccount } from "../api/account";
import { BigDecimal } from "@graphprotocol/graph-ts/index";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import {
    getMarketRentId,
    removeMarketRent,
    saveMarketRentConditions,
    updateCreateMarketRentStats,
    updateRemoveMarketRentStats,
} from "./helpers";
import { getMarketSaleConditionId } from "../market-sale/helpers";
import { getTokenId } from "../nft/helpers";

export function handleRent(receipt: near.ReceiptWithOutcome): void {
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

        const stats = getOrCreateStatisticSystem();
        stats.transactionTotal++;

        if (method == "rent_add") {
            const tokenIdJson = data.get("token_id");
            const contractId = data.get("contract_id");
            const accountId = data.get("owner_id");
            const minTime = data.get("min_time");
            const maxTime = data.get("max_time");
            const createdAt = data.get("created_at");
            const saleConditions = data.get("sale_conditions");

            if (!tokenIdJson || !accountId || !minTime || !maxTime || !createdAt || !contractId) {
                log.error("[rent_add] - invalid args", []);
                return;
            }

            const tokenId = tokenIdJson.toString();
            const contractTokenId = getTokenId(contractId.toString(), tokenId);
            const contractRentId = getMarketRentId(contractId.toString(), tokenId);

            const rent = new MarketRent(contractRentId);
            rent.nftId = tokenId;
            rent.nft = contractTokenId;
            rent.ownerId = accountId.toString();
            rent.owner = accountId.toString();
            rent.minTime = minTime.toU64() as i32;
            rent.maxTime = maxTime.toU64() as i32;
            rent.createdAt = timestamp;
            rent.contractId = contractId.toString();

            if (saleConditions && !saleConditions.isNull()) {
                saveMarketRentConditions(stats, contractRentId, accountId.toString(), saleConditions);
            }

            rent.save();

            // token
            const token = Nft.load(contractTokenId);

            if (token) {
                token.rent = contractRentId;
                token.rentId = contractRentId;

                token.save();
            }

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(accountId.toString(), stats, contractStats);

            // stats
            stats.marketRentTotal++;

            // stats acc
            const senderStats = getOrCreateStatistic(accountId.toString());
            senderStats.transactionTotal++;
            senderStats.marketRentTotal++;
            senderStats.save();

            contractStats.save();
        } else if (method == "rent_remove") {
            const tokenIdJson = data.get("token_id");
            const accountId = data.get("account_id");
            const contractId = data.get("contract_id");

            if (!tokenIdJson || !accountId || !contractId) {
                log.error("[rent_remove] - invalid args", []);
                return;
            }

            const tokenId = tokenIdJson.toString();

            const contractTokenId = getTokenId(contractId.toString(), tokenId);
            const contractRentId = getMarketRentId(contractId.toString(), tokenId);

            const rent = MarketRent.load(contractRentId);

            if (!rent) {
                return;
            }

            removeMarketRent(contractRentId);

            // token
            const token = Nft.load(contractTokenId);

            if (token) {
                token.rent = null;
                token.rentId = null;
            }

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(accountId.toString(), stats, contractStats);

            // stats
            stats.marketRentTotal--;
            updateRemoveMarketRentStats(stats, contractRentId, accountId.toString());

            // stats acc
            const senderStats = getOrCreateStatistic(accountId.toString());
            senderStats.transactionTotal++;
            senderStats.marketRentTotal--;
            senderStats.save();

            contractStats.save();
        } else if (method == "rent_pay") {
            const tokenIdJson = data.get("token_id");
            const accountId = data.get("owner_id");
            const contractId = data.get("contract_id");
            const receiverId = data.get("receiver_id");
            const time = data.get("time");
            const endTime = data.get("end_time");
            const rawPrice = data.get("price");

            if (
                !tokenIdJson ||
                !accountId ||
                !receiverId ||
                !time ||
                !endTime ||
                !rawPrice ||
                !contractId
            ) {
                log.error("[rent_pay] - invalid args", []);
                return;
            }

            const tokenId = tokenIdJson.toString();
            const contractTokenId = getTokenId(contractId.toString(), tokenId);
            const contractRentId = getMarketRentId(contractId.toString(), tokenId);

            const rent = MarketRent.load(contractRentId);

            if (!rent) {
                return;
            }

            let price = BigDecimal.fromString(rawPrice.toString()).div(
                BigDecimal.fromString("1000000000000000000000000")
            );

            rent.endedAt = endTime.toU64() as i32;
            rent.renterId = receiverId.toString();

            rent.save();

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(receiverId.toString(), stats, contractStats);

            // stats
            stats.marketRentTotal--;
            updateRemoveMarketRentStats(stats, contractRentId, accountId.toString());

            // stats acc
            const senderStats = getOrCreateStatistic(receiverId.toString());
            senderStats.transactionTotal++;
            senderStats.marketRentTotal--;
            senderStats.save();

            contractStats.save();
        } else if (method == "rent_update") {
            const tokenIdJson = data.get("token_id");
            const ownerId = data.get("owner_id");
            const contractId = data.get("contract_id");
            const minTime = data.get("min_time");
            const maxTime = data.get("max_time");
            const ftTokenId = data.get("ft_token_id");
            const price = data.get("price");

            if (!tokenIdJson || !ownerId || !contractId || !ftTokenId || !price) {
                log.error("[market_update_sale] - invalid args", []);
                return;
            }

            const tokenId = tokenIdJson.toString();
            const contractTokenId = getTokenId(contractId.toString(), tokenId);
            const contractRentId = getMarketRentId(contractId.toString(), tokenId.toString());
            const saleConditionId = getMarketSaleConditionId(contractRentId, ftTokenId.toString());

            const rent = MarketRent.load(contractRentId);

            if (!rent) {
                return;
            }

            let saleCondition = MarketRentCondition.load(saleConditionId);

            if (!saleCondition) {
                saleCondition = new MarketRentCondition(saleConditionId);
                saleCondition.rentId = contractRentId;
                saleCondition.rent = contractRentId;
            }

            saleCondition.ftTokenId = ftTokenId.toString();
            saleCondition.price = price.toString();

            if (ftTokenId.toString() == "near") {
                updateCreateMarketRentStats(stats, contractRentId, ownerId.toString(), saleCondition);
            }

            saleCondition.save();

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(ownerId.toString(), stats, contractStats);

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        } else if (method == "rent_claim") {
            const tokenIdJson = data.get("token_id");
            const ownerId = data.get("owner_id");
            const renterId = data.get("renter_id");
            const contractId = data.get("contract_id");

            if (!tokenIdJson || !ownerId || !renterId || !contractId) {
                return;
            }

            const tokenId = tokenIdJson.toString();
            const contractTokenId = getTokenId(contractId.toString(), tokenId);
            const contractRentId = getMarketRentId(contractId.toString(), tokenId);

            const rent = MarketRent.load(contractRentId);

            if (!rent) {
                return;
            }

            removeMarketRent(contractRentId);

            // token
            const token = Nft.load(contractTokenId);

            if (token) {
                token.rent = null;
                token.rentId = null;
            }

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(ownerId.toString(), stats, contractStats);

            // stats acc
            const senderStats = getOrCreateStatistic(ownerId.toString());
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        }

        stats.save();
    }
}
