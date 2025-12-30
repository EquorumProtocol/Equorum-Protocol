const { ethers } = require('ethers');

// Endereços dos contratos deployados
const contracts = {
    EquorumGenesisVesting: {
        address: '0x736f48BB9844d7CFa52Bb1E7665112f9CB06A5Fe',
        constructorArgs: [
            '0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0', // token
            '0xE47e15833eF9Ea4280C030c0663caA19fd94842C'  // genesis address
        ]
    },
    EquorumStaking: {
        address: '0xf7DB92f37308A19b0C985775d414789f2B9ecAf2',
        constructorArgs: [
            '0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0', // token
            '0x736f48BB9844d7CFa52Bb1E7665112f9CB06A5Fe'  // vesting
        ]
    },
    EquorumFaucetDistributor: {
        address: '0xDdeE4050738eDDBb2fdDF02470203C5Ca30858b7',
        constructorArgs: [
            '0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0'  // token
        ]
    },
    EquorumLiquidityManager: {
        address: '0xBe26AD2F8E4726Ca95A3395E704D99f79833A018',
        constructorArgs: [
            '0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0'  // token
        ]
    },
    EquorumReserveManager: {
        address: '0xC44F174a1450b698F6718e61bfda41B171B2d101',
        constructorArgs: [
            '0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0'  // token
        ]
    },
    TimeLock: {
        address: '0x7fA6918BeC19F09BB14b017C11DF25FD7a953a84',
        constructorArgs: []
    },
    EquorumGovernance: {
        address: '0xF4cCaCd8d81488592b86e6A6BF54902508a05Ab3',
        constructorArgs: [
            '0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0', // token
            '0x7fA6918BeC19F09BB14b017C11DF25FD7a953a84'  // timelock
        ]
    }
};

// Gerar argumentos encodados para cada contrato
for (const [name, data] of Object.entries(contracts)) {
    if (data.constructorArgs.length > 0) {
        const types = data.constructorArgs.map(() => 'address');
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, data.constructorArgs);
        console.log(`\n${name}:`);
        console.log(`Address: ${data.address}`);
        console.log(`Constructor Args (sem 0x): ${encoded.slice(2)}`);
    } else {
        console.log(`\n${name}:`);
        console.log(`Address: ${data.address}`);
        console.log(`Constructor Args: (nenhum)`);
    }
}
