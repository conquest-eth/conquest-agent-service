import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts} from 'hardhat';

describe('OuterSpace', function () {
  it('should work', async function () {
    await deployments.fixture('OuterSpace');
    const outerSpaceContract = await ethers.getContract('OuterSpace');
    expect(outerSpaceContract.address).to.be.a('string');
  });

  it('should fails', async function () {
    await deployments.fixture('OuterSpace');
    const outerSpaceContract = await ethers.getContract('OuterSpace');
    expect(outerSpaceContract.fails('testing')).to.be.revertedWith('fails');
  });

  it('setMessage works', async function () {
    await deployments.fixture('OuterSpace');
    const others = await getUnnamedAccounts();
    const outerSpaceContract = await ethers.getContract('OuterSpace', others[0]);
    const testMessage = 'Hello World';
    await expect(outerSpaceContract.setMessage(testMessage))
      .to.emit(outerSpaceContract, 'MessageChanged')
      .withArgs(others[0], testMessage);
  });
});
