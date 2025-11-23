import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type ReputationConfig = {
    owner?: Address;
    id?: number;
    counter?: number;
};

export function reputationConfigToCell(config: ReputationConfig): Cell {
    // Simple config for testing - just stores counter
    if (config.id !== undefined || config.counter !== undefined) {
        return beginCell()
            .storeUint(config.counter || config.id || 0, 64)
            .endCell();
    }
    
    // Full config for production
    return beginCell()
        .storeUint(0, 64) // rating_count = 0
        .storeDict(null) // empty ratings dictionary
        .storeDict(null) // empty reputations dictionary
        .storeDict(null) // empty job_ratings dictionary
        .storeAddress(config.owner!) // owner address
        .endCell();
}

export const Opcodes = {
    submit_rating: 0x9e6f2a84,
};

export class DeployReputation implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DeployReputation(address);
    }

    static createFromConfig(config: ReputationConfig, code: Cell, workchain = 0) {
        const data = reputationConfigToCell(config);
        const init = { code, data };
        return new DeployReputation(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendSubmitRating(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jobId: bigint;
            targetUser: Address;
            rating: number; // 1-5
        }
    ) {
        if (opts.rating < 1 || opts.rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.submit_rating, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.jobId, 64)
                .storeAddress(opts.targetUser)
                .storeUint(opts.rating, 8)
                .endCell(),
        });
    }

    async getReputation(provider: ContractProvider, user: Address) {
        const result = await provider.get('get_reputation', [{ type: 'slice', cell: beginCell().storeAddress(user).endCell() }]);
        return {
            totalRatings: result.stack.readBigNumber(),
            ratingSum: result.stack.readBigNumber(),
            avgRating: result.stack.readBigNumber(),
            jobCount: result.stack.readBigNumber(),
        };
    }

    async getRating(provider: ContractProvider, ratingId: bigint) {
        const result = await provider.get('get_rating', [{ type: 'int', value: ratingId }]);
        return {
            jobId: result.stack.readBigNumber(),
            rater: result.stack.readAddress(),
            ratee: result.stack.readAddress(),
            rating: result.stack.readNumber(),
        };
    }

    async getRatingCount(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_rating_count', []);
        return result.stack.readBigNumber();
    }

    async calculateScore(provider: ContractProvider, user: Address): Promise<number> {
        const result = await provider.get('calculate_score', [{ type: 'slice', cell: beginCell().storeAddress(user).endCell() }]);
        return result.stack.readNumber();
    }

    async sendIncrease(
        provider: ContractProvider,
        via: Sender,
        opts: {
            increaseBy: number;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x7e8764ef, 32) // op::increase
                .storeUint(0, 64) // query_id
                .storeUint(opts.increaseBy, 32)
                .endCell(),
        });
    }

    async getCounter(provider: ContractProvider): Promise<number> {
        const result = await provider.get('get_counter', []);
        return result.stack.readNumber();
    }
}
