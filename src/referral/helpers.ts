import {
    ReferralContract,
    ReferralContractInfluencer,
    ReferralContractVolume,
    ReferralInfluencer,
    ReferralInfluencerContract,
    ReferralProgram,
} from "../../generated/schema";

export function getReferralId(contractId: string, accountId: string, programId: string): string {
    return contractId + "||" + accountId + "||" + programId;
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

export function getReferralContractInfluencerId(influencerId: string, contractId: string): string {
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

    contract.save();

    return contract;
}

//

export function getOrCreateReferralInfluencerContract(
    influencerId: string,
    contractId: string
): ReferralInfluencerContract {
    const id = getReferralInfluencerContractId(influencerId, contractId);
    const contract = ReferralInfluencerContract.load(id.toString());

    if (contract) {
        contract.programsCount++;
        contract.save();

        return contract;
    }

    return createReferralInfluencerContract(influencerId, contractId);
}

export function createReferralInfluencerContract(
    influencerId: string,
    contractId: string
): ReferralInfluencerContract {
    const id = getReferralInfluencerContractId(influencerId, contractId);
    const contract = new ReferralInfluencerContract(id.toString());

    contract.influencerId = influencerId;
    contract.contractId = contractId;
    contract.programsCount = 1 as i32;
    contract.referralsCount = 0 as i32;
    contract.activeReferralsCount = 0 as i32;

    contract.save();

    return contract;
}

//

export function getOrCreateReferralContractInfluencer(
    influencerId: string,
    contractId: string
): ReferralContractInfluencer {
    const id = getReferralContractInfluencerId(influencerId, contractId);
    const contract = ReferralContractInfluencer.load(id.toString());

    if (contract) {
        contract.programsCount++;
        contract.save();

        return contract;
    }

    return createReferralContractInfluencer(influencerId, contractId);
}

export function createReferralContractInfluencer(
    influencerId: string,
    contractId: string
): ReferralContractInfluencer {
    const id = getReferralContractInfluencerId(influencerId, contractId);
    const contract = new ReferralContractInfluencer(id.toString());

    contract.influencerId = influencerId;
    contract.contractId = contractId;
    contract.programsCount = 1 as i32;
    contract.referralsCount = 0 as i32;
    contract.activeReferralsCount = 0 as i32;

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
