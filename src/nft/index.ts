import { near } from "@graphprotocol/graph-ts";
import { getReceiptDate, parseEvent } from "../utils";
import { TokenMapper } from "./api";

export function handleNft(receipt: near.ReceiptWithOutcome): void {
    const actions = receipt.receipt.actions;
    for (let i = 0; i < actions.length; i++) {
        handleAction(actions[i], receipt);
    }
}

function handleAction(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        return;
    }

    // const functionCall = action.toFunctionCall();
    // const ipfsHash = 'bafybeiew2l6admor2lx6vnfdaevuuenzgeyrpfle56yrgse4u6nnkwrfeu'
    // const methodName = functionCall.methodName
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

        const tokenMapper = new TokenMapper(contractId, timestamp);

        tokenMapper.handle(method, data);

    }
}
