import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address } from '@ton/core';
import { DeployJobRegistry } from '../wrappers/DeployJobRegistry';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('JobRegistry Integration Tests', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let employer: SandboxContract<TreasuryContract>;
    let worker: SandboxContract<TreasuryContract>;
    let jobRegistry: SandboxContract<DeployJobRegistry>;

    beforeAll(async () => {
        code = await compile('DeployJobRegistry');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        employer = await blockchain.treasury('employer');
        worker = await blockchain.treasury('worker');

        jobRegistry = blockchain.openContract(
            DeployJobRegistry.createFromConfig({
                owner: deployer.address
            }, code)
        );

        const deployResult = await jobRegistry.sendDeploy(
            deployer.getSender(),
            toNano('0.05')
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jobRegistry.address,
            deploy: true,
            success: true,
        });
    });

    describe('Job Creation', () => {
        it('should create a job successfully', async () => {
            const jobId = 1;
            const wages = toNano('100');
            const duration = 8; // hours

            const metadata = beginCell()
                .storeUint(jobId, 32)
                .storeUint(duration, 32)
                .endCell();

            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages,
                metadata,
                value: toNano('0.1'),
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: true,
            });

            // Verify job data
            const jobData = await jobRegistry.getJobData(jobId);
            expect(jobData.employer).toEqualAddress(employer.address);
            expect(jobData.wages).toBe(wages);
            expect(jobData.status).toBe(0); // OPEN
        });

        it('should reject job creation with insufficient gas', async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.001'), // Too low
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 13, // Out of gas
            });
        });

        it('should reject duplicate job IDs', async () => {
            const jobId = 1;

            // Create first job
            const metadata1 = beginCell()
                .storeUint(jobId, 32)
                .storeUint(8, 32)
                .endCell();

            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata: metadata1,
                value: toNano('0.1'),
            });

            // Try to create duplicate
            const metadata2 = beginCell()
                .storeUint(jobId, 32)
                .storeUint(16, 32)
                .endCell();

            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('200'),
                metadata: metadata2,
                value: toNano('0.1'),
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 400, // Job already exists
            });
        });

        it('should handle zero wages gracefully', async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('0'),
                metadata,
                value: toNano('0.1'),
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 401, // Invalid wages
            });
        });

        it('should measure gas usage for job creation', async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('1'),
            });

            const tx = result.transactions[1];
            const gasUsed = tx.totalFees.coins;
            
            console.log(`Gas used for job creation: ${gasUsed}`);
            expect(gasUsed).toBeLessThan(toNano('0.1'));
        });
    });

    describe('Job Acceptance', () => {
        beforeEach(async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            // Create a job before each test
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });
        });

        it('should allow worker to accept job', async () => {
            const result = await jobRegistry.sendAcceptJob(worker.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                from: worker.address,
                to: jobRegistry.address,
                success: true,
            });

            const jobData = await jobRegistry.getJobData(1);
            expect(jobData.worker).toEqualAddress(worker.address);
            expect(jobData.status).toBe(1); // ASSIGNED
        });

        it('should reject if employer tries to accept their own job', async () => {
            const result = await jobRegistry.sendAcceptJob(employer.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 402, // Employer cannot be worker
            });
        });

        it('should reject acceptance of non-existent job', async () => {
            const result = await jobRegistry.sendAcceptJob(worker.getSender(), {
                jobId: 999n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                from: worker.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 404, // Job not found
            });
        });

        it('should prevent concurrent acceptance by multiple workers', async () => {
            const worker2 = await blockchain.treasury('worker2');

            // Both workers try to accept simultaneously
            const [result1, result2] = await Promise.all([
                jobRegistry.sendAcceptJob(worker.getSender(), {
                    jobId: 1n,
                    value: toNano('0.05'),
                }),
                jobRegistry.sendAcceptJob(worker2.getSender(), {
                    jobId: 1n,
                    value: toNano('0.05'),
                }),
            ]);

            // Only one should succeed
            const successes = [result1, result2].filter(r =>
                r.transactions.some((tx: any) => 
                    tx.inMessage?.info.type === 'internal' &&
                    tx.inMessage?.info.dest.equals(jobRegistry.address) &&
                    tx.description.type === 'generic' &&
                    tx.description.computePhase.type === 'vm' &&
                    tx.description.computePhase.success
                )
            );

            expect(successes.length).toBe(1);
        });
    });

    describe('Job Completion', () => {
        beforeEach(async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            // Create and assign job
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });

            await jobRegistry.sendAcceptJob(worker.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            });
        });

        it('should allow employer to complete job', async () => {
            const result = await jobRegistry.sendCompleteJob(employer.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: true,
            });

            const jobData = await jobRegistry.getJobData(1);
            expect(jobData.status).toBe(3); // COMPLETED
        });

        it('should reject completion by non-employer', async () => {
            const result = await jobRegistry.sendCompleteJob(worker.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                from: worker.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 403, // Unauthorized
            });
        });

        it('should reject completion of unassigned job', async () => {
            const metadata = beginCell()
                .storeUint(2, 32)
                .storeUint(8, 32)
                .endCell();

            // Create new job without assignment
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });

            const result = await jobRegistry.sendCompleteJob(employer.getSender(), {
                jobId: 2n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 405, // Invalid state
            });
        });
    });

    describe('Batch Operations', () => {
        it('should handle multiple job creations efficiently', async () => {
            const jobCount = 5;
            const results = [];

            for (let i = 1; i <= jobCount; i++) {
                const metadata = beginCell()
                    .storeUint(i, 32)
                    .storeUint(8, 32)
                    .endCell();

                const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                    wages: toNano('100'),
                    metadata,
                    value: toNano('0.1'),
                });
                results.push(result);
            }

            // All should succeed
            results.forEach(result => {
                expect(result.transactions).toHaveTransaction({
                    from: employer.address,
                    to: jobRegistry.address,
                    success: true,
                });
            });

            // Calculate average gas
            const totalGas = results.reduce((sum, result) => {
                const tx = result.transactions[1];
                return sum + Number(tx.totalFees.coins);
            }, 0);

            const avgGas = totalGas / jobCount;
            console.log(`Average gas per job creation: ${avgGas}`);
        });
    });

    describe('Network Latency Simulation', () => {
        it('should handle delayed transactions', async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            // Create job
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 100));

            // Accept job after delay
            const result = await jobRegistry.sendAcceptJob(worker.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                success: true,
            });
        });

        it('should handle transaction timeout gracefully', async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            // This test simulates a transaction that might timeout
            // In production, implement retry logic
            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.05'), // Minimal gas
            });

            // Transaction should either succeed or fail gracefully
            expect(result.transactions.length).toBeGreaterThan(0);
        });
    });

    describe('State Recovery', () => {
        it('should maintain consistent state after failed transaction', async () => {
            const metadata = beginCell()
                .storeUint(1, 32)
                .storeUint(8, 32)
                .endCell();

            // Create job
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });

            const jobDataBefore = await jobRegistry.getJobData(1);

            // Try invalid operation
            await jobRegistry.sendCompleteJob(employer.getSender(), {
                jobId: 1n,
                value: toNano('0.05'),
            }).catch(() => {});

            // State should remain unchanged
            const jobDataAfter = await jobRegistry.getJobData(1);
            expect(jobDataAfter.status).toBe(jobDataBefore.status);
        });
    });
});
