import { Account } from "../../generated/schema";

export function getOrCreateAccount(id: string, onCreate: (id: string) => void): Account {
    const account = Account.load(id.toString());

    if (account) {
        return account;
    }

    onCreate(id);

    return createAccount(id);
}

export function createAccount(id: string): Account {
    const account = new Account(id.toString());

    account.save();

    return account;
}

export function getAccount(id: string): Account | null {
    const account = Account.load(id.toString());

    return account;
}
