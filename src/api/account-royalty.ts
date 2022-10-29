import { AccountRoyalty } from "../../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts/index";

export function getAccountRoyaltyId(accountId: string, ftTokenId: string): string {
    return accountId + "||" + ftTokenId;
}

export function getOrCreateAccountRoyalty(accountId: string, ftTokenId: string): AccountRoyalty {
    const id = getAccountRoyaltyId(accountId, ftTokenId);
    const royalty = AccountRoyalty.load(id.toString());

    if (royalty) {
        return royalty;
    }

    return createAccountRoyalty(accountId, ftTokenId);
}

export function createAccountRoyalty(accountId: string, ftTokenId: string): AccountRoyalty {
    const id = getAccountRoyaltyId(accountId, ftTokenId);
    const royalty = new AccountRoyalty(id.toString());

    royalty.account = accountId;
    royalty.accountId = accountId;
    royalty.ftTokenId = ftTokenId;
    royalty.amount = "0";

    royalty.save();

    return royalty;
}
