const FflonkVerifier = artifacts.require("FflonkVerifier");

module.exports = function (deployer) {
    deployer.then(async () => {
        await deployer.deploy(FflonkVerifier, { gas: 30000000 });
    });
};
