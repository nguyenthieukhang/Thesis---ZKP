const Verifier = artifacts.require('Verifier')

module.exports = function (deployer) {
    return deployer.then(async () => {
      const verifier = await Verifier.deployed()
      const mixer = await deployer.deploy(
        verifier.address,
        ETH_AMOUNT=100000000
      )
      console.log('Mixer address', mixer.address)
    })
  }