import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
    NikGover, 
    GoverToken, 
    Timelock, 
    Star} from "../typechain-types";

    let admin:SignerWithAddress;
    let user1:SignerWithAddress;
    let user2:SignerWithAddress;
    let gover:NikGover;
    let token:GoverToken;
    let timelock:Timelock;
    let star:Star;

    async function main() {
        [admin, user1, user2] = await ethers.getSigners();

        const GoverToken = await ethers.getContractFactory("GoverToken");
        token = await GoverToken.deploy();
        await token.waitForDeployment();
        console.log("GTK address:", token.target);

        const TimeLock = await ethers.getContractFactory("Timelock");
        timelock = await TimeLock.deploy(3500, [], [], admin.address);
        await timelock.waitForDeployment();
        console.log("TimeLock address:", timelock.target);

        const NikGover = await ethers.getContractFactory("NikGover");
        gover = await NikGover.deploy(token.target, timelock.target);
        await gover.waitForDeployment();
        console.log("Governance address:", gover.target);

        const grandProposalRole = await timelock.grantRole(
            await timelock.PROPOSER_ROLE(),
            gover.target
        );
        await grandProposalRole.wait();
        
        const grandExecuterRole = await timelock.grantRole(
            await timelock.EXECUTOR_ROLE(),
            ethers.ZeroAddress
        );
        await grandExecuterRole.wait();

        const renounceDefAdmin = await timelock.renounceRole(
            await timelock.DEFAULT_ADMIN_ROLE(),
            admin.address
        );
        await renounceDefAdmin.wait();
        
        const Star = await ethers.getContractFactory("Star");
        star = await Star.deploy(timelock.target);
        await star.waitForDeployment();
        console.log("Star address:", star.target);

    }
    main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    });
