import { Statistic } from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";

export class NftIdoMapper {
    protected stats: Statistic;
    protected contractId: string;
    protected createdAt: i32;

    constructor(contractId: string, timestamp: i32) {
        this.stats = getOrCreateStatisticSystem();
        this.contractId = contractId;
        this.createdAt = timestamp;

        this.stats.transactionTotal++;
    }

    public end(): void {
        this.stats.save();
    }

    // private
}
