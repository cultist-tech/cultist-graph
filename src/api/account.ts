import { Account, Statistic } from "../../generated/schema";

export function getOrCreateAccount(
    id: string,
    stats: Statistic,
    contractStats: Statistic
): Account {
    const account = Account.load(id.toString());

    if (account) {
        return account;
    }

    return createAccount(id, stats, contractStats);
}

export function createAccount(id: string, stats: Statistic, contractStats: Statistic): Account {
    const account = new Account(id.toString());

    stats.accountTotal++;
    contractStats.accountTotal++;

    account.save();

    return account;
}

export function getAccount(id: string): Account | null {
    const account = Account.load(id.toString());

    return account;
}
