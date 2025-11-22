import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type EscrowConfig = {
    owner: Address;
    feeBps: number; // 250 = 2.5%
};

export function escrowConfigToCell(config: EscrowConfig): Cell {
    return beginCell()
        .storeUint(0, 64) // escrow_count = 0
        .storeDict(null) // empty escrows dictionary
        .storeAddress(config.owner) // owner address
        .storeUint(config.feeBps, 16) // fee in basis points
        .endCell();
}

export const Opcodes = {
    create_escrow: 0x8f4a33db,
    fund: 0x2fcb26a8,
    lock: 0x5de7c0ab,
    confirm: 0x6a8d4f12,
    release: 0x3c9f8b2e,
    dispute: 0x7b3e5c91,
    resolve: 0x4f2a9d63,
};

export const EscrowState = {
    created: 0,
    funded: 1,
    locked: 2,
    completed: 3,
    disputed: 4,
};

export class DeployEscrow implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DeployEscrow(address);
    }

    static createFromConfig(config: EscrowConfig, code: Cell, workchain = 0) {
        const data = escrowConfigToCell(config);
        const init = { code, data };
        return new DeployEscrow(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateEscrow(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jobId: bigint;
            employer: Address;
            worker: Address;
            amount: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.create_escrow, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.jobId, 64)
                .storeAddress(opts.employer)
                .storeAddress(opts.worker)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendFund(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            escrowId: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.fund, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.escrowId, 64)
                .endCell(),
        });
    }

    async sendLock(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            escrowId: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.lock, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.escrowId, 64)
                .endCell(),
        });
    }

    async sendConfirm(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            escrowId: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.confirm, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.escrowId, 64)
                .endCell(),
        });
    }

    async sendDispute(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            escrowId: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.dispute, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.escrowId, 64)
                .endCell(),
        });
    }

    async getEscrowCount(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_escrow_count', []);
        return result.stack.readBigNumber();
    }

    async getEscrow(provider: ContractProvider, escrowId: bigint) {
        const result = await provider.get('get_escrow', [{ type: 'int', value: escrowId }]);
        return {
            jobId: result.stack.readBigNumber(),
            employer: result.stack.readAddress(),
            worker: result.stack.readAddress(),
            amount: result.stack.readBigNumber(),
            state: result.stack.readNumber(),
            employerConfirmed: result.stack.readBoolean(),
            workerConfirmed: result.stack.readBoolean(),
        };
    }

    async getFeeBps(provider: ContractProvider): Promise<number> {
        const result = await provider.get('get_fee_bps', []);
        return result.stack.readNumber();
    }
}
