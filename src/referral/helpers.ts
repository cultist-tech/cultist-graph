import {
    Referral,
    ReferralContract,
    ReferralContractInfluencer,
    ReferralContractVolume,
    ReferralInfluencer,
    ReferralInfluencerContract,
    ReferralProgram,
} from "../../generated/schema";
import { log, BigInt } from "@graphprotocol/graph-ts";
import {sumBigInt} from "../utils";

export function getReferralId(contractId: string, accountId: string): string {
    return contractId + "||" + accountId;
}

export function getReferralProgramId(
    contractId: string,
    influencerId: string,
    programId: string
): string {
    return contractId + "||" + influencerId + "||" + programId;
}

export function getReferralContractId(contractId: string): string {
    return contractId;
}

export function getReferralInfluencerId(influencerId: string): string {
    return influencerId;
}

export function getReferralInfluencerContractId(influencerId: string, contractId: string): string {
    return influencerId + "||" + contractId;
}

export function getReferralContractInfluencerId(contractId: string, influencerId: string): string {
    return contractId + "||" + influencerId;
}

export function getReferralContractVolumeId(contractId: string, ftTokenId: string): string {
    return contractId + "||" + ftTokenId;
}

export function getReferralInfluencerVolumeId(contractId: string, ftTokenId: string): string {
    return contractId + "||" + ftTokenId;
}

//

export function getOrCreateReferralContract(contractId: string): ReferralContract {
    const id = getReferralContractId(contractId);
    const contract = ReferralContract.load(id.toString());

    if (contract) {
        return contract;
    }

    return createReferralContract(contractId);
}

export function createReferralContract(contractId: string): ReferralContract {
    const id = getReferralContractId(contractId);
    const contract = new ReferralContract(id.toString());

    contract.contractId = contractId;
    contract.referralsCount = 0 as i32;
    contract.activeReferralsCount = 0 as i32;
    contract.programsCount = 0 as i32;
    contract.influencersCount = 0 as i32;
    contract.payoutNear = '0';

    contract.save();

    return contract;
}

//

export function getOrCreateReferralInfluencer(influencerId: string): ReferralInfluencer {
    const id = getReferralInfluencerId(influencerId);
    let contract = ReferralInfluencer.load(id.toString());

    if (contract) {
        return contract;
    }

    return createReferralInfluencer(influencerId);
}

export function createReferralInfluencer(influencerId: string): ReferralInfluencer {
    const id = getReferralInfluencerId(influencerId);
    const contract = new ReferralInfluencer(id.toString());

    contract.influencerId = influencerId;
    contract.referralsCount = 0 as i32;
    contract.activeReferralsCount = 0 as i32;
    contract.programsCount = 0 as i32;
    contract.contractsCount = 0 as i32;
    contract.payoutNear = '0';

    contract.save();

    return contract;
}

//

export function getOrCreateReferralInfluencerContract(
    influencerId: string,
    contractId: string,
    createdAt: BigInt,
): ReferralInfluencerContract {
    const id = getReferralInfluencerContractId(influencerId, contractId);
    const contract = ReferralInfluencerContract.load(id.toString());

    if (contract) {
        contract.save();

        return contract;
    }

    return createReferralInfluencerContract(influencerId, contractId, createdAt);
}

export function createReferralInfluencerContract(
    influencerId: string,
    contractId: string,
    createdAt: BigInt,
): ReferralInfluencerContract {
    const id = getReferralInfluencerContractId(influencerId, contractId);
    const contract = new ReferralInfluencerContract(id.toString());

    contract.influencerId = influencerId;
    contract.contractId = contractId;
    contract.programsCount = 1 as i32;
    contract.referralsCount = 0 as i32;
    contract.activeReferralsCount = 0 as i32;
    contract.payoutNear = '0';
    contract.createdAt = createdAt;

    contract.save();

    return contract;
}

//

