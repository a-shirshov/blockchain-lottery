const { ethers, deployments } = require("hardhat")

async function enterRaffle() {
    const raffle = await ethers.getContractAt("Raffle", (await deployments.get("Raffle")).address, await ethers.provider.getSigner(deployer))
    const entranceFee = await raffle.getEntranceFee()
    tx = await raffle.enterRaffle({ value: entranceFee + 1 })
    tx.wait(1)
    console.log("Entered!")
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })