import { near, store } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { MarketRent, MarketRentCondition, Token } from "../../generated/schema";
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
            const tokenIdRaw = data.get("token_id");
            const contractId = data.get("contract_id");
            const accountId = data.get("owner_id");
            const minTime = data.get("min_time");
            const maxTime = data.get("max_time");
            const createdAt = data.get("created_at");
            const saleConditions = data.get("sale_conditions");

            if (!tokenIdRaw || !accountId || !minTime || !maxTime || !createdAt || !contractId) {
                log.error("[rent_add] - invalid args", []);
                return;
            }

            const tokenId = getTokenId(contractId.toString(), tokenIdRaw.toString());

            const rentId = getMarketRentId(contractId.toString(), tokenId.toString());

            const rent = new MarketRent(rentId.toString());
            rent.tokenId = tokenIdRaw.toString();
            rent.token = tokenId.toString();
            rent.ownerId = accountId.toString();
            rent.owner = accountId.toString();
            rent.minTime = minTime.toU64() as i32;
            rent.maxTime = maxTime.toU64() as i32;
            rent.createdAt = timestamp;
            rent.contractId = contractId.toString();

            if (saleConditions && !saleConditions.isNull()) {
                saveMarketRentConditions(stats, rentId, accountId.toString(), saleConditions);
            }

            rent.save();

            // token
            const tokenContractId = getTokenId(contractId.toString(), tokenId.toString());
            const token = Token.load(tokenContractId);

            if (token) {
                token.rent = rentId;
                token.rentId = rentId;
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
            const tokenIdRaw = data.get("token_id");
            const accountId = data.get("account_id");
            const contractId = data.get("contract_id");

            if (!tokenIdRaw || !accountId || !contractId) {
                log.error("[rent_remove] - invalid args", []);
                return;
            }

            const tokenId = getTokenId(contractId.toString(), tokenIdRaw.toString());

            const rentId = getMarketRentId(contractId.toString(), tokenId.toString());
            const rent = MarketRent.load(rentId.toString());

            if (!rent) {
                return;
            }

            removeMarketRent(rentId);

            // token
            const tokenContractId = getTokenId(contractId.toString(), tokenId.toString());
            const token = Token.load(tokenContractId);

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
            updateRemoveMarketRentStats(stats, rentId, accountId.toString());

            // stats acc
            const senderStats = getOrCreateStatistic(accountId.toString());
            senderStats.transactionTotal++;
            senderStats.marketRentTotal--;
            senderStats.save();

            contractStats.save();
        } else if (method == "rent_pay") {
            const tokenIdRaw = data.get("token_id");
            const accountId = data.get("owner_id");
            const contractId = data.get("contract_id");
            const receiverId = data.get("receiver_id");
            const time = data.get("time");
            const endTime = data.get("end_time");
            const rawPrice = data.get("price");

            if (
                !tokenIdRaw ||
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

            const tokenId = getTokenId(contractId.toString(), tokenIdRaw.toString());

            const rentId = getMarketRentId(contractId.toString(), tokenId.toString());
            const rent = MarketRent.load(rentId.toString());

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
            updateRemoveMarketRentStats(stats, rentId, accountId.toString());

            // stats acc
            const senderStats = getOrCreateStatistic(receiverId.toString());
            senderStats.transactionTotal++;
            senderStats.marketRentTotal--;
            senderStats.save();

            contractStats.save();
        } else if (method == "rent_update") {
            const tokenIdRaw = data.get("token_id");
            const ownerId = data.get("owner_id");
            const contractId = data.get("contract_id");
            const minTime = data.get("min_time");
            const maxTime = data.get("max_time");
            const ftTokenId = data.get("ft_token_id");
            const price = data.get("price");

            if (!tokenIdRaw || !ownerId || !contractId || !ftTokenId || !price) {
                log.error("[market_update_sale] - invalid args", []);
                return;
            }

            const tokenId = getTokenId(contractId.toString(), tokenIdRaw.toString());

            const rentId = getMarketRentId(contractId.toString(), tokenId.toString());
            const saleConditionId = getMarketSaleConditionId(rentId, ftTokenId.toString());

            const rent = MarketRent.load(rentId);

            if (!rent) {
                return;
            }

            let saleCondition = MarketRentCondition.load(saleConditionId);

            if (!saleCondition) {
                saleCondition = new MarketRentCondition(saleConditionId);
                saleCondition.rentId = rentId;
                saleCondition.rent = rentId;
            }

            saleCondition.ftTokenId = ftTokenId.toString();
            saleCondition.price = price.toString();

            if (ftTokenId.toString() == "near") {
                updateCreateMarketRentStats(stats, rentId, ownerId.toString(), saleCondition);
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
            const tokenIdRaw = data.get("token_id");
            const ownerId = data.get("owner_id");
            const renterId = data.get("renter_id");
            const contractId = data.get("contract_id");

            if (!tokenIdRaw || !ownerId || !renterId || !contractId) {
                return;
            }

            const tokenId = getTokenId(contractId.toString(), tokenIdRaw.toString());

            const rentId = getMarketRentId(contractId.toString(), tokenId.toString());
            const rent = MarketRent.load(rentId.toString());

            if (!rent) {
                return;
            }

            removeMarketRent(rentId);

            // token
            const tokenContractId = getTokenId(contractId.toString(), tokenId.toString());
            const token = Token.load(tokenContractId);

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
