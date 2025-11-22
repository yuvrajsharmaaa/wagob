import { toNano } from '@ton/core';
import { DeployEscrow } from '../wrappers/DeployEscrow';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const escrow = provider.open(
        DeployEscrow.createFromConfig(
            {
                owner: provider.sender().address!,
                feeBps: 250, // 2.5% platform fee
            },
            await compile('DeployEscrow')
        )
    );

    await escrow.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(escrow.address);

    console.log('Escrow deployed at:', escrow.address);
    console.log('Owner:', provider.sender().address);
    console.log('Platform fee:', '2.5%');
    
    // Verify deployment
    const escrowCount = await escrow.getEscrowCount();
    const feeBps = await escrow.getFeeBps();
    console.log('Initial escrow count:', escrowCount.toString());
    console.log('Fee (basis points):', feeBps);
}
