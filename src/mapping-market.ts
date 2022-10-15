import { near, store } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { MarketSale, MarketSaleCondition, Account } from "../generated/schema";
import { parseEvent } from "./utils";
import { createAccount, getAccount, getOrCreateAccount } from "./account/account";
import { getOrCreateStatisticSystem } from "./statistic/statistic";
import { saveMarketSaleConditions } from "./market-sale/condition";
import { removeMarketSale } from "./market-sale";
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
            const createdAt = saleObj.get("created_at");
            const isAuction = saleObj.get("is_auction");

            if (!ownerId || !ownerId || !contractId || !tokenId || !saleConditions || !createdAt) {
                log.error("[market_create_sale] - invalid args", []);
                return;
            }

            const saleId = contractId.toString() + "||" + tokenId.toString();

            const sale = new MarketSale(saleId);

            sale.tokenId = tokenId.toString();
            sale.token = tokenId.toString();
            sale.ownerId = ownerId.toString();
            sale.owner = ownerId.toString();
            sale.contractId = contractId.toString();
            sale.createdAt = createdAt.toU64() as i32;
            sale.isAuction = isAuction ? isAuction.toBool() : false;

            if (saleConditions && !saleConditions.isNull()) {
                saveMarketSaleConditions(saleId, saleConditions);
            }

            sale.save();

            //
            getOrCreateAccount(ownerId.toString());

            //
            const stats = getOrCreateStatisticSystem();
            stats.marketSaleTotal++;
            stats.save();
        } else if (method == "market_update_sale") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const nftContractId = data.get("nft_contract_id");
            const ftTokenId = data.get("ft_token_id");
            const price = data.get("price");

            if (!tokenId || !ownerId || !nftContractId || !ftTokenId || !price) {
                log.error("[market_update_sale] - invalid args", []);
                return;
            }

            const saleId = nftContractId.toString() + "||" + tokenId.toString();
            const saleConditionId = saleId + "||" + ftTokenId.toString();

            let saleCondition = MarketSaleCondition.load(saleConditionId);

            if (!saleCondition) {
                saleCondition = new MarketSaleCondition(saleConditionId);
                saleCondition.saleId = saleId;
                saleCondition.sale = saleId;
            }

            saleCondition.ftTokenId = ftTokenId.toString();
            saleCondition.price = price.toString();

            if (saleCondition.ftTokenId == "near") {
                const stats = getOrCreateStatisticSystem();

                stats.marketSaleNearTotal++;
                stats.marketSaleNearSum = BigInt.fromString(stats.marketSaleNearSum)
                    .plus(BigInt.fromString(saleCondition.price))
                    .toString();

                if (
                    BigInt.fromString(stats.marketSaleNearFloor).gt(
                        BigInt.fromString(saleCondition.price)
                    )
                ) {
                    stats.marketSaleNearFloor = saleCondition.price;

                    stats.save();
                }
            }

            saleCondition.save();

            //
            getOrCreateAccount(ownerId.toString());
        } else if (method == "market_remove_sale") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const nftContractId = data.get("nft_contract_id");

            if (!tokenId || !ownerId || !nftContractId) {
                log.error("[market_remove_sale] - invalid args", []);
                return;
            }

            const saleId = nftContractId.toString() + "||" + tokenId.toString();
            const sale = MarketSale.load(saleId);

            if (!sale) {
                return;
            }

            removeMarketSale(saleId);

            //
            getOrCreateAccount(ownerId.toString());

            //
            const stats = getOrCreateStatisticSystem();
            stats.marketSaleTotal--;
            stats.save();
        } else if (method == "market_offer") {
            const tokenId = data.get("token_id");
            const ownerId = data.get("owner_id");
            const receiverId = data.get("receiver_id");
            const nftContractId = data.get("nft_contract_id");
            const payout = data.get("payout");
            const ftTokenId = data.get("ft_token_id");
            const price = data.get("price");

            if (
                !tokenId ||
                !ownerId ||
                !receiverId ||
                !nftContractId ||
                !payout ||
                !ftTokenId ||
                !price
            ) {
                log.error("[market_offer] - invalid args", []);
                return;
            }

            const saleId = nftContractId.toString() + "||" + tokenId.toString();
            const sale = MarketSale.load(saleId);

            if (!sale) {
                return;
            }

            store.remove("MarketSale", saleId.toString());

            //
            getOrCreateAccount(ownerId.toString());

            //
            const stats = getOrCreateStatisticSystem();
            stats.marketSaleTotal--;
            stats.save();
        }
    }
}
