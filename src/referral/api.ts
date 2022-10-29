import { Referral, Statistic } from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { JSONValue, TypedMap } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts/index";
import {
    getOrCreateReferralContract,
    getOrCreateReferralInfluencer,
    getOrCreateReferralProgram,
    getReferralId,
} from "./helpers";
import { getOrCreateAccount } from "../api/account";

export class ReferralMapper {
    protected stats: Statistic;
    protected createdAt: i32;

    constructor(timestamp: i32) {
        this.stats = getOrCreateStatisticSystem();
        this.createdAt = timestamp;

        this.stats.transactionTotal++;
    }

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        if (method == "program_create") {
            this.onProgramCreate(data);
        } else if (method == "referral_accept") {
            this.onReferralAccept(data);
        }

        this.end();
    }

    public onProgramCreate(data: TypedMap<string, JSONValue>): void {
        const contract_id = data.get("contract_id");
        const influencer_id = data.get("influencer_id");
        const program_id = data.get("program_id");

        if (!contract_id || !influencer_id || !program_id) {
            log.error("[program_create] - invalid args", []);
            return;
        }

        const contractStats = getOrCreateStatistic(contract_id.toString());
        contractStats.transactionTotal++;

        getOrCreateReferralContract(contract_id.toString());
        getOrCreateReferralInfluencer(influencer_id.toString());
        getOrCreateReferralProgram(
            contract_id.toString(),
            influencer_id.toString(),
            program_id.toString()
        );
        getOrCreateAccount(influencer_id.toString(), this.stats, contractStats);
    }

    public onReferralAccept(data: TypedMap<string, JSONValue>): void {
        const contract_id = data.get("contract_id");
        const influencer_id = data.get("influencer_id");
        const program_id = data.get("program_id");
        const account_id = data.get("account_id");

        if (!contract_id || !influencer_id || !program_id || !account_id) {
            log.error("[referral_accept] - invalid args", []);
            return;
        }

        const contractStats = getOrCreateStatistic(contract_id.toString());
        contractStats.transactionTotal++;

        const referralId = getReferralId(
            contract_id.toString(),
            account_id.toString(),
            program_id.toString()
        );
        let referral = Referral.load(referralId);

        if (referral) {
            return;
        }

        const program = getOrCreateReferralProgram(
            contract_id.toString(),
            influencer_id.toString(),
            program_id.toString()
        );
        program.count++;
        program.save();

        const referralContract = getOrCreateReferralContract(contract_id.toString());
        referralContract.count++;
        referralContract.save();

        const referralInfluencer = getOrCreateReferralInfluencer(influencer_id.toString());
        referralInfluencer.count++;
        referralInfluencer.save();

        getOrCreateAccount(account_id.toString(), this.stats, contractStats);

        referral = new Referral(referralId);
        referral.accountId = account_id.toString();
        referral.contractId = contract_id.toString();
        referral.influencerId = influencer_id.toString();
        referral.programId = program_id.toString();
        referral.program = program_id.toString();
        referral.contract = contract_id.toString();
        referral.influencer = influencer_id.toString();
        referral.account = account_id.toString();

        referral.save();
    }

    public end(): void {
        this.stats.save();
    }
}
