import { Statistic } from "../../generated/schema";

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
    row.marketSaleNearTotal = 0 as i32;
    row.marketSaleNearFloor = "0";
    row.marketSaleNearSum = "0";

    row.marketRentTotal = 0 as i32;
    row.marketRentNearTotal = 0 as i32;
    row.marketRentNearFloor = "0";
    row.marketRentNearSum = "0";

    row.accountTotal = 0 as i32;
    row.transactionTotal = 0 as i32;

    row.save();

    return row;
}
export function getOrCreateStatisticSystem(): Statistic {
    const id = "_";

    return getOrCreateStatistic(id);
}
