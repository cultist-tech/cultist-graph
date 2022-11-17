import { near } from "@graphprotocol/graph-ts";
import { getReceiptDate } from "../utils";
import { ParasService } from "./api";
import { json, JSONValue, log, TypedMap } from "@graphprotocol/graph-ts/index";

function parseParasEvent(logData: string): TypedMap<string, JSONValue> {
    if (!logData) {
        return new TypedMap<string, JSONValue>();
    }
    let outcomeLog = logData.toString();

    if (!(outcomeLog.slice(0, 1) == "{" && outcomeLog.slice(-1) == "}")) {
        return new TypedMap<string, JSONValue>();
    }

    log.info("outcomeLog paras {}", [outcomeLog]);

    let jsonData = json.try_fromString(outcomeLog);
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

        const method = ev.get("type");
        const data = ev.get("params");

        if (!data || !method) {
            continue;
        }

        const api = new ParasService(timestamp);
        api.handle(method.toString(), data.toObject());
    }
}
