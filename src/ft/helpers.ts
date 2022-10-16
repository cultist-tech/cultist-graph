import { FtBalance } from "../../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function getOrCreateFtBalance(accountId: string, contractId: string): FtBalance {
  const id = contractId + "||" + accountId;
  const ftBalance = FtBalance.load(id.toString());

  if (ftBalance) {
    return ftBalance;
  }

  return createFtBalance(accountId, contractId);
}

export function createFtBalance(accountId: string, contractId: string): FtBalance {
  const id = contractId + "||" + accountId;
  const ftBalance = new FtBalance(id.toString());

  ftBalance.balance = BigInt.zero();
  ftBalance.contractId = contractId;
  ftBalance.accountId = accountId;
  ftBalance.owner = accountId;

  ftBalance.save();

  return ftBalance;
}
