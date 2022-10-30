import {
    Referral,
    ReferralContractInfluencer,
    ReferralInfluencerContract,
    ReferralProgram,
    Statistic,
} from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { JSONValue, TypedMap } from "@graphprotocol/graph-ts";
import { log } from "@graphprotocol/graph-ts/index";
import {
    getOrCreateReferralContract,
    getOrCreateReferralContractInfluencer,
    getOrCreateReferralInfluencer,
    getOrCreateReferralInfluencerContract,
    getReferralContractInfluencerId,
    getReferralId,
    getReferralInfluencerContractId,
    getReferralProgramId,
} from "./helpers";
import { getOrCreateAccount } from "../api/account";

export class ReferralService {
    protected stats: Statistic;
    protected createdAt: i32;

    constructor(timestamp: i32) {
        this.stats = getOrCreateStatisticSystem();
        this.createdAt = timestamp;

        this.stats.transactionTotal++;
    }

    //

    //

    public handle(method: string, data: TypedMap<string, JSONValue>): void {
        if (method == "program_create") {
            this.onProgramCreate(data);
        } else if (method == "referral_accept") {
            this.onReferralAccept(data);
        }

        this.end();
    }

    protected onProgramCreate(data: TypedMap<string, JSONValue>): void {
        const contract_id = data.get("contract_id");
        const influencer_id = data.get("influencer_id");
        const program_id = data.get("program_id");
        const royalty_percent = data.get("royalty_percent");
        const code = data.get("code");

        if (!contract_id || !influencer_id || !program_id || !royalty_percent || !code) {
            log.error("[program_create] - invalid args", []);
            return;
        }

        const contractStats = getOrCreateStatistic(contract_id.toString());
        contractStats.transactionTotal++;

        const id = getReferralProgramId(
            contract_id.toString(),
            influencer_id.toString(),
            program_id.toString()
        );
        const program = new ReferralProgram(id.toString());

        program.contractId = contract_id.toString();
        program.influencerId = influencer_id.toString();
        program.referralsCount = 0 as i32;
        program.activeReferralsCount = 0 as i32;
        program.programId = program_id.toString();
        program.contract = contract_id.toString();
        program.influencer = influencer_id.toString();
        program.royalty_percent = royalty_percent.toI64() as i32;
        program.code = code.toString();
        program.createdAt = this.createdAt;

        program.save();

        const referralContract = getOrCreateReferralContract(contract_id.toString());
        const referralInfluencer = getOrCreateReferralInfluencer(influencer_id.toString());
        const referralContractInfluencerId = getReferralContractInfluencerId(
            contract_id.toString(),
            influencer_id.toString()
        );
        const referralInfluencerContractId = getReferralContractInfluencerId(
            influencer_id.toString(),
            contract_id.toString()
        );

        if (!ReferralContractInfluencer.load(referralContractInfluencerId)) {
            referralInfluencer.contractsCount++;
            referralInfluencer.save();
        }
        if (!ReferralInfluencerContract.load(referralInfluencerContractId)) {
            referralContract.influencersCount++;
            referralContract.save();
        }

        getOrCreateReferralContractInfluencer(contract_id.toString(), influencer_id.toString());
        getOrCreateReferralInfluencerContract(influencer_id.toString(), contract_id.toString());

        getOrCreateAccount(influencer_id.toString(), this.stats, contractStats);
    }

    protected onReferralAccept(data: TypedMap<string, JSONValue>): void {
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
        );
        let referral = Referral.load(referralId);

        if (referral) {
            return;
        }

        const programId = getReferralProgramId(
            contract_id.toString(),
            influencer_id.toString(),
            program_id.toString()
        );
        const program = ReferralProgram.load(programId);

        if (!program) {
            log.error("[onReferralAccept] - not found", []);
            return;
        }

        program.referralsCount++;
        program.activeReferralsCount++;
        program.save();

        const referralContract = getOrCreateReferralContract(contract_id.toString());
        referralContract.referralsCount++;
        referralContract.activeReferralsCount++;
        referralContract.save();

        const referralInfluencer = getOrCreateReferralInfluencer(influencer_id.toString());
        referralContract.referralsCount++;
        referralContract.activeReferralsCount++;
        referralInfluencer.save();

        const referralContractInfluencer = getOrCreateReferralContractInfluencer(
            influencer_id.toString(),
            contract_id.toString()
        );
        referralContractInfluencer.referralsCount++;
        referralContractInfluencer.activeReferralsCount++;
        referralContractInfluencer.createdAt = this.createdAt;
        referralContractInfluencer.save();

        const referralInfluencerContract = getOrCreateReferralInfluencerContract(
            contract_id.toString(),
            influencer_id.toString()
        );
        referralInfluencerContract.referralsCount++;
        referralInfluencerContract.activeReferralsCount++;
        referralInfluencerContract.createdAt = this.createdAt;
        referralInfluencerContract.save();

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

    protected end(): void {
        this.stats.save();
    }
}
