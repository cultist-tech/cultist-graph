import { Account, ContractStat, MarketSaleCondition } from "../../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts/index";
import { getMarketSaleConditionId } from "../market-sale/helpers";

function getOrCreateStats(contractId: string): ContractStat {
    const stats = ContractStat.load(contractId);

    if (stats) {
        return stats;
    }

    const newStats = new ContractStat(contractId);

    return newStats;
}

export class ContractStatsApi {
    public stats: ContractStat;

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

    public nftUpgrade(accountId: string): void {
        this.stats.transactionTotal++;
        this.stats.nftUpgradeTotal++;
        this.getOrCreateAccount(accountId);
    }

    public marketCreate(accountId: string): void {
        this.stats.marketSaleTotal++;
        this.getOrCreateAccount(accountId);
    }

    public marketPay(ownerId: string, receiverId: string): void {
        this.stats.marketSaleTotal--;
        this.getOrCreateAccount(ownerId);
        this.getOrCreateAccount(receiverId);
    }

    public marketRemove(ownerId: string, saleId: string): void {
        this.stats.transactionTotal++;
        this.stats.marketSaleTotal--;

        const saleConditionId = getMarketSaleConditionId(saleId, "near");
        const saleCondition = MarketSaleCondition.load(saleConditionId);

        if (saleCondition && this.stats.marketSaleNearTotal > 0) {
            this.marketRemoveSaleNear(saleCondition.price);
        }

        this.getOrCreateAccount(ownerId);
    }

    public marketUpdate(saleId: string, ftTokenId: string, price: string): void {
        this.stats.transactionTotal++;

        if (ftTokenId === "near") {
            const saleConditionId = getMarketSaleConditionId(saleId, "near");
            const saleCondition = MarketSaleCondition.load(saleConditionId);

            if (saleCondition) {
                this.marketRemoveSaleNear(saleCondition.price);
            }

            this.marketAddSaleNear(price);
        }
    }

    public marketRemoveSaleNear(price: string): void {
        this.stats.marketSaleNearTotal--;
        this.stats.marketSaleNearSum = BigInt.fromString(this.stats.marketSaleNearSum)
            .minus(BigInt.fromString(price))
            .toString();
    }

    public marketAddSaleNear(price: string): void {
        this.stats.marketSaleNearTotal++;
        this.stats.marketSaleNearSum = BigInt.fromString(this.stats.marketSaleNearSum)
            .plus(BigInt.fromString(price))
            .toString();
    }

    public reputationUpdate(change: i32): void {
        this.stats.reputationTotal = this.stats.reputationTotal + change;

        if (this.stats.reputationTotal < 0) {
            this.stats.reputationTotal = 0;
        }
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
