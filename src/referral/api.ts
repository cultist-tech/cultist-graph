import {
    Referral,
    ReferralContractInfluencer,
    ReferralInfluencerContract,
    ReferralProgram,
    Statistic,
} from "../../generated/schema";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { JSONValue, TypedMap, BigInt } from "@graphprotocol/graph-ts";
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
    protected createdAt: BigInt;

    constructor(timestamp: BigInt) {
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
        const metadataJson = data.get("metadata");

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
        program.payoutNear = '0';
        program.createdAt = this.createdAt;

        if (metadataJson && !metadataJson.isNull()) {
            const metadataObj = metadataJson.toObject();
            const titleJson = metadataObj.get('title');
            const descriptionJson = metadataObj.get('description');
            const mediaJson = metadataObj.get('media');
            const urlJson = metadataObj.get('url');

            program.title = titleJson ? titleJson.toString() : null;
            program.description = descriptionJson ? descriptionJson.toString() : null;
            program.media = mediaJson ? mediaJson.toString() : null;
            program.url = urlJson ? urlJson.toString() : null;
        }

        program.save();

        const referralContract = getOrCreateReferralContract(contract_id.toString());
        referralContract.programsCount++;

        const referralInfluencer = getOrCreateReferralInfluencer(influencer_id.toString());
        referralInfluencer.programsCount++;

        const referralContractInfluencerId = getReferralContractInfluencerId(
            contract_id.toString(),
            influencer_id.toString()
        );
        const referralInfluencerContractId = getReferralInfluencerContractId(
            influencer_id.toString(),
            contract_id.toString(),
        );

        if (!ReferralContractInfluencer.load(referralContractInfluencerId)) {
            referralInfluencer.contractsCount++;
            referralContract.createdAt = this.createdAt;
        }
        if (!ReferralInfluencerContract.load(referralInfluencerContractId)) {
            referralContract.influencersCount++;
            referralContract.createdAt = this.createdAt;
        }

        referralInfluencer.save();
        referralContract.save();

        getOrCreateReferralContractInfluencer(contract_id.toString(), influencer_id.toString(), this.createdAt);
        getOrCreateReferralInfluencerContract(influencer_id.toString(), contract_id.toString(), this.createdAt);

        getOrCreateAccount(influencer_id.toString(), this.stats, contractStats);
    }

    protected onReferralAccept(data: TypedMap<string, JSONValue>): void {
        const contractIdJson = data.get("contract_id");
        const influencerIdJson = data.get("influencer_id");
        const programIdJson = data.get("program_id");
        const accountIdJson = data.get("account_id");

        if (!contractIdJson || !influencerIdJson || !programIdJson || !accountIdJson) {
            log.error("[referral_accept] - invalid args", []);
            return;
        }

        const influencerId = influencerIdJson.toString();
        const contractId = contractIdJson.toString();
        const accountId = accountIdJson.toString();

        const contractStats = getOrCreateStatistic(contractId);
        contractStats.transactionTotal++;

        const referralId = getReferralId(
            contractId,
            accountId
        );
        let referral = Referral.load(referralId);

        if (referral) {
            return;
        }

        const programId = getReferralProgramId(
            contractId,
            influencerId,
            programIdJson.toString()
        );
        const program = ReferralProgram.load(programId);

        if (!program) {
            log.error("[onReferralAccept] - not found", []);
            return;
        }

        program.referralsCount++;
        program.save();

        const referralContract = getOrCreateReferralContract(contractId);
        referralContract.referralsCount++;
        referralContract.save();

        const referralInfluencer = getOrCreateReferralInfluencer(influencerId);
        referralContract.referralsCount++;
        referralInfluencer.save();

        const referralContractInfluencer = getOrCreateReferralContractInfluencer(
            influencerId,
            contractId,
            this.createdAt,
        );
        referralContractInfluencer.referralsCount++;
        referralContractInfluencer.createdAt = this.createdAt;
        referralContractInfluencer.save();

        const referralInfluencerContract = getOrCreateReferralInfluencerContract(
            influencerId,
            contractId,
            this.createdAt,
        );
        referralInfluencerContract.referralsCount++;
        referralInfluencerContract.createdAt = this.createdAt;
        referralInfluencerContract.save();

        getOrCreateAccount(accountId, this.stats, contractStats);

        referral = new Referral(referralId);
        referral.payoutNear = '0';
        referral.accountId = accountId;
        referral.contractId = contractIdJson.toString();
        referral.influencerId = influencerIdJson.toString();
        referral.programId = programId.toString();
        referral.program = programId.toString();
        referral.contract = contractIdJson.toString();
        referral.influencer = influencerIdJson.toString();
        referral.account = accountId;
        referral.createdAt = this.createdAt;

        referral.save();
    }

    protected end(): void {
        this.stats.save();
    }
}
