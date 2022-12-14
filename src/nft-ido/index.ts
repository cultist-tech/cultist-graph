import { near } from "@graphprotocol/graph-ts";
import { getReceiptDate, parseEvent } from "../utils";
import { NftIdoMapper } from "./api";

export function handleNftIdo(receipt: near.ReceiptWithOutcome): void {
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

        const tokenMapper = new NftIdoMapper(contractId, timestamp);

        if (method == "ido_create") {
            tokenMapper.onCreate(data);
        } else if (method == "ido_update") {
            tokenMapper.onUpdate(data);
        } else if (method == "ido_start") {
            tokenMapper.onStart(data);
        } else if (method == "ido_pause") {
            tokenMapper.onPause(data);
        } else if (method == "ido_add_token") {
            tokenMapper.onAddToken(data);
        } else if (method == "ido_buy_token") {
            tokenMapper.onBuyToken(data);
        }

        tokenMapper.end();
    }
}
