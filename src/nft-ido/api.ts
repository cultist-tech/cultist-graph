import { NftIdo, Statistic, Token } from "../../generated/schema";
import { getOrCreateStatisticSystem } from "../api/statistic";
import {BigInt, JSONValue, log, TypedMap} from "@graphprotocol/graph-ts/index";
import { getNftIdoId } from "./helpers";
import { getTokenId } from "../nft/helpers";

export class NftIdoMapper {
    protected stats: Statistic;
    protected contractId: string;
    protected createdAt: BigInt;

    constructor(contractId: string, timestamp: BigInt) {
        this.stats = getOrCreateStatisticSystem();
        this.contractId = contractId;
        this.createdAt = timestamp;

        this.stats.transactionTotal++;
    }

    public onCreate(raw: TypedMap<string, JSONValue>): void {
        const rawEl = raw.get("ido");

        if (!rawEl) {
            return;
        }

        const obj = rawEl.toObject();

        const contractId = obj.get("contract_id");
        const idoId = obj.get("ido_id");
        const name = obj.get("name");
        const amount = obj.get("amount");
        const price = obj.get("price");
        const buyMax = obj.get("buy_max");
        const perTransactionMin = obj.get("per_transaction_min");
        const perTransactionMax = obj.get("per_transaction_max");

        if (
            !contractId ||
            !idoId ||
            !name ||
            !amount ||
            !price ||
            !buyMax ||
            !perTransactionMax ||
            !perTransactionMin
        ) {
            log.error("[ido_create] - invalid args", []);
            return;
        }

        const contractNftIdoId = getNftIdoId(contractId.toString(), idoId.toString());
        const nftIdo = new NftIdo(contractNftIdoId);

        nftIdo.amount = amount.toU64() as i32;
        nftIdo.buyMax = buyMax.toU64() as i32;
        nftIdo.perTransactionMax = perTransactionMax.toU64() as i32;
        nftIdo.perTransactionMin = perTransactionMin.toU64() as i32;
        nftIdo.price = price.toString();
        nftIdo.name = name.toString();
        nftIdo.idoId = idoId.toString();
        nftIdo.contractId = contractId.toString();
        nftIdo.amountReady = 0 as i32;
        nftIdo.notMinted = amount.toU64() as i32;
        nftIdo.locked = true;

        nftIdo.save();
    }

    public onUpdate(obj: TypedMap<string, JSONValue>): void {
        const contractId = obj.get("contract_id");
        const idoId = obj.get("ido_id");
        const date = obj.get("date");
        const buyMax = obj.get("buy_max");
        const perTransactionMin = obj.get("per_transaction_min");
        const perTransactionMax = obj.get("per_transaction_max");

        if (!contractId || !idoId || !date || !buyMax || !perTransactionMin || !perTransactionMax) {
            log.error("[ido_update] - invalid args", []);
            return;
        }

        const contractNftIdoId = getNftIdoId(contractId.toString(), idoId.toString());
        const nftIdo = this.get(contractNftIdoId);

        nftIdo.startDate = date.toI64() as i32;
        nftIdo.buyMax = buyMax.toU64() as i32;
        nftIdo.perTransactionMax = perTransactionMax.toU64() as i32;
        nftIdo.perTransactionMin = perTransactionMin.toU64() as i32;

        nftIdo.save();
    }

    public onStart(obj: TypedMap<string, JSONValue>): void {
        const contractId = obj.get("contract_id");
        const idoId = obj.get("ido_id");
        const date = obj.get("date");

        if (!contractId || !idoId || !date) {
            log.error("[ido_start] - invalid args", []);
            return;
        }

        const contractNftIdoId = getNftIdoId(contractId.toString(), idoId.toString());
        const nftIdo = this.get(contractNftIdoId);

        nftIdo.startDate = date.toI64() as i32;

        nftIdo.save();
    }

    public onPause(obj: TypedMap<string, JSONValue>): void {
        const contractId = obj.get("contract_id");
        const idoId = obj.get("ido_id");
        const pause = obj.get("pause");

        if (!contractId || !idoId || !pause) {
            log.error("[ido_pause] - invalid args", []);
            return;
        }

        const contractNftIdoId = getNftIdoId(contractId.toString(), idoId.toString());
        const nftIdo = this.get(contractNftIdoId);

        nftIdo.locked = pause.toBool();

        nftIdo.save();
    }

    public onAddToken(obj: TypedMap<string, JSONValue>): void {
        const contractId = obj.get("contract_id");
        const idoId = obj.get("ido_id");
        const tokenId = obj.get("token_id");

        if (!contractId || !idoId || !tokenId) {
            log.error("[ido_add_token] - invalid args", []);
            return;
        }

        const contractTokenId = getTokenId(contractId.toString(), tokenId.toString());
        const contractIdoId = getNftIdoId(contractId.toString(), idoId.toString());
        const token = Token.load(contractTokenId);

        if (token) {
            token.nftIdoId = contractIdoId;
            token.nftIdo = contractIdoId;

            token.save();
        }

        const nftIdo = this.get(contractIdoId);

        nftIdo.amountReady++;

        nftIdo.save();
    }

    public onBuyToken(obj: TypedMap<string, JSONValue>): void {
        const contractId = obj.get("contract_id");
        const idoId = obj.get("ido_id");
        const tokenId = obj.get("token_id");
        const receiverId = obj.get("receiver_id");

        if (!contractId || !idoId || !tokenId || !receiverId) {
            log.error("[ido_buy_token] - invalid args", []);
            return;
        }

        const contractTokenId = getTokenId(contractId.toString(), tokenId.toString());
        const contractIdoId = getNftIdoId(contractId.toString(), idoId.toString());
        const token = Token.load(contractTokenId);

        if (token) {
            token.nftIdoId = contractIdoId;
            token.nftIdo = contractIdoId;

            token.save();
        }

        const nftIdo = this.get(contractIdoId);

        nftIdo.notMinted--;

        nftIdo.save();
    }

    public end(): void {
        this.stats.save();
    }

    // private

    protected get(contractNftIdoId: string): NftIdo {
        const nftIdo = NftIdo.load(contractNftIdoId);

        if (!nftIdo) {
            log.error("[ido_pause] - not found", []);

            throw new Error("Not found");
        }

        return nftIdo;
    }
}
