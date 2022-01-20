// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "./ConquestToken.sol";

contract ConquestStakingPool {
    uint256 internal constant PRECISION = 1e24;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 reward);
    event StakeTransfered(address indexed from, address indexed to, uint256 amount);

    uint256 internal _lastUpdateTime;
    uint256 internal _rewardPerTokenPerSecondAtLastUpdate;
    uint256 internal _totalStaked;
    mapping(address => uint256) internal _amountStakedPerAccount;
    mapping(address => uint256) internal _rewardPerTokenPerSecondAccountedPerAccount;
    mapping(address => uint256) internal _rewardsToWithdrawPerAccount;

    ConquestToken immutable internal _conquestToken;
    constructor(ConquestToken conquestToken) {
        _conquestToken = conquestToken;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // For Authorized Games
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice stake ${amount} tokens from account ${account}.
    /// @param account The account whose token are staked. Will be given reward.
    /// @param amount The amount of tokens to stake.
    function stake(address account, uint256 amount) external onlyGames {
        if (amount == 0) {
            return;
        }

        (uint256 totalStakedSoFar, uint256 amountStakedSoFar) = _update(account);
        _totalStaked = totalStakedSoFar + amount;
        _amountStakedPerAccount[account] = amountStakedSoFar + amount;

        _conquestToken.transferFrom(account, address(this), amount);
        emit Staked(account, amount);
    }

    /// @notice Withdraws ${amount} staked tokens from account ${account}.
    /// @param account The account whose token are withdrawn.
    /// @param amount The amount of tokens to withdraw.
    function withdraw(address account, uint256 amount) external {
        if (amount == 0) {
            return;
        }

        (uint256 totalStakedSoFar, uint256 amountStakedSoFar) = _update(account);
         unchecked {
            _amountStakedPerAccount[account] = amountStakedSoFar - amount;
            _totalStaked = totalStakedSoFar - amount;
        }

        _conquestToken.transfer(account, amount);
        emit Withdrawn(account, amount);
    }

    // TODO variant where you can withdraw an amount of token + an amount of reward at the same time (not full exit)

    /// @notice Transfers ${amount} staked token to another account. Rewards acrrued are given to account ${from} first.
    /// @param from account to transfer from
    /// @param to account to transfer to
    /// @param amount The amount of staked tokens to transfer
    function transfer(address from, address to, uint256 amount) external {
        if (amount == 0) {
            return;
        }
        if (from == to) {
            return;
        }

        (uint256 totalStakedSoFar, uint256 rewardPerTokenPerSecond, ) = _updateGlobal();
        uint256 amountStakedSoFar;
        unchecked {
            amountStakedSoFar = _updateAccount(from, rewardPerTokenPerSecond);
            _amountStakedPerAccount[from] = amountStakedSoFar - amount;
            amountStakedSoFar = _updateAccount(to, rewardPerTokenPerSecond);
            _amountStakedPerAccount[to] = amountStakedSoFar + amount;
        }

        emit StakeTransfered(from, to, amount);
    }


    // ---------------------------------------------------------------------------------------------------------------
    // For Accounts
    // ---------------------------------------------------------------------------------------------------------------

    /// @notice Withdraws all earned rewards
    function getReward() external {
        uint256 amountStakedSoFar = _amountStakedPerAccount[msg.sender];

        (uint256 totalStakedSoFar, uint256 rewardPerTokenPerSecond, ) = _updateGlobal();
        uint256 reward = _computeTokenEarned(
            _rewardPerTokenPerSecondAccountedPerAccount[msg.sender],
            amountStakedSoFar,
            rewardPerTokenPerSecond,
            _rewardsToWithdrawPerAccount[msg.sender]
        );
        _rewardPerTokenPerSecondAccountedPerAccount[msg.sender] = rewardPerTokenPerSecond;

        if (reward > 0) {
            _rewardsToWithdrawPerAccount[msg.sender] = 0;
            _conquestToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------------------------------------------

    // TODO balanceOf
    // TODO totalSupply
    // ... ?

    /// @notice The amount of reward tokens each staked token has earned so far
    function rewardPerTokenPerSecond() external view returns (uint256) {
        return
            _computeNewRewardPerTokenPerSecond(
                _totalStaked,
                0, // TODO rewardRate,
                _lastUpdateTime
            );
    }

    /// @notice The amount of reward tokens an account has accrued so far. Does not include already withdrawn rewards.
    function earned(address account) external view returns (uint256) {
        return
            _computeTokenEarned(
                _rewardPerTokenPerSecondAccountedPerAccount[account],
                _amountStakedPerAccount[account],
                _computeNewRewardPerTokenPerSecond(
                    _totalStaked,
                    0, // TODO rewardRate
                    _lastUpdateTime
                ),
                _rewardsToWithdrawPerAccount[account]
            );
    }


    // ---------------------------------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------------------------------

    function _computeTokenEarned(
        uint256 rewardPerTokenPerSecondAccountedSoFar,
        uint256 accountStakedAmount,
        uint256 currentRewardPerTokenPerSecond,
        uint256 accountRewardsSoFar
    ) internal pure returns(uint256) {
        return accountRewardsSoFar + ((accountStakedAmount * (currentRewardPerTokenPerSecond - rewardPerTokenPerSecondAccountedSoFar)) / PRECISION);
    }

    // TODO make it pure and totalStaked == 0 check outside ?
    function _computeNewRewardPerTokenPerSecond(uint256 totalStaked, uint256 rewardRate, uint256 lastUpdateTime) internal view returns(uint256) {
        if (totalStaked == 0) {
            return _rewardPerTokenPerSecondAtLastUpdate;
        }
        return ((block.timestamp - lastUpdateTime) * rewardRate * PRECISION) / totalStaked;
    }

    function _updateGlobal() internal returns(uint256 totalStakedSoFar, uint256 rewardPerTokenPerSecond, uint256 rewardRate) {
        totalStakedSoFar = _totalStaked;
        rewardRate = 0; // TODO compute
        rewardPerTokenPerSecond = _computeNewRewardPerTokenPerSecond(totalStakedSoFar, rewardRate, _lastUpdateTime);

        _rewardPerTokenPerSecondAtLastUpdate = rewardPerTokenPerSecond;
        _lastUpdateTime = block.timestamp;
    }

    function _updateAccount(address account, uint256 rewardPerTokenPerSecond) internal returns (uint256 amountStakedSoFar) {
        amountStakedSoFar = _amountStakedPerAccount[account];

        _rewardsToWithdrawPerAccount[account] = _computeTokenEarned(
            _rewardPerTokenPerSecondAccountedPerAccount[account],
            amountStakedSoFar,
            rewardPerTokenPerSecond,
            _rewardsToWithdrawPerAccount[account]
        );
        _rewardPerTokenPerSecondAccountedPerAccount[account] = rewardPerTokenPerSecond;
    }

    function _update(address account) internal returns (uint256, uint256) {
        (uint256 totalStakedSoFar, uint256 rewardPerTokenPerSecond, ) = _updateGlobal();
        uint256 amountStakedSoFar = _updateAccount(account, rewardPerTokenPerSecond);
        return (totalStakedSoFar, amountStakedSoFar);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------------------------------------------------

    modifier onlyGames() {
        // TODO
        _;
    }
}
