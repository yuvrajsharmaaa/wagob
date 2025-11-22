import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { DeployJobRegistry } from '../wrappers/DeployJobRegistry';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('DeployJobRegistry', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('DeployJobRegistry');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let deployJobRegistry: SandboxContract<DeployJobRegistry>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployJobRegistry = blockchain.openContract(DeployJobRegistry.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await deployJobRegistry.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: deployJobRegistry.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and deployJobRegistry are ready to use
    });
});
