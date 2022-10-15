import { FtBalance } from "../../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function getOrCreateFtBalance(id: string, contractId: string): FtBalance {
  const ftBalance = FtBalance.load(id.toString());

  if (ftBalance) {
    return ftBalance;
  }

  return createFtBalance(id, contractId);
}

export function createFtBalance(id: string, contractId: string): FtBalance {
  const ftBalance = new FtBalance(id.toString());

  ftBalance.balance = BigInt.zero();
  ftBalance.contractId = contractId;

  ftBalance.save();

  return ftBalance;
}
