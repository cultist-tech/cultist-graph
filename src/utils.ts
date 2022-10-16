import { json, JSONValue, log, TypedMap } from "@graphprotocol/graph-ts";
import {near} from "@graphprotocol/graph-ts/index";

function convertNanoSec(time: number): number {
    return time;
}
export function getReceiptDate(receiptWithOutcome: near.ReceiptWithOutcome): number {
    return (convertNanoSec(receiptWithOutcome.block.header.timestampNanosec)) as i32;
}

export function parseEvent(logData: string): TypedMap<string, JSONValue> {
    let outcomeLog = logData.toString();

    if (!outcomeLog.includes("EVENT_JSON:")) {
        log.info("outcomeLog skip {}", [outcomeLog]);

        return new TypedMap<string, JSONValue>();
    }

    log.info("outcomeLog {}", [outcomeLog]);

    let parsed = outcomeLog.replace("EVENT_JSON:", "");

    let jsonData = json.try_fromString(parsed);
    const jsonObject = jsonData.value.toObject();

    return jsonObject;
}
