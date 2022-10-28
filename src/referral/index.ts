import { near, BigInt } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts";
import {getReceiptDate, parseEvent} from "../utils";
import { getOrCreateAccount } from "../api/account";
import { getOrCreateReferralProgram } from "./helpers";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";

export function handleReferral(receipt: near.ReceiptWithOutcome): void {
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

        if (method == "program_create") {
            const contract_id = data.get("contract_id");
            const influencer_id = data.get("influencer_id");
            const program_id = data.get("program_id");

            if (!contract_id || !influencer_id || !program_id) {
                log.error("[program_create] - invalid args", []);
                return;
            }

            getOrCreateReferralProgram(contract_id.toString(), influencer_id.toString(), program_id.toString());

        } else if (method == "referral_accept") {
            const contract_id = data.get("contract_id");
            const influencer_id = data.get("influencer_id");
            const program_id = data.get("program_id");

            if (!contract_id || !influencer_id || !program_id) {
                log.error("[referral_accept] - invalid args", []);
                return;
            }

            const referral = getOrCreateReferralProgram(contract_id.toString(), influencer_id.toString(), program_id.toString());
            referral.count++;

            referral.save();
        }

        stats.save();
    }
}
