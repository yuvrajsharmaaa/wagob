import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { FirstContract } from '../wrappers/FirstContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('FirstContract', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('FirstContract');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let firstContract: SandboxContract<FirstContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        firstContract = blockchain.openContract(FirstContract.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await firstContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: firstContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and firstContract are ready to use
    });
});
