import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {read} = hre.deployments;

  const alliance = '0xe6e59ef0b38a049cb9bbbc3bfb87dce72c1a199d';

  const p1 = '0x5Ee7b50d94Bebb61b343F8f5A46b787f0776bcbE';
  const p2 = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

  const alliances = await read(
    'AllianceRegistry',
    'havePlayersAnAllianceInCommon',
    p1,
    p2,
    1
  );

  const p1Data = await read(
    'AllianceRegistry',
    'getAllianceData',
    p1,
    alliance
  );
  const p2Data = await read(
    'AllianceRegistry',
    'getAllianceData',
    p2,
    alliance
  );

  console.log({
    alliances,
    p1Data,
    p2Data,
  });
}
if (require.main === module) {
  func(hre);
}

// havePlayersAnAllianceInCommon
