import { toNano } from '@ton/core';
import { DeployJobRegistry } from '../wrappers/DeployJobRegistry';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jobRegistry = provider.open(
        DeployJobRegistry.createFromConfig(
            {
                owner: provider.sender().address!,
            },
            await compile('DeployJobRegistry')
        )
    );

    await jobRegistry.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jobRegistry.address);

    console.log('JobRegistry deployed at:', jobRegistry.address);
    console.log('Owner:', provider.sender().address);
    
    // Verify deployment
    const jobCount = await jobRegistry.getJobCount();
    console.log('Initial job count:', jobCount.toString());
}
