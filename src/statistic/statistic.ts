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
    row.tokenTotal = 0 as i32;

    row.save();

    return row;
}
export function getOrCreateStatisticSystem(): Statistic {
  const id = '_';
  const row = Statistic.load(id);

  if (row) {
    return row;
  }

  return createStatistic(id);
}
