const { ethers, network, deployments, getChainId } = require("hardhat")

async function mockKeepers() {
    const raffle = await ethers.getContractAt("Raffle", (await deployments.get("Raffle")).address, await(ethers.getSigners)[10])
    const checkData = ethers.keccak256(ethers.toUtf8Bytes(""))
    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData)
    const chainId = await getChainId()
    console.log(chainId)
    console.log(upkeepNeeded)
    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const requestId = (await raffle.queryFilter("RequestedRaffleWinner"))[0].args[0]
        console.log(`Performed upkeep with RequestId: ${requestId}`)
        
        if (chainId == 1337) {
            await mockVrf(requestId, raffle)
        }
    } else {
        console.log("No upkeep needed!")
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok let's pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", (await deployments.get("VRFCoordinatorV2Mock")).address, await(ethers.getSigners)[10])
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, (await deployments.get("Raffle")).address)
    console.log("Responded!")
    const recentWinner = await raffle.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })