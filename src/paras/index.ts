import { near } from "@graphprotocol/graph-ts";
import { getReceiptDate } from "../utils";
import { ParasService } from "./api";
import {json, JSONValue, log, TypedMap} from "@graphprotocol/graph-ts/index";

function parseParasEvent(logData: string): TypedMap<string, JSONValue> {
    let outcomeLog = logData.toString();

    log.info("outcomeLog {}", [outcomeLog]);

    let parsed = outcomeLog.replace("EVENT_JSON:", "");

    let jsonData = json.try_fromString(parsed);
    const jsonObject = jsonData.value.toObject();

    return jsonObject;
}

export function handleParas(receipt: near.ReceiptWithOutcome): void {
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
        const ev = parseParasEvent(outcome.logs[logIndex]);

        const data = ev.get('type');
        const method = ev.get('params');

        if (!data || !method) {
            continue;
        }

        const api = new ParasService(timestamp);
        api.handle(method.toString(), data.toObject());
    }
}
