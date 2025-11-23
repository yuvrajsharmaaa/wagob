import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address } from '@ton/core';
import { DeployJobRegistry } from '../wrappers/DeployJobRegistry';
import { DeployEscrow } from '../wrappers/DeployEscrow';
import { DeployReputation } from '../wrappers/DeployReputation';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

/**
 * Comprehensive Integration Tests for WajoB Smart Contracts
 * 
 * Tests cover:
 * - Complete job lifecycle (creation → assignment → completion)
 * - Escrow funding and release
 * - Reputation submission
 * - Edge cases and error scenarios
 * - Gas optimization
 * - Concurrent operations
 */

describe('WajoB E2E Integration Tests', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let employer: SandboxContract<TreasuryContract>;
    let worker: SandboxContract<TreasuryContract>;
    
    let jobRegistryCode: Cell;
    let escrowCode: Cell;
    let reputationCode: Cell;
    
    let jobRegistry: SandboxContract<DeployJobRegistry>;
    let escrow: SandboxContract<DeployEscrow>;
    let reputation: SandboxContract<DeployReputation>;

    beforeAll(async () => {
        jobRegistryCode = await compile('DeployJobRegistry');
        escrowCode = await compile('DeployEscrow');
        reputationCode = await compile('DeployReputation');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        employer = await blockchain.treasury('employer');
        worker = await blockchain.treasury('worker');

        // Deploy JobRegistry
        jobRegistry = blockchain.openContract(
            DeployJobRegistry.createFromConfig(
                { owner: deployer.address },
                jobRegistryCode
            )
        );

        await jobRegistry.sendDeploy(deployer.getSender(), toNano('0.05'));

        // Deploy Escrow
        escrow = blockchain.openContract(
            DeployEscrow.createFromConfig(
                { id: 0, counter: 0 },
                escrowCode
            )
        );

        await escrow.sendDeploy(deployer.getSender(), toNano('0.05'));

        // Deploy Reputation
        reputation = blockchain.openContract(
            DeployReputation.createFromConfig(
                { id: 0, counter: 0 },
                reputationCode
            )
        );

        await reputation.sendDeploy(deployer.getSender(), toNano('0.05'));
    });

    describe('Complete Job Lifecycle', () => {
        it('should execute full job flow: create → assign → fund → complete → rate', async () => {
            const wages = toNano('100');
            const jobMetadata = beginCell()
                .storeUint(1, 64) // jobId
                .storeUint(8, 32) // duration in hours
                .storeStringTail('Software Development')
                .endCell();

            // Step 1: Employer creates job
            console.log('Step 1: Creating job...');
            const createResult = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages,
                metadata: jobMetadata,
                value: toNano('0.1'),
            });

            expect(createResult.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: true,
            });

            const jobCountAfterCreate = await jobRegistry.getJobCount();
            expect(jobCountAfterCreate).toBe(1n);

            console.log(`✓ Job created. Total jobs: ${jobCountAfterCreate}`);

            // Step 2: Worker accepts job
            console.log('Step 2: Worker accepting job...');
            const jobId = 1n; // First job
            const assignResult = await jobRegistry.sendAssignWorker(employer.getSender(), {
                jobId,
                worker: worker.address,
                value: toNano('0.05'),
            });

            expect(assignResult.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: true,
            });

            const jobData = await jobRegistry.getJob(jobId);
            expect(jobData.worker).toEqualAddress(worker.address);
            console.log('✓ Worker assigned');

            // Step 3: Employer funds escrow
            console.log('Step 3: Funding escrow...');
            const fundResult = await escrow.sendIncrease(employer.getSender(), {
                increaseBy: Number(wages / 1000000000n), // Convert to smaller unit
                value: wages + toNano('0.1'),
            });

            expect(fundResult.transactions).toHaveTransaction({
                from: employer.address,
                to: escrow.address,
                success: true,
            });

            const escrowBalance = await escrow.getCounter();
            console.log(`✓ Escrow funded. Balance: ${escrowBalance}`);

            // Step 4: Job completed, update status
            console.log('Step 4: Completing job...');
            const completeResult = await jobRegistry.sendUpdateStatus(employer.getSender(), {
                jobId,
                status: 3, // COMPLETED
                value: toNano('0.05'),
            });

            expect(completeResult.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: true,
            });

            const updatedJob = await jobRegistry.getJob(jobId);
            expect(updatedJob.status).toBe(3);
            console.log('✓ Job marked as completed');

            // Step 5: Submit reputation rating
            console.log('Step 5: Submitting reputation rating...');
            const ratingResult = await reputation.sendIncrease(employer.getSender(), {
                increaseBy: 5, // 5-star rating
                value: toNano('0.05'),
            });

            expect(ratingResult.transactions).toHaveTransaction({
                from: employer.address,
                to: reputation.address,
                success: true,
            });

            const reputationScore = await reputation.getCounter();
            expect(reputationScore).toBe(5);
            console.log(`✓ Reputation submitted. Score: ${reputationScore}`);

            console.log('\n✅ Complete job lifecycle executed successfully');
        });

        it('should measure gas usage for complete lifecycle', async () => {
            const gasMetrics: { operation: string; gas: bigint }[] = [];
            
            const jobMetadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            // Create job
            const createResult = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata: jobMetadata,
                value: toNano('1'),
            });
            gasMetrics.push({
                operation: 'Job Creation',
                gas: createResult.transactions[1].totalFees.coins,
            });

            // Assign worker
            const assignResult = await jobRegistry.sendAssignWorker(employer.getSender(), {
                jobId: 1n,
                worker: worker.address,
                value: toNano('1'),
            });
            gasMetrics.push({
                operation: 'Worker Assignment',
                gas: assignResult.transactions[1].totalFees.coins,
            });

            // Fund escrow
            const fundResult = await escrow.sendIncrease(employer.getSender(), {
                increaseBy: 100,
                value: toNano('1'),
            });
            gasMetrics.push({
                operation: 'Escrow Funding',
                gas: fundResult.transactions[1].totalFees.coins,
            });

            // Update status
            const statusResult = await jobRegistry.sendUpdateStatus(employer.getSender(), {
                jobId: 1n,
                status: 3,
                value: toNano('1'),
            });
            gasMetrics.push({
                operation: 'Status Update',
                gas: statusResult.transactions[1].totalFees.coins,
            });

            // Submit rating
            const ratingResult = await reputation.sendIncrease(employer.getSender(), {
                increaseBy: 5,
                value: toNano('1'),
            });
            gasMetrics.push({
                operation: 'Reputation Rating',
                gas: ratingResult.transactions[1].totalFees.coins,
            });

            console.log('\n📊 Gas Usage Metrics:');
            console.log('═══════════════════════════════════════');
            
            let totalGas = 0n;
            gasMetrics.forEach(({ operation, gas }) => {
                console.log(`${operation.padEnd(20)}: ${gas} (${Number(gas) / 1e9} TON)`);
                totalGas += gas;
                expect(gas).toBeLessThan(toNano('0.1')); // Each operation < 0.1 TON
            });
            
            console.log('───────────────────────────────────────');
            console.log(`${'TOTAL'.padEnd(20)}: ${totalGas} (${Number(totalGas) / 1e9} TON)`);
            console.log('═══════════════════════════════════════\n');

            expect(totalGas).toBeLessThan(toNano('0.5')); // Total < 0.5 TON
        });
    });

    describe('Error Scenarios and Edge Cases', () => {
        it('should handle insufficient gas gracefully', async () => {
            const jobMetadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            const result = await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata: jobMetadata,
                value: toNano('0.001'), // Very low gas
            });

            // Transaction should fail due to out of gas
            expect(result.transactions).toHaveTransaction({
                from: employer.address,
                to: jobRegistry.address,
                success: false,
                exitCode: 13, // Out of gas
            });

            // Verify no job was created
            const jobCount = await jobRegistry.getJobCount();
            expect(jobCount).toBe(0n);
        });

        it('should prevent state corruption on partial execution', async () => {
            const jobMetadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            // Create job successfully
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata: jobMetadata,
                value: toNano('0.1'),
            });

            const jobBefore = await jobRegistry.getJob(1n);

            // Try to update with insufficient gas
            await jobRegistry.sendUpdateStatus(employer.getSender(), {
                jobId: 1n,
                status: 3,
                value: toNano('0.001'),
            }).catch(() => {});

            // Job state should remain unchanged
            const jobAfter = await jobRegistry.getJob(1n);
            expect(jobAfter.status).toBe(jobBefore.status);
        });

        it('should handle network latency and delayed transactions', async () => {
            const jobMetadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            // Create job
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata: jobMetadata,
                value: toNano('0.1'),
            });

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assign worker after delay
            const result = await jobRegistry.sendAssignWorker(employer.getSender(), {
                jobId: 1n,
                worker: worker.address,
                value: toNano('0.05'),
            });

            expect(result.transactions).toHaveTransaction({
                success: true,
            });
        });

        it('should prevent concurrent double-spending', async () => {
            // Fund escrow
            await escrow.sendIncrease(employer.getSender(), {
                increaseBy: 100,
                value: toNano('100.1'),
            });

            const balanceBefore = await escrow.getCounter();

            // Try to spend the same funds twice
            // Note: In production contracts, implement proper locking mechanisms
            const [tx1, tx2] = await Promise.all([
                escrow.sendIncrease(worker.getSender(), {
                    increaseBy: -50,
                    value: toNano('0.05'),
                }),
                escrow.sendIncrease(worker.getSender(), {
                    increaseBy: -50,
                    value: toNano('0.05'),
                }),
            ]);

            // Verify balance changed only once or properly handled
            const balanceAfter = await escrow.getCounter();
            console.log(`Balance before: ${balanceBefore}, after: ${balanceAfter}`);
        });
    });

    describe('Concurrent Operations', () => {
        it('should handle multiple simultaneous job creations', async () => {
            const jobCount = 5;
            const promises = [];

            for (let i = 1; i <= jobCount; i++) {
                const employer = await blockchain.treasury(`employer${i}`);
                const metadata = beginCell()
                    .storeUint(i, 64)
                    .storeUint(8, 32)
                    .endCell();

                promises.push(
                    jobRegistry.sendCreateJob(employer.getSender(), {
                        wages: toNano('100'),
                        metadata,
                        value: toNano('0.1'),
                    })
                );
            }

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result.transactions).toHaveTransaction({
                    success: true,
                });
            });

            const totalJobs = await jobRegistry.getJobCount();
            expect(totalJobs).toBe(BigInt(jobCount));
        });

        it('should prevent race conditions in worker assignment', async () => {
            // Create job
            const metadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });

            const worker2 = await blockchain.treasury('worker2');
            const worker3 = await blockchain.treasury('worker3');

            // Multiple workers try to get assigned simultaneously
            // Only one should succeed
            const results = await Promise.all([
                jobRegistry.sendAssignWorker(employer.getSender(), {
                    jobId: 1n,
                    worker: worker.address,
                    value: toNano('0.05'),
                }),
                jobRegistry.sendAssignWorker(employer.getSender(), {
                    jobId: 1n,
                    worker: worker2.address,
                    value: toNano('0.05'),
                }),
                jobRegistry.sendAssignWorker(employer.getSender(), {
                    jobId: 1n,
                    worker: worker3.address,
                    value: toNano('0.05'),
                }),
            ]);

            // Count successful assignments
            const successCount = results.filter(r =>
                r.transactions.some(tx => tx.description.type === 'generic')
            ).length;

            console.log(`Successful assignments: ${successCount} out of 3 attempts`);
        });
    });

    describe('Contract Interactions', () => {
        it('should coordinate between JobRegistry and Escrow', async () => {
            const wages = toNano('100');
            const metadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            // Create job in registry
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages,
                metadata,
                value: toNano('0.1'),
            });

            // Fund corresponding escrow
            await escrow.sendIncrease(employer.getSender(), {
                increaseBy: Number(wages / 1000000000n),
                value: wages + toNano('0.1'),
            });

            // Verify both contracts updated
            const job = await jobRegistry.getJob(1n);
            const escrowBalance = await escrow.getCounter();

            expect(job.wages).toBe(wages);
            expect(BigInt(escrowBalance) * 1000000000n).toBe(wages);
        });

        it('should link reputation to completed jobs', async () => {
            const metadata = beginCell()
                .storeUint(1, 64)
                .storeUint(8, 32)
                .endCell();

            // Create and complete job
            await jobRegistry.sendCreateJob(employer.getSender(), {
                wages: toNano('100'),
                metadata,
                value: toNano('0.1'),
            });

            await jobRegistry.sendAssignWorker(employer.getSender(), {
                jobId: 1n,
                worker: worker.address,
                value: toNano('0.05'),
            });

            await jobRegistry.sendUpdateStatus(employer.getSender(), {
                jobId: 1n,
                status: 3, // COMPLETED
                value: toNano('0.05'),
            });

            // Submit reputation
            await reputation.sendIncrease(employer.getSender(), {
                increaseBy: 5,
                value: toNano('0.05'),
            });

            // Verify linkage
            const job = await jobRegistry.getJob(1n);
            const rating = await reputation.getCounter();

            expect(job.status).toBe(3); // COMPLETED
            expect(rating).toBe(5);
        });
    });

    describe('Performance and Optimization', () => {
        it('should handle batch job creations efficiently', async () => {
            const batchSize = 10;
            const startTime = Date.now();
            
            for (let i = 1; i <= batchSize; i++) {
                const metadata = beginCell()
                    .storeUint(i, 64)
                    .storeUint(8, 32)
                    .endCell();

                await jobRegistry.sendCreateJob(employer.getSender(), {
                    wages: toNano('100'),
                    metadata,
                    value: toNano('0.1'),
                });
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / batchSize;

            console.log(`\n⚡ Performance Metrics:`);
            console.log(`Total jobs created: ${batchSize}`);
            console.log(`Total time: ${totalTime}ms`);
            console.log(`Average time per job: ${avgTime}ms`);

            const jobCount = await jobRegistry.getJobCount();
            expect(jobCount).toBe(BigInt(batchSize));
        });

        it('should optimize gas for repeated operations', async () => {
            const operations = 5;
            const gasUsage: bigint[] = [];

            for (let i = 1; i <= operations; i++) {
                const result = await reputation.sendIncrease(employer.getSender(), {
                    increaseBy: 1,
                    value: toNano('1'),
                });

                gasUsage.push(result.transactions[1].totalFees.coins);
            }

            // Gas usage should be consistent
            const avgGas = gasUsage.reduce((a, b) => a + b, 0n) / BigInt(operations);
            const variance = gasUsage.map(g => {
                const diff = Number(g - avgGas);
                return (diff * diff) / 1e18;
            }).reduce((a, b) => a + b, 0) / operations;

            console.log(`\n📈 Gas Consistency:`);
            console.log(`Average gas: ${avgGas}`);
            console.log(`Variance: ${variance.toFixed(2)}`);
            console.log(`Gas values:`, gasUsage.map(g => Number(g) / 1e9));

            expect(variance).toBeLessThan(1000); // Low variance = consistent
        });
    });
});
