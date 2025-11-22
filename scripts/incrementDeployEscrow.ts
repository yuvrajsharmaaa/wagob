import { Address, toNano } from '@ton/core';
import { DeployEscrow } from '../wrappers/DeployEscrow';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('DeployEscrow address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const deployEscrow = provider.open(DeployEscrow.createFromAddress(address));

    const counterBefore = await deployEscrow.getCounter();

    await deployEscrow.sendIncrease(provider.sender(), {
        increaseBy: 1,
        value: toNano('0.05'),
    });

    ui.write('Waiting for counter to increase...');

    let counterAfter = await deployEscrow.getCounter();
    let attempt = 1;
    while (counterAfter === counterBefore) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        counterAfter = await deployEscrow.getCounter();
        attempt++;
    }

    ui.clearActionPrompt();
    ui.write('Counter increased successfully!');
}
