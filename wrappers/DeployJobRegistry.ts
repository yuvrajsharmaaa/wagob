import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type JobRegistryConfig = {
    owner: Address;
};

export function jobRegistryConfigToCell(config: JobRegistryConfig): Cell {
    return beginCell()
        .storeUint(0, 64) // job_count = 0
        .storeDict(null) // empty jobs dictionary
        .storeAddress(config.owner) // owner address
        .endCell();
}

export const Opcodes = {
    create_job: 0x7362d09c,
    update_status: 0x5fcc3d14,
    assign_worker: 0x235caf52,
    cancel_job: 0x9a4b7c1d,
};

export class DeployJobRegistry implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DeployJobRegistry(address);
    }

    static createFromConfig(config: JobRegistryConfig, code: Cell, workchain = 0) {
        const data = jobRegistryConfigToCell(config);
        const init = { code, data };
        return new DeployJobRegistry(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateJob(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            wages: bigint;
            metadata: Cell;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.create_job, 32)
                .storeUint(0, 64) // query_id
                .storeCoins(opts.wages)
                .storeRef(opts.metadata)
                .endCell(),
        });
    }

    async sendUpdateStatus(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jobId: bigint;
            status: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.update_status, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.jobId, 64)
                .storeUint(opts.status, 8)
                .endCell(),
        });
    }

    async sendAssignWorker(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jobId: bigint;
            worker: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.assign_worker, 32)
                .storeUint(0, 64) // query_id
                .storeUint(opts.jobId, 64)
                .storeAddress(opts.worker)
                .endCell(),
        });
    }

    async getJobCount(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_job_count', []);
        return result.stack.readBigNumber();
    }

    async getJob(provider: ContractProvider, jobId: bigint) {
        const result = await provider.get('get_job', [{ type: 'int', value: jobId }]);
        return {
            employer: result.stack.readAddress(),
            worker: result.stack.readAddressOpt(),
            wages: result.stack.readBigNumber(),
            status: result.stack.readNumber(),
            metadata: result.stack.readCell(),
        };
    }

    async jobExists(provider: ContractProvider, jobId: bigint): Promise<boolean> {
        const result = await provider.get('job_exists', [{ type: 'int', value: jobId }]);
        return result.stack.readBoolean();
    }
}
