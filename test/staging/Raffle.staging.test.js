const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle Unit Tests", function(){
        let raffle, entranceFee, deployer
        const chainId = network.config.chainId
        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            raffle = await ethers.getContractAt("Raffle", (await deployments.get("Raffle")).address, await ethers.provider.getSigner(deployer))
            entranceFee = await raffle.getEntranceFee()
            console.log("Before each done")
        })

        //Event Listener doesn't work
        describe("fulfillRandomWords", function() {
            it("works with live Chainlink Keepers and ChainLink WRF, we get a random winner", async function() {
                const startingTimeStamp = await raffle.getLatestTimeStamp()
                const deployerAddress = (await ethers.getSigners())[0]
                await new Promise(async (resolve, reject) => {
                    console.log("Promice created")
                    raffle.on("WinnerPicked", async () => {
                        console.log("WinnerPicked event happened")
                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerEndingBalance = await ethers.provider.getBalance(deployerAddress)
                            const endingTimeStamp = await raffle.getLatestTimeStamp()
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toString(), deployerAddress)
                            assert.equal(raffleState, 0)
                            assert.equal (winnerEndingBalance.toString(), (winnerStartingBalance + BigInt(entranceFee)).toString())
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()
                            console.log("resolve done")
                        } catch (e) {
                            console.log(e)
                            reject(e)
                        }
                    })

                    const tx = await raffle.enterRaffle({value: entranceFee})
                    console.log("Let's wait some time...")
                    console.log("Entered state")
                    const winnerStartingBalance = await ethers.provider.getBalance(deployerAddress)
                    console.log("Winner Balnace: ", winnerStartingBalance)
                })
            })
        })
    })