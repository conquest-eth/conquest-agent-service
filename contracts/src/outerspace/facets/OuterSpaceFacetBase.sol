// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "../types/ImportingOuterSpaceTypes.sol";
import "../base/ImportingOuterSpaceConstants.sol";
import "../events/ImportingOuterSpaceEvents.sol";
import "../base/UsingOuterSpaceDataLayout.sol";

import "../../libraries/Extraction.sol";
import "../../libraries/Math.sol";

import "../../interfaces/IAlliance.sol";
import "../../alliances/AllianceRegistry.sol";

// TODO Remove
//  import "hardhat/console.sol";

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
    uint32 internal immutable _acquireNumSpaceships; // TODO use uint256
    uint32 internal immutable _productionSpeedUp; // TODO use uint256
    uint256 internal immutable _frontrunningDelay;
    uint256 internal immutable _productionCapAsDuration;
    uint256 internal immutable _upkeepProductionDecreaseRatePer10000th;
    uint256 internal immutable _fleetSizeFactor6;
    uint32 internal immutable _expansionDelta; // = 8;  // TODO use uint256
    uint256 internal immutable _giftTaxPer10000; // = 2500;

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
        uint256 upkeepProductionDecreaseRatePer10000th;
        uint256 fleetSizeFactor6;
        uint32 expansionDelta;
        uint256 giftTaxPer10000;
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
        _upkeepProductionDecreaseRatePer10000th = config.upkeepProductionDecreaseRatePer10000th;
        _fleetSizeFactor6 = config.fleetSizeFactor6;
        _expansionDelta = config.expansionDelta;
        _giftTaxPer10000 = config.giftTaxPer10000;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // PLANET STATE
    // ---------------------------------------------------------------------------------------------------------------

    struct PlanetUpdateState {
        uint256 location;
        uint40 lastUpdated;
        bool active; // modified
        uint32 numSpaceships; // modified
        int40 travelingUpkeep; // modified
        uint40 exitStartTime;
        uint40 newExitStartTime; // modified
        uint32 overflow; // modified
        address owner;
        address newOwner; // modified
        bytes32 data;
        uint24 futureExtraProduction;
    }

    function _createPlanetUpdateState(Planet memory planet, uint256 location)
        internal
        view
        returns (PlanetUpdateState memory planetUpdate)
    {
        (bool active, uint32 currentNumSpaceships) = _activeNumSpaceships(planet.numSpaceships);
        planetUpdate.location = location;
        planetUpdate.lastUpdated = planet.lastUpdated;
        planetUpdate.active = active;
        planetUpdate.numSpaceships = currentNumSpaceships;
        planetUpdate.travelingUpkeep = planet.travelingUpkeep;
        planetUpdate.exitStartTime = planet.exitStartTime;
        planetUpdate.newExitStartTime = planet.exitStartTime;
        planetUpdate.overflow = planet.overflow;
        planetUpdate.owner = planet.owner;
        planetUpdate.newOwner = planet.owner;
        planetUpdate.data = _planetData(location);
    }

    // solhint-disable-next-line code-complexity
    function _computePlanetUpdateForTimeElapsed(PlanetUpdateState memory planetUpdate) internal view {
        if (planetUpdate.exitStartTime != 0) {
            if (_hasJustExited(planetUpdate.exitStartTime)) {
                planetUpdate.newExitStartTime = 0;
                planetUpdate.numSpaceships = 0;
                planetUpdate.travelingUpkeep = 0;
                planetUpdate.newOwner = address(0);
                planetUpdate.overflow = 0;
                planetUpdate.active = false; // event is emitted at the endof each write function
                // lastUpdated is set at the end directly on storage
                return;
            }
        }

        uint256 timePassed = block.timestamp - planetUpdate.lastUpdated;
        uint16 production = _production(planetUpdate.data);
        uint256 produce = (timePassed * uint256(_productionSpeedUp) * uint256(production)) / 1 hours;

        // NOTE: the repaypemnt of upkeep always happen at a fixed rate (per planet), it is fully predictable
        uint256 upkeepRepaid = 0;
        if (planetUpdate.travelingUpkeep > 0) {
            upkeepRepaid = ((produce * _upkeepProductionDecreaseRatePer10000th) / 10000);
            if (upkeepRepaid > uint40(planetUpdate.travelingUpkeep)) {
                upkeepRepaid = uint40(planetUpdate.travelingUpkeep);
            }
            planetUpdate.travelingUpkeep = planetUpdate.travelingUpkeep - int40(uint40(upkeepRepaid));
        }

        uint256 newNumSpaceships = planetUpdate.numSpaceships;
        uint256 extraUpkeepPaid = 0;
        if (_productionCapAsDuration > 0) {
            uint256 capWhenActive = _capWhenActive(production);
            uint256 cap = planetUpdate.active ? capWhenActive : 0;

            if (newNumSpaceships > cap) {
                uint256 decreaseRate = 1800;
                if (planetUpdate.overflow > 0) {
                    decreaseRate = (uint256(planetUpdate.overflow) * 1800) / capWhenActive;
                    if (decreaseRate < 1800) {
                        decreaseRate = 1800;
                    }
                }

                uint256 decrease = (timePassed * uint256(_productionSpeedUp) * decreaseRate) / 1 hours;
                if (decrease > newNumSpaceships - cap) {
                    decrease = newNumSpaceships - cap;
                }
                if (decrease > newNumSpaceships) {
                    if (planetUpdate.active) {
                        extraUpkeepPaid = produce - upkeepRepaid + newNumSpaceships;
                    }
                    newNumSpaceships = 0;
                } else {
                    if (planetUpdate.active) {
                        extraUpkeepPaid = produce - upkeepRepaid + decrease;
                    }
                    newNumSpaceships -= decrease;
                }
            } else {
                if (planetUpdate.active) {
                    uint256 maxIncrease = cap - newNumSpaceships;
                    uint256 increase = produce - upkeepRepaid;
                    if (increase > maxIncrease) {
                        extraUpkeepPaid = increase - maxIncrease;
                        increase = maxIncrease;
                    }
                    newNumSpaceships += increase;
                    // solhint-disable-next-line no-empty-blocks
                } else {
                    // not effect currently, when inactive, cap == 0, meaning zero spaceship here
                    // NOTE: we could do the following assuming we act on upkeepRepaid when inactive, we do not do that currently
                    //  extraUpkeepPaid = produce - upkeepRepaid;
                }
            }

            if (planetUpdate.active) {
                // travelingUpkeep can go negative allow you to charge up your planet for later use
                int256 newTravelingUpkeep = int256(planetUpdate.travelingUpkeep) - int256(extraUpkeepPaid);

                if (newTravelingUpkeep < -int256(cap)) {
                    newTravelingUpkeep = -int256(cap);
                }
                planetUpdate.travelingUpkeep = int40(newTravelingUpkeep);
            }
        } else {
            // TODO We are not using this branch, and in that branch there is no upkeep or overflow to consider
            if (planetUpdate.active) {
                newNumSpaceships +=
                    (timePassed * uint256(_productionSpeedUp) * uint256(production)) /
                    1 hours -
                    upkeepRepaid;
            } else {
                // NOTE no need to overflow here  as there is no production cap, so no incentive to regroup spaceships
                uint256 decrease = (timePassed * uint256(_productionSpeedUp) * 1800) / 1 hours;
                if (decrease > newNumSpaceships) {
                    decrease = newNumSpaceships;
                    newNumSpaceships = 0;
                } else {
                    newNumSpaceships -= decrease;
                }
            }
        }

        if (newNumSpaceships >= ACTIVE_MASK) {
            newNumSpaceships = ACTIVE_MASK - 1;
        }
        planetUpdate.numSpaceships = uint32(newNumSpaceships);

        if (!planetUpdate.active && planetUpdate.numSpaceships == 0) {
            planetUpdate.newOwner = address(0);
        }
    }

    function _setPlanet(
        Planet storage planet,
        PlanetUpdateState memory planetUpdate,
        bool exitInterupted
    ) internal {
        if (planetUpdate.exitStartTime > 0 && planetUpdate.newExitStartTime == 0) {
            // NOTE: planetUpdate.newExitStartTime is only set to zero when exit is actually complete (not interupted)
            //  interuption is handled by exitInterupted
            // exit has completed, newExitStartTime is not set to zero for interuption,
            // interuption is taken care below (owner changes)
            _handleExitComplete(planetUpdate);
        }
        if (planetUpdate.owner != planetUpdate.newOwner) {
            planet.owner = planetUpdate.newOwner;
            planet.ownershipStartTime = uint40(block.timestamp);
            // TODO stakedOwnershipStartTime ?
            // TODO handle staking pool ?
            emit Transfer(planetUpdate.owner, planetUpdate.newOwner, planetUpdate.location);
        }

        if (exitInterupted) {
            // if (planetUpdate.newExitStartTime == 0 && planetUpdate.exitStartTime > 0) {
            // exit interupted // TODO event ?
            // }
            planet.exitStartTime = 0;
        } else if (planetUpdate.newExitStartTime != planetUpdate.exitStartTime) {
            planet.exitStartTime = planetUpdate.newExitStartTime;
        }

        planet.numSpaceships = _setActiveNumSpaceships(planetUpdate.active, planetUpdate.numSpaceships);
        planet.travelingUpkeep = planetUpdate.travelingUpkeep;

        planet.overflow = planetUpdate.overflow;
        planet.lastUpdated = uint40(block.timestamp);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // STAKING / PRODUCTION CAPTURE
    // ---------------------------------------------------------------------------------------------------------------

    function _acquire(
        address player,
        uint256 stake,
        uint256 location
    ) internal {
        // -----------------------------------------------------------------------------------------------------------
        // Initialise State Update
        // -----------------------------------------------------------------------------------------------------------
        Planet storage planet = _getPlanet(location);
        PlanetUpdateState memory planetUpdate = _createPlanetUpdateState(planet, location);

        // -----------------------------------------------------------------------------------------------------------
        // check requirements
        // -----------------------------------------------------------------------------------------------------------
        require(stake == uint256(_stake(planetUpdate.data)) * (DECIMALS_18), "INVALID_AMOUNT");

        // -----------------------------------------------------------------------------------------------------------
        // Compute Basic Planet Updates
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForTimeElapsed(planetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Staking logic...
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForStaking(player, planetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Write New State
        // -----------------------------------------------------------------------------------------------------------
        _setPlanet(planet, planetUpdate, false);
        // _setAccountFromPlanetUpdate(planetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Update Space Discovery
        // -----------------------------------------------------------------------------------------------------------
        _setDiscoveryAfterStaking(location);

        // -----------------------------------------------------------------------------------------------------------
        // Emit Event
        // -----------------------------------------------------------------------------------------------------------
        emit PlanetStake(
            player,
            location,
            planetUpdate.numSpaceships,
            planetUpdate.travelingUpkeep,
            planetUpdate.overflow,
            stake
        );
    }

    function _computePlanetUpdateForStaking(address player, PlanetUpdateState memory planetUpdate) internal view {
        require(!planetUpdate.active, "STILL_ACTIVE");

        uint32 defense;
        // NOTE : natives are back automatically once spaceships reaches zero (here we know we are not active)
        // TODO consider making natives come back over time => would need to compute the time numSpaceship became zero
        if (planetUpdate.numSpaceships == 0) {
            defense = _natives(planetUpdate.data);
        } else {
            // Do not allow staking over occupied planets, they are going to zero at some point though
            require(planetUpdate.owner == player, "OCCUPIED");
        }

        uint16 production = _production(planetUpdate.data);
        uint32 cap = uint32(_capWhenActive(production));

        // TODO ensure a player staking on a planet it previously exited work here
        planetUpdate.newOwner = player;
        if (defense != 0) {
            (uint32 attackerLoss, ) =
                _computeFight(uint256(_acquireNumSpaceships), defense, 10000, _defense(planetUpdate.data));
            // attacker alwasy win as defense (and stats.native) is restricted to 3500
            // (attackerLoss: 0, defenderLoss: 0) would mean defense was zero
            require(attackerLoss < _acquireNumSpaceships, "FAILED_CAPTURED");
            planetUpdate.numSpaceships = _acquireNumSpaceships - attackerLoss;

            // NOTE cannot be overflow here as staking provide a number of spaceships below that
            planetUpdate.overflow = 0;
        } else {
            planetUpdate.numSpaceships += _acquireNumSpaceships;
            if (_productionCapAsDuration > 0) {
                if (planetUpdate.numSpaceships > cap) {
                    planetUpdate.overflow = planetUpdate.numSpaceships - cap;
                } else {
                    planetUpdate.overflow = 0;
                }
            }
        }

        // NOTE when staking on a planet, we set an allowance for traveling upkeep
        planetUpdate.travelingUpkeep = -int32(cap);
        planetUpdate.active = true;
    }

    // solhint-disable-next-line code-complexity
    function _setDiscoveryAfterStaking(uint256 location) internal {
        Discovered memory discovered = _discovered;

        int256 x = int256(int128(int256(location & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)));
        int256 y = int256(int128(int256(location >> 128)));

        bool changes = false;
        if (x < 0) {
            require(-x <= int256(uint256(discovered.minX)), "NOT_REACHABLE_YET_MINX");
            x = -x + int32(_expansionDelta);
            if (x > UINT32_MAX) {
                x = UINT32_MAX;
            }
            if (int256(uint256(discovered.minX)) < x) {
                discovered.minX = uint32(uint256(x));
                changes = true;
            }
        } else {
            require(x <= int256(uint256(discovered.maxX)), "NOT_REACHABLE_YET_MAXX");
            x = x + int32(_expansionDelta);
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
            y = -y + int32(_expansionDelta);
            if (y > UINT32_MAX) {
                y = UINT32_MAX;
            }
            if (int256(uint256(discovered.minY)) < y) {
                discovered.minY = uint32(uint256(y));
                changes = true;
            }
        } else {
            require(y <= int256(uint256(discovered.maxY)), "NOT_REACHABLE_YET_MAXY");
            y = y + int32(_expansionDelta);
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

    function _handleExitComplete(PlanetUpdateState memory planetUpdate) internal {
        uint256 stake = _completeExit(planetUpdate.owner, planetUpdate.location, planetUpdate.data);

        // TODO Transfer to zero and Transfer from zero ?

        // optional so we can use it in the batch withdraw,
        uint256 newStake = _stakeReadyToBeWithdrawn[planetUpdate.owner] + stake;
        _stakeReadyToBeWithdrawn[planetUpdate.owner] = newStake;
        emit StakeToWithdraw(planetUpdate.owner, newStake);
    }

    function _completeExit(
        address owner,
        uint256 location,
        bytes32 data
    ) internal returns (uint256 stake) {
        stake = uint256(_stake(data)) * (DECIMALS_18);
        emit ExitComplete(owner, location, stake);

        // TODO handle Staking pool release ?
        // (maybe not necessary here, can do in withdrawals?)

        // --------------------------------------------------------
        // Extra Reward was added
        // --------------------------------------------------------
        uint256 rewardId = _rewards[location];
        if (rewardId != 0) {
            // rewardId would contains the package. maybe this could be handled by an external contract
            _rewardsToWithdraw[owner][rewardId] = true;
            _rewards[location] = 0; // reset
            // if you had reward to a planet in he process of exiting,
            // you are adding the reward to the player exiting unless _setPlanetAfterExit is called first
            emit RewardToWithdraw(owner, location, rewardId);
        }
        // --------------------------------------------------------
    }

    function _exitFor(address owner, uint256 location) internal {
        Planet storage planet = _getPlanet(location);
        (bool active, ) = _activeNumSpaceships(planet.numSpaceships);
        require(active, "NOT_ACTIVE");
        require(owner == planet.owner, "NOT_OWNER");
        require(planet.exitStartTime == 0, "EXITING_ALREADY");
        planet.exitStartTime = uint40(block.timestamp);
        emit PlanetExit(owner, location);
    }

    function _fetchAndWithdrawFor(address owner, uint256[] calldata locations) internal {
        uint256 addedStake = 0;
        for (uint256 i = 0; i < locations.length; i++) {
            Planet storage planet = _getPlanet(locations[i]);
            if (_hasJustExited(planet.exitStartTime)) {
                require(owner == planet.owner, "NOT_OWNER");
                emit Transfer(owner, address(0), locations[i]);
                addedStake += _completeExit(planet.owner, locations[i], _planetData(locations[i]));
                planet.owner = address(0);
                planet.ownershipStartTime = 0;
                planet.exitStartTime = 0;
                planet.numSpaceships = 0;
                planet.overflow = 0;
                planet.travelingUpkeep = 0;
                planet.lastUpdated = uint40(block.timestamp);
            }
        }
        uint256 newStake = _stakeReadyToBeWithdrawn[owner] + addedStake;
        _unsafe_withdrawAll(owner, newStake);
    }

    function _unsafe_withdrawAll(address owner, uint256 amount) internal {
        _stakeReadyToBeWithdrawn[owner] = 0;
        emit StakeToWithdraw(owner, amount);
        require(_stakingToken.transfer(owner, amount), "FAILED_TRANSFER");
        // TODO Staking Pool
        emit StakeToWithdraw(owner, 0);
    }

    function _hasJustExited(uint40 exitTime) internal view returns (bool) {
        return exitTime > 0 && block.timestamp > exitTime + _exitDuration;
    }

    function _ping(uint256 location) internal {
        Planet storage planet = _getPlanet(location);
        PlanetUpdateState memory planetUpdate = _createPlanetUpdateState(planet, location);
        _computePlanetUpdateForTimeElapsed(planetUpdate);
        _setPlanet(planet, planetUpdate, false);
        // _setAccountFromPlanetUpdate(planetUpdate);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // REWARDS
    // ---------------------------------------------------------------------------------------------------------------

    function _addReward(uint256 location, address sponsor) internal {
        uint256 rewardId = _rewards[location];
        if (rewardId == 0) {
            rewardId = ++_prevRewardIds[sponsor];
            _rewards[location] = (uint256(uint160(sponsor)) << 96) + rewardId;
        }
        // TODO should it fails if different sponsor added reward before

        // TODO rewardId association with the actual rewards // probably contract address holding the reward
        emit RewardSetup(location, sponsor, rewardId);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // FLEET SENDING
    // ---------------------------------------------------------------------------------------------------------------

    function _unsafe_sendFor(
        uint256 fleetId,
        address operator,
        FleetLaunch memory launch
    ) internal {
        // -----------------------------------------------------------------------------------------------------------
        // Initialise State Update
        // -----------------------------------------------------------------------------------------------------------
        Planet storage planet = _getPlanet(launch.from);
        PlanetUpdateState memory planetUpdate = _createPlanetUpdateState(planet, launch.from);

        // -----------------------------------------------------------------------------------------------------------
        // check requirements
        // -----------------------------------------------------------------------------------------------------------

        require(planet.exitStartTime == 0, "PLANET_EXIT");
        require(launch.fleetSender == planet.owner, "NOT_OWNER");

        // -----------------------------------------------------------------------------------------------------------
        // Compute Basic Planet Updates
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForTimeElapsed(planetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Requirements post Planet Updates
        // -----------------------------------------------------------------------------------------------------------

        require(planetUpdate.numSpaceships >= launch.quantity, "SPACESHIPS_NOT_ENOUGH");

        // -----------------------------------------------------------------------------------------------------------
        // Sending logic...
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForFleetLaunch(planetUpdate, launch.quantity);

        // -----------------------------------------------------------------------------------------------------------
        // Write New State
        // -----------------------------------------------------------------------------------------------------------
        _setPlanet(planet, planetUpdate, false);
        // _setAccountFromPlanetUpdate(planetUpdate);

        _setFleetFlyingSlot(launch.from, launch.quantity);

        // TODO add debt info
        _fleets[fleetId] = Fleet({
            launchTime: uint40(block.timestamp),
            owner: launch.fleetOwner,
            quantity: launch.quantity,
            futureExtraProduction: planetUpdate.futureExtraProduction
        });

        emit FleetSent(
            launch.fleetSender,
            launch.fleetOwner,
            launch.from,
            operator,
            fleetId,
            launch.quantity,
            planetUpdate.numSpaceships,
            planetUpdate.travelingUpkeep,
            planetUpdate.overflow
        );
    }

    function _computePlanetUpdateForFleetLaunch(PlanetUpdateState memory planetUpdate, uint32 quantity) internal view {
        planetUpdate.numSpaceships -= quantity;
        if (_productionCapAsDuration > 0) {
            if (planetUpdate.active) {
                // NOTE we do not update travelingUpkeep on Inactive planets
                //  these get reset on staking

                uint16 production = _production(planetUpdate.data);
                uint256 cap = _capWhenActive(production);
                if (planetUpdate.numSpaceships < cap) {
                    uint256 futureExtraProduction = cap - planetUpdate.numSpaceships;
                    if (futureExtraProduction > quantity) {
                        futureExtraProduction = quantity;
                    }
                    int256 newTravelingUpkeep = int256(planetUpdate.travelingUpkeep) + int256(futureExtraProduction);
                    if (newTravelingUpkeep > int256(cap)) {
                        newTravelingUpkeep = int256(cap);
                    }
                    planetUpdate.travelingUpkeep = int40(newTravelingUpkeep);
                    planetUpdate.futureExtraProduction = uint24(futureExtraProduction); // cap is always smaller than uint24
                }
            }

            if (planetUpdate.overflow > quantity) {
                planetUpdate.overflow -= quantity;
            } else {
                planetUpdate.overflow = 0;
            }
        }
    }

    function _setFleetFlyingSlot(uint256 from, uint32 quantity) internal {
        // -----------------------------------------------------------------------------------------------------------
        // record flying fleets (to prevent front-running, see resolution)
        // -----------------------------------------------------------------------------------------------------------
        uint256 timeSlot = block.timestamp / (_frontrunningDelay / 2);
        uint32 flying = _inFlight[from][timeSlot].flying;
        flying = flying + quantity;
        require(flying >= quantity, "ORBIT_OVERFLOW"); // unlikely to ever happen,
        // would need a huge amount of spaceships to be received and each in turn being sent
        // TOEXPLORE could also cap, that would result in some fleet being able to escape.
        _inFlight[from][timeSlot].flying = flying;
        // -----------------------------------------------------------------------------------------------------------
    }

    // ---------------------------------------------------------------------------------------------------------------
    // FLEET RESOLUTION, ATTACK / REINFORCEMENT
    // ---------------------------------------------------------------------------------------------------------------
    struct ResolutionState {
        address fleetOwner;
        uint40 fleetLaunchTime;
        uint32 originalQuantity;
        uint32 fleetQuantity;
        bytes32 fromData;
        uint32 inFlightFleetLoss;
        uint32 inFlightPlanetLoss;
        bool gifting;
        bool taxed;
        bool victory;
        uint32 attackerLoss;
        uint32 defenderLoss;
        uint32 orbitDefense1;
        uint32 orbitDefenseDestroyed1;
        uint32 orbitDefense2;
        uint32 orbitDefenseDestroyed2;
        uint40 arrivalTime;
        uint32 accumulatedDefenseAdded;
        uint32 accumulatedAttackAdded;
        uint16 attackPower;
        uint24 futureExtraProduction;
    }

    function _resolveFleet(uint256 fleetId, FleetResolution calldata resolution) internal {
        // -----------------------------------------------------------------------------------------------------------
        // Initialise State Update
        // -----------------------------------------------------------------------------------------------------------
        Planet storage toPlanet = _getPlanet(resolution.to);
        PlanetUpdateState memory toPlanetUpdate = _createPlanetUpdateState(toPlanet, resolution.to);
        ResolutionState memory rState = _createResolutionState(_fleets[fleetId], resolution.from);

        // -----------------------------------------------------------------------------------------------------------
        // check requirements
        // -----------------------------------------------------------------------------------------------------------

        require(
            rState.fleetQuantity > 0, // TODO use other indicator, maybe even result: gift / failed attack / success
            rState.fleetOwner != address(0) ? "FLEET_RESOLVED_ALREADY" : "FLEET_DO_NOT_EXIST"
        );
        _requireCorrectDistance(
            resolution.distance,
            resolution.from,
            resolution.to,
            rState.fromData,
            toPlanetUpdate.data
        );
        _requireCorrectTimeAndUpdateArrivalTime(
            resolution.distance,
            resolution.arrivalTimeWanted,
            rState.fleetLaunchTime,
            rState.fromData,
            rState
        );

        // -----------------------------------------------------------------------------------------------------------
        // Compute Basic Planet Updates
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForTimeElapsed(toPlanetUpdate);

        uint32 numSpaceshipsAtArrival = toPlanetUpdate.numSpaceships;

        // -----------------------------------------------------------------------------------------------------------
        // Traveling logic...
        // -----------------------------------------------------------------------------------------------------------

        _computeInFlightLossForFleet(rState, resolution);

        // -----------------------------------------------------------------------------------------------------------
        // Resolution logic...
        // -----------------------------------------------------------------------------------------------------------

        _updateFleetForGifting(rState, resolution, toPlanetUpdate.newOwner);

        _computeResolutionResult(rState, toPlanetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Write New State
        // -----------------------------------------------------------------------------------------------------------

        _recordInOrbitLossAfterAttack(rState, toPlanetUpdate);

        _recordOrbitLossAccountingForFleetOrigin(rState, resolution);

        _setTravelingUpkeepFromOrigin(fleetId, rState, resolution.from);

        _setPlanet(toPlanet, toPlanetUpdate, rState.victory);

        _setAccumulatedAttack(rState, toPlanetUpdate);

        // _setAccountFromPlanetUpdate(toPlanetUpdate); // TODO remove, else think about the fromPlanet ?

        // TODO quantity should be kept ?
        //  so Alliance Contract can act on that value ?, could use 1st bit indicator
        _fleets[fleetId].quantity = 0;

        // -----------------------------------------------------------------------------------------------------------
        // Events
        // -----------------------------------------------------------------------------------------------------------
        _emitFleetArrived(
            fleetId,
            rState,
            toPlanetUpdate.owner,
            resolution.to,
            _arrivalData(rState, toPlanetUpdate, numSpaceshipsAtArrival)
        );
    }

    function _arrivalData(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate,
        uint32 numSpaceshipsAtArrival
    ) internal pure returns (ArrivalData memory arrivalData) {
        arrivalData.newNumspaceships = toPlanetUpdate.numSpaceships;
        arrivalData.newTravelingUpkeep = toPlanetUpdate.travelingUpkeep;
        arrivalData.newOverflow = toPlanetUpdate.overflow;
        arrivalData.numSpaceshipsAtArrival = numSpaceshipsAtArrival;
        arrivalData.taxLoss = rState.taxed
            ? (rState.originalQuantity - rState.inFlightFleetLoss) - rState.fleetQuantity
            : 0;
        arrivalData.fleetLoss = rState.attackerLoss;
        arrivalData.planetLoss = rState.defenderLoss;
        arrivalData.inFlightFleetLoss = rState.inFlightFleetLoss;
        arrivalData.inFlightPlanetLoss = rState.inFlightPlanetLoss;
        arrivalData.accumulatedDefenseAdded = rState.accumulatedDefenseAdded;
        arrivalData.accumulatedAttackAdded = rState.accumulatedAttackAdded;
    }

    function _emitFleetArrived(
        uint256 fleetId,
        ResolutionState memory rState,
        address planetOwner,
        uint256 to,
        ArrivalData memory arrivalData
    ) internal {
        emit FleetArrived(fleetId, rState.fleetOwner, planetOwner, to, rState.gifting, rState.victory, arrivalData);
    }

    function _requireCorrectDistance(
        uint256 distance,
        uint256 from,
        uint256 to,
        bytes32 fromPlanetData,
        bytes32 toPlanetData
    ) internal pure {
        // check input instead of compute sqrt

        (int8 fromSubX, int8 fromSubY) = _subLocation(fromPlanetData);
        (int8 toSubX, int8 toSubY) = _subLocation(toPlanetData);
        uint256 distanceSquared =
            uint256(
                int256( // check input instead of compute sqrt
                    ((int128(int256(to & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) * 4 + toSubX) -
                        (int128(int256(from & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) * 4 + fromSubX)) **
                        2 +
                        ((int128(int256(to >> 128)) * 4 + toSubY) - (int128(int256(from >> 128)) * 4 + fromSubY))**2
                )
            );
        require(distance**2 <= distanceSquared && distanceSquared < (distance + 1)**2, "wrong distance");
    }

    function _requireCorrectTimeAndUpdateArrivalTime(
        uint256 distance,
        uint256 arrivalTimeWanted,
        uint40 launchTime,
        bytes32 fromPlanetData,
        ResolutionState memory rState
    ) internal view {
        uint256 minReachTime = launchTime + (distance * (_timePerDistance * 10000)) / _speed(fromPlanetData);
        uint256 reachTime = Math.max(arrivalTimeWanted, minReachTime);
        if (arrivalTimeWanted > 0) {
            rState.arrivalTime = uint40(arrivalTimeWanted);
        } else {
            rState.arrivalTime = uint40(minReachTime);
        }
        require(block.timestamp >= reachTime, "too early");
        require(block.timestamp < reachTime + _resolveWindow, "too late, your spaceships are lost in space");
    }

    function _computeInFlightLossForFleet(ResolutionState memory rState, FleetResolution memory resolution)
        internal
        view
    {
        // -----------------------------------------------------------------------------------------------------------
        // check if fleet was attacked while departing (used to prevent front-running, see fleet sending)
        // -----------------------------------------------------------------------------------------------------------
        uint256 timeSlot = rState.fleetLaunchTime / (_frontrunningDelay / 2);
        uint32 destroyed = _inFlight[resolution.from][timeSlot].destroyed;
        uint32 originalQuantity = rState.fleetQuantity;
        if (destroyed < rState.fleetQuantity) {
            rState.fleetQuantity -= uint32(destroyed);
        } else {
            rState.fleetQuantity = 0;
        }

        rState.inFlightFleetLoss = originalQuantity - rState.fleetQuantity;
        // -----------------------------------------------------------------------------------------------------------
    }

    function _updateFleetForGifting(
        ResolutionState memory rState,
        FleetResolution memory resolution,
        address destinationOwner
    ) internal view {
        (bool gifting, bool taxed) = _computeGifting(destinationOwner, resolution, rState);
        rState.gifting = gifting;
        rState.taxed = taxed;
    }

    // TODO simplify and apply that to attack (when fleetOwner is not fleetSender)
    //  if (resolution.gift) { rState.fleetOwner = destinationOwner }
    //  then compute tax based on fleetOwner != fleetSender, box for attacks and gift
    //  combined attack could even work for non-allies ?
    //  in _computeGift calculate the tax for every branch that result in `gifting` being false
    //  then in attack, add tax to the quantity of fleet + modify event

    // solhint-disable-next-line code-complexity
    function _computeGifting(
        address destinationOwner,
        FleetResolution memory resolution,
        ResolutionState memory rState
    ) internal view returns (bool gifting, bool taxed) {
        if (destinationOwner == address(0)) {
            // destination has no owner : this is an attack
            return (false, _isFleetOwnerTaxed(rState.fleetOwner, resolution.fleetSender, rState.fleetLaunchTime));
        }
        if (destinationOwner == rState.fleetOwner && destinationOwner == resolution.fleetSender) {
            // destination is sender is fleet owner: this is a non-taxed gift
            return (true, false);
        }

        if (resolution.gift || destinationOwner == rState.fleetOwner) {
            // intent was gift
            if (
                resolution.specific == address(0) || // anyone
                resolution.specific == destinationOwner || // only one address and matching owner
                destinationOwner == rState.fleetOwner // owner is fleet owner => gift
            ) {
                // and it was for anyone or specific destination owner that is the same as the current one
                // or it was simply that fleetOwner = destinationOwner

                // check tax applies with sender
                (, uint96 joinTime) =
                    _allianceRegistry.havePlayersAnAllianceInCommon(
                        resolution.fleetSender,
                        destinationOwner,
                        rState.fleetLaunchTime
                    );
                return (true, joinTime == 0 || joinTime > rState.fleetLaunchTime);
            }

            if (resolution.specific == address(1)) {
                // or the specific specify any common alliances (1)

                if (rState.fleetOwner == resolution.fleetSender) {
                    (, uint96 joinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            resolution.fleetSender,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );
                    return (joinTime > 0, joinTime > rState.fleetLaunchTime);
                } else {
                    (, uint96 fleetOwnerJoinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            rState.fleetOwner,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );

                    if (fleetOwnerJoinTime == 0) {
                        // not in an alliance
                        return (
                            false,
                            _isFleetOwnerTaxed(rState.fleetOwner, resolution.fleetSender, rState.fleetLaunchTime)
                        );
                    }

                    // alliance => means gift
                    // check if taxed:
                    (, uint96 senderJoinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            resolution.fleetSender,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );

                    return (true, senderJoinTime == 0 || senderJoinTime > rState.fleetLaunchTime);
                }
            }

            if (uint160(resolution.specific) > 1) {
                // or a specific alliance that matches

                (uint96 joinTimeToSpecific, ) =
                    _allianceRegistry.getAllianceData(destinationOwner, IAlliance(resolution.specific));

                if (joinTimeToSpecific > 0) {
                    (, uint96 joinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            resolution.fleetSender,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );
                    return (true, joinTime == 0 || joinTime > rState.fleetLaunchTime);
                }
            }
        } else {
            // intent was attack
            if (resolution.specific == address(1)) {
                // and the attack was on any non-allies

                if (rState.fleetOwner == resolution.fleetSender) {
                    // make it a gift if the destination owner is actually an ally
                    (, uint96 joinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            resolution.fleetSender,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );
                    return (joinTime > 0, joinTime > rState.fleetLaunchTime);
                } else {
                    (, uint96 fleetOwnerJoinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            rState.fleetOwner,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );

                    if (fleetOwnerJoinTime == 0) {
                        // not in an alliance
                        return (
                            false,
                            _isFleetOwnerTaxed(rState.fleetOwner, resolution.fleetSender, rState.fleetLaunchTime)
                        );
                    }

                    // alliance => means gift
                    // check if taxed:
                    (, uint96 senderJoinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            resolution.fleetSender,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );

                    return (true, senderJoinTime == 0 || senderJoinTime > rState.fleetLaunchTime);
                }
            }

            if (uint160(resolution.specific) > 1 && resolution.specific != destinationOwner) {
                // but specific not matching current owner

                (uint96 joinTimeToSpecific, ) =
                    _allianceRegistry.getAllianceData(destinationOwner, IAlliance(resolution.specific));

                // make it a gift if the destination is not matching the specific alliance
                // (or owner, in which case since it is not an alliance, it will also not match)
                if (joinTimeToSpecific == 0) {
                    (, uint96 joinTime) =
                        _allianceRegistry.havePlayersAnAllianceInCommon(
                            resolution.fleetSender,
                            destinationOwner,
                            rState.fleetLaunchTime
                        );
                    return (true, joinTime == 0 || joinTime > rState.fleetLaunchTime);
                }
            }
        }
        return (false, _isFleetOwnerTaxed(rState.fleetOwner, resolution.fleetSender, rState.fleetLaunchTime));
    }

    function _isFleetOwnerTaxed(
        address fleetOwner,
        address fleetSender,
        uint40 fleetLaunchTime
    ) internal view returns (bool) {
        if (fleetOwner == fleetSender) {
            return false;
        }
        (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(fleetOwner, fleetSender, fleetLaunchTime);
        return joinTime == 0 || joinTime > fleetLaunchTime;
    }

    function _setTravelingUpkeepFromOrigin(
        uint256 fleetID,
        ResolutionState memory rState,
        uint256 location
    ) internal {
        // TODO why only when attacked ?
        //  should we not also bring bacp upkeep when arriving ?
        if (rState.attackerLoss > 0) {
            // // we have to update the origin
            Planet storage fromPlanet = _planets[location];
            PlanetUpdateState memory fromPlanetUpdate = _createPlanetUpdateState(fromPlanet, location);
            _computePlanetUpdateForTimeElapsed(fromPlanetUpdate);

            uint16 production = _production(fromPlanetUpdate.data);
            uint256 capWhenActive = _capWhenActive(production);

            uint256 refund = rState.futureExtraProduction;
            uint256 timePassed = block.timestamp - rState.fleetLaunchTime;
            uint256 produce = (timePassed * uint256(_productionSpeedUp) * uint256(production)) / 1 hours;
            if (produce > refund) {
                refund = 0;
            } else {
                refund -= produce;
            }

            int256 newTravelingUpkeep = int256(fromPlanetUpdate.travelingUpkeep) - int256(refund);
            if (newTravelingUpkeep < -int256(capWhenActive)) {
                newTravelingUpkeep = -int256(capWhenActive);
            }
            fromPlanetUpdate.travelingUpkeep = int40(newTravelingUpkeep);

            _setPlanet(fromPlanet, fromPlanetUpdate, false);

            emit TravelingUpkeepRefund(
                location,
                fleetID,
                fromPlanetUpdate.numSpaceships,
                fromPlanetUpdate.travelingUpkeep,
                fromPlanetUpdate.overflow
            );
        }
    }

    function _setAccumulatedAttack(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate) internal {
        if (rState.victory) {
            // victory, past attack has been succesful in capturing the planet, They do not count anymore
            delete _attacks[toPlanetUpdate.location][rState.fleetOwner][rState.arrivalTime];
        } else if (!rState.taxed) {
            AccumulatedAttack storage attack = _attacks[toPlanetUpdate.location][rState.fleetOwner][rState.arrivalTime];

            attack.target = toPlanetUpdate.owner;
            attack.damageCausedSoFar = rState.defenderLoss + rState.inFlightPlanetLoss;
            attack.numAttackSpent = rState.attackerLoss;
            attack.averageAttackPower = rState.attackPower;
        }
    }

    function _createResolutionState(Fleet storage fleet, uint256 from)
        internal
        view
        returns (ResolutionState memory rState)
    {
        rState.fleetOwner = fleet.owner;
        rState.fleetLaunchTime = fleet.launchTime;
        rState.originalQuantity = fleet.quantity;
        rState.fleetQuantity = fleet.quantity;
        rState.futureExtraProduction = fleet.futureExtraProduction;
        rState.fromData = _planetData(from);
        rState.attackPower = _attack(rState.fromData);
    }

    function _recordOrbitLossAccountingForFleetOrigin(ResolutionState memory rState, FleetResolution memory resolution)
        internal
    {
        if (rState.inFlightFleetLoss > 0) {
            uint256 timeSlot = rState.fleetLaunchTime / (_frontrunningDelay / 2);

            // NOTE we already computed that destroyed cannot be smaller than inFlightFleetLoss
            //  see _computeInFlightLossForFleet
            _inFlight[resolution.from][timeSlot].destroyed -= rState.inFlightFleetLoss;
        }
    }

    function _computeResolutionResult(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
        view
    {
        if (rState.taxed) {
            rState.fleetQuantity = uint32(
                uint256(rState.fleetQuantity) - (uint256(rState.fleetQuantity) * _giftTaxPer10000) / 10000
            );
        }
        if (rState.gifting) {
            _computeGiftingResolutionResult(rState, toPlanetUpdate);
        } else {
            _computeAttackResolutionResult(rState, toPlanetUpdate);
        }
    }

    function _computeGiftingResolutionResult(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
        view
    {
        uint256 newNumSpaceships = toPlanetUpdate.numSpaceships + rState.fleetQuantity;
        if (newNumSpaceships >= ACTIVE_MASK) {
            newNumSpaceships = ACTIVE_MASK - 1;
        }

        toPlanetUpdate.numSpaceships = uint32(newNumSpaceships);
        if (!toPlanetUpdate.active) {
            // NOTE: not active, overflow is applied on cap = 0
            if (toPlanetUpdate.numSpaceships > toPlanetUpdate.overflow) {
                toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships;
            }
        } else {
            uint32 cap = uint32(_capWhenActive(_production(toPlanetUpdate.data)));
            if (_productionCapAsDuration > 0 && newNumSpaceships > cap) {
                if (toPlanetUpdate.numSpaceships - cap > toPlanetUpdate.overflow) {
                    toPlanetUpdate.overflow = uint32(toPlanetUpdate.numSpaceships - cap);
                }
            } else {
                toPlanetUpdate.overflow = 0;
            }
        }
    }

    function _computeAttackResolutionResult(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
        view
    {
        // NOTE natives come back to power once numSPaceships == 0 and planet not active
        if (!toPlanetUpdate.active && toPlanetUpdate.numSpaceships < _natives(toPlanetUpdate.data)) {
            _updatePlanetUpdateStateAndResolutionStateForNativeAttack(rState, toPlanetUpdate);
        } else {
            // TODO 45min config ?
            // if (block.timestamp < rState.arrivalTime + 45 minutes) {
            if (!rState.taxed) {
                AccumulatedAttack memory acc = _attacks[toPlanetUpdate.location][rState.fleetOwner][rState.arrivalTime];
                if (acc.target == toPlanetUpdate.owner && acc.numAttackSpent != 0) {
                    rState.attackPower = uint16(
                        (uint256(rState.attackPower) *
                            uint256(rState.fleetQuantity) +
                            uint256(acc.averageAttackPower) *
                            uint256(acc.numAttackSpent)) / (uint256(rState.fleetQuantity) + uint256(acc.numAttackSpent))
                    );
                    rState.accumulatedAttackAdded = acc.numAttackSpent;
                    rState.accumulatedDefenseAdded = acc.damageCausedSoFar;
                }
            }
            // }

            _updatePlanetUpdateStateAndResolutionStateForPlanetAttack(rState, toPlanetUpdate);
        }
    }

    function _updatePlanetUpdateStateAndResolutionStateForNativeAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate
    ) internal view {
        // NOTE: when we are dealing with native attacks, we do not consider combined attacks
        // TODO We need to consider that case in the UI
        uint16 attack = _attack(rState.fromData);
        uint16 defense = _defense(toPlanetUpdate.data);
        uint16 natives = _natives(toPlanetUpdate.data);
        (uint32 attackerLoss, uint32 defenderLoss) = _computeFight(rState.fleetQuantity, natives, attack, defense);
        rState.attackerLoss = attackerLoss;
        if (defenderLoss == natives && rState.fleetQuantity > attackerLoss) {
            // (attackerLoss: 0, defenderLoss: 0) means that numAttack was zero as natives cannot be zero
            toPlanetUpdate.numSpaceships = rState.fleetQuantity - attackerLoss;
            rState.defenderLoss = defenderLoss;
            rState.victory = true;
            toPlanetUpdate.newOwner = rState.fleetOwner;
            // solhint-disable-next-line no-empty-blocks
        }
        // NOTE else (attacker lost) then nothing happen
    }

    function _updatePlanetUpdateStateAndResolutionStateForPlanetAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate
    ) internal view {
        _updateResolutionStateFromOrbitDefense(rState, toPlanetUpdate);
        uint256 numDefense =
            toPlanetUpdate.numSpaceships + rState.accumulatedDefenseAdded + rState.orbitDefense1 + rState.orbitDefense2;
        uint16 production = _production(toPlanetUpdate.data);

        if (numDefense == 0 && rState.fleetQuantity > 0) {
            // scenario where there is actually no defense on the place,

            toPlanetUpdate.newOwner = rState.fleetOwner;
            toPlanetUpdate.numSpaceships = rState.fleetQuantity;
            if (!toPlanetUpdate.active) {
                // numDefense = 0 so numAttack is the overflow, attacker took over
                toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships;
            } else {
                if (_productionCapAsDuration > 0) {
                    uint32 cap = uint32(_capWhenActive(production));
                    if (toPlanetUpdate.numSpaceships > cap) {
                        // numDefense = 0 so numAttack is the overflow, attacker took over
                        toPlanetUpdate.overflow = uint32(toPlanetUpdate.numSpaceships - cap);
                    } else {
                        toPlanetUpdate.overflow = 0;
                    }
                }
            }

            rState.victory = true;
        } else {
            _computeAttack(rState, toPlanetUpdate, numDefense);
            _computeTravelingUpkeepReductionFromDefenseLoss(rState, toPlanetUpdate, production);
        }
    }

    function _updateResolutionStateFromOrbitDefense(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate
    ) internal view {
        // -----------------------------------------------------------------------------------------------------------
        // consider fleets that just departed from the planet (used to prevent front-running, see fleet sending)
        // -----------------------------------------------------------------------------------------------------------
        uint256 timeSlot = block.timestamp / (_frontrunningDelay / 2);
        InFlight storage slot1 = _inFlight[toPlanetUpdate.location][timeSlot - 1];
        rState.orbitDefense1 = slot1.flying > 2**31 ? 2**31 - 1 : uint32(slot1.flying);
        rState.orbitDefenseDestroyed1 = slot1.destroyed > 2**31 ? 2**31 - 1 : uint32(slot1.destroyed);
        InFlight storage slot2 = _inFlight[toPlanetUpdate.location][timeSlot];
        rState.orbitDefense2 = slot2.flying > 2**31 ? 2**31 - 1 : uint32(slot2.flying);
        rState.orbitDefenseDestroyed2 = slot2.destroyed > 2**31 ? 2**31 - 1 : uint32(slot2.destroyed);
    }

    // solhint-disable-next-line code-complexity
    function _computeAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate,
        uint256 numDefense
    ) internal view {
        uint16 attack = rState.attackPower;
        uint16 defense = _defense(toPlanetUpdate.data);
        uint256 numAttack = rState.fleetQuantity + rState.accumulatedAttackAdded;
        (uint32 attackerLoss, uint32 defenderLoss) = _computeFight(numAttack, numDefense, attack, defense);
        rState.defenderLoss = defenderLoss;
        rState.attackerLoss = attackerLoss;

        // (attackerLoss: 0, defenderLoss: 0) could either mean attack was zero or defense was zero :
        if (rState.fleetQuantity > 0 && rState.defenderLoss == numDefense) {
            // NOTE Attacker wins

            // all orbiting fleets are destroyed, inFlightPlanetLoss is all that is left
            uint256 inFlightPlanetLoss = numDefense - toPlanetUpdate.numSpaceships - rState.accumulatedDefenseAdded;
            if (inFlightPlanetLoss > ACTIVE_MASK) {
                // cap it
                // TODO investigate potential issues
                inFlightPlanetLoss = ACTIVE_MASK - 1;
            }
            rState.inFlightPlanetLoss = uint32(inFlightPlanetLoss);

            rState.defenderLoss = rState.defenderLoss - rState.inFlightPlanetLoss;

            toPlanetUpdate.numSpaceships = rState.fleetQuantity + rState.accumulatedAttackAdded - attackerLoss;
            rState.victory = true;

            toPlanetUpdate.newOwner = rState.fleetOwner;

            if (!toPlanetUpdate.active) {
                // attack took over, overflow is numSpaceships
                toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships;
            } else {
                if (_productionCapAsDuration > 0) {
                    uint16 production = _production(toPlanetUpdate.data);
                    uint32 cap = uint32(_capWhenActive(production));
                    if (toPlanetUpdate.numSpaceships > cap) {
                        if (toPlanetUpdate.numSpaceships - cap > toPlanetUpdate.overflow) {
                            toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships - cap;
                        }
                    } else {
                        toPlanetUpdate.overflow = 0;
                    }
                }
            }
        } else if (rState.attackerLoss == rState.fleetQuantity + rState.accumulatedAttackAdded) {
            // NOTE Defender wins

            if (defenderLoss > toPlanetUpdate.numSpaceships + rState.accumulatedDefenseAdded) {
                rState.inFlightPlanetLoss =
                    defenderLoss -
                    toPlanetUpdate.numSpaceships -
                    rState.accumulatedDefenseAdded;

                toPlanetUpdate.numSpaceships = 0;
                // TODO change owner already if incative ?
                //  not needed though as this is the same has having numSpaceships = 1 and become zero over time

                if (rState.orbitDefense1 >= rState.inFlightPlanetLoss) {
                    rState.orbitDefense1 -= rState.inFlightPlanetLoss;
                    rState.orbitDefenseDestroyed1 += rState.inFlightPlanetLoss;
                } else {
                    rState.orbitDefenseDestroyed1 += rState.orbitDefense1;
                    uint32 extra = (rState.inFlightPlanetLoss - rState.orbitDefense1);
                    if (rState.orbitDefense2 >= extra) {
                        rState.orbitDefense2 -= extra;
                        rState.orbitDefenseDestroyed2 += extra;
                    } else {
                        rState.orbitDefenseDestroyed2 += rState.orbitDefense2;
                        rState.orbitDefense2 = 0; // should never reach minus but let simply set it to zero
                    }
                    rState.orbitDefense1 = 0;
                }
            } else {
                toPlanetUpdate.numSpaceships =
                    toPlanetUpdate.numSpaceships +
                    rState.accumulatedDefenseAdded -
                    defenderLoss;

                // TODO change owner already if incative and numSpaceship == 0 (like above)
                //  not needed though as this is the same has having numSpaceships = 1 and become zero over time
            }

            rState.defenderLoss = rState.defenderLoss - rState.inFlightPlanetLoss;

            if (!toPlanetUpdate.active) {
                if (defenderLoss > toPlanetUpdate.overflow) {
                    toPlanetUpdate.overflow = 0;
                } else {
                    toPlanetUpdate.overflow -= defenderLoss;
                }
            } else {
                if (_productionCapAsDuration > 0) {
                    uint16 production = _production(toPlanetUpdate.data);
                    uint32 cap = uint32(_capWhenActive(production));
                    if (toPlanetUpdate.numSpaceships > cap) {
                        if (defenderLoss <= toPlanetUpdate.overflow) {
                            toPlanetUpdate.overflow -= defenderLoss;
                        } else {
                            toPlanetUpdate.overflow = 0;
                        }
                    } else {
                        toPlanetUpdate.overflow = 0;
                    }
                }
            }
        } else {
            // should not happen
            // because we check for numDefense == 0 before performing the attack, see _updatePlanetUpdateStateAndResolutionStateForPlanetAttack
            revert("ZERO_ZERO");
        }
    }

    function _computeFight(
        uint256 numAttack,
        uint256 numDefense,
        uint256 attack,
        uint256 defense
    ) internal view returns (uint32 attackerLoss, uint32 defenderLoss) {
        if (numAttack == 0 || numDefense == 0) {
            // this edge case need to be considered,
            // as the result of this function cannot tell from it whos is winning here
            return (0, 0);
        }

        uint256 attackFactor =
            numAttack * ((1000000 - _fleetSizeFactor6) + ((_fleetSizeFactor6 * numAttack) / numDefense));
        uint256 attackDamage = (attackFactor * attack) / defense / 1000000;

        if (numDefense > attackDamage) {
            // attack fails
            attackerLoss = uint32(numAttack); // all attack destroyed
            defenderLoss = uint32(attackDamage); // 1 spaceship will be left at least as attackDamage < numDefense
        } else {
            // attack succeed
            uint256 defenseFactor =
                numDefense * ((1000000 - _fleetSizeFactor6) + ((_fleetSizeFactor6 * numDefense) / numAttack));
            uint256 defenseDamage = uint32((defenseFactor * defense) / attack / 1000000);

            if (defenseDamage >= numAttack) {
                defenseDamage = numAttack - 1; // ensure 1 spaceship left
            }

            attackerLoss = uint32(defenseDamage);
            defenderLoss = uint32(numDefense); // all defense destroyed
        }
    }

    function _computeTravelingUpkeepReductionFromDefenseLoss(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate,
        uint16 production
    ) internal view {
        // allow the attacker to pay for upkeep as part of the attack
        // only get to keep the upkeep that was there as a result of spaceships sent away

        uint256 capWhenActive = _capWhenActive(production);

        int256 totalDefenseLoss = int256(uint256(rState.defenderLoss) + uint256(rState.inFlightPlanetLoss));
        int256 newTravelingUpkeep = int256(toPlanetUpdate.travelingUpkeep) - totalDefenseLoss;
        if (newTravelingUpkeep < -int256(capWhenActive)) {
            newTravelingUpkeep = -int256(capWhenActive);
        }
        toPlanetUpdate.travelingUpkeep = int40(newTravelingUpkeep);
    }

    function _recordInOrbitLossAfterAttack(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
    {
        if (rState.inFlightPlanetLoss > 0) {
            InFlight storage slot1 = _inFlight[toPlanetUpdate.location][block.timestamp / (_frontrunningDelay / 2) - 1];
            slot1.flying = rState.orbitDefense1;
            slot1.destroyed = rState.orbitDefenseDestroyed1;

            InFlight storage slot2 = _inFlight[toPlanetUpdate.location][block.timestamp / (_frontrunningDelay / 2)];
            slot2.flying = rState.orbitDefense2;
            slot2.destroyed = rState.orbitDefenseDestroyed2;
        }
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
    bytes32 internal constant stakeRange = 0x00060008000A000C000E00100012001400140016001800200028003000380048;

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
        // skip stakeIndex * 2 + 0 as it is always zero in stakeRange
        return uint16(uint8(stakeRange[stakeIndex * 2 + 1]));
    }

    function _production(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        // TODO TRY : 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4000,4400,4800,5400,6200,7200 ?

        // 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4200,5400,6600,7800,9000,12000
        // 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0
        return data.normal16(12, 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0); // per hour
    }

    function _capWhenActive(uint16 production) internal view returns (uint256) {
        return _acquireNumSpaceships + (uint256(production) * _productionCapAsDuration) / 1 hours;
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
