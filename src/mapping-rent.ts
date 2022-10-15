import { near, store } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { Account, MarketRent } from "../generated/schema";
import { parseEvent } from "./utils";
import { getOrCreateAccount } from "./account/account";
import { BigDecimal } from "@graphprotocol/graph-ts/index";
import { getOrCreateStatisticSystem } from "./statistic/statistic";
import { saveMarketRentConditions } from "./market-rent/condition";
import { getMarketSaleId, removeMarketSale } from "./market-sale";

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

        if (method == "rent_add") {
            const tokenId = data.get("token_id");
            const contractId = data.get("contract_id");
            const accountId = data.get("owner_id");
            const minTime = data.get("min_time");
            const maxTime = data.get("max_time");
            const createdAt = data.get("created_at");
            const saleConditions = data.get("sale_conditions");

            if (!tokenId || !accountId || !minTime || !maxTime || !createdAt || !contractId) {
                log.error("[rent_add] - invalid args", []);
                return;
            }

            const rentId = contractId.toString() + "||" + tokenId.toString();

            const rent = new MarketRent(rentId.toString());
            rent.tokenId = tokenId.toString();
            rent.token = tokenId.toString();
            rent.ownerId = accountId.toString();
            rent.owner = accountId.toString();
            rent.minTime = minTime.toU64() as i32;
            rent.maxTime = maxTime.toU64() as i32;
            rent.createdAt = createdAt.toU64() as i32;
            rent.contractId = contractId.toString();

            if (saleConditions && !saleConditions.isNull()) {
                saveMarketRentConditions(rentId, saleConditions);
            }

            rent.save();

            // acc
            getOrCreateAccount(accountId.toString());

            // stats
            const stats = getOrCreateStatisticSystem();
            stats.marketRentTotal++;
            stats.save();
        } else if (method == "rent_remove") {
            const tokenId = data.get("token_id");
            const accountId = data.get("account_id");
            const contractId = data.get("contract_id");

            if (!tokenId || !accountId || !contractId) {
                log.error("[rent_remove] - invalid args", []);
                return;
            }

            const rentId = contractId.toString() + "||" + tokenId.toString();
            const rent = MarketRent.load(rentId.toString());

            if (!rent) {
                return;
            }

            store.remove("MarketRent", rentId.toString());

            // acc
            getOrCreateAccount(accountId.toString());

            // stats
            const stats = getOrCreateStatisticSystem();
            stats.marketRentTotal--;
            stats.save();
        } else if (method == "rent_pay") {
            const tokenId = data.get("token_id");
            const accountId = data.get("owner_id");
            const contractId = data.get("contract_id");
            const receiverId = data.get("receiver_id");
            const time = data.get("time");
            const endTime = data.get("end_time");
            const rawPrice = data.get("price");

            if (
                !tokenId ||
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

            const rentId = contractId.toString() + "||" + tokenId.toString();
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

            // clear
            const saleId = getMarketSaleId(contractId.toString(), tokenId.toString());
            removeMarketSale(saleId);

            // acc
            getOrCreateAccount(receiverId.toString());

            //
            const stats = getOrCreateStatisticSystem();
            stats.marketRentTotal--;
            stats.save();
        } else if (method == "rent_claim") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const renterId = data.get("renter_id");
            const contractId = data.get("contract_id");

            if (!tokenId || !ownerId || !renterId || !contractId) {
                return;
            }

            const rentId = contractId.toString() + "||" + tokenId.toString();
            const rent = MarketRent.load(rentId.toString());

            if (!rent) {
                return;
            }

            store.remove("MarketRent", tokenId.toString());

            // acc
            getOrCreateAccount(ownerId.toString());
        }
    }
}
