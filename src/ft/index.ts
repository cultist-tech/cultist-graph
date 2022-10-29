import { near, BigInt } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import { getReceiptDate, parseEvent } from "../utils";
import { getOrCreateAccount } from "../api/account";
import { getOrCreateFtBalance } from "./helpers";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";

export function handleFt(receipt: near.ReceiptWithOutcome): void {
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

        const contractId = receiptWithOutcome.receipt.receiverId;

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

        if (method == "ft_transfer") {
            const amount = data.get("amount");
            const old_owner_id = data.get("old_owner_id");
            const new_owner_id = data.get("new_owner_id");
            const memo = data.get("memo");

            if (!amount || !new_owner_id || !old_owner_id) {
                log.error("[ft_transfer] - invalid args", []);
                return;
            }

            const senderBalance = getOrCreateFtBalance(old_owner_id.toString(), contractId);
            const receiverBalance = getOrCreateFtBalance(new_owner_id.toString(), contractId);

            senderBalance.balance = senderBalance.balance.minus(
                BigInt.fromString(amount.toString())
            );
            receiverBalance.balance = receiverBalance.balance.plus(
                BigInt.fromString(amount.toString())
            );

            if (senderBalance.balance.lt(BigInt.zero())) {
                log.error("[ft_transfer] - zero transfer {} {} {}", [
                    old_owner_id.toString(),
                    new_owner_id.toString(),
                    amount.toString(),
                ]);

                return;
            }

            senderBalance.save();
            receiverBalance.save();

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(old_owner_id.toString(), stats, contractStats);
            getOrCreateAccount(new_owner_id.toString(), stats, contractStats);

            // stats acc
            const senderStats = getOrCreateStatistic(old_owner_id.toString());
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        } else if (method == "ft_mint") {
            const amount = data.get("amount");
            const account_id = data.get("owner_id");
            const memo = data.get("memo");

            if (!account_id || !amount) {
                log.error("[ft_mint] - invalid args", []);
                return;
            }

            const receiverBalance = getOrCreateFtBalance(account_id.toString(), contractId);

            receiverBalance.balance = receiverBalance.balance.plus(
                BigInt.fromString(amount.toString())
            );

            receiverBalance.save();

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(account_id.toString(), stats, contractStats);

            // stats acc
            const senderStats = getOrCreateStatistic(account_id.toString());
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        } else if (method == "ft_burn") {
            const amount = data.get("amount");
            const account_id = data.get("owner_id");
            const memo = data.get("memo");

            if (!account_id || !amount) {
                log.error("[ft_mint] - invalid args", []);
                return;
            }

            const receiverBalance = getOrCreateFtBalance(account_id.toString(), contractId);

            receiverBalance.balance = receiverBalance.balance.minus(
                BigInt.fromString(amount.toString())
            );

            receiverBalance.save();

            //
            const contractStats = getOrCreateStatistic(contractId.toString());

            // acc
            getOrCreateAccount(account_id.toString(), stats, contractStats);

            // stats acc
            const senderStats = getOrCreateStatistic(account_id.toString());
            senderStats.transactionTotal++;
            senderStats.save();

            contractStats.save();
        }

        stats.save();
    }
}
