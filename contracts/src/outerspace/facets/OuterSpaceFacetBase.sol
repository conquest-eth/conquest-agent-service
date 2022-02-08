// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "../base/ImportingOuterSpaceTypes.sol";
import "../base/ImportingOuterSpaceConstants.sol";
import "../base/ImportingOuterSpaceEvents.sol";
import "../base/UsingOuterSpaceDataLayout.sol";

import "../../libraries/Extraction.sol";
import "../../libraries/Math.sol";

import "../../interfaces/IAlliance.sol";
import "../../alliances/AllianceRegistry.sol";

contract OuterSpaceFacetBase is
    ImportingOuterSpaceTypes,
    ImportingOuterSpaceConstants,
    ImportingOuterSpaceEvents,
    UsingOuterSpaceDataLayout
{
    using Extraction for bytes32;

    IERC20 internal immutable _stakingToken;
    AllianceRegistry internal immutable _allianceRegistry;
    bytes32 internal immutable _genesis;
    uint256 internal immutable _resolveWindow;
    uint256 internal immutable _timePerDistance;
    uint256 internal immutable _exitDuration;
    uint32 internal immutable _acquireNumSpaceships;
    uint32 internal immutable _productionSpeedUp;
    uint256 internal immutable _frontrunningDelay;
    uint256 internal immutable _productionCapAsDuration;
    uint256 internal immutable _fleetSizeFactor6;

    struct Config {
        IERC20 stakingToken;
        AllianceRegistry allianceRegistry;
        bytes32 genesis;
        uint256 resolveWindow;
        uint256 timePerDistance;
        uint256 exitDuration;
        uint32 acquireNumSpaceships;
        uint32 productionSpeedUp;
        uint256 frontrunningDelay;
        uint256 productionCapAsDuration;
        uint256 fleetSizeFactor6;
    }

    constructor(Config memory config) {
        uint32 t = uint32(config.timePerDistance) / 4; // the coordinates space is 4 times bigger
        require(t * 4 == config.timePerDistance, "TIME_PER_DIST_NOT_DIVISIBLE_4");

        _stakingToken = config.stakingToken;
        _allianceRegistry = config.allianceRegistry;
        _genesis = config.genesis;
        _resolveWindow = config.resolveWindow;
        _timePerDistance = t;
        _exitDuration = config.exitDuration;
        _acquireNumSpaceships = config.acquireNumSpaceships;
        _productionSpeedUp = config.productionSpeedUp;
        _frontrunningDelay = config.frontrunningDelay;
        _productionCapAsDuration = config.productionCapAsDuration;
        _fleetSizeFactor6 = config.fleetSizeFactor6;
    }

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

    // ---------------------------------------------------------------------------------------------------------------
    // STAKING / PRODUCTION CAPTURE
    // ---------------------------------------------------------------------------------------------------------------

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

        int256 x = int256(int128(int256(location & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)));
        int256 y = int256(int128(int256(location >> 128)));

        bool changes = false;
        if (x < 0) {
            require(-x <= int256(uint256(discovered.minX)), "NOT_REACHABLE_YET_MINX");
            x = -x + EXPANSION;
            if (x > UINT32_MAX) {
                x = UINT32_MAX;
            }
            if (int256(uint256(discovered.minX)) < x) {
                discovered.minX = uint32(uint256(x));
                changes = true;
            }
        } else {
            require(x <= int256(uint256(discovered.maxX)), "NOT_REACHABLE_YET_MAXX");
            x = x + EXPANSION;
            if (x > UINT32_MAX) {
                x = UINT32_MAX;
            }
            if (discovered.maxX < uint32(uint256(x))) {
                discovered.maxX = uint32(uint256(x));
                changes = true;
            }
        }

        if (y < 0) {
            require(-y <= int256(uint256(discovered.minY)), "NOT_REACHABLE_YET_MINY");
            y = -y + EXPANSION;
            if (y > UINT32_MAX) {
                y = UINT32_MAX;
            }
            if (int256(uint256(discovered.minY)) < y) {
                discovered.minY = uint32(uint256(y));
                changes = true;
            }
        } else {
            require(y <= int256(uint256(discovered.maxY)), "NOT_REACHABLE_YET_MAXY");
            y = y + EXPANSION;
            if (y > UINT32_MAX) {
                y = UINT32_MAX;
            }
            if (int256(uint256(discovered.maxY)) < y) {
                discovered.maxY = uint32(uint256(y));
                changes = true;
            }
        }
        if (changes) {
            _discovered = discovered;
        }
    }

    // ---------------------------------------------------------------------------------------------------------------
    // EXITS / WITHDRAWALS
    // ---------------------------------------------------------------------------------------------------------------

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

    // ---------------------------------------------------------------------------------------------------------------
    // FLEET SENDING
    // ---------------------------------------------------------------------------------------------------------------

    function _sendFor(
        uint256 fleetId,
        address operator,
        FleetLaunch memory launch
    ) internal {
        Planet storage planet = _getPlanet(launch.from);

        require(planet.exitTime == 0, "PLANET_EXIT");
        require(launch.fleetSender == planet.owner, "NOT_OWNER");

        bytes32 data = _planetData(launch.from);
        uint16 production = _production(data);

        (bool active, uint32 currentNumSpaceships) = _getCurrentNumSpaceships(
            planet.numSpaceships,
            planet.lastUpdated,
            production
        );
        require(currentNumSpaceships >= launch.quantity, "SPACESHIPS_NOT_ENOUGH");

        (uint32 launchTime, uint32 numSpaceships) = _computeSpaceshipBeforeSending(
            currentNumSpaceships,
            active,
            launch.from,
            launch.quantity
        );

        _fleets[fleetId] = Fleet({launchTime: launchTime, owner: launch.fleetOwner, quantity: launch.quantity});

        emit FleetSent(
            launch.fleetSender,
            launch.fleetOwner,
            launch.from,
            operator,
            fleetId,
            launch.quantity,
            numSpaceships
        );
    }

    function _computeSpaceshipBeforeSending(
        uint32 currentNumSpaceships,
        bool active,
        uint256 from,
        uint32 quantity
    ) internal returns (uint32 launchTime, uint32 numSpaceships) {
        Planet storage planet = _getPlanet(from);
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // record flying fleets (to prevent front-running, see resolution)
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        uint256 timeSlot = block.timestamp / (_frontrunningDelay / 2);
        uint64 flying = _inFlight[from][timeSlot].flying;
        flying = flying + quantity;
        require(flying >= quantity, "OVERFLOW"); // unlikely to ever happen, would need a hug amount of spaceships to be received and each in turn being sent
        _inFlight[from][timeSlot].flying = flying;
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------

        launchTime = uint32(block.timestamp); // TODO allow delay : launchTime in future
        numSpaceships = currentNumSpaceships - quantity;
        planet.numSpaceships = _setActiveNumSpaceships(active, numSpaceships);
        planet.lastUpdated = launchTime;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // FLEET RESOLUTION, ATTACK / REINFORCEMENT
    // ---------------------------------------------------------------------------------------------------------------

    struct FleetResult {
        uint32 inFlightPlanetLoss;
        uint32 attackerLoss;
        uint32 defenderLoss;
        bool won;
        uint32 numSpaceships;
    }

    function _resolveFleet(uint256 fleetId, FleetResolution memory resolution) internal {
        Fleet memory fleet = _fleets[fleetId];
        (uint32 quantity, uint32 inFlightFleetLoss) = _checkFleetAndComputeQuantityLeft(fleet, resolution);
        Planet memory toPlanet = _getPlanet(resolution.to);
        _resolveAndEmit(
            fleetId,
            toPlanet,
            _hasJustExited(toPlanet.exitTime) ? address(0) : toPlanet.owner,
            fleet,
            resolution,
            quantity,
            inFlightFleetLoss
        );
    }

    function _resolveAndEmit(
        uint256 fleetId,
        Planet memory toPlanet,
        address destinationOwner,
        Fleet memory fleet,
        FleetResolution memory resolution,
        uint32 quantity,
        uint32 inFlightFleetLoss
    ) internal {
        (bool gifting, bool taxed) = _checkGifting(fleet.owner, resolution, toPlanet, fleet.launchTime); // TODO fleet.owner or sender or origin (or seller) ?
        FleetResult memory result = _performResolution(
            fleet,
            resolution.from,
            toPlanet,
            resolution.to,
            gifting,
            taxed,
            quantity
        );
        emit_fleet_arrived(fleet.owner, fleetId, destinationOwner, resolution.to, gifting, result, inFlightFleetLoss);
        _fleets[fleetId].quantity = 0; // TODO quantity should be kept ? so Alliance Contract can act on that value ?, could use 1st bit indicator
    }

    // solhint-disable-next-line code-complexity
    function _checkGifting(
        address sender,
        FleetResolution memory resolution,
        Planet memory toPlanet,
        uint256 fleetLaunchTime
    ) internal view returns (bool gifting, bool taxed) {
        if (toPlanet.owner == address(0)) {
            // destination has no owner : this is an attack
            return (false, false);
        }
        if (toPlanet.owner == sender) {
            // destination is sender: this is a non-taxed gift
            return (true, false);
        }

        if (resolution.gift) {
            // intent was gift
            if (resolution.specific == address(0) || resolution.specific == toPlanet.owner) {
                // and it was for anyone or specific destination owner that is the same as the current one

                (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                    sender,
                    toPlanet.owner,
                    fleetLaunchTime
                );
                return (true, joinTime == 0 || joinTime > fleetLaunchTime);
            }

            if (resolution.specific == address(1)) {
                // or the specific specify any common alliances (1)

                (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                    sender,
                    toPlanet.owner,
                    fleetLaunchTime
                );
                return (joinTime > 0, joinTime > fleetLaunchTime);
            }

            if (uint160(resolution.specific) > 1) {
                // or a specific one that matches

                (uint96 joinTimeToSpecific, ) = _allianceRegistry.getAllianceData(
                    toPlanet.owner,
                    IAlliance(resolution.specific)
                );

                if (joinTimeToSpecific > 0) {
                    (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                        sender,
                        toPlanet.owner,
                        fleetLaunchTime
                    );
                    return (true, joinTime == 0 || joinTime > fleetLaunchTime);
                }
            }
        } else {
            // intent was attack
            if (resolution.specific == address(1)) {
                // and the attack was on any non-allies

                // make it a gift if the destination owner is actually an ally
                (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                    sender,
                    toPlanet.owner,
                    fleetLaunchTime
                );
                return (joinTime > 0, joinTime > fleetLaunchTime);
            }

            if (uint160(resolution.specific) > 1 && resolution.specific != toPlanet.owner) {
                // but specific not matching current owner

                (uint96 joinTimeToSpecific, ) = _allianceRegistry.getAllianceData(
                    toPlanet.owner,
                    IAlliance(resolution.specific)
                );

                // make it a gift if the destination is not matching the specific alliance (or owner, in which case since it is not an alliance, it will also not match)
                if (joinTimeToSpecific == 0) {
                    (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                        sender,
                        toPlanet.owner,
                        fleetLaunchTime
                    );
                    return (true, joinTime == 0 || joinTime > fleetLaunchTime);
                }
            }
        }
    }

    function _performResolution(
        Fleet memory fleet,
        uint256 from,
        Planet memory toPlanet,
        uint256 to,
        bool gifting,
        bool taxed,
        uint32 quantity
    ) internal returns (FleetResult memory result) {
        if (gifting) {
            return _performReinforcement(fleet.owner, toPlanet, to, quantity, taxed, fleet.launchTime);
        } else {
            return _performAttack(fleet.owner, fleet.launchTime, from, toPlanet, to, quantity);
        }
    }

    function _checkFleetAndComputeQuantityLeft(Fleet memory fleet, FleetResolution memory resolution)
        internal
        returns (uint32 quantity, uint32 inFlightFleetLoss)
    {
        quantity = fleet.quantity;
        require(quantity > 0, "FLEET_DO_NOT_EXIST");

        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        // check if fleet was attacked while departing (used to prevent front-running, see fleet sending)
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------
        quantity = _fleet_flying_at_origin(quantity, resolution.from, fleet.launchTime);
        inFlightFleetLoss = fleet.quantity - quantity;
        // ----------------------------------------------------------------------------------------------------------------------------------------------------------

        _checkDistance(resolution.distance, resolution.from, resolution.to);
        _checkTime(resolution.distance, resolution.from, fleet.launchTime);
    }

    function emit_fleet_arrived(
        address fleetOwner,
        uint256 fleetID,
        address toOwner,
        uint256 to,
        bool gift,
        FleetResult memory result,
        uint32 inFlightFleetLoss
    ) internal {
        emit FleetArrived(
            fleetID,
            fleetOwner,
            toOwner,
            to,
            gift,
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
        uint256 timeSlot = launchTime / (_frontrunningDelay / 2);
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
        address newOwner,
        uint32 numSpaceshipsArrived
    ) internal returns (FleetResult memory result) {
        _setPlanetAfterExit(to, owner, planet, numSpaceshipsArrived > 0 ? newOwner : address(0), numSpaceshipsArrived);
        result.numSpaceships = numSpaceshipsArrived;
        result.won = numSpaceshipsArrived > 0; // TODO does it make sense if reinforcement ?
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
        // TODO accumulate attacks in succession (30 min - 2h) so that attack arriving at the same time get combined in one big fleet
        // basically store the last attack (fleet amount destroyed, amount destroyed on the defending planet, timestamp)
        // retrieve that , add fleet amount destroyed to new attacking fleet quantity, perform the attack as if it was happening now, but recuded previously destroyed amount to that attack
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
        uint256 timeSlot = block.timestamp / (_frontrunningDelay / 2);
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
            _inFlight[to][block.timestamp / (_frontrunningDelay / 2) - 1].flying = state.flying1;
            _inFlight[to][block.timestamp / (_frontrunningDelay / 2) - 1].destroyed = state.destroyed1;
            _inFlight[to][block.timestamp / (_frontrunningDelay / 2)].flying = state.flying2;
            _inFlight[to][block.timestamp / (_frontrunningDelay / 2)].destroyed = state.destroyed2;
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
        uint32 quantity,
        bool taxed,
        uint32 launchTime
    ) internal returns (FleetResult memory result) {
        if (_hasJustExited(toPlanet.exitTime)) {
            address newOwner = toPlanet.owner;
            if (newOwner == address(0)) {
                newOwner = sender;
            }
            return _fleetAfterExit(to, toPlanet.owner, _planets[to], quantity > 0 ? newOwner : address(0), quantity);
        } else {
            if (taxed) {
                quantity = uint32(uint256(quantity) - (uint256(quantity) * GIFT_TAX_PER_10000) / 10000);
            }
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
    ) internal view returns (uint32 attackerLoss, uint32 defenderLoss) {
        if (numAttack == 0 || numDefense == 0) {
            return (0, 0); // this edge case need to be considered, as the result of this function cannot tell from it whos is winning here
        }

        uint256 attackFactor = numAttack *
            ((1000000 - _fleetSizeFactor6) + ((_fleetSizeFactor6 * numAttack) / numDefense));
        uint256 attackDamage = (attackFactor * attack) / defense / 1000000;

        if (numDefense > attackDamage) {
            // attack fails
            attackerLoss = uint32(numAttack); // all attack destroyed
            defenderLoss = uint32(attackDamage); // 1 spaceship will be left at least as attackDamage < numDefense
        } else {
            // attack succeed
            uint256 defenseFactor = numDefense *
                ((1000000 - _fleetSizeFactor6) + ((_fleetSizeFactor6 * numDefense) / numAttack));
            uint256 defenseDamage = uint32((defenseFactor * defense) / attack / 1000000);

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

        uint256 distanceSquared = uint256(
            int256( // check input instead of compute sqrt
                ((int128(int256(to & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) * 4 + toSubX) -
                    (int128(int256(from & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) * 4 + fromSubX)) **
                    2 +
                    ((int128(int256(to >> 128)) * 4 + toSubY) - (int128(int256(from >> 128)) * 4 + fromSubY))**2
            )
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

    // ---------------------------------------------------------------------------------------------------------------
    // PLANET STATS
    // ---------------------------------------------------------------------------------------------------------------

    function _planetData(uint256 location) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(_genesis, location));
    }

    function _subLocation(bytes32 data) internal pure returns (int8 subX, int8 subY) {
        subX = 1 - int8(data.value8Mod(0, 3));
        subY = 1 - int8(data.value8Mod(2, 3));
    }

    // // 4,5,5,10,10,15,15, 20, 20, 30,30,40,40,80,80,100
    // bytes32 constant stakeRange = 0x000400050005000A000A000F000F00140014001E001E00280028005000500064;

    // 6, 8, 10, 12, 14, 16, 18, 20, 20, 22, 24, 32, 40, 48, 56, 72
    bytes32 constant stakeRange = 0x00060008000A000C000E00100012001400140016001800200028003000380048;

    function _stake(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        // return data.normal16(4, 0x000400050005000A000A000F000F00140014001E001E00280028005000500064);
        uint8 productionIndex = data.normal8(12); // production affect the stake value

        // TODO remove or decide otherwise:
        // uint16 offset = data.normal16(4, 0x0000000100010002000200030003000400040005000500060006000700070008);
        // uint16 stakeIndex = productionIndex + offset;
        // if (stakeIndex < 4) {
        //     stakeIndex = 0;
        // } else if (stakeIndex > 19) {
        //     stakeIndex = 15;
        // } else {
        //     stakeIndex -= 4;
        // }
        uint16 stakeIndex = productionIndex;
        return uint16(uint8(stakeRange[stakeIndex * 2 + 1])); // skip stakeIndex * 2 + 0 as it is always zero in stakeRange
    }

    function _production(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        // TODO TRY : 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4000,4400,4800,5400,6200,7200 ?

        // 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4200,5400,6600,7800,9000,12000
        // 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0
        return data.normal16(12, 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0); // per hour
    }

    function _attack(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 4000 + data.normal8(20) * 400; // 4,000 - 7,000 - 10,000
    }

    function _defense(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 4000 + data.normal8(28) * 400; // 4,000 - 7,000 - 10,000
    }

    function _speed(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 5005 + data.normal8(36) * 333; // 5,005 - 7,502.5 - 10,000
    }

    function _natives(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
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

    // ---------------------------------------------------------------------------------------------------------------
    // GETTERS
    // ---------------------------------------------------------------------------------------------------------------

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

        uint256 maxIncrease = ACTIVE_MASK - 1;
        uint256 timePassed = block.timestamp - lastUpdated;
        uint256 newSpaceships = currentNumSpaceships;
        if (_productionCapAsDuration > 0) {
            uint256 decrease = 0;
            uint256 cap = _acquireNumSpaceships + (_productionCapAsDuration * uint256(production)) / 1 hours;
            if (currentNumSpaceships > cap) {
                decrease = (timePassed * 1800) / 3600; // 1800 per hours
                if (decrease > currentNumSpaceships - cap) {
                    decrease = currentNumSpaceships - cap;
                }
                maxIncrease = 0;
            } else {
                maxIncrease = cap - currentNumSpaceships;
            }

            if (active) {
                uint256 increase = (timePassed * uint256(production) * _productionSpeedUp) / 1 hours;
                if (increase > maxIncrease) {
                    increase = maxIncrease;
                }
                newSpaceships += increase;
            }

            if (decrease > newSpaceships) {
                newSpaceships = 0; // not possible
            } else {
                newSpaceships -= decrease;
            }
        } else if (active) {
            newSpaceships += (timePassed * uint256(production) * _productionSpeedUp) / 1 hours;
        }

        if (newSpaceships >= ACTIVE_MASK) {
            newSpaceships = ACTIVE_MASK - 1;
        }
        currentNumSpaceships = uint32(newSpaceships);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // UTILS
    // ---------------------------------------------------------------------------------------------------------------

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
