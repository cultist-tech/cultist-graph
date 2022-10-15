import { Statistic } from "../../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function getOrCreateStatistic(id: string): Statistic {
    const row = Statistic.load(id);

    if (row) {
        return row;
    }

    return createStatistic(id);
}
export function createStatistic(id: string): Statistic {
    const row = new Statistic(id);

    row.nftTotal = 0 as i32;
    row.nftPayTotal = 0 as i32;
    row.nftTransferTotal = 0 as i32;
    row.nftBurnTotal = 0 as i32;

    row.marketSaleTotal = 0 as i32;
    row.marketSaleNearFloor = BigInt.zero();
    row.marketSaleNearTotal = 0 as i32;
    row.marketSaleNearSum = BigInt.zero();

    row.marketRentTotal = 0 as i32;
    row.marketRentNearFloor = BigInt.zero();
    row.marketRentNearTotal = 0 as i32;
    row.marketRentNearSum = BigInt.zero();

    row.accountTotal = 0 as i32;

    row.save();

    return row;
}
export function getOrCreateStatisticSystem(): Statistic {
    const id = "_";
    const row = Statistic.load(id);

    if (row) {
        return row;
    }

    return createStatistic(id);
}
