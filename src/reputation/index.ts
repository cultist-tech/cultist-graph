import { Reputation } from "../../generated/schema";
import { JSONValue, TypedMap, log } from "@graphprotocol/graph-ts/index";

function getReputationId(contractId: string, accountId: string): string {
    return contractId + "||" + accountId;
}

export class ReputationService {
    protected contractId: string;

    constructor(contractId: string) {
        this.contractId = contractId;
    }

    public isEvent(method: string): boolean {
        return ["cult_reputation_increase", "cult_reputation_decrease"].indexOf(method) > -1;
    }

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        if (method === "cult_reputation_increase") {
            const accountIdJson = data.get("account_id");
            const amountJson = data.get("amount");

            if (!accountIdJson || !amountJson) {
                log.error("[cult_reputation_increase] - Invalid reputation log", []);
                return;
            }

            const accountId = accountIdJson.toString();
            const amount = amountJson.toI64();

            const rep = this.getOrCreate(this.contractId, accountId);
            rep.value = amount as u32;

            rep.save();
        } else if (method === "cult_reputation_decrease") {
            const accountIdJson = data.get("account_id");
            const amountJson = data.get("amount");

            if (!accountIdJson || !amountJson) {
                log.error("[cult_reputation_decrease] - Invalid reputation log", []);
                return;
            }

            const accountId = accountIdJson.toString();
            const amount = amountJson.toI64();

            const rep = this.getOrCreate(this.contractId, accountId);
            rep.value = amount as u32;

            rep.save();
        }
    }

    protected getOrCreate(contractId: string, accountId: string): Reputation {
        const id = getReputationId(contractId, accountId);

        const item = Reputation.load(id);

        if (item) {
            return item;
        }

        const newItem = new Reputation(id);
        newItem.contractId = contractId;
        newItem.accountId = accountId;
        newItem.value = 0;

        newItem.save();

        return newItem;
    }
}
