import { near } from "@graphprotocol/graph-ts";
import {getReceiptDate, parseEvent} from "../utils";
import { NftFractionationMapper } from "./api";

export function handleNftFractionation(receipt: near.ReceiptWithOutcome): void {
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
    const contractId = receiptWithOutcome.receipt.receiverId;
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

        const mapper = new NftFractionationMapper(contractId, timestamp);

        if (method == "fractionation_create") {
            mapper.onCreate(data);
        } else if (method == 'fractionation_complete') {
            mapper.onCompete(data);
        } else if (method == 'fractionation_process') {
            mapper.onProcess(data);
        }

        mapper.end();
    }
}