export function getOrCreateReferralContractInfluencer(
    influencerId: string,
    contractId: string,
    createdAt: BigInt,
): ReferralContractInfluencer {
    const id = getReferralContractInfluencerId(contractId, influencerId);
    const contract = ReferralContractInfluencer.load(id.toString());

    if (contract) {
        contract.save();

        return contract;
    }

    return createReferralContractInfluencer(influencerId, contractId, createdAt);
}

export function createReferralContractInfluencer(
    contractId: string,
    influencerId: string,
    createdAt: BigInt,
): ReferralContractInfluencer {
    const id = getReferralContractInfluencerId(contractId, influencerId);
    const contract = new ReferralContractInfluencer(id.toString());

    contract.influencerId = influencerId;
    contract.contractId = contractId;
    contract.programsCount = 1 as i32;
    contract.referralsCount = 0 as i32;
    contract.activeReferralsCount = 0 as i32;
    contract.payoutNear = '0';
    contract.createdAt = createdAt;

    contract.save();

    return contract;
}

//

export function getOrCreateReferralContractVolume(
    contractId: string,
    ftTokenId: string,
): ReferralContractVolume {
    const id = getReferralContractVolumeId(contractId, ftTokenId);
    const contract = ReferralContractVolume.load(id);

    if (contract) {
        contract.save();

        return contract;
    }

    return createReferralContractVolume(contractId, ftTokenId);
}

export function createReferralContractVolume(
    contractId: string,
    ftTokenId: string,
): ReferralContractVolume {
    const id = getReferralContractVolumeId(contractId, ftTokenId);
    const contract = new ReferralContractVolume(id);

    contract.contractId = contractId;
    contract.ftTokenId = ftTokenId;
    contract.amount = '0';

    contract.save();

    return contract;
}

//

export function referralIncrementPayout(contractId: string, accountId: string, ftTokenId: string, amount: string): void {
    const referralId = getReferralId(contractId, accountId);
    const referral = Referral.load(referralId);

    if (!referral) {
        return;
    }

    const referralContractVolume = getOrCreateReferralContractVolume(contractId, ftTokenId);
    referralContractVolume.amount = sumBigInt(referralContractVolume.amount, amount);
    referralContractVolume.ftTokenId = ftTokenId;
    referralContractVolume.save();

    const program = ReferralProgram.load(referral.programId);

    if (!program) {
        log.error("REFERRAL Not found referral program", []);
        return;
    }

    const contract = ReferralContract.load(getReferralContractId(program.contractId));
    const influencer = ReferralInfluencer.load(getReferralInfluencerId(program.influencerId));
    const influencerContract = ReferralInfluencerContract.load(getReferralInfluencerContractId(program.influencerId, program.contractId));
    const contractInfluencer = ReferralContractInfluencer.load(getReferralContractInfluencerId(program.contractId, program.influencerId));

    if (!contract || !influencer || !influencerContract || !contractInfluencer) {
        log.error("REFERRAL Not found referral program entities", []);
        return;
    }

    if (referral.payoutCount == 0) {
        program.activeReferralsCount++;
        contract.activeReferralsCount++;
        influencer.activeReferralsCount++;
        influencerContract.activeReferralsCount++;
        contractInfluencer.activeReferralsCount++;
    }

    program.payoutCount++;
    contract.payoutCount++;
    influencer.payoutCount++;
    influencerContract.payoutCount++;
    contractInfluencer.payoutCount++;
    referral.payoutCount++;

    if (ftTokenId == "near") {
        program.payoutNear = sumBigInt(program.payoutNear, amount);
        contract.payoutNear = sumBigInt(contract.payoutNear, amount);
        influencer.payoutNear = sumBigInt(influencer.payoutNear, amount);
        influencerContract.payoutNear = sumBigInt(influencerContract.payoutNear, amount);
        contractInfluencer.payoutNear = sumBigInt(contractInfluencer.payoutNear, amount);
        referral.payoutNear = sumBigInt(referral.payoutNear, amount);
    }

    program.save();
    contract.save();
    influencer.save();
    influencerContract.save();
    contractInfluencer.save();
    referral.save();
}
