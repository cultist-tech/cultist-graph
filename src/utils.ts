import { json, JSONValue, log, TypedMap } from "@graphprotocol/graph-ts";
import { BigInt, near } from "@graphprotocol/graph-ts/index";

export function getReceiptDate(receiptWithOutcome: near.ReceiptWithOutcome): BigInt {
    return BigInt.fromU64(receiptWithOutcome.block.header.timestampNanosec).div(BigInt.fromU64(1_000_000));
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

export function sumBigInt(one: string, two: string): string {
    return BigInt.fromString(one).plus(BigInt.fromString(two)).toString();
}

