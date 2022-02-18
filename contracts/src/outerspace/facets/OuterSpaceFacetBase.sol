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

// TODO Remove
import "hardhat/console.sol";

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
    uint256 internal immutable _upkeepProductionDecreaseRatePer10000th;
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
        uint256 upkeepProductionDecreaseRatePer10000th;
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
        _upkeepProductionDecreaseRatePer10000th = config.upkeepProductionDecreaseRatePer10000th;
        _fleetSizeFactor6 = config.fleetSizeFactor6;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // PLANET STATE
    // ---------------------------------------------------------------------------------------------------------------

    struct PlanetUpdateState {
        uint256 location;
        uint40 lastUpdated;
        bool active; // do you need to get the old ?
        uint32 numSpaceships; // do you need to get the old ?
        int40 travelingUpkeep;
        uint40 exitStartTime;
        uint40 newExitStartTime;
        uint32 overflow; // do you need to get the old ?
        address owner;
        address newOwner;
        bytes32 data;
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
        uint256 produce = (timePassed * uint256(production) * _productionSpeedUp) / 1 hours;

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
            // NOTE no need of productionSpeedUp for the cap because _productionCapAsDuration can include it
            uint256 cap = planetUpdate.active
                ? _acquireNumSpaceships + (uint256(production) * _productionCapAsDuration) / 1 hours
                : 0;

            if (newNumSpaceships > cap) {
                uint256 decreaseRate = 1800;
                if (planetUpdate.overflow > 0) {
                    decreaseRate = (planetUpdate.overflow * 1800) / cap;
                    if (decreaseRate < 1800) {
                        decreaseRate = 1800;
                    }
                }

                uint256 decrease = (timePassed * decreaseRate) / 1 hours;
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
                } else {
                    // not effect currently, when inactive, cap == 0, meaning zero spaceship here
                    // NOTE: we could do the following assuming we act on upkeepRepaid when inactive, we do not do that currently
                    //  extraUpkeepPaid = produce - upkeepRepaid;
                }
            }

            if (planetUpdate.active) {
                // travelingUpkeep can go negative allow you to charge up your planet for later use, up to 7 days
                int256 newTravelingUpkeep = int256(planetUpdate.travelingUpkeep) - int256(extraUpkeepPaid);
                // TODO add _aquireNumSpaceships ? (+ see other place where this is computed)
                if (newTravelingUpkeep < -int256((3 days * uint256(production)) / 1 hours)) {
                    newTravelingUpkeep = -int256((3 days * uint256(production)) / 1 hours);
                }
                planetUpdate.travelingUpkeep = int40(newTravelingUpkeep);
            }
        } else {
            if (planetUpdate.active) {
                newNumSpaceships += (timePassed * uint256(production) * _productionSpeedUp) / 1 hours - upkeepRepaid;
            } else {
                // NOTE no need to overflow here  as there is no production cap, so no incentive to regroup spaceships
                uint256 decrease = (timePassed * 1800) / 1 hours;
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

        // TODO remove
        // console.log(
        //     "extraUpkeepPaid %i, numSpaceships: %i, upkeepRepaid: %i,",
        //     extraUpkeepPaid,
        //     planetUpdate.numSpaceships,
        //     upkeepRepaid
        // );
    }

    function _setPlanet(Planet storage planet, PlanetUpdateState memory planetUpdate) internal {
        if (planetUpdate.exitStartTime > 0 && planetUpdate.newExitStartTime == 0) {
            // exit has completed, newExitStartTime is not set to zero for interuption,
            // interuption is taken care below (owner changes)
            _handleExitComplete(planetUpdate);
        }
        if (planetUpdate.owner != planetUpdate.newOwner) {
            planet.owner = planetUpdate.newOwner;
            planet.ownershipStartTime = uint40(block.timestamp);
            // TODO stakedOwnershipStartTime ?
            // TODO handle staking pool ?

            planet.exitStartTime = 0; // exit interupted // TODO event ?
        }
        if (planetUpdate.newExitStartTime > 0 && planetUpdate.exitStartTime == 0) {
            planet.exitStartTime = planetUpdate.newExitStartTime;
        }

        planet.numSpaceships = _setActiveNumSpaceships(planetUpdate.active, planetUpdate.numSpaceships);
        planet.travelingUpkeep = planetUpdate.travelingUpkeep;

        planet.overflow = planetUpdate.overflow;
        planet.lastUpdated = uint40(block.timestamp);
    }

    // was used to keep track of totalProduction, not needed anymore
    // function _setAccountFromPlanetUpdate(PlanetUpdateState memory planetUpdate) internal {
    //     if (planetUpdate.owner != planetUpdate.newOwner) {
    //         uint16 production = _production(planetUpdate.data);
    //         if (planetUpdate.owner != address(0)) {
    //             _accounts[planetUpdate.owner].totalProduction -= production;
    //         }
    //         if (planetUpdate.newOwner != address(0)) {
    //             _accounts[planetUpdate.newOwner].totalProduction += production;
    //         }
    //     }
    // }

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
        _setPlanet(planet, planetUpdate);
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
        uint32 defense;
        if (planetUpdate.lastUpdated == 0) {
            defense = _natives(planetUpdate.data);
        } else {
            require(!planetUpdate.active, "STILL_ACTIVE");

            // Do not allow staking over occupied planets, they are going to zero at some point though
            // TODO owner == address(0) ? is it possible for address(0) + numSpaceships > 0 ?
            require(planetUpdate.owner == player || planetUpdate.numSpaceships == 0, "OCCUPIED");

            // used to be the following (but this gave too many cons to send spaceships to non-active planets):
            // TODO reconsider or remove natives entirely ?
            // if (mplanet.owner != sender) {
            //     defense = currentNumSpaceships;
            // } else {
            //     defense = 0;
            // }
        }

        uint16 production = _production(planetUpdate.data);
        uint32 cap = uint32(_acquireNumSpaceships + (production * _productionCapAsDuration) / 1 hours);

        // TODO ensure a player staking on a planet it previously exited work here
        planetUpdate.newOwner = player;
        if (defense != 0) {
            (uint32 attackerLoss, ) = _computeFight(_acquireNumSpaceships, defense, 10000, _defense(planetUpdate.data));
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

    function _handleExitComplete(PlanetUpdateState memory planetUpdate) internal {
        uint256 stake = _completeExit(planetUpdate.owner, planetUpdate.location, planetUpdate.data);

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
        _setPlanet(planet, planetUpdate);
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

    function _sendFor(
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
        _setPlanet(planet, planetUpdate);
        // _setAccountFromPlanetUpdate(planetUpdate);

        _setFleetFlyingSlot(launch.from, launch.quantity);

        // TODO add debt info
        _fleets[fleetId] = Fleet({
            launchTime: uint40(block.timestamp),
            owner: launch.fleetOwner,
            quantity: launch.quantity
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
            uint16 production = _production(planetUpdate.data);

            int256 newTravelingUpkeep = int256(planetUpdate.travelingUpkeep) + int256(uint256(quantity));
            if (newTravelingUpkeep > int256((3 days * uint256(production)) / 1 hours)) {
                newTravelingUpkeep = int256((3 days * uint256(production)) / 1 hours);
            }
            planetUpdate.travelingUpkeep = int40(newTravelingUpkeep);

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
        uint32 fleetQuantity;
        bytes32 fromData;
        uint32 inFlightFleetLoss;
        uint32 inFlightPlanetLoss;
        bool gifting;
        bool taxed;
        bool victory; // TODO ? and check old behavior,
        // for example on fleet_after_Exit the victory is true if numSPaceshipArrived > 0
        uint32 attackerLoss;
        uint32 defenderLoss;
        uint32 orbitDefense1;
        uint32 orbitDefenseDestroyed1;
        uint32 orbitDefense2;
        uint32 orbitDefenseDestroyed2;
    }

    function _resolveFleet(uint256 fleetId, FleetResolution memory resolution) internal {
        // -----------------------------------------------------------------------------------------------------------
        // Initialise State Update
        // -----------------------------------------------------------------------------------------------------------
        Planet storage toPlanet = _getPlanet(resolution.to);
        PlanetUpdateState memory toPlanetUpdate = _createPlanetUpdateState(toPlanet, resolution.to);
        ResolutionState memory rState = _createResolutionState(_fleets[fleetId], resolution.from);

        // -----------------------------------------------------------------------------------------------------------
        // check requirements
        // -----------------------------------------------------------------------------------------------------------

        require(rState.fleetQuantity > 0, "FLEET_DO_NOT_EXIST");
        _requireCorrectDistance(
            resolution.distance,
            resolution.from,
            resolution.to,
            rState.fromData,
            toPlanetUpdate.data
        );
        _requireCorrectTime(resolution.distance, rState.fleetLaunchTime, rState.fromData); // TODO delay

        // -----------------------------------------------------------------------------------------------------------
        // Compute Basic Planet Updates
        // -----------------------------------------------------------------------------------------------------------
        _computePlanetUpdateForTimeElapsed(toPlanetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Traveling logic...
        // -----------------------------------------------------------------------------------------------------------

        _computeInFlightLossForFleet(rState, resolution);

        // -----------------------------------------------------------------------------------------------------------
        // Resolution logic...
        // -----------------------------------------------------------------------------------------------------------

        _updateFleetForGifting(rState, resolution, toPlanetUpdate.owner);

        _computeResolutionResult(rState, toPlanetUpdate);

        // -----------------------------------------------------------------------------------------------------------
        // Write New State
        // -----------------------------------------------------------------------------------------------------------

        _recordInOrbitLossAfterAttack(rState, toPlanetUpdate);

        _recordOrbitLossAccountingForFleetOrigin(rState, resolution);

        _setTravelingUpkeepFromOrigin(fleetId, rState, resolution.from);

        _setPlanet(toPlanet, toPlanetUpdate);
        // _setAccountFromPlanetUpdate(toPlanetUpdate); // TODO remove, else think about the fromPlanet ?

        // TODO quantity should be kept ?
        //  so Alliance Contract can act on that value ?, could use 1st bit indicator
        _fleets[fleetId].quantity = 0;

        // -----------------------------------------------------------------------------------------------------------
        // Events
        // -----------------------------------------------------------------------------------------------------------
        emit FleetArrived(
            fleetId,
            rState.fleetOwner,
            toPlanetUpdate.owner,
            resolution.to,
            rState.gifting,
            rState.attackerLoss,
            rState.defenderLoss,
            rState.inFlightFleetLoss,
            rState.inFlightPlanetLoss,
            rState.victory,
            toPlanetUpdate.numSpaceships,
            toPlanetUpdate.travelingUpkeep,
            toPlanetUpdate.overflow
        );
    }

    function _setTravelingUpkeepFromOrigin(
        uint256 fleetID,
        ResolutionState memory rState,
        uint256 location
    ) internal {
        if (rState.attackerLoss > 0) {
            // // we have to update the origin
            Planet storage fromPlanet = _planets[location];
            PlanetUpdateState memory fromPlanetUpdate = _createPlanetUpdateState(fromPlanet, location);
            _computePlanetUpdateForTimeElapsed(fromPlanetUpdate);

            uint32 production = _production(fromPlanetUpdate.data);
            int256 newTravelingUpkeep = int256(fromPlanetUpdate.travelingUpkeep) - int256(int32(rState.attackerLoss));
            if (newTravelingUpkeep < -int256((7 days * uint256(production) * _productionSpeedUp) / 1 hours)) {
                newTravelingUpkeep = -int256((7 days * uint256(production) * _productionSpeedUp) / 1 hours);
            }
            fromPlanetUpdate.travelingUpkeep = int40(newTravelingUpkeep);

            _setPlanet(fromPlanet, fromPlanetUpdate);

            emit TravelingUpkeepReductionFromDestruction(
                location,
                fleetID,
                fromPlanetUpdate.numSpaceships,
                fromPlanetUpdate.travelingUpkeep,
                fromPlanetUpdate.overflow
            );
        }
    }

    function _createResolutionState(Fleet storage fleet, uint256 from)
        internal
        view
        returns (ResolutionState memory rState)
    {
        rState.fleetOwner = fleet.owner;
        rState.fleetLaunchTime = fleet.launchTime;
        rState.fleetQuantity = fleet.quantity;
        rState.fromData = _planetData(from);
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

    function _updateFleetForGifting(
        ResolutionState memory rState,
        FleetResolution memory resolution,
        address destinationOwner
    ) internal view {
        (bool gifting, bool taxed) = _computeGifting(destinationOwner, resolution, rState.fleetLaunchTime);
        rState.gifting = gifting;
        rState.taxed = taxed;
    }

    // solhint-disable-next-line code-complexity
    function _computeGifting(
        address destinationOwner,
        FleetResolution memory resolution,
        uint256 fleetLaunchTime
    ) internal view returns (bool gifting, bool taxed) {
        if (destinationOwner == address(0)) {
            // destination has no owner : this is an attack
            return (false, false);
        }
        if (destinationOwner == resolution.fleetSender) {
            // destination is sender: this is a non-taxed gift
            return (true, false);
        }

        if (resolution.gift) {
            // intent was gift
            if (resolution.specific == address(0) || resolution.specific == destinationOwner) {
                // and it was for anyone or specific destination owner that is the same as the current one

                (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                    resolution.fleetSender,
                    destinationOwner,
                    fleetLaunchTime
                );
                return (true, joinTime == 0 || joinTime > fleetLaunchTime);
            }

            if (resolution.specific == address(1)) {
                // or the specific specify any common alliances (1)

                (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                    resolution.fleetSender,
                    destinationOwner,
                    fleetLaunchTime
                );
                return (joinTime > 0, joinTime > fleetLaunchTime);
            }

            if (uint160(resolution.specific) > 1) {
                // or a specific one that matches

                (uint96 joinTimeToSpecific, ) = _allianceRegistry.getAllianceData(
                    destinationOwner,
                    IAlliance(resolution.specific)
                );

                if (joinTimeToSpecific > 0) {
                    (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                        resolution.fleetSender,
                        destinationOwner,
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
                    resolution.fleetSender,
                    destinationOwner,
                    fleetLaunchTime
                );
                return (joinTime > 0, joinTime > fleetLaunchTime);
            }

            if (uint160(resolution.specific) > 1 && resolution.specific != destinationOwner) {
                // but specific not matching current owner

                (uint96 joinTimeToSpecific, ) = _allianceRegistry.getAllianceData(
                    destinationOwner,
                    IAlliance(resolution.specific)
                );

                // make it a gift if the destination is not matching the specific alliance
                // (or owner, in which case since it is not an alliance, it will also not match)
                if (joinTimeToSpecific == 0) {
                    (, uint96 joinTime) = _allianceRegistry.havePlayersAnAllianceInCommon(
                        resolution.fleetSender,
                        destinationOwner,
                        fleetLaunchTime
                    );
                    return (true, joinTime == 0 || joinTime > fleetLaunchTime);
                }
            }
        }
    }

    function _computeResolutionResult(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
        view
    {
        if (rState.gifting) {
            _computeGiftingResolutionResult(rState, toPlanetUpdate);
        } else {
            _computeAttackResolutionResult(rState, toPlanetUpdate);
        }
    }

    function _computeAttackResolutionResult(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
        view
    {
        if (toPlanetUpdate.lastUpdated == 0) {
            // Planet was never touched (or do we allow attack to fail silently,
            // see _updatePlanetUpdateStateAndResolutionStateForNativeAttack)
            _updatePlanetUpdateStateAndResolutionStateForNativeAttack(rState, toPlanetUpdate);
        } else {
            _updatePlanetUpdateStateAndResolutionStateForPlanetAttack(rState, toPlanetUpdate);
        }
    }

    function _computeGiftingResolutionResult(ResolutionState memory rState, PlanetUpdateState memory toPlanetUpdate)
        internal
        view
    {
        if (rState.taxed) {
            rState.fleetQuantity = uint32(
                uint256(rState.fleetQuantity) - (uint256(rState.fleetQuantity) * GIFT_TAX_PER_10000) / 10000
            );
        }
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
            uint32 cap = uint32(_acquireNumSpaceships + _production(toPlanetUpdate.data) * _productionCapAsDuration) /
                1 hours;
            if (_productionCapAsDuration > 0 && newNumSpaceships > cap) {
                if (toPlanetUpdate.numSpaceships - cap > toPlanetUpdate.overflow) {
                    toPlanetUpdate.overflow = uint32(toPlanetUpdate.numSpaceships - cap);
                }
            } else {
                toPlanetUpdate.overflow = 0;
            }
        }
    }

    function _updatePlanetUpdateStateAndResolutionStateForNativeAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate
    ) internal view {
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
            // solhint-disable-next-line no-empty-blocks
        } else {
            // TODO revert ?
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
        // // numDefense = uint32(Math.min(flying1 + flying2 + numDefense, 2**32 - 1));
    }

    function _updatePlanetUpdateStateAndResolutionStateForPlanetAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate
    ) internal view {
        _updateResolutionStateFromOrbitDefense(rState, toPlanetUpdate);
        uint256 numDefense = toPlanetUpdate.numSpaceships + rState.orbitDefense1 + rState.orbitDefense2;
        uint16 production = _production(toPlanetUpdate.data);

        if (numDefense == 0 && rState.fleetQuantity > 0) {
            // scenario where there is actually no defense on the place,
            // TODO check if we could already assume active = false ?

            toPlanetUpdate.newOwner = rState.fleetOwner;
            toPlanetUpdate.numSpaceships = rState.fleetQuantity;
            if (!toPlanetUpdate.active) {
                // numDefense = 0 so numAttack is the overflow, attacker took over
                toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships;
            } else {
                if (_productionCapAsDuration > 0) {
                    uint32 cap = uint32(_acquireNumSpaceships + (production * _productionCapAsDuration) / 1 hours);
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
            _computeTravelingUpkeepReductionAfterAttack(rState, toPlanetUpdate, production);
        }
    }

    function _computeTravelingUpkeepReductionAfterAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate,
        uint16 production
    ) internal view {
        // allow the attacker to pay for upkeep as part of the attack
        // only get to keep the upkeep that was there as a result of spaceships sent away

        int256 totalLoss = int256(uint256(rState.defenderLoss + rState.inFlightPlanetLoss + rState.attackerLoss));
        int256 newTravelingUpkeep = int256(toPlanetUpdate.travelingUpkeep) - totalLoss;
        if (newTravelingUpkeep < -int256((7 days * uint256(production) * _productionSpeedUp) / 1 hours)) {
            newTravelingUpkeep = -int256((7 days * uint256(production) * _productionSpeedUp) / 1 hours);
        }
        toPlanetUpdate.travelingUpkeep = int40(newTravelingUpkeep);
    }

    // solhint-disable-next-line code-complexity
    function _computeAttack(
        ResolutionState memory rState,
        PlanetUpdateState memory toPlanetUpdate,
        uint256 numDefense
    ) internal view {
        uint16 attack = _attack(rState.fromData);
        uint16 defense = _defense(toPlanetUpdate.data);
        (uint32 attackerLoss, uint32 defenderLoss) = _computeFight(
            rState.fleetQuantity,
            toPlanetUpdate.numSpaceships,
            attack,
            defense
        );
        rState.defenderLoss = defenderLoss;
        rState.attackerLoss = attackerLoss;

        // (attackerLoss: 0, defenderLoss: 0) could either mean attack was zero or defense was zero :
        if (rState.fleetQuantity > 0 && rState.defenderLoss == numDefense) {
            // NOTE Attacker wins

            // all orbiting fleets are destroyed, inFlightPlanetLoss is all that is left
            rState.inFlightPlanetLoss = uint32(numDefense - toPlanetUpdate.numSpaceships);

            toPlanetUpdate.numSpaceships = rState.fleetQuantity - attackerLoss;
            rState.victory = true;

            toPlanetUpdate.newOwner = rState.fleetOwner;

            if (!toPlanetUpdate.active) {
                // attack took over, overflow is numSpaceships
                toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships;
            } else {
                if (_productionCapAsDuration > 0) {
                    uint16 production = _production(toPlanetUpdate.data);
                    uint32 cap = uint32(_acquireNumSpaceships + (production * _productionCapAsDuration) / 1 hours);
                    if (toPlanetUpdate.numSpaceships > cap) {
                        if (toPlanetUpdate.numSpaceships - cap > toPlanetUpdate.overflow) {
                            toPlanetUpdate.overflow = toPlanetUpdate.numSpaceships - cap;
                        }
                    } else {
                        toPlanetUpdate.overflow = 0;
                    }
                }
            }
        } else if (rState.attackerLoss == rState.fleetQuantity) {
            // NOTE Defender wins

            if (defenderLoss > toPlanetUpdate.numSpaceships) {
                rState.inFlightPlanetLoss = defenderLoss - toPlanetUpdate.numSpaceships;
                rState.defenderLoss = toPlanetUpdate.numSpaceships; // defenderLoss represent only planet loss
                toPlanetUpdate.numSpaceships = 0;

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
                toPlanetUpdate.numSpaceships = toPlanetUpdate.numSpaceships - defenderLoss;
            }
            if (!toPlanetUpdate.active) {
                if (defenderLoss > toPlanetUpdate.overflow) {
                    toPlanetUpdate.overflow = 0;
                } else {
                    toPlanetUpdate.overflow -= defenderLoss;
                }
            } else {
                if (_productionCapAsDuration > 0) {
                    uint16 production = _production(toPlanetUpdate.data);
                    uint32 cap = uint32(_acquireNumSpaceships + (production * _productionCapAsDuration) / 1 hours);
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
            assert(false); // should not happen
        }
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

    function _requireCorrectTime(
        uint256 distance,
        uint40 launchTime,
        bytes32 fromPlanetData
    ) internal view {
        uint256 reachTime = launchTime + (distance * (_timePerDistance * 10000)) / _speed(fromPlanetData);
        require(block.timestamp >= reachTime, "too early");
        require(block.timestamp < reachTime + _resolveWindow, "too late, your spaceships are lost in space");
    }

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
