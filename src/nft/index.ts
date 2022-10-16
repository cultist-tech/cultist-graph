import { near, store, BigDecimal } from "@graphprotocol/graph-ts";
import { Token, TokenMetadata } from "../../generated/schema";
import { log } from "@graphprotocol/graph-ts";
import { parseEvent } from "../utils";
import { getOrCreateAccount } from "../api/account";
import { convertRarity, saveTokenRoyalties } from "./helpers";
import { getOrCreateStatistic, getOrCreateStatisticSystem } from "../api/statistic";
import { getMarketSaleId, removeMarketSale } from "../market-sale/helpers";
import { getMarketRentId, removeMarketRent } from "../market-rent/helpers";

export function handleNft(receipt: near.ReceiptWithOutcome): void {
    const actions = receipt.receipt.actions;
    for (let i = 0; i < actions.length; i++) {
        handleAction(actions[i], receipt);
    }
}

function handleAction(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        return;
    }

    const outcome = receiptWithOutcome.outcome;
    // const functionCall = action.toFunctionCall();
    // const ipfsHash = 'bafybeiew2l6admor2lx6vnfdaevuuenzgeyrpfle56yrgse4u6nnkwrfeu'
    // const methodName = functionCall.methodName
    const contractId = receiptWithOutcome.receipt.receiverId;

    for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
        const ev = parseEvent(outcome.logs[logIndex]);
        const eventDataArr = ev.get("data");
        const eventMethod = ev.get("event");

        if (!eventDataArr || !eventMethod) {
            continue;
        }

        const eventData = eventDataArr.toArray()[0];

        if (!eventData) {
            continue;
        }

        const data = eventData.toObject();
        const method = eventMethod.toString();

        const stats = getOrCreateStatisticSystem();
        stats.transactionTotal++;

        if (method == "nft_create") {
            const rawToken = data.get("token");

            if (!rawToken) {
                log.error("[nft_create] - invalid args", []);
                return;
            }
            const tokenData = rawToken.toObject();

            const tokenId = tokenData.get("token_id");
            const ownerId = tokenData.get("owner_id");
            const metadata = tokenData.get("metadata");

            // const collection = tokenData.get('collection');
            // const tokenType = tokenData.get('token_type');
            // const tokenSubType = tokenData.get('token_sub_type');
            const rarity = tokenData.get("rarity");
            const royalty = tokenData.get("royalty");
            const bindToOwner = tokenData.get("bind_to_owner");

            if (!tokenId || !ownerId) {
                log.error("[nft_create] - invalid token args", []);
                continue;
            }

            const token = new Token(tokenId.toString());

            token.tokenId = tokenId.toString();
            token.ownerId = ownerId.toString();
            token.owner = ownerId.toString();
            token.bindToOwner = bindToOwner && !bindToOwner.isNull() ? bindToOwner.toBool() : false;

            if (rarity && !rarity.isNull()) {
                token.rarity = convertRarity(rarity);
            }

            if (metadata && !metadata.isNull()) {
                const metaObj = metadata.toObject();
                const tokenMetadata = new TokenMetadata(tokenId.toString());
                const metaTitle = metaObj.get("title");
                const metaDescription = metaObj.get("description");
                const metaMedia = metaObj.get("media");

                tokenMetadata.tokenId = tokenId.toString();
                tokenMetadata.title =
                    metaTitle && !metaTitle.isNull() ? metaTitle.toString() : null;
                tokenMetadata.description =
                    metaDescription && !metaDescription.isNull()
                        ? metaDescription.toString()
                        : null;
                tokenMetadata.media =
                    metaMedia && !metaMedia.isNull() ? metaMedia.toString() : null;

                token.tokenMetadata = tokenId.toString();
                token.tokenMetadataId = tokenId.toString();

                tokenMetadata.save();
            }

            if (royalty && !royalty.isNull()) {
                saveTokenRoyalties(token.tokenId, royalty);
            }

            token.save();

            // acc
            getOrCreateAccount(ownerId.toString());

            // stats
            stats.nftTotal++;

            // stats acc
            const accStats = getOrCreateStatistic(ownerId.toString());
            accStats.nftTotal++;
            accStats.transactionTotal++;
            accStats.save();
        } else if (method == "nft_transfer") {
            const tokenIds = data.get("token_ids");
            const senderId = data.get("old_owner_id");
            const receiverId = data.get("new_owner_id");

            if (!tokenIds || !senderId || !receiverId) {
                log.error("[nft_transfer] - invalid args", []);
                continue;
            }
            const tokenId = tokenIds.toArray()[0];

            let token = Token.load(tokenId.toString());
            if (!token) {
                log.error("[nft_transfer] - Not found transferred token {}", [tokenId.toString()]);
                continue;
            }

            token.owner = receiverId.toString();
            token.ownerId = receiverId.toString();

            token.save();

            // clear
            const saleId = getMarketSaleId(contractId, tokenId.toString());
            const rentId = getMarketRentId(contractId, tokenId.toString());
            removeMarketSale(saleId);
            removeMarketRent(rentId);

            // acc
            getOrCreateAccount(senderId.toString());
            getOrCreateAccount(receiverId.toString());

            // stats
            stats.nftTransferTotal++;

            // stats acc
            const senderStats = getOrCreateStatistic(senderId.toString());
            senderStats.nftTotal--;
            senderStats.transactionTotal++;
            senderStats.save();
            const receiverStats = getOrCreateStatistic(receiverId.toString());
            receiverStats.nftTotal++;
            receiverStats.transactionTotal++;
            receiverStats.save();
        } else if (method == "nft_burn") {
            const tokenIds = data.get("token_ids");
            const senderId = data.get("owner_id");

            if (!tokenIds || !senderId) {
                log.error("[nft_burn] - invalid args", []);
                continue;
            }
            const tokenId = tokenIds.toArray()[0];

            let token = Token.load(tokenId.toString());

            if (!token) {
                log.error("[nft_burn] - Not found token {}", [tokenId.toString()]);
                continue;
            }

            store.remove("Token", tokenId.toString());

            // clear
            const saleId = getMarketSaleId(contractId, tokenId.toString());
            const rentId = getMarketRentId(contractId, tokenId.toString());
            removeMarketSale(saleId);
            removeMarketRent(rentId);

            // acc
            getOrCreateAccount(senderId.toString());

            // stats
            stats.nftTotal--;
            stats.nftBurnTotal++;

            // stats acc
            const senderStats = getOrCreateStatistic(senderId.toString());
            senderStats.nftTotal--;
            senderStats.transactionTotal++;
            senderStats.save();
        } else if (method == "nft_mint") {
            const tokenIds = data.get("token_ids");
            const receiverId = data.get("owner_id");

            if (!receiverId || !tokenIds) {
                log.error("[nft_mint] - invalid args", []);
                continue;
            }

            // acc
            getOrCreateAccount(receiverId.toString());

            const senderStats = getOrCreateStatistic(receiverId.toString());
            senderStats.transactionTotal++;
            senderStats.save();
        } else if (method == "nft_transfer_payout") {
            const tokenId = data.get("token_id");
            const senderId = data.get("sender_id");
            const receiverId = data.get("receiver_id");
            const balance = data.get("balance");

            if (!receiverId || !balance || !senderId || !tokenId) {
                log.error("[nft_transfer_payout] - invalid args", []);
                continue;
            }

            let price = BigDecimal.fromString(balance.toString()).div(
                BigDecimal.fromString("1000000000000000000000000")
            );

            // acc
            getOrCreateAccount(senderId.toString());
            getOrCreateAccount(receiverId.toString());

            // stats
            stats.nftPayTotal++;

            // stats acc
            const senderStats = getOrCreateStatistic(senderId.toString());
            senderStats.transactionTotal++;
            senderStats.save();
        }

        stats.save();
    }
}
