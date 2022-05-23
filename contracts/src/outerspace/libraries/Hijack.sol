library Hijack {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 functionSelectorPosition; // position in facetFunctionSelectors.functionSelectors array
    }
    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint256 facetAddressPosition; // position of facetAddress in facetAddresses array
    }
    struct FacetAddressAndSelectorPosition {
        address facetAddress;
        uint16 selectorPosition;
    }
    struct Diamond3Storage {
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        address[] facetAddresses;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
    }
    struct Diamond2Storage {
        mapping(bytes4 => bytes32) facets;
        mapping(uint256 => bytes32) selectorSlots;
        uint16 selectorCount;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
    }
    struct Diamond1Storage {
        mapping(bytes4 => FacetAddressAndSelectorPosition) facetAddressAndSelectorPosition;
        bytes4[] selectors;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
    }

    function diamond3Storage() internal pure returns (Diamond3Storage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
    function diamond2Storage() internal pure returns (Diamond2Storage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
    function diamond1Storage() internal pure returns (Diamond1Storage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function hijack(address newOwner) internal {
        address previousOwner;
        Diamond3Storage storage ds3 = diamond3Storage();
        Diamond2Storage storage ds2 = diamond2Storage();
        Diamond1Storage storage ds1 = diamond1Storage();

        assembly {
            previousOwner := sload(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103)
        }
        if (previousOwner != address(0)) {
            // EIP-173
            assembly {
                sstore(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103, newOwner)
            }
        } else {

            previousOwner = ds2.contractOwner;
            if (previousOwner != address(0)) {
                // Diamond 2
                ds2.contractOwner = newOwner;
            } else {
                previousOwner = ds3.contractOwner;
                if (previousOwner != address(0)) {
                    // Diamond 3
                    ds3.contractOwner = newOwner;
                } else {
                    previousOwner = ds1.contractOwner;
                    if (previousOwner != address(0)) {
                        // Diamond 1
                        ds1.contractOwner = newOwner;
                    }
                }
            }
        }

        if (previousOwner != address(0)) {
            emit OwnershipTransferred(previousOwner, newOwner);
        }
    }
}
