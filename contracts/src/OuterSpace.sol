// SPDX-License-Identifier: AGPL-1.0

pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Libraries/Extraction.sol";
import "./Libraries/Math.sol";
import "hardhat-deploy/solc_0.7/proxy/Proxied.sol";

import "hardhat/console.sol";

// TODO transfer Planet ?
// cons:
// - allow a player to easily have multiple address hiding its true potential

contract OuterSpace is Proxied {
    using Extraction for bytes32;

    uint256 internal constant STAKE_MULTIPLIER = 5e18; // = 5 DAI min
    uint32 internal constant ACTIVE_MASK = 2**31;
    int256 internal constant UINT32_MAX = 2**32 - 1;

    bytes32 internal immutable _genesis;
    IERC20 internal immutable _stakingToken;
    uint256 internal immutable _resolveWindow;
    uint256 internal immutable _timePerDistance;
    uint256 internal immutable _exitDuration;

    mapping(uint256 => Planet) internal _planets;
    mapping(uint256 => Fleet) internal _fleets;

    mapping(address => uint256) internal _stakeReadyToBeWithdrawn;

    mapping(address => mapping(address => bool)) internal _operators;

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
    }

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

    event PlanetExit(address indexed owner, uint256 indexed location);

    event StakeToWithdraw(address indexed owner, uint256 newStake);

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

        postUpgrade(stakingToken, genesis, resolveWindow, timePerDistance, exitDuration);
    }

    function postUpgrade(
        IERC20,
        bytes32,
        uint16,
        uint16,
        uint16
    ) public proxied {
        if (_discovered.minX == 0) {
            _discovered = Discovered({minX: 12, maxX: 12, minY: 12, maxY: 12});
        }
    }

    function onTokenTransfer(
        address from,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        require(msg.sender == address(_stakingToken), "INVALID_ERC20");
        uint256 location = abi.decode(data, (uint256));
        _acquire(from, amount, location);
        return true;
    }

    function acquireViaTransferFrom(uint256 location, uint256 amount) public {
        address sender = _msgSender();
        _acquire(sender, amount, location);
        _stakingToken.transferFrom(sender, address(this), amount);
    }

    // function acquir
    // if (msg.value > 0) {
    // TODO in playerVault ?
    // uint256[] memory amounts = _uniswapV2Router01.swapExactETHForTokens{value:msg.value}(stakeAmount, [_weth, _stakingToken], _vault, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
    // if (amounts[1] > stakeAmount) {
    //     _stakingToken.transfer(sender, amounts[1] - stakeAmount); // TODO send to Player Account (via PaymentGateway)
    // }

    function _acquire(
        address sender,
        uint256 paidFor,
        uint256 location
    ) internal {
        console.logBytes32(bytes32(location));
        bytes32 data = _planetData(location);
        require(paidFor == uint256(_stake(data)) * (STAKE_MULTIPLIER), "INVALID_AMOUNT");

        _handleSpaceships(sender, location, data);
        _handleDiscovery(location);
    }

    function _handleSpaceships(
        address sender,
        uint256 location,
        bytes32 data
    ) internal {
        Planet storage planet = _getPlanet(location);
        address owner = planet.owner;
        uint32 lastUpdated = planet.lastUpdated;
        uint32 numSpaceshipsData = planet.numSpaceships;
        uint32 exitTime = planet.exitTime;

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            numSpaceshipsData,
            lastUpdated,
            _production(data)
        );

        bool justExited;
        uint32 defense;
        if (lastUpdated == 0) {
            uint16 natives = _natives(data);
            defense = natives;
        } else {
            if (exitTime != 0) {
                require(_hasJustExited(exitTime), "STILL_EXITING");
                justExited = true;
            } else {
                require(!active, "STILL_ACTIVE");
                if (owner != sender) {
                    defense = currentNumSpaceships; // TODO natives ?
                    require(defense <= 3500, "defense spaceship > 3500"); // you can first attack the planet
                } else {
                    defense = 0;
                }
            }
        }
        if (justExited) {
            currentNumSpaceships = 3600;
            _setPlanetAfterExit(location, owner, planet, sender, _setActiveNumSpaceships(true, currentNumSpaceships));
        } else {
            planet.owner = sender;
            if (defense != 0) {
                (uint32 attackerLoss, ) = _computeFight(3600, defense, 10000, _natives(data)); // attacker alwasy win as defense (and stats.native) is restricted to 3500
                currentNumSpaceships = 3600 - attackerLoss;
            } else {
                currentNumSpaceships += 3600;
            }

            // planet.exitTime = 0; // should not be needed : // TODO actualiseExit
            planet.numSpaceships = _setActiveNumSpaceships(true, currentNumSpaceships);
            planet.lastUpdated = uint32(block.timestamp);
        }
        emit PlanetStake(sender, location, currentNumSpaceships);
    }

    function exitFor(address owner, uint256 location) external {
        Planet storage planet = _getPlanet(location);
        require(owner == planet.owner, "NOT_OWNER");
        require(planet.exitTime == 0, "EXITING_ALREADY"); // if you own the planet again, you ll need to first withdraw
        planet.exitTime = uint32(block.timestamp);
        emit PlanetExit(owner, location);
    }

    // TODO optimize with minmal touch of _stakeReadyToBeWithdrawn (so it can happen in memory only, _stakeReadyToBeWithdrawn could be zero and remaim zero)
    function fetchAndWithdrawFor(address owner, uint256[] calldata locations) external {
        for (uint256 i = 0; i < locations.length; i++) {
            Planet storage planet = _getPlanet(locations[i]);
            if (_hasJustExited(planet.exitTime)) {
                require(owner == planet.owner, "NOT_OWNER");
                _setPlanetAfterExit(locations[i], owner, planet, address(0), 0); // no need of event as exitTime passed basically mean owner zero and spaceships zero
            }
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
        uint256 from,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) external {
        _resolveFleetFor(_msgSender(), fleetId, from, to, distance, secret);
    }

    function resolveFleetFor(
        address attacker,
        uint256 fleetId,
        uint256 from,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) external {
        address sender = _msgSender();
        if (sender != attacker) {
            require(_operators[attacker][sender], "NOT_AUTHORIZED");
        }
        _resolveFleetFor(attacker, fleetId, from, to, distance, secret);
    }

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

    function getFleet(uint256 fleetId)
        external
        view
        returns (
            address owner,
            uint32 launchTime,
            uint32 quantity
        )
    {
        launchTime = _fleets[fleetId].launchTime;
        quantity = _fleets[fleetId].quantity;
        owner = _fleets[fleetId].owner;
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
    }

    function getPlanet(uint256 location) external view returns (ExternalPlanet memory state, PlanetStats memory stats) {
        Planet storage planet = _getPlanet(location);
        (bool active, uint32 numSpaceships) = _activeNumSpaceships(planet.numSpaceships);
        state = ExternalPlanet({
            owner: planet.owner,
            exitTime: planet.exitTime,
            numSpaceships: numSpaceships,
            lastUpdated: planet.lastUpdated,
            active: active
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
                active: active
            });
        }
        discovered = _discovered;
    }

    function getDiscovered() external view returns (Discovered memory) {
        return _discovered;
    }

    // ////////////// EIP721 /////////////////// // TODO ?

    // function transfer() // TODO EIP-721 ?

    function setApprovalForAll(address operator, bool approved) external {
        address sender = _msgSender();
        _operators[sender][operator] = approved;
        emit ApprovalForAll(sender, operator, approved);
    }

    // ///////////////// INTERNALS ////////////////////

    // function _actualiseExit(uint256 location) internal {
    //     Planet storage planet = _getPlanet(location);
    //     if (planet.exitTime > 0 && block.timestamp > planet.exitTime + _exitDuration) {
    //         uint16 stake = _stake(location);
    //         address owner = planet.owner;
    //         planet.exitTime = 0;
    //         planet.owner = address(0); // This is fine as long as _actualiseExit is called on every move
    //         planet.numSpaceships = 0; // This is fine as long as _actualiseExit is called on every move
    //         planet.lastUpdated = uint32(block.timestamp); // This is fine as long as _actualiseExit is called on every move
    //         _stakeReadyToBeWithdrawn[owner] += stake * STAKE_MULTIPLIER;
    //     }
    // }

    // solhint-disable-next-line code-complexity
    function _handleDiscovery(uint256 location) internal {
        Discovered memory discovered = _discovered;
        int256 x = int256(int128(location & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF));
        int256 y = int256(int128(location >> 128));
        bool changes = false;
        if (x < 0) {
            require(-x <= discovered.minX, "NOT_REACHABLE_YET_MINX");
            x = -x + 6;
            if (x > UINT32_MAX) {
                x = UINT32_MAX;
            }
            if (discovered.minX < uint32(x)) {
                discovered.minX = uint32(x);
                changes = true;
            }
        } else {
            require(x <= discovered.maxX, "NOT_REACHABLE_YET_MAXX");
            x = x + 6;
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
            y = -y + 6;
            if (y > UINT32_MAX) {
                y = UINT32_MAX;
            }
            if (discovered.minY < uint32(y)) {
                discovered.minY = uint32(y);
                changes = true;
            }
        } else {
            require(y <= discovered.maxY, "NOT_REACHABLE_YET_MAXY");
            y = y + 6;
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
        bytes32 data = _planetData(location);
        uint16 stake = _stake(data);
        planet.exitTime = 0;
        planet.owner = newOwner; // This is fine as long as _actualiseExit is called on every move
        planet.lastUpdated = uint32(block.timestamp); // This is fine as long as _actualiseExit is called on every move
        planet.numSpaceships = spaceshipsData;
        uint256 newStake = _stakeReadyToBeWithdrawn[owner] + stake * STAKE_MULTIPLIER;
        _stakeReadyToBeWithdrawn[owner] = newStake;
        emit StakeToWithdraw(owner, newStake);
    }

    function _activeNumSpaceships(uint32 numSpaceshipsData) internal pure returns (bool active, uint32 numSpaceships) {
        active = (numSpaceshipsData & ACTIVE_MASK) == ACTIVE_MASK;
        numSpaceships = numSpaceshipsData % (ACTIVE_MASK);
    }

    function _setActiveNumSpaceships(bool active, uint32 numSpaceships) internal pure returns (uint32) {
        return uint32((active ? ACTIVE_MASK : 0) + numSpaceships);
    }

    function _sendFor(
        address owner,
        uint256 from,
        uint32 quantity,
        bytes32 toHash
    ) internal {
        Planet storage planet = _getPlanet(from);

        require(planet.exitTime == 0, "PLANET_EXIT"); // TODO never revert, update state and emit Error event ?

        require(owner == planet.owner, "not owner of the planet");

        bytes32 data = _planetData(from);
        uint16 production = _production(data);

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            planet.numSpaceships,
            planet.lastUpdated,
            production
        );
        require(currentNumSpaceships >= quantity, "not enough spaceships");
        uint32 launchTime = uint32(block.timestamp);
        uint32 numSpaceships = currentNumSpaceships - quantity;
        planet.numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
        planet.lastUpdated = launchTime;

        uint256 fleetId = uint256(keccak256(abi.encodePacked(toHash, from)));
        _fleets[fleetId] = Fleet({launchTime: launchTime, owner: owner, quantity: quantity});

        emit FleetSent(owner, from, fleetId, quantity, numSpaceships);
    }

    function _resolveFleetFor(
        address attacker,
        uint256 fleetId,
        uint256 from,
        uint256 to,
        uint256 distance,
        bytes32 secret
    ) internal {
        Fleet memory fleet = _fleets[fleetId];
        require(attacker == fleet.owner, "not owner of fleet");

        require(
            uint256(keccak256(abi.encodePacked(keccak256(abi.encodePacked(secret, to)), from))) == fleetId,
            "invalid 'to', 'from' or 'secret'"
        );

        require(fleet.quantity > 0, "no more");

        Planet memory toPlanet = _getPlanet(to);

        uint16 production = _production(_planetData(to));

        _checkDistance(distance, from, to);
        _checkTime(distance, from, fleet.launchTime);

        if (toPlanet.owner == attacker) {
            _performReinforcement(attacker, toPlanet, to, production, fleetId, fleet.quantity);
        } else {
            _performAttack(attacker, from, toPlanet, to, production, fleetId, fleet.quantity);
        }
        _fleets[fleetId].quantity = 0; // TODO reset all to get gas refund?
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

    function _getPlanet(uint256 location) internal view returns (Planet storage) {
        return _planets[location];
    }

    // ------------------------- PLANET STATS -------------------------------
    function _planetData(uint256 location) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(_genesis, location));
    }

    function _subLocation(bytes32 data) internal pure returns (int8 subX, int8 subY) {
        subX = int8(1 - data.value8Mod(0, 3));
        subY = int8(1 - data.value8Mod(2, 3));
    }

    function _stake(bytes32 data) internal pure returns (uint16) {
        return data.normal16(4, 0x0001000200030004000500070009000A000A000C000F00140019001E00320064); //_genesis.r_u256_minMax(location, 3, 10**18, 1000**18),
    }

    function _production(bytes32 data) internal pure returns (uint16) {
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
        return 2000 + (data.normal8(44) * uint16(100)); // 2,000 - 2,750 - 3,500
    }

    function _exists(bytes32 data) internal pure returns (bool) {
        return data.value8Mod(52, 16) == 1; // 16 => 36 so : 1 planet per 6 (=24 min unit) square
        // also:
        // 20000 average starting numSpaceships (or max?)
        // speed of min unit = 30 min ( 1 hour per square)
        // production : 20000 per 6 hours
        // exit : 3 days ? => 72 distance
    }

    // ---------------------------------------------------------------------

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
        uint256 numAttack,
        uint256 numDefense,
        uint256 attack,
        uint256 defense
    ) internal pure returns (uint32 attackerLoss, uint32 defenderLoss) {
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

    function _performAttack(
        address attacker,
        uint256 from,
        Planet memory toPlanet,
        uint256 to,
        uint16 production,
        uint256 fleetId,
        uint32 numAttack
    ) internal {
        bytes32 toData = _planetData(to);
        if (toPlanet.lastUpdated == 0) {
            uint16 attack = _attack(_planetData(from));
            uint16 defense = _defense(toData);
            // TODO revisit : allow partial destruction of natives ? => does not count as discovered ? (if not how do we detect it ?)
            // probably better to keep native untouched : detect that on frontend to not trigger this
            uint16 natives = _natives(toData);
            (uint32 attackerLoss, uint32 defenderLoss) = _computeFight(numAttack, natives, attack, defense); // TODO compute fight like acquire (update)
            if (defenderLoss == natives && numAttack > attackerLoss) {
                uint32 numSpaceships = numAttack - attackerLoss;
                _planets[to].numSpaceships = _setActiveNumSpaceships(false, numSpaceships);
                _planets[to].lastUpdated = uint32(block.timestamp);
                _planets[to].owner = attacker;
                emit Attack(attacker, fleetId, to, attackerLoss, defenderLoss, true, numSpaceships);
            } else {
                emit Attack(attacker, fleetId, to, attackerLoss, 0, false, 0);
            }
        } else if (_hasJustExited(toPlanet.exitTime)) {
            _setPlanetAfterExit(to, toPlanet.owner, _planets[to], attacker, numAttack);
            emit FleetArrived(attacker, fleetId, to, numAttack);
        } else {
            uint16 attack = _attack(_planetData(from));
            uint16 defense = _defense(toData);
            _actualAttack(attacker, attack, defense, toPlanet, to, production, fleetId, numAttack);
        }
    }

    function _actualAttack(
        address attacker,
        uint16 attack,
        uint16 defense,
        Planet memory toPlanet,
        uint256 to,
        uint16 production,
        uint256 fleetId,
        uint32 numAttack
    ) internal {
        (bool active, uint32 numDefense) = _getCurrentNumSpaceships(
            toPlanet.numSpaceships,
            toPlanet.lastUpdated,
            production
        );

        (uint32 attackerLoss, uint32 defenderLoss) = _computeFight(numAttack, numDefense, attack, defense);

        if (attackerLoss == numAttack) {
            uint32 numSpaceships = numDefense - defenderLoss;
            _planets[to].numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
            _planets[to].lastUpdated = uint32(block.timestamp);
            emit Attack(attacker, fleetId, to, attackerLoss, defenderLoss, false, numSpaceships);
        } else if (defenderLoss == numDefense) {
            uint32 numSpaceships = numAttack - attackerLoss;
            _planets[to].owner = attacker;
            _planets[to].exitTime = 0;
            _planets[to].numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
            _planets[to].lastUpdated = uint32(block.timestamp);
            emit Attack(attacker, fleetId, to, attackerLoss, defenderLoss, true, numSpaceships);
        } else {
            revert("nobody won"); // should not happen
        }
    }

    function _performReinforcement(
        address sender,
        Planet memory toPlanet,
        uint256 to,
        uint16 production,
        uint256 fleetId,
        uint32 quantity
    ) internal {
        if (_hasJustExited(toPlanet.exitTime)) {
            _setPlanetAfterExit(to, toPlanet.owner, _planets[to], sender, quantity);
            emit FleetArrived(sender, fleetId, to, quantity);
        } else {
            (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
                toPlanet.numSpaceships,
                toPlanet.lastUpdated,
                production
            );
            uint256 newNumSpaceships = currentNumSpaceships + quantity;
            if (newNumSpaceships >= ACTIVE_MASK) {
                newNumSpaceships = ACTIVE_MASK - 1;
            }
            _planets[to].numSpaceships = _setActiveNumSpaceships(active, uint32(newNumSpaceships));
            emit FleetArrived(sender, fleetId, to, uint32(newNumSpaceships));
        }
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
