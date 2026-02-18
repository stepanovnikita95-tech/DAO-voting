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
    let user3:SignerWithAddress;
    let nonVoter:SignerWithAddress;
    let gover:NikGover;
    let token:GoverToken;
    let timelock:Timelock;
    let star:Star;

    export async function deployFixture() {
        [admin, user1, user2, user3, nonVoter] = await ethers.getSigners();

        const GoverToken = await ethers.getContractFactory("GoverToken");
        token = await GoverToken.deploy();
        await token.waitForDeployment();

        const TimeLock = await ethers.getContractFactory("Timelock");
        timelock = await TimeLock.deploy(3500, [], [], admin.address);
        await timelock.waitForDeployment();

        const NikGover = await ethers.getContractFactory("NikGover");
        gover = await NikGover.deploy(token.target, timelock.target);
        await gover.waitForDeployment();

        const grandProposalRole = await timelock.grantRole(
            await timelock.PROPOSER_ROLE(),
            gover.target
        );
        await grandProposalRole.wait();
        
        const grandExecuterRole = await timelock.grantRole(
            await timelock.EXECUTOR_ROLE(),
            gover.target
        );
        await grandExecuterRole.wait();

        const renounceDefAdmin = await timelock.renounceRole(
            await timelock.DEFAULT_ADMIN_ROLE(),
            admin.address
        );
        await renounceDefAdmin.wait();
        
        const Star = await ethers.getContractFactory("Star");
        star = await Star.deploy(timelock.target, {
            value: ethers.parseEther("2")
        });
        await star.waitForDeployment();

        return { token, timelock, gover, star, admin, user1, user2, user3, nonVoter }
    }