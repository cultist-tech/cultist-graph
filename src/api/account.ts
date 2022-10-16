import { Account, Statistic } from "../../generated/schema";

export function getOrCreateAccount(id: string, stats: Statistic): Account {
    const account = Account.load(id.toString());

    if (account) {
        return account;
    }

    return createAccount(id, stats);
}

export function createAccount(id: string, stats: Statistic): Account {
    const account = new Account(id.toString());

    stats.accountTotal++;

    // account.totalMints = 0 as i32;
    // account.totalSales = 0 as i32;
    // account.totalRents = 0 as i32;
    // account.totalPayRents = 0 as i32;
    // account.totalPaySales = 0 as i32;
    // account.totalTransfers = 0 as i32;
    // account.totalPayRentsPrice = BigDecimal.zero();
    // account.totalPaySalesPrice = BigDecimal.zero();
    // account.totalMintsPrice = BigDecimal.zero();
    // account.totalBurn = 0 as i32;
    // account.balance = BigInt.zero();
    // account.currentNfts = 0 as i32;
    // account.currentSales = 0 as i32;
    // account.currentRents = 0 as i32;

    account.save();

    return account;
}

export function getAccount(id: string): Account | null {
    const account = Account.load(id.toString());

    return account;
}
