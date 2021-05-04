// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Libraries/Extraction.sol";
import "./Libraries/Math.sol";
import "hardhat-deploy/solc_0.7/proxy/Proxied.sol";

contract OuterSpace is Proxied {
    using Extraction for bytes32;

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // CONSTANTS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    uint256 internal constant DECIMALS_18 = 1e18;
    uint32 internal constant ACTIVE_MASK = 2**31;
    int256 internal constant UINT32_MAX = 2**32 - 1;
    uint256 internal constant FRONT_RUNNING_DELAY = 30 * 60; // 30 min // TODO make it configurable in the constructor

    int256 internal constant EXPANSION = 8;
    uint32 internal constant INITIAL_SPACE = 16;

    uint256 internal constant COMBAT_RULE_SWITCH_TIME = 1620144000; // Tuesday, 4 May 2021 16:00:00 GMT

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // CONFIGURATION / IMMUTABLE
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    bytes32 internal immutable _genesis;
    IERC20 internal immutable _stakingToken;
    uint256 internal immutable _resolveWindow;
    uint256 internal immutable _timePerDistance;
    uint256 internal immutable _exitDuration;
    uint32 internal immutable _acquireNumSpaceships;
    uint32 internal immutable _productionSpeedUp;

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // STORAGE
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    mapping(uint256 => Planet) internal _planets;
    mapping(uint256 => Fleet) internal _fleets;

    mapping(address => uint256) internal _stakeReadyToBeWithdrawn;

    mapping(address => mapping(address => bool)) internal _operators;

    // front running protection : FRONT_RUNNING_DELAY / 2 slots
    struct InFlight {
        uint64 flying;
        uint64 destroyed;
    }
    // TODO make it namespaces per user, currently it is possible (though unlikely) for 2 users to share a slot if one attack another and quickly send away spaceships
    mapping(uint256 => mapping(uint256 => InFlight)) internal _inFlight;

    struct Discovered {
        uint32 minX;
        uint32 maxX;
        uint32 minY;
        uint32 maxY;
    }

    Discovered internal _discovered;

    struct Planet {
        address owner;
        uint32 exitTime;
        uint32 numSpaceships; // uint31 + first bit => active
        uint32 lastUpdated; // also used as native-destruction indicator
    }

    struct Fleet {
        address owner;
        uint32 launchTime;
        uint32 quantity;
        // TODO uint32 delay
    }

    // rewards
    mapping(address => uint256) internal _prevRewardIds;
    mapping(uint256 => uint256) internal _rewards;
    mapping(address => mapping(uint256 => bool)) internal _rewardsToWithdraw;

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // EVENTS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    event PlanetStake(address indexed acquirer, uint256 indexed location, uint32 numSpaceships, uint256 stake);
    event FleetSent(
        address indexed fleetOwner,
        uint256 indexed from,
        uint256 fleet,
        uint32 quantity,
        uint32 newNumSpaceships
    );

    // TODO add fromPlanet to the event ?
    event FleetArrived(
        uint256 indexed fleet,
        address indexed fleetOwner,
        address indexed destinationOwner,
        uint256 destination,
        uint32 fleetLoss,
        uint32 planetLoss,
        uint32 inFlightFleetLoss,
        uint32 inFlightPlanetLoss,
        bool won,
        uint32 newNumspaceships
    );

    event PlanetExit(address indexed owner, uint256 indexed location);

    event ExitComplete(address indexed owner, uint256 indexed location, uint256 stake);

    event RewardSetup(uint256 indexed location, uint256 rewardId);
    event RewardToWithdraw(address indexed owner, uint256 indexed location, uint256 indexed rewardId);

    event StakeToWithdraw(address indexed owner, uint256 newStake);

    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // CONSTRUCTOR / INITIALIZATION
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    constructor(
        IERC20 stakingToken,
        bytes32 genesis,
        uint32 resolveWindow,
        uint32 timePerDistance,
        uint32 exitDuration,
        uint32 acquireNumSpaceships,
        uint32 productionSpeedUp
    ) {
        uint32 t = timePerDistance / 4; // the coordinates space is 4 times bigger
        require(t * 4 == timePerDistance, "TIME_PER_DIST_NOT_DIVISIBLE_4");

        _stakingToken = stakingToken;
        _genesis = genesis;
        _resolveWindow = resolveWindow;
        _timePerDistance = t;
        _exitDuration = exitDuration;
        _acquireNumSpaceships = acquireNumSpaceships;
        _productionSpeedUp = productionSpeedUp;

        postUpgrade(
            stakingToken,
            genesis,
            resolveWindow,
            timePerDistance,
            exitDuration,
            acquireNumSpaceships,
            productionSpeedUp
        );
    }

    function postUpgrade(
        IERC20,
        bytes32,
        uint32,
        uint32,
        uint32,
        uint32,
        uint32
    ) public proxied {
        if (_discovered.minX == 0) {
            _discovered = Discovered({
                minX: INITIAL_SPACE,
                maxX: INITIAL_SPACE,
                minY: INITIAL_SPACE,
                maxY: INITIAL_SPACE
            });
        }
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // STAKING / PRODUCTION CAPTURE
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function onTokenTransfer(
        address,
        uint256 amount,
        bytes calldata data
    ) public returns (bool) {
        require(msg.sender == address(_stakingToken), "INVALID_ERC20");
        (address acquirer, uint256 location) = abi.decode(data, (address, uint256));
        _acquire(acquirer, amount, location); // we do not care of who the payer is
        return true;
    }

    function onTokenPaidFor(
        address,
        address forAddress,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        require(msg.sender == address(_stakingToken), "INVALID_ERC20");
        uint256 location = abi.decode(data, (uint256));
        _acquire(forAddress, amount, location); // we do not care of who the payer is
        return true;
    }

    function acquireViaTransferFrom(uint256 location, uint256 amount) public {
        address sender = _msgSender();
        _acquire(sender, amount, location);
        _stakingToken.transferFrom(sender, address(this), amount);
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // REWARD SETUP
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // TODO : ERC20, ERC721, ERC1155
    function addReward(uint256 location, address sponsor) external onlyProxyAdmin {
        Planet memory planet = _planets[location];
        if (_hasJustExited(planet.exitTime)) {
            _setPlanetAfterExit(location, planet.owner, _planets[location], address(0), 0);
        }

        uint256 rewardId = _rewards[location];
        if (rewardId == 0) {
            rewardId = ++_prevRewardIds[sponsor];
            _rewards[location] = (uint256(uint160(sponsor)) << 96) + rewardId;
        }
        // TODO should it fails if different sponsor added reward before

        // TODO rewardId association with the actual rewards // probably contract address holding the reward
        emit RewardSetup(location, rewardId);
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // EXIT / WITHDRAWALS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function exitFor(address owner, uint256 location) external {
        Planet storage planet = _getPlanet(location);
        require(owner == planet.owner, "NOT_OWNER");
        require(planet.exitTime == 0, "EXITING_ALREADY"); // if you own the planet again, you ll need to first withdraw
        planet.exitTime = uint32(block.timestamp);
        emit PlanetExit(owner, location);
    }

    function fetchAndWithdrawFor(address owner, uint256[] calldata locations) external {
        uint256 addedStake = 0;
        for (uint256 i = 0; i < locations.length; i++) {
            Planet storage planet = _getPlanet(locations[i]);
            if (_hasJustExited(planet.exitTime)) {
                require(owner == planet.owner, "NOT_OWNER");
                addedStake += _setPlanetAfterExitWithoutUpdatingStake(locations[i], owner, planet, address(0), 0); // no need of event as exitTime passed basically mean owner zero and spaceships zero
            }
        }
        uint256 newStake = _stakeReadyToBeWithdrawn[owner] + addedStake;
        _withdrawAll(owner, newStake);
    }

    function balanceToWithdraw(address owner) external view returns (uint256) {
        return _stakeReadyToBeWithdrawn[owner];
    }

    function withdrawFor(address owner) external {
        uint256 amount = _stakeReadyToBeWithdrawn[owner];
        _withdrawAll(owner, amount);
    }

    function _withdrawAll(address owner, uint256 amount) internal {
        _updateStake(owner, 0);
        require(_stakingToken.transfer(owner, amount), "FAILED_TRANSFER"); // TODO FundManager
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // FLEET RESOLUTION, ATTACK / REINFORCEMENT
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function resolveFleet(
        uint256 fleetId,
        uint256 from,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) external {
        _resolveFleet(fleetId, from, to, distance, secret);
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // FLEET SENDING
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function send(
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) external {
        _sendFor(_msgSender(), from, quantity, toHash);
    }

    function sendFor(
        address owner,
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) external {
        address sender = _msgSender();
        if (sender != owner) {
            require(_operators[owner][sender], "NOT_AUTHORIZED");
        }
        _sendFor(_msgSender(), from, quantity, toHash);
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // GETTERS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function getFleet(uint256 fleetId, uint256 from)
        external
        view
        returns (
            address owner,
            uint32 launchTime,
            uint32 quantity,
            uint64 flyingAtLaunch, // can be more than quantity if multiple fleet were launched around the same time from the same planet
            uint64 destroyedAtLaunch
        )
    {
        launchTime = _fleets[fleetId].launchTime;
        quantity = _fleets[fleetId].quantity;
        owner = _fleets[fleetId].owner;

        uint256 timeSlot = launchTime / (FRONT_RUNNING_DELAY / 2);
        destroyedAtLaunch = _inFlight[from][timeSlot].destroyed;
        flyingAtLaunch = _inFlight[from][timeSlot].flying;
    }

    function getGeneisHash() external view returns (bytes32) {
        return _genesis;
    }

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

    struct ExternalPlanet {
        address owner;
        uint32 exitTime;
        uint32 numSpaceships;
        uint32 lastUpdated;
        bool active;
        uint256 reward;
    }

    function getPlanet(uint256 location) external view returns (ExternalPlanet memory state, PlanetStats memory stats) {
        Planet storage planet = _getPlanet(location);
        (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
        state = ExternalPlanet({
            owner: planet.owner,
            exitTime: planet.exitTime,
            numSpaceships: numSpaceships,
            lastUpdated: planet.lastUpdated,
            active: active,
            reward: _rewards[location]
        });
        stats = _getPlanetStats(location);
    }

    function getPlanetStates(uint256[] calldata locations)
        external
        view
        returns (ExternalPlanet[] memory planetStates, Discovered memory discovered)
    {
        planetStates = new ExternalPlanet[](locations.length);
        for (uint256 i = 0; i < locations.length; i++) {
            Planet storage planet = _getPlanet(locations[i]);
            (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
            planetStates[i] = ExternalPlanet({
                owner: planet.owner,
                exitTime: planet.exitTime,
                numSpaceships: numSpaceships,
                lastUpdated: planet.lastUpdated,
                active: active,
                reward: _rewards[locations[i]]
            });
        }
        discovered = _discovered;
    }

    function getDiscovered() external view returns (Discovered memory) {
        return _discovered;
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // ERC721 : // TODO
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function setApprovalForAll(address operator, bool approved) external {
        address sender = _msgSender();
        _operators[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // INTERNALS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    // function _actualiseExit(uint256 location) internal {
    //     Planet storage planet = _getPlanet(location);
    //     if (planet.exitTime > 0 && block.timestamp > planet.exitTime + _exitDuration) {
    //         uint16 stake = _stake(location);
    //         address owner = planet.owner;
    //         planet.exitTime = 0;
    //         planet.owner = address(0); // This is fine as long as _actualiseExit is called on every move
    //         planet.numSpaceships = 0; // This is fine as long as _actualiseExit is called on every move
    //         planet.lastUpdated = uint32(block.timestamp); // This is fine as long as _actualiseExit is called on every move
    //         _stakeReadyToBeWithdrawn[owner] += stake * DECIMALS_18;
    //     }
    // }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // STAKING / PRODUCTION CAPTURE
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function _acquire(
        address sender,
        uint256 stake,
        uint256 location
    ) internal {
        // console.logBytes32(bytes32(location));
        bytes32 data = _planetData(location);
        require(stake == uint256(_stake(data)) * (DECIMALS_18), "INVALID_AMOUNT");

        uint32 numSpaceships = _handleSpaceships(sender, location, data);
        _handleDiscovery(location);
        emit PlanetStake(sender, location, numSpaceships, stake);
    }

    function _handleSpaceships(
        address sender,
        uint256 location,
        bytes32 data
    ) internal returns (uint32) {
        Planet storage planet = _getPlanet(location);
        Planet memory mplanet = planet;

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            mplanet.numSpaceships,
            mplanet.lastUpdated,
            _production(data)
        );

        bool justExited;
        uint32 defense;
        if (mplanet.lastUpdated == 0) {
            defense = _natives(data);
        } else {
            if (mplanet.exitTime != 0) {
                require(_hasJustExited(mplanet.exitTime), "STILL_EXITING");
                justExited = true;
            } else {
                require(!active, "STILL_ACTIVE");

                // Do not allow staking over occupied planets
                require(mplanet.owner == sender || currentNumSpaceships == 0, "OCCUPIED");
                // used to be the following (but this gave too many cons to send spaceships to non-active planets):
                // if (mplanet.owner != sender) {
                //     defense = currentNumSpaceships;
                // } else {
                //     defense = 0;
                // }
            }
        }
        if (justExited) {
            currentNumSpaceships = _acquireNumSpaceships;
            _setPlanetAfterExit(
                location,
                mplanet.owner,
                planet,
                sender,
                _setActiveNumSpaceships(true, currentNumSpaceships)
            );
        } else {
            planet.owner = sender;
            if (defense != 0) {
                uint32 attackerLoss;
                if (block.timestamp > COMBAT_RULE_SWITCH_TIME) {
                    (attackerLoss, ) = _computeFight(_acquireNumSpaceships, defense, 10000, _defense(data));
                } else {
                    (attackerLoss, ) = _old_computeFight(_acquireNumSpaceships, defense, 10000, _defense(data));
                }

                // attacker alwasy win as defense (and stats.native) is restricted to 3500
                // (attackerLoss: 0, defenderLoss: 0) would mean defense was zero
                require(attackerLoss < _acquireNumSpaceships, "FAILED_CAPTURED");
                currentNumSpaceships = _acquireNumSpaceships - attackerLoss;
            } else {
                currentNumSpaceships += _acquireNumSpaceships;
            }

            // planet.exitTime = 0; // should not be needed : // TODO actualiseExit
            planet.numSpaceships = _setActiveNumSpaceships(true, currentNumSpaceships);
            planet.lastUpdated = uint32(block.timestamp);
        }
        return currentNumSpaceships;
    }

    // solhint-disable-next-line code-complexity
    function _handleDiscovery(uint256 location) internal {
        Discovered memory discovered = _discovered;
        int256 x = int256(int128(location & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF));
        int256 y = int256(int128(location >> 128));
        bool changes = false;
        if (x < 0) {
            require(-x <= discovered.minX, "NOT_REACHABLE_YET_MINX");
            x = -x + EXPANSION;
            if (x > UINT32_MAX) {
                x = UINT32_MAX;
            }
            if (discovered.minX < uint32(x)) {
                discovered.minX = uint32(x);
                changes = true;
            }
        } else {
            require(x <= discovered.maxX, "NOT_REACHABLE_YET_MAXX");
            x = x + EXPANSION;
            if (x > UINT32_MAX) {
                x = UINT32_MAX;
            }
            if (discovered.maxX < uint32(x)) {
                discovered.maxX = uint32(x);
                changes = true;
            }
        }

        if (y < 0) {
            require(-y <= discovered.minY, "NOT_REACHABLE_YET_MINY");
            y = -y + EXPANSION;
            if (y > UINT32_MAX) {
                y = UINT32_MAX;
            }
            if (discovered.minY < uint32(y)) {
                discovered.minY = uint32(y);
                changes = true;
            }
        } else {
            require(y <= discovered.maxY, "NOT_REACHABLE_YET_MAXY");
            y = y + EXPANSION;
            if (y > UINT32_MAX) {
                y = UINT32_MAX;
            }
            if (discovered.maxY < uint32(y)) {
                discovered.maxY = uint32(y);
                changes = true;
            }
        }
        if (changes) {
            _discovered = discovered;
        }
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // EXITS / WITHDRAWALS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function _hasJustExited(uint32 exitTime) internal view returns (bool) {
        return exitTime > 0 && block.timestamp > exitTime + _exitDuration;
    }

    function _setPlanetAfterExit(
        uint256 location,
        address owner,
        Planet storage planet,
        address newOwner,
        uint32 spaceshipsData
    ) internal {
        uint256 addedStake = _setPlanetAfterExitWithoutUpdatingStake(location, owner, planet, newOwner, spaceshipsData);
        _updateStake(owner, _stakeReadyToBeWithdrawn[owner] + addedStake);
    }

    function _updateStake(address owner, uint256 newStake) internal {
        _stakeReadyToBeWithdrawn[owner] = newStake;
        emit StakeToWithdraw(owner, newStake);
    }

    function _setPlanetAfterExitWithoutUpdatingStake(
        uint256 location,
        address owner,
        Planet storage planet,
        address newOwner,
        uint32 spaceshipsData
    ) internal returns (uint256) {
        bytes32 data = _planetData(location);
        uint256 stake = uint256(_stake(data)) * (DECIMALS_18);
        emit ExitComplete(owner, location, stake);

        // --------------------------------------------------------
        // Extra Reward was added
        // --------------------------------------------------------
        uint256 rewardId = _rewards[location];
        if (rewardId != 0) {
            _rewardsToWithdraw[owner][rewardId] = true; // rewardId would contains the package. maybe this could be handled by an external contract
            _rewards[location] = 0; // reset / if you had reward to a planet in he process of exiting, you are adding the reward to the player exiting unless _setPlanetAfterExit is called first
            emit RewardToWithdraw(owner, location, rewardId);
        }
        // --------------------------------------------------------

        planet.exitTime = 0;
        planet.owner = newOwner; // This is fine as long as _actualiseExit is called on every move
        planet.lastUpdated = uint32(block.timestamp); // This is fine as long as _actualiseExit is called on every move
        planet.numSpaceships = spaceshipsData;
        return stake;
    }

    /*
    uint256 newStake = _stakeReadyToBeWithdrawn[owner] + stake * DECIMALS_18;
    _stakeReadyToBeWithdrawn[owner] = newStake;
    emit StakeToWithdraw(owner, newStake);
    */

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // FLEET SENDING
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function _sendFor(
        address owner,
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) internal {
        Planet storage planet = _getPlanet(from);

        require(planet.exitTime == 0, "PLANET_EXIT");
        require(owner == planet.owner, "NOT_OWNER");

        bytes32 data = _planetData(from);
        uint16 production = _production(data);

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            planet.numSpaceships,
            planet.lastUpdated,
            production
        );
        require(currentNumSpaceships >= quantity, "SPACESHIPS_NOT_ENOUGH");

        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // record flying fleets (to prevent front-running, see resolution)
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        uint256 timeSlot = block.timestamp / (FRONT_RUNNING_DELAY / 2);
        uint64 flying = _inFlight[from][timeSlot].flying;
        flying = flying + quantity;
        require(flying >= quantity, "OVERFLOW"); // unlikely to ever happen, would need a hug amount of spaceships to be received and each in turn being sent
        _inFlight[from][timeSlot].flying = flying;
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------

        uint32 launchTime = uint32(block.timestamp); // TODO allow delay : launchTime in future
        uint32 numSpaceships = currentNumSpaceships - quantity;
        planet.numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
        planet.lastUpdated = launchTime;

        uint256 fleetId = uint256(keccak256(abi.encodePacked(toHash, from)));
        _fleets[fleetId] = Fleet({launchTime: launchTime, owner: owner, quantity: quantity});

        emit FleetSent(owner, from, fleetId, quantity, numSpaceships);
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // FLEET RESOLUTION, ATTACK / REINFORCEMENT
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    struct FleetResult {
        uint32 inFlightPlanetLoss;
        uint32 attackerLoss;
        uint32 defenderLoss;
        bool won;
        uint32 numSpaceships;
    }

    function _resolveFleet(
        uint256 fleetId,
        uint256 from,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) internal {
        Fleet memory fleet = _fleets[fleetId];
        (uint32 quantity, uint32 inFlightFleetLoss) = _checkFleetAndComputeQuantityLeft(
            fleet,
            fleetId,
            from,
            to,
            distance,
            secret
        );
        Planet memory toPlanet = _getPlanet(to);
        emit_fleet_arrived(
            fleet.owner,
            fleetId,
            _hasJustExited(toPlanet.exitTime) ? address(0) : toPlanet.owner,
            to,
            _performResolution(fleet, from, toPlanet, to, quantity),
            inFlightFleetLoss
        );
        _fleets[fleetId].quantity = 0; // TODO reset all to get gas refund? // TODO ensure frontend can still easily check fleet status
    }

    function _performResolution(
        Fleet memory fleet,
        uint256 from,
        Planet memory toPlanet,
        uint256 to,
        uint32 quantity
    ) internal returns (FleetResult memory result) {
        if (toPlanet.owner == fleet.owner) {
            return _performReinforcement(fleet.owner, toPlanet, to, quantity);
        } else {
            return _performAttack(fleet.owner, fleet.launchTime, from, toPlanet, to, quantity);
        }
    }

    function _checkFleetAndComputeQuantityLeft(
        Fleet memory fleet,
        uint256 fleetId,
        uint256 from,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) internal returns (uint32 quantity, uint32 inFlightFleetLoss) {
        require(
            uint256(keccak256(abi.encodePacked(keccak256(abi.encodePacked(secret, to)), from))) == fleetId,
            "INVALID_FLEET_DATA_OR_SECRET'"
        );

        quantity = fleet.quantity;
        require(quantity > 0, "FLEET_DO_NOT_EXIST");

        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // check if fleet was attacked while departing (used to prevent front-running, see fleet sending)
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        quantity = _fleet_flying_at_origin(quantity, from, fleet.launchTime);
        inFlightFleetLoss = fleet.quantity - quantity;
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------

        _checkDistance(distance, from, to);
        _checkTime(distance, from, fleet.launchTime);
    }

    function emit_fleet_arrived(
        address fleetOwner,
        uint256 fleetID,
        address toOwner,
        uint256 to,
        FleetResult memory result,
        uint32 inFlightFleetLoss
    ) internal {
        emit FleetArrived(
            fleetID,
            fleetOwner,
            toOwner,
            to,
            result.attackerLoss,
            result.defenderLoss,
            inFlightFleetLoss,
            result.inFlightPlanetLoss,
            result.won,
            result.numSpaceships
        );
    }

    function _fleet_flying_at_origin(
        uint32 quantity,
        uint256 from,
        uint32 launchTime
    ) internal returns (uint32) {
        uint256 timeSlot = launchTime / (FRONT_RUNNING_DELAY / 2);
        uint64 destroyed = _inFlight[from][timeSlot].destroyed;
        if (destroyed < quantity) {
            quantity -= uint32(destroyed);
            _inFlight[from][timeSlot].destroyed = 0;
        } else {
            quantity = 0;
            _inFlight[from][timeSlot].destroyed = destroyed - quantity;
        }
        return quantity;
    }

    function _performAttack(
        address attacker,
        uint32 launchTime,
        uint256 from,
        Planet memory toPlanet,
        uint256 to,
        uint32 numAttack
    ) internal returns (FleetResult memory result) {
        if (toPlanet.lastUpdated == 0) {
            // Planet was never touched (previous attack could have failed to succeed attack on natives)
            bytes32 toPlanetData = _planetData(to);
            return _nativeAttack(attacker, launchTime, from, to, toPlanetData, numAttack);
        } else if (_hasJustExited(toPlanet.exitTime)) {
            return _fleetAfterExit(to, toPlanet.owner, _planets[to], attacker, numAttack);
        } else {
            bytes32 toPlanetData = _planetData(to);
            uint16 attack = _attack(_planetData(from));
            uint16 defense = _defense(toPlanetData);
            uint16 production = _production(toPlanetData);
            return _actualAttack(attacker, launchTime, attack, defense, toPlanet, to, production, numAttack);
        }
    }

    function _fleetAfterExit(
        uint256 to,
        address owner,
        Planet storage planet,
        address attacker,
        uint32 numAttack
    ) internal returns (FleetResult memory result) {
        _setPlanetAfterExit(to, owner, planet, numAttack > 0 ? attacker : address(0), numAttack);
        result.numSpaceships = numAttack;
        result.won = numAttack > 0;
    }

    function _nativeAttack(
        address attacker,
        uint32 launchTime,
        uint256 from,
        uint256 to,
        bytes32 toData,
        uint32 numAttack
    ) internal returns (FleetResult memory result) {
        uint16 attack = _attack(_planetData(from));
        uint16 defense = _defense(toData);
        uint16 natives = _natives(toData);
        uint32 attackerLoss;
        uint32 defenderLoss;
        if (launchTime > COMBAT_RULE_SWITCH_TIME) {
            (attackerLoss, defenderLoss) = _computeFight(numAttack, natives, attack, defense);
        } else {
            (attackerLoss, defenderLoss) = _old_computeFight(numAttack, natives, attack, defense);
        }
        result.attackerLoss = attackerLoss;
        if (defenderLoss == natives && numAttack > attackerLoss) {
            // (attackerLoss: 0, defenderLoss: 0) means that numAttack was zero as natives cannot be zero
            result.numSpaceships = numAttack - attackerLoss;
            _planets[to].numSpaceships = _setActiveNumSpaceships(false, result.numSpaceships);
            _planets[to].lastUpdated = uint32(block.timestamp);
            _planets[to].owner = attacker;
            result.defenderLoss = defenderLoss;
            result.won = true;
        }
    }

    function _actualAttack(
        address attacker,
        uint32 launchTime,
        uint16 attack,
        uint16 defense,
        Planet memory toPlanet,
        uint256 to,
        uint16 production,
        uint32 numAttack
    ) internal returns (FleetResult memory result) {
        PreCombatState memory state = _getPlanetPreCombatState(toPlanet, to, production);

        if (state.numDefense == 0 && numAttack > 0) {
            _planets[to].owner = attacker;
            _planets[to].exitTime = 0;
            _planets[to].numSpaceships = _setActiveNumSpaceships(state.active, numAttack);
            _planets[to].lastUpdated = uint32(block.timestamp);
            result.won = true;
            result.numSpaceships = numAttack;
            return result;
        }

        return _completeCombatResult(state, attacker, launchTime, to, numAttack, attack, defense);
    }

    struct PreCombatState {
        bool active;
        uint32 currentNumSpaceships;
        uint32 numDefense;
        uint64 flying1;
        uint64 destroyed1;
        uint64 flying2;
        uint64 destroyed2;
    }

    function _getPlanetPreCombatState(
        Planet memory toPlanet,
        uint256 to,
        uint16 production
    ) internal view returns (PreCombatState memory state) {
        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            toPlanet.numSpaceships,
            toPlanet.lastUpdated,
            production
        );

        (
            uint32 numDefense,
            uint64 flying1,
            uint64 destroyed1,
            uint64 flying2,
            uint64 destroyed2
        ) = computeDefenseWithInFlightFleets(currentNumSpaceships, to);
        state.active = active;
        state.currentNumSpaceships = currentNumSpaceships;
        state.numDefense = numDefense;
        state.flying1 = flying1;
        state.destroyed1 = destroyed1;
        state.flying2 = flying2;
        state.destroyed2 = destroyed2;
    }

    function computeDefenseWithInFlightFleets(uint32 numSpaceships, uint256 to)
        internal
        view
        returns (
            uint32 numDefense,
            uint64 flying1,
            uint64 destroyed1,
            uint64 flying2,
            uint64 destroyed2
        )
    {
        numDefense = numSpaceships;
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // consider fleets that just departed from the planet (used to prevent front-running, see fleet sending)
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        uint256 timeSlot = block.timestamp / (FRONT_RUNNING_DELAY / 2);
        flying1 = _inFlight[to][timeSlot - 1].flying;
        destroyed1 = _inFlight[to][timeSlot - 1].flying;
        flying2 = _inFlight[to][timeSlot].flying;
        destroyed2 = _inFlight[to][timeSlot].destroyed;
        numDefense = uint32(Math.min(flying1 + flying2 + numDefense, 2**32 - 1));
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
    }

    function _completeCombatResult(
        PreCombatState memory state,
        address attacker,
        uint32 launchTime,
        uint256 to,
        uint32 numAttack,
        uint16 attack,
        uint16 defense
    ) internal returns (FleetResult memory result) {
        uint32 attackerLoss;
        uint32 defenderLoss;
        if (launchTime > COMBAT_RULE_SWITCH_TIME) {
            (attackerLoss, defenderLoss) = _computeFight(numAttack, state.numDefense, attack, defense);
        } else {
            (attackerLoss, defenderLoss) = _old_computeFight(numAttack, state.numDefense, attack, defense);
        }
        result.attackerLoss = attackerLoss;
        result.defenderLoss = defenderLoss;

        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // consider fleets that just departed from the planet (used to prevent front-running, see fleet sending)
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        if (result.defenderLoss > state.currentNumSpaceships) {
            result.inFlightPlanetLoss = defenderLoss - state.currentNumSpaceships;
            result.defenderLoss = state.currentNumSpaceships;
            if (state.flying1 >= result.inFlightPlanetLoss) {
                state.flying1 -= result.inFlightPlanetLoss;
                state.destroyed1 += result.inFlightPlanetLoss;
            } else {
                state.destroyed1 += state.flying1;
                uint64 extra = (result.inFlightPlanetLoss - state.flying1);
                if (state.flying2 >= extra) {
                    state.flying2 -= extra;
                    state.destroyed2 += extra;
                } else {
                    state.destroyed2 += state.flying2;
                    state.flying2 = 0; // should never reach minus but let simply set it to zero
                }
                state.flying1 = 0;
            }
            _inFlight[to][block.timestamp / (FRONT_RUNNING_DELAY / 2) - 1].flying = state.flying1;
            _inFlight[to][block.timestamp / (FRONT_RUNNING_DELAY / 2) - 1].destroyed = state.destroyed1;
            _inFlight[to][block.timestamp / (FRONT_RUNNING_DELAY / 2)].flying = state.flying2;
            _inFlight[to][block.timestamp / (FRONT_RUNNING_DELAY / 2)].destroyed = state.destroyed2;
        }
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // (attackerLoss: 0, defenderLoss: 0) could either mean attack was zero or defense was zero :
        if (numAttack > 0 && result.defenderLoss == state.currentNumSpaceships) {
            result.numSpaceships = numAttack - attackerLoss;
            result.won = true;
            _planets[to].owner = attacker;
            _planets[to].exitTime = 0;
            _planets[to].numSpaceships = _setActiveNumSpaceships(state.active, result.numSpaceships);
            _planets[to].lastUpdated = uint32(block.timestamp);
        } else if (result.attackerLoss == numAttack) {
            // always true as if attack won it will be going in the "if" above
            result.numSpaceships = state.currentNumSpaceships - defenderLoss;
            _planets[to].numSpaceships = _setActiveNumSpaceships(state.active, result.numSpaceships);
            _planets[to].lastUpdated = uint32(block.timestamp);
        } else {
            assert(false); // should not happen
        }
    }

    function _performReinforcement(
        address sender,
        Planet memory toPlanet,
        uint256 to,
        uint32 quantity
    ) internal returns (FleetResult memory result) {
        if (_hasJustExited(toPlanet.exitTime)) {
            return _fleetAfterExit(to, toPlanet.owner, _planets[to], quantity > 0 ? sender : address(0), quantity);
        } else {
            bytes32 toPlanetData = _planetData(to);
            uint16 production = _production(toPlanetData);
            (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
                toPlanet.numSpaceships,
                toPlanet.lastUpdated,
                production
            );
            uint256 newNumSpaceships = currentNumSpaceships + quantity;
            if (newNumSpaceships >= ACTIVE_MASK) {
                newNumSpaceships = ACTIVE_MASK - 1;
            }
            _planets[to].lastUpdated = uint32(block.timestamp);
            _planets[to].numSpaceships = _setActiveNumSpaceships(active, uint32(newNumSpaceships));
            result.numSpaceships = uint32(newNumSpaceships);
        }
    }

    function _computeFight(
        uint256 numAttack,
        uint256 numDefense,
        uint256 attack,
        uint256 defense
    ) internal pure returns (uint32 attackerLoss, uint32 defenderLoss) {
        if (numAttack == 0 || numDefense == 0) {
            return (0, 0); // this edge case need to be considered, as the result of this function cannot tell from it whos is winning here
        }
        uint256 attackDamage = (numAttack * attack) / defense;

        if (numDefense > attackDamage) {
            // attack fails
            attackerLoss = uint32(numAttack); // all attack destroyed
            defenderLoss = uint32(attackDamage); // 1 spaceship will be left at least as attackDamage < numDefense
        } else {
            // attack succeed
            uint256 defenseDamage = uint32((numDefense * defense) / attack);
            if (defenseDamage >= numAttack) {
                defenseDamage = numAttack - 1; // ensure 1 spaceship left
            }

            attackerLoss = uint32(defenseDamage);
            defenderLoss = uint32(numDefense); // all defense destroyed
        }
    }

    function _old_computeFight(
        uint256 numAttack,
        uint256 numDefense,
        uint256 attack,
        uint256 defense
    ) internal pure returns (uint32 attackerLoss, uint32 defenderLoss) {
        if (numAttack == 0 || numDefense == 0) {
            return (0, 0);
        }
        uint256 attackPower = (numAttack * attack);
        uint256 defensePower = (numDefense * defense);

        uint256 numAttackRound = (numDefense * 100000000) / attackPower;
        if (numAttackRound * attackPower < (numDefense * 100000000)) {
            numAttackRound++;
        }
        uint256 numDefenseRound = (numAttack * 100000000) / defensePower;
        if (numDefenseRound * defensePower < (numAttack * 100000000)) {
            numDefenseRound++;
        }

        uint256 numRound = Math.min(numAttackRound, numDefenseRound);
        attackerLoss = uint32(Math.min((numRound * defensePower) / 100000000, numAttack));
        defenderLoss = uint32(Math.min((numRound * attackPower) / 100000000, numDefense));
    }

    function _checkDistance(
        uint256 distance,
        uint256 from,
        uint256 to
    ) internal view {
        (int8 fromSubX, int8 fromSubY) = _subLocation(_planetData(from));
        (int8 toSubX, int8 toSubY) = _subLocation(_planetData(to));
        // check input instead of compute sqrt
        uint256 distanceSquared = uint256( // check input instead of compute sqrt
            ((int128(to & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) * 4 + toSubX) -
                (int128(from & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) * 4 + fromSubX)) **
                2 +
                ((int128(to >> 128) * 4 + toSubY) - (int128(from >> 128) * 4 + fromSubY))**2
        );
        require(distance**2 <= distanceSquared && distanceSquared < (distance + 1)**2, "wrong distance");
    }

    function _checkTime(
        uint256 distance,
        uint256 from,
        uint32 launchTime
    ) internal view {
        uint256 reachTime = launchTime + (distance * (_timePerDistance * 10000)) / _speed(_planetData(from));
        require(block.timestamp >= reachTime, "too early");
        require(block.timestamp < reachTime + _resolveWindow, "too late, your spaceships are lost in space");
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // PLANET STATS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function _planetData(uint256 location) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(_genesis, location));
    }

    function _subLocation(bytes32 data) internal pure returns (int8 subX, int8 subY) {
        subX = int8(1 - data.value8Mod(0, 3));
        subY = int8(1 - data.value8Mod(2, 3));
    }

    // 4,5,5,10,10,15,15, 20, 20, 30,30,40,40,80,80,100
    bytes32 constant stakeRange = 0x000400050005000A000A000F000F00140014001E001E00280028005000500064;

    function _stake(bytes32 data) internal pure returns (uint16) {
        // return data.normal16(4, 0x000400050005000A000A000F000F00140014001E001E00280028005000500064);
        uint8 productionIndex = data.normal8(12); // production affect the stake value
        uint16 offset = data.normal16(4, 0x0000000100010002000200030003000400040005000500060006000700070008);
        uint16 stakeIndex = productionIndex + offset;
        if (stakeIndex < 4) {
            stakeIndex = 0;
        } else if (stakeIndex > 19) {
            stakeIndex = 15;
        } else {
            stakeIndex -= 4;
        }
        return uint16(uint8(stakeRange[stakeIndex * 2 + 1])); // skip stakeIndex * 2 + 0 as it is always zero in stakeRange
    }

    function _production(bytes32 data) internal pure returns (uint16) {
        // TODO TRY : 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4000,4400,4800,5400,6200,7200 ?

        // 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4200,5400,6600,7800,9000,12000
        // 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0
        return data.normal16(12, 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0); // per hour
    }

    function _attack(bytes32 data) internal pure returns (uint16) {
        return 4000 + data.normal8(20) * 400; // 4,000 - 7,000 - 10,000
    }

    function _defense(bytes32 data) internal pure returns (uint16) {
        return 4000 + data.normal8(28) * 400; // 4,000 - 7,000 - 10,000
    }

    function _speed(bytes32 data) internal pure returns (uint16) {
        return 5005 + data.normal8(36) * 333; // 5,005 - 7,502.5 - 10,000
    }

    function _natives(bytes32 data) internal pure returns (uint16) {
        return 15000 + data.normal8(44) * 3000; // 15,000 - 37,500 - 60,000
    }

    function _exists(bytes32 data) internal pure returns (bool) {
        return data.value8Mod(52, 16) == 1; // 16 => 36 so : 1 planet per 6 (=24 min unit) square
        // also:
        // 20000 average starting numSpaceships (or max?)
        // speed of min unit = 30 min ( 1 hour per square)
        // production : 20000 per 6 hours
        // exit : 3 days ? => 72 distance
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // GETTERS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function _getPlanet(uint256 location) internal view returns (Planet storage) {
        return _planets[location];
    }

    function _getPlanetStats(uint256 location) internal view returns (PlanetStats memory) {
        bytes32 data = _planetData(location);
        require(_exists(data), "no planet in this location");

        (int8 subX, int8 subY) = _subLocation(data);
        return
            PlanetStats({
                subX: subX,
                subY: subY,
                stake: _stake(data),
                production: _production(data),
                attack: _attack(data),
                defense: _defense(data),
                speed: _speed(data),
                natives: _natives(data)
            });
    }

    function _getCurrentNumSpaceships(
        uint32 numSpaceshipsData,
        uint256 lastUpdated,
        uint16 production
    ) internal view returns (bool active, uint32 currentNumSpaceships) {
        (active, currentNumSpaceships) = _activeNumSpaceships(numSpaceshipsData);
        if (active) {
            uint256 timePassed = block.timestamp - lastUpdated;
            uint256 newSpaceships = uint256(currentNumSpaceships) +
                (timePassed * uint256(production) * _productionSpeedUp) /
                1 hours;
            if (newSpaceships >= ACTIVE_MASK) {
                newSpaceships = ACTIVE_MASK - 1;
            }
            currentNumSpaceships = uint32(newSpaceships);
        }
    }

    // --------------------------------------------------------------------------------------------------------------------------------------------------------------
    // UTILS
    // --------------------------------------------------------------------------------------------------------------------------------------------------------------

    function _activeNumSpaceships(uint32 numSpaceshipsData) internal pure returns (bool active, uint32 numSpaceships) {
        active = (numSpaceshipsData & ACTIVE_MASK) == ACTIVE_MASK;
        numSpaceships = numSpaceshipsData % (ACTIVE_MASK);
    }

    function _setActiveNumSpaceships(bool active, uint32 numSpaceships) internal pure returns (uint32) {
        return uint32((active ? ACTIVE_MASK : 0) + numSpaceships);
    }

    function _msgSender() internal view returns (address) {
        return msg.sender; // TODO metatx
    }
}
