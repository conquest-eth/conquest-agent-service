// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Libraries/Random.sol";

// import "hardhat/console.sol";

contract OuterSpace {
    using Random for bytes32;

    uint256 internal constant STAKE_MULTIPLIER = 5e18; // = 5 DAI min
    uint32 internal constant ACTIVE_MASK = 2**31;

    mapping(address => mapping(address => bool)) internal _operators;
    mapping(uint256 => Planet) internal _planets;
    mapping(uint256 => Fleet) internal _fleets;
    bytes32 internal immutable _genesis;
    IERC20 internal immutable _stakingToken;
    uint256 internal immutable _resolveWindow;
    uint256 internal immutable _timePerDistance;
    uint256 internal immutable _exitDuration;

    mapping(address => uint256) internal _stakeReadyToBeWithdrawn;

    struct PlanetStats {
        int8 subX;
        int8 subY;
        uint16 stake;
        uint16 production;
        uint16 attack;
        uint16 defense;
        uint16 speed;
        uint16 natives;
    }
    struct Planet {
        // PlanetStats stats; // generated on demand from hash
        address owner;
        uint32 exitTime;
        uint32 numSpaceships; // uint31 + first bit => active
        uint32 lastUpdated; // also used as native-destruction indicator
    }

    struct ExternalPlanet {
        address owner;
        uint32 exitTime;
        uint32 numSpaceships;
        uint32 lastUpdated;
        bool active;
    }

    struct Fleet {
        uint256 from;
        bytes32 toHash; // to is not revealed until needed // if same as from, then take a specific time (bluff)
        uint32 launchTime;
        uint32 quantity; // we know how many but not where
    }
    // note : launchTime could be set in future when launching, like 30 min, 1h ? or any time ?

    event PlanetStake(address indexed acquirer, uint256 indexed location, uint32 numSpaceships);
    event FleetSent(
        address indexed sender,
        uint256 indexed from,
        uint256 fleet,
        uint32 quantity,
        uint32 newNumSpaceships
    );
    event FleetArrived(
        address indexed sender,
        uint256 indexed fleet,
        uint256 indexed location,
        uint32 newNumspaceships
    );
    event Attack(
        address indexed sender,
        uint256 indexed fleet,
        uint256 indexed location,
        uint32 fleetLoss,
        uint32 toLoss,
        bool won,
        uint32 newNumspaceships
    );

    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    constructor(
        IERC20 stakingToken,
        bytes32 genesis,
        uint16 resolveWindow,
        uint16 timePerDistance,
        uint16 exitDuration
    ) {
        uint16 t = timePerDistance / 4; // the coordinates space is 4 times bigger
        require(t * 4 == timePerDistance, "TIMEPDIST_NOT_DIVISIBLE_4");

        _stakingToken = stakingToken;
        _genesis = genesis;
        _resolveWindow = resolveWindow;
        _timePerDistance = t;
        _exitDuration = exitDuration;
    }

    // TODO stakeFromApproved()...
    function stake(address forPlayer, uint256 location) external payable {
        // address sender = _msgSender();
        (Planet storage planet, PlanetStats memory stats) = _getPlanet(location);

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            planet.numSpaceships,
            planet.lastUpdated,
            stats.production
        );

        uint32 defense;
        if (planet.lastUpdated == 0) {
            defense = stats.natives;
        } else {
            uint32 exitTime = planet.exitTime;
            if (exitTime != 0) {
                require(block.timestamp > planet.exitTime + _exitDuration, "STILL_EXITING");
                // TODO _actualiseExit
            } else {
                require(!active, "STILL_ACTIVE");
            }
            defense = currentNumSpaceships;
            require(defense <= 3500, "defense spaceship > 3500"); // you can first attack the planet
        }
        planet.owner = forPlayer;
        planet.exitTime = 0; // should not be needed : // TODO actualiseExit

        (uint32 attackerLoss, ) = _computeFight(3600, defense, 10000, 10000); // attacker alwasy win as defense (and stats.native) is restricted to 3500
        currentNumSpaceships = 3600 - attackerLoss;
        planet.numSpaceships = _setActiveNumSpaceships(true, currentNumSpaceships);
        planet.lastUpdated = uint32(block.timestamp);

        if (msg.value > 0) {
            // TODO in playerVault ?
            // uint256[] memory amounts = _uniswapV2Router01.swapExactETHForTokens{value:msg.value}(stakeAmount, [_weth, _stakingToken], _vault, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
            // if (amounts[1] > stakeAmount) {
            //     _stakingToken.transfer(sender, amounts[1] - stakeAmount); // TODO send to Player Account (via PaymentGateway)
            // }
        } else {
            // get from Player account ?
            // TODO _stakingToken.transferFrom(sender, address(this), stakeAmount);
        }

        (bool newActive, uint32 newSpaceships) = _activeNumSpaceships(planet.numSpaceships);

        emit PlanetStake(forPlayer, location, currentNumSpaceships);
    }

    function exitFor(address owner, uint256 location) external {
        (Planet storage planet, ) = _getPlanet(location);
        require(owner == planet.owner, "NOT_OWNER");
        require(planet.exitTime == 0, "EXITING_ALREADY"); // if you own the planet again, you ll need to first withdraw
        planet.exitTime = uint32(block.timestamp);
    }

    function _actualiseExit(uint256 location) internal {
        (Planet storage planet, PlanetStats memory stats) = _getPlanet(location);
        if (planet.exitTime > 0 && block.timestamp > planet.exitTime + _exitDuration) {
            address owner = planet.owner;
            planet.exitTime = 0;
            planet.owner = address(0); // This is fine as long as _actualiseExit is called on every move
            planet.numSpaceships = 0; // This is fine as long as _actualiseExit is called on every move
            planet.lastUpdated = uint32(block.timestamp); // This is fine as long as _actualiseExit is called on every move
            _stakeReadyToBeWithdrawn[owner] += stats.stake * STAKE_MULTIPLIER;
        }
    }

    // TODO optimize with minmal touch of _stakeReadyToBeWithdrawn (so it can happen in memory only, _stakeReadyToBeWithdrawn could be zero and remaim zero)
    function fetchAndWithdrawFor(address owner, uint256[] calldata locations) external {
        for (uint256 i = 0; i < locations.length; i++) {
            _actualiseExit(locations[i]);
        }
        withdrawFor(owner);
    }

    function withdrawFor(address owner) public {
        uint256 amount = _stakeReadyToBeWithdrawn[owner];
        _stakeReadyToBeWithdrawn[owner] = 0;
        // TODO transfer amount;
        // - if StakingToken own by contract is enouygh, take it
        // - else extract from interest bearing token
        // and then transfer
    }

    function resolveFleet(
        uint256 fleetId,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) external {
        _resolveFleetFor(_msgSender(), fleetId, to, distance, secret);
    }

    function resolveFleetFor(
        address attacker,
        uint256 fleetId,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) external {
        address sender = _msgSender();
        if (sender != attacker) {
            require(_operators[attacker][sender], "NOT_AUTHORIZED");
        }
        _resolveFleetFor(attacker, fleetId, to, distance, secret);
    }

    function send(
        uint80 subId,
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) external {
        _sendFor(_msgSender(), subId, from, quantity, toHash);
    }

    function sendFor(
        address owner,
        uint80 subId,
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) external {
        address sender = _msgSender();
        if (sender != owner) {
            require(_operators[owner][sender], "NOT_AUTHORIZED");
        }
        _sendFor(_msgSender(), subId | (1 << 81), from, quantity, toHash);
    }

    function getFleet(uint256 fleetId)
        external
        view
        returns (
            uint256 launchTime,
            uint256 from,
            uint32 quantity
        )
    {
        launchTime = _fleets[fleetId].launchTime;
        from = _fleets[fleetId].from;
        quantity = _fleets[fleetId].quantity;
    }

    // ////////////// EIP721 /////////////////// // TODO ?

    // function transfer() // TODO EIP-721 ?

    function setApprovalForAll(address operator, bool approved) external {
        address sender = _msgSender();
        _operators[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    function getGeneisHash() external view returns (bytes32) {
        return _genesis;
    }

    // TODO remove /////////////////// used to test gas cost of computing stats from reading from storage
    // PlanetStats _test;
    // function getPlanetStats(uint256 location) external returns (PlanetStats memory stats) {
    //     // return _getPlanetStats(location);
    //     return _test;
    // }
    ///////////////////////////////////

    function getPlanet(uint256 location) external view returns (ExternalPlanet memory state, PlanetStats memory stats) {
        (Planet storage planet, PlanetStats memory planetStats) = _getPlanet(location);
        (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
        state = ExternalPlanet({
            owner: planet.owner,
            exitTime: planet.exitTime,
            numSpaceships: numSpaceships,
            lastUpdated: planet.lastUpdated,
            active: active
        });
        stats = planetStats;
    }

    // ///////////////// INTERNALS ////////////////////

    function _activeNumSpaceships(uint32 numSpaceshipsData) internal view returns (bool active, uint32 numSpaceships) {
        active = (numSpaceshipsData & ACTIVE_MASK) == ACTIVE_MASK;
        numSpaceships = numSpaceshipsData % (ACTIVE_MASK);
    }

    function _setActiveNumSpaceships(bool active, uint32 numSpaceships) internal pure returns (uint32) {
        return uint32((active ? ACTIVE_MASK : 0) + numSpaceships);
    }

    function _sendFor(
        address owner,
        uint88 subId,
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) internal {
        (Planet storage planet, PlanetStats memory stats) = _getPlanet(from);
        require(owner == planet.owner, "not owner of the planet");

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            planet.numSpaceships,
            planet.lastUpdated,
            stats.production
        );
        require(currentNumSpaceships >= quantity, "not enough spaceships");
        uint32 launchTime = uint32(block.timestamp);
        uint32 numSpaceships = currentNumSpaceships - quantity;
        planet.numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
        planet.lastUpdated = launchTime;

        uint256 fleetId = (uint256(owner) << 96) | subId;
        _fleets[fleetId] = Fleet({launchTime: launchTime, from: from, toHash: toHash, quantity: quantity});

        /* TODO
        struct Fleet {
            address owner;
            uint32 launchTime;
            uint32 quantity; // we know how many but not where
        }
        fleetId = keccak256(from,toHash); // remove the need for storage : id encode both from and toHash
        _fleets[fleetId] = Fleet({owner: owner, launchTime: launchTime, quantity: quantity});

        // verifcation
        require(keccak256(abi.encodePacked(from, keccak256(abi.encodePacked(secret, to)))) == fleetId, "invalid 'from',  'to' or 'secret'");
        */

        // require(planet.lastFleets.length < 10, "too many fleet send at around the same time");
        // uint256 numPastFleets = planet.lastFleets.length;
        // for (uint256 i = 0; i < num; i++) {
        //     if (planet.lastFleets[i].launchTime) {

        //     }
        // }
        // planet.lastFleets.push(fleetId);

        emit FleetSent(owner, from, fleetId, quantity, numSpaceships);
    }

    function _resolveFleetFor(
        address attacker,
        uint256 fleetId,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) internal {
        Fleet storage fleet = _fleets[fleetId];
        address fleetOwner = address(fleetId >> 96);
        require(attacker == fleetOwner, "not owner of fleet");
        // require(fleet.from != 0, "fleet not exists"); // TODO remove
        require(keccak256(abi.encodePacked(secret, to)) == fleet.toHash, "invalid 'to' or 'secret'");

        uint256 from = fleet.from;
        uint32 quantity = fleet.quantity;
        require(quantity > 0, "no more");
        (, PlanetStats memory fromStats) = _getPlanet(from);
        (Planet storage toPlanet, PlanetStats memory toStats) = _getPlanet(to);
        // TODO : reenable
        // _checkDistance(distance, from, fromStats, to, toStats);
        // _checkTime(distance, fromStats, fleet);

        if (toPlanet.owner == attacker) {
            _performReinforcement(attacker, to, toPlanet, toStats, fleetId, quantity);
        } else {
            _performAttack(attacker, fromStats, to, toStats, fleetId, quantity);
        }
        fleet.quantity = 0; // TODO reset all to get gas refund?
    }

    function _checkDistance(
        uint256 distance,
        uint256 from,
        PlanetStats memory fromStats,
        uint256 to,
        PlanetStats memory toStats
    ) internal pure {
        // check input instead of compute sqrt
        uint256 distanceSquared = uint256( // check input instead of compute sqrt
            ((int128(to & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) * 4 + toStats.subX) -
                (int128(from & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) * 4 + fromStats.subX)) **
                2 +
                ((int128(to >> 128) * 4 + toStats.subY) - (int128(from >> 128) * 4 + fromStats.subY))**2
        );
        require(distance**2 <= distanceSquared && distanceSquared < (distance + 1)**2, "wrong distance");
    }

    function _checkTime(
        uint256 distance,
        PlanetStats memory stats,
        Fleet memory fleet
    ) internal view {
        uint256 reachTime = fleet.launchTime + (distance * (_timePerDistance * 10000)) / stats.speed;
        require(block.timestamp >= reachTime, "too early");
        require(block.timestamp < reachTime + 2 hours, "too late, your spaceships are lost in space");
    }

    function _getPlanet(uint256 location) internal view returns (Planet storage, PlanetStats memory) {
        return (_planets[location], _getPlanetStats(location));
    }

    function _getPlanetStats(uint256 location) internal view returns (PlanetStats memory) {
        // depending on random algorithm might be cheaper to always execute random
        // if we use uin16 for each field, it would be cheaper to read from storage
        // int120 gx = int120(gridLocation & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        // int120 gy = int120(gridLocation >> 128);

        bool hasPlanet = _genesis.r_u8(location, 1, 16) == 1;
        require(hasPlanet, "no planet in this location");

        return
            PlanetStats({
                subX: int8(1 - _genesis.r_u8(location, 2, 3)),
                subY: int8(1 - _genesis.r_u8(location, 3, 3)),
                stake: _genesis.r_normalFrom(
                    location,
                    4,
                    0x0001000200030004000500070009000A000A000C000F00140019001E00320064
                ), //_genesis.r_u256_minMax(location, 3, 10**18, 1000**18),
                production: _genesis.r_normalFrom(
                    location,
                    5,
                    0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0
                ), // per hour
                attack: 4000 + _genesis.r_normal(location, 6) * 400, // 1/10,000
                defense: 4000 + _genesis.r_normal(location, 7) * 400, // 1/10,000
                speed: 4090 + _genesis.r_normal(location, 8) * 334, // 1/10,000
                natives: 2000 + _genesis.r_normal(location, 9) * 100
                // maxCapacity ?
            });

        // Planet storage planet = _planets[location];
        // if (planet.exits) {
        //     return planet;
        // }
        // // require(kec)
        // // TODO check existence from hash
        // _planets[location] = Planet();
        // return _planets[location];
    }

    function _msgSender() internal view returns (address) {
        return msg.sender; // TODO metatx
    }

    function _getCurrentNumSpaceships(
        uint32 numSpaceshipsData,
        uint256 lastUpdated,
        uint16 production
    ) internal view returns (bool active, uint32 currentNumSpaceships) {
        (active, currentNumSpaceships) = _activeNumSpaceships(numSpaceshipsData);
        if (active) {
            uint256 timePassed = block.timestamp - lastUpdated;
            uint256 newSpaceships = uint256(currentNumSpaceships) + (timePassed * uint256(production)) / 1 hours;
            if (newSpaceships >= ACTIVE_MASK) {
                newSpaceships = ACTIVE_MASK - 1;
            }
            currentNumSpaceships = uint32(newSpaceships);
        }
    }

    function _computeFight(
        uint32 numAttack,
        uint32 numDefense,
        uint16 attack,
        uint16 defense
    ) internal pure returns (uint32 attackerLoss, uint32 defenderLoss) {
        uint256 attackPower = (numAttack * attack) / 10000;
        uint256 defensePower = (numDefense * defense) / 10000;

        uint256 numAttackRound = (numDefense * 10000) / attackPower;
        if (numAttackRound * attackPower < (numDefense * 10000)) {
            numAttackRound++;
        }
        uint256 numDefenseRound = (numAttack * 10000) / defensePower;
        if (numDefenseRound * defensePower < (numAttack * 10000)) {
            numDefenseRound++;
        }

        uint256 numRound = Math.min(numAttackRound, numDefenseRound);
        attackerLoss = uint32(Math.min((numRound * defensePower) / 10000, numAttack));
        defenderLoss = uint32(Math.min((numRound * attackPower) / 10000, numDefense));
    }

    function _performAttack(
        address attacker,
        PlanetStats memory fromPlanetStats,
        uint256 to,
        PlanetStats memory toPlanetStats,
        uint256 fleetId,
        uint32 numAttack
    ) internal {
        (bool active, uint32 numDefense) = _getCurrentNumSpaceships(
            _planets[to].numSpaceships,
            _planets[to].lastUpdated,
            toPlanetStats.production
        );

        (uint32 attackerLoss, uint32 defenderLoss) = _computeFight(
            numAttack,
            numDefense,
            fromPlanetStats.attack,
            toPlanetStats.defense
        );

        if (attackerLoss == numAttack) {
            uint32 numSpaceships = numDefense - defenderLoss;
            _planets[to].numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
            emit Attack(attacker, fleetId, to, attackerLoss, defenderLoss, false, numSpaceships);
        } else if (defenderLoss == numDefense) {
            // TODO exitTime and stake
            _planets[to].owner = attacker;
            _planets[to].exitTime = 0;
            uint32 numSpaceships = numAttack - attackerLoss;
            _planets[to].numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
            emit Attack(attacker, fleetId, to, attackerLoss, defenderLoss, true, numSpaceships);
        } else {
            revert("nobody won");
        }
        _planets[to].lastUpdated = uint32(block.timestamp);
    }

    function _performReinforcement(
        address attacker,
        uint256 to,
        Planet storage toPlanet,
        PlanetStats memory toStats,
        uint256 fleetId,
        uint32 quantity
    ) internal {
        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            toPlanet.numSpaceships,
            toPlanet.lastUpdated,
            toStats.production
        );
        uint256 newNumSpaceships = currentNumSpaceships + quantity;
        if (newNumSpaceships >= ACTIVE_MASK) {
            newNumSpaceships = ACTIVE_MASK - 1;
        }
        toPlanet.numSpaceships = _setActiveNumSpaceships(active, uint32(newNumSpaceships));
        emit FleetArrived(attacker, fleetId, to, uint32(newNumSpaceships));
    }
}

// Bounties will be external
// event Bounty(
//     address from,
//     address token,
//     uint256 amount,
//     uint256 location,
//     uint256 deadline,
//     address target,
//     uint256 perLoss,
//     address hunter,
// );

// Bounty will be an external contract using the capability of _operators
// function attachBounty(
//     uint256 location,
//     address token,
//     // uint256 tokenType, // TODO : ERC20 / ERC777 / ERC1155 / ERC721
//     uint256 maxSpaceships,
//     uint256 amountPerSpaceships,
//     uint256 deadline,
//     address target, // can be zero for getting reward no matter who is owning the planet.
//     address hunter // can be zero for anybody
// ) external {
//     address sender = _msgSender();
//     // require(target != sender, "please do not target yourself"); // TODO add this check ?
//     emit Bounty(sender, token, amountPerSpaceships * maxSpaceships, location, deadline, target, amountPerSpaceships, hunter);
// }

// function withdrawBounty(

// ) external {
//     // TODO
//     // check bounty deadline is over
//     // if bounty has been taken, allow winner to withdraw
//     // if bounty has not be taken, allow bounty offerer to withdraw
// }
