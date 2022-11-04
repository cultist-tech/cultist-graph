import {
    Statistic,
} from "../../generated/schema";
import {getOrCreateStatistic, getOrCreateStatisticSystem} from "../api/statistic";
import { JSONValue, TypedMap, BigInt } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts/index";
import {referralIncrementPayout} from "../referral/helpers";
import {getOrCreateAccount} from "../api/account";

// use for referral service

export class ParasService {
    protected stats: Statistic;
    protected createdAt: BigInt;

    constructor(timestamp: BigInt) {
        this.stats = getOrCreateStatisticSystem();
        this.createdAt = timestamp;

        this.stats.transactionTotal++;
    }

    //

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        if (method == "resolve_purchase") {
            this.onResolvePurchase(data);
        }

        this.end();
    }

    //

    protected onResolvePurchase(data: TypedMap<string, JSONValue>): void {
        const ownerIdJson = data.get("owner_id");
        const nftContractIdJson = data.get("nft_contract_id");
        const tokenIdJson = data.get("token_id");
        const ftTokenIdJson = data.get("ft_token_id");
        const priceJson = data.get("price");
        const buyerIdJson = data.get("buyer_id");

        if (!ownerIdJson || !nftContractIdJson || !tokenIdJson || !ftTokenIdJson || !priceJson || !buyerIdJson) {
            log.error("[PARAS RESOLVE PURCHASE] - invalid args", []);
            return;
        }

        const contractId = nftContractIdJson.toString();
        const ownerId = ownerIdJson.toString();
        const buyerId = buyerIdJson.toString();
        const ftTokenId = ftTokenIdJson.toString();
        const price = priceJson.toString();

        const contractStats = getOrCreateStatistic(contractId.toString());

        referralIncrementPayout(contractId, ownerId, ftTokenId, price);
        referralIncrementPayout(contractId, buyerId, ftTokenId, price);
        getOrCreateAccount(ownerId, this.stats, contractStats);
        getOrCreateAccount(buyerId, this.stats, contractStats);

        contractStats.save();
    }

    protected end(): void {
        this.stats.save();
    }
}
