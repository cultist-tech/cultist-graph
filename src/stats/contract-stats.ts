import { Account, ContractStats } from "../../generated/schema";

function getOrCreateStats(contractId: string): ContractStats {
    const stats = ContractStats.load(contractId);

    if (stats) {
        return stats;
    }

    const newStats = new ContractStats(contractId);

    return newStats;
}

export class ContractStatsApi {
    public stats: ContractStats;

    constructor(contractId: string) {
        this.stats = getOrCreateStats(contractId);
    }

    public nftMint(receiverId: string): void {
        this.stats.transactionTotal++;
        this.getOrCreateAccount(receiverId);
    }

    public nftTransfer(senderId: string, receiverId: string): void {
        this.stats.transactionTotal++;
        this.stats.nftTransferTotal++;
        this.getOrCreateAccount(senderId);
        this.getOrCreateAccount(receiverId);
    }

    public nftTransferPayout(ownerId: string, receiverId: string): void {
        this.stats.nftBuyTotal++;
        this.stats.nftSellTotal++;
        this.getOrCreateAccount(ownerId);
        this.getOrCreateAccount(receiverId);
    }

    public nftBurn(accountId: string): void {
        this.stats.transactionTotal++;
        this.stats.nftBurnTotal++;
        this.getOrCreateAccount(accountId);
    }

    public marketCreate(accountId: string): void {
        this.stats.marketSaleTotal++;
        this.getOrCreateAccount(accountId);
    }

    public marketPay(ownerId: string, receiverId: string): void {
        this.stats.marketSaleTotal--
        this.getOrCreateAccount(ownerId);
        this.getOrCreateAccount(receiverId);
    }

    public marketRemove(ownerId: string): void {
        this.stats.transactionTotal++;
        this.stats.marketSaleTotal--;

        this.getOrCreateAccount(ownerId);
    }

    public marketUpdate(): void {
        this.stats.transactionTotal++;
    }

    //

    public getOrCreateAccount(accountId: string): Account {
        const account = Account.load(accountId);

        if (account) {
            return account;
        }

        // TODO need create AccountByContract
        const newAccount = new Account(accountId);
        newAccount.save();

        this.stats.accountTotal++;

        return newAccount;
    }

    public save(): void {
        this.stats.save();
    }
}
