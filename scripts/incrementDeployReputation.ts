import { Address, toNano } from '@ton/core';
import { DeployReputation } from '../wrappers/DeployReputation';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('DeployReputation address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const deployReputation = provider.open(DeployReputation.createFromAddress(address));

    const counterBefore = await deployReputation.getCounter();

    await deployReputation.sendIncrease(provider.sender(), {
        increaseBy: 1,
        value: toNano('0.05'),
    });

    ui.write('Waiting for counter to increase...');

    let counterAfter = await deployReputation.getCounter();
    let attempt = 1;
    while (counterAfter === counterBefore) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        counterAfter = await deployReputation.getCounter();
        attempt++;
    }

    ui.clearActionPrompt();
    ui.write('Counter increased successfully!');
}
