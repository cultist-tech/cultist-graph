import { ReferralProgram } from "../../generated/schema";

export function getReferralId(contractId: string, accountId: string, programId: string): string {
    return contractId + '|||' + accountId + '||' + programId;
}

export function getReferralProgramId(contractId: string, influencerId: string, programId: string): string {
    return contractId + '||' + influencerId + '||' + programId;
}

export function getOrCreateReferralProgram(contractId: string, influencerId: string, programId: string): ReferralProgram {
    const id = getReferralProgramId(contractId, influencerId, programId);
    const program = ReferralProgram.load(id.toString());

    if (program) {
        return program;
    }

    return createReferralProgram(contractId, influencerId, programId);
}

export function createReferralProgram(contractId: string, influencerId: string, programId: string): ReferralProgram {
    const id = getReferralProgramId(contractId, influencerId, programId);
    const program = new ReferralProgram(id.toString());

    program.contractId = contractId;
    program.influencerId = influencerId;
    program.count = 0 as i32;
    program.programId = programId;

    program.save();

    return program;
}

