import { toNano } from '@ton/core';
import { DeployReputation } from '../wrappers/DeployReputation';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const reputation = provider.open(
        DeployReputation.createFromConfig(
            {
                owner: provider.sender().address!,
            },
            await compile('DeployReputation')
        )
    );

    await reputation.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(reputation.address);

    console.log('Reputation deployed at:', reputation.address);
    console.log('Owner:', provider.sender().address);
    
    // Verify deployment
    const ratingCount = await reputation.getRatingCount();
    console.log('Initial rating count:', ratingCount.toString());
}
