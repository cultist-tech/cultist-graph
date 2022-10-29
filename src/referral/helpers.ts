import { ReferralContract, ReferralInfluencer, ReferralProgram } from "../../generated/schema";

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

export function getOrCreateReferralProgram(
    contractId: string,
    influencerId: string,
    programId: string
): ReferralProgram {
    const id = getReferralProgramId(contractId, influencerId, programId);
    const program = ReferralProgram.load(id.toString());

    if (program) {
        return program;
    }

    return createReferralProgram(contractId, influencerId, programId);
}

export function createReferralProgram(
    contractId: string,
    influencerId: string,
    programId: string
): ReferralProgram {
    const id = getReferralProgramId(contractId, influencerId, programId);
    const program = new ReferralProgram(id.toString());

    program.contractId = contractId;
    program.influencerId = influencerId;
    program.count = 0 as i32;
    program.programId = programId;
    program.contract = contractId;
    program.influencer = influencerId;

    program.save();

    return program;
}

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
    contract.count = 0 as i32;

    contract.save();

    return contract;
}

export function getOrCreateReferralInfluencer(influencerId: string): ReferralInfluencer {
    const id = getReferralInfluencerId(influencerId);
    const contract = ReferralInfluencer.load(id.toString());

    if (contract) {
        return contract;
    }

    return createReferralInfluencer(influencerId);
}

export function createReferralInfluencer(influencerId: string): ReferralInfluencer {
    const id = getReferralInfluencerId(influencerId);
    const contract = new ReferralInfluencer(id.toString());

    contract.influencerId = influencerId;
    contract.count = 0 as i32;

    contract.save();

    return contract;
}
