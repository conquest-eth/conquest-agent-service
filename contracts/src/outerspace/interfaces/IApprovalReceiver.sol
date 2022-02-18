// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

interface IApprovalReceiver {
    function onApprovedBy(address owner, bytes calldata data) external;
}
