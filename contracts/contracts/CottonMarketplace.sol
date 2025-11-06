// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CottonDPP.sol";

/**
 * @title CottonMarketplace
 * @dev Marketplace met escrow, payments en fee management
 */
contract CottonMarketplace is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    
    IERC20 public usdt;
    CottonDPP public dppContract;
    
    // Fee structure
    uint256 public constant TRANSPORTER_BASE_FEE = 50 * 10**6; // 50 USDT
    uint256 public constant TRANSPORTER_PER_KG = 0.20 * 10**6; // 0.20 USDT per kg
    uint256 public constant CERTIFIER_BASE_FEE = 100 * 10**6; // 100 USDT
    uint256 public constant MIN_FARMER_ESCROW = 1000 * 10**6; // 1000 USDT
    
    // Market data per batch
    struct MarketData {
        bool onMarket;
        address buyer;
        uint256 escrowAmount;
        uint256 farmerAmount;
        uint256 certifierFee;
        uint256 transporterFee;
        uint256 farmerEscrow;
        address certifier;
        address transporter;
        bool certified;
        bool rejected;
        bool certifierPaid;
        bool transporterPaid;
    }
    
    struct Payment {
        address from;
        address to;
        uint256 amount;
        uint256 batchId;
        string reason;
        uint256 timestamp;
    }
    
    // Mappings
    mapping(uint256 => MarketData) public marketData;
    mapping(uint256 => Payment[]) public batchPayments;
    mapping(address => uint256) public farmerEscrowBalance;
    uint256[] private _marketBatches;
    uint256[] private _reservedBatches;
    
    // Events
    event BatchPurchased(uint256 indexed batchId, address indexed buyer, uint256 escrowAmount);
    event BatchCertified(uint256 indexed batchId, address indexed certifier, bool approved);
    event EscrowReleased(uint256 indexed batchId, address indexed recipient, uint256 amount);
    event EscrowRefunded(uint256 indexed batchId, address indexed buyer, uint256 amount);
    event CertifierPaid(uint256 indexed batchId, address indexed certifier, uint256 amount);
    event TransporterPaid(uint256 indexed batchId, address indexed transporter, uint256 amount);
    event FarmerEscrowDeposited(address indexed farmer, uint256 amount, uint256 newBalance);
    event FarmerEscrowRefunded(address indexed farmer, uint256 amount, uint256 newBalance);
    event FarmerEscrowUsed(uint256 indexed batchId, address indexed farmer, uint256 amount, uint256 remainingBalance);
    event PaymentMade(uint256 indexed batchId, address indexed from, address indexed to, uint256 amount, string reason);

    constructor(address _usdtAddress, address _dppAddress) {
        usdt = IERC20(_usdtAddress);
        dppContract = CottonDPP(_dppAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ========== ESCROW FUNCTIONS ==========
    
    function depositFarmerEscrow(uint256 amount) external onlyRole(FARMER_ROLE) {
        require(amount >= MIN_FARMER_ESCROW, "Min escrow");
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        farmerEscrowBalance[msg.sender] += amount;
        
        emit FarmerEscrowDeposited(msg.sender, amount, farmerEscrowBalance[msg.sender]);
    }

    function withdrawFarmerEscrow(uint256 amount) external onlyRole(FARMER_ROLE) {
        require(farmerEscrowBalance[msg.sender] >= amount, "Insufficient balance");
        
        // Check geen actieve batches
        for (uint256 i = 0; i < _marketBatches.length; i++) {
            uint256 batchId = _marketBatches[i];
            (,address farmer,,,,,,, ) = dppContract.getBatch(batchId);
            if (farmer == msg.sender && marketData[batchId].onMarket) {
                revert("Active batches on market");
            }
        }
        
        farmerEscrowBalance[msg.sender] -= amount;
        require(usdt.transfer(msg.sender, amount), "Withdrawal failed");
        
        emit FarmerEscrowRefunded(msg.sender, amount, farmerEscrowBalance[msg.sender]);
    }

    function getFarmerEscrowBalance(address farmer) external view returns (uint256) {
        return farmerEscrowBalance[farmer];
    }

    // ========== MARKETPLACE FUNCTIONS ==========
    
    function putBatchOnMarket(uint256 batchId) external onlyRole(FARMER_ROLE) {
        (,address farmer,uint256 weight,,,,,, ) = dppContract.getBatch(batchId);
        require(farmer == msg.sender, "Not owner");
        require(!marketData[batchId].onMarket, "Already on market");
        require(marketData[batchId].buyer == address(0), "Already sold");
        
        // Bereken certificeerder fee
        uint256 requiredEscrow = CERTIFIER_BASE_FEE;
        if (weight <= 500) {
            requiredEscrow += weight * 1 * 10**6;
        } else if (weight <= 1000) {
            requiredEscrow += (500 * 1 * 10**6) + ((weight - 500) * 80 * 10**4);
        } else if (weight <= 2000) {
            requiredEscrow += (500 * 1 * 10**6) + (500 * 80 * 10**4) + ((weight - 1000) * 60 * 10**4);
        } else {
            requiredEscrow += (500 * 1 * 10**6) + (500 * 80 * 10**4) + (1000 * 60 * 10**4) + ((weight - 2000) * 40 * 10**4);
        }
        
        require(farmerEscrowBalance[msg.sender] >= requiredEscrow, "Insufficient escrow");
        
        marketData[batchId].farmerEscrow = requiredEscrow;
        marketData[batchId].onMarket = true;
        _marketBatches.push(batchId);
    }

    function purchaseBatch(uint256 batchId) external onlyRole(FACTORY_ROLE) {
        require(marketData[batchId].onMarket, "Not on market");
        
        (,, uint256 weight, uint256 quality,,,,,) = dppContract.getBatch(batchId);
        
        uint256 ratePerKg = 10 * 10**6;
        if (quality >= 90) {
            ratePerKg = 13 * 10**6;
        } else if (quality >= 70) {
            ratePerKg = 115 * 10**5;
        }
        
        uint256 totalAmount = weight * ratePerKg;
        
        // Bereken fees
        uint256 certifierFee = CERTIFIER_BASE_FEE;
        if (weight <= 500) {
            certifierFee += weight * 1 * 10**6;
        } else if (weight <= 1000) {
            certifierFee += (500 * 1 * 10**6) + ((weight - 500) * 80 * 10**4);
        } else if (weight <= 2000) {
            certifierFee += (500 * 1 * 10**6) + (500 * 80 * 10**4) + ((weight - 1000) * 60 * 10**4);
        } else {
            certifierFee += (500 * 1 * 10**6) + (500 * 80 * 10**4) + (1000 * 60 * 10**4) + ((weight - 2000) * 40 * 10**4);
        }
        
        uint256 transporterFee = TRANSPORTER_BASE_FEE + (weight * TRANSPORTER_PER_KG);
        uint256 farmerAmount = totalAmount - certifierFee - transporterFee;
        
        require(usdt.transferFrom(msg.sender, address(this), totalAmount), "Transfer failed");
        
        marketData[batchId].onMarket = false;
        marketData[batchId].buyer = msg.sender;
        marketData[batchId].escrowAmount = totalAmount;
        marketData[batchId].farmerAmount = farmerAmount;
        marketData[batchId].certifierFee = certifierFee;
        marketData[batchId].transporterFee = transporterFee;
        
        _removeFromMarketBatches(batchId);
        _reservedBatches.push(batchId);
        
        emit BatchPurchased(batchId, msg.sender, totalAmount);
    }

    function certifyBatch(uint256 batchId, bool approved) external onlyRole(CERTIFIER_ROLE) {
        require(marketData[batchId].buyer != address(0), "Not purchased");
        require(!marketData[batchId].certified && !marketData[batchId].rejected, "Already certified");
        require(!marketData[batchId].certifierPaid, "Already paid");
        
        marketData[batchId].certifier = msg.sender;
        marketData[batchId].certifierPaid = true;
        
        (,address farmer,,,,,,, ) = dppContract.getBatch(batchId);
        
        if (approved) {
            marketData[batchId].certified = true;
            
            uint256 farmerAmount = marketData[batchId].farmerAmount;
            uint256 certifierFee = marketData[batchId].certifierFee;
            
            require(usdt.transfer(farmer, farmerAmount), "Farmer transfer failed");
            require(usdt.transfer(msg.sender, certifierFee), "Certifier transfer failed");
            
            batchPayments[batchId].push(Payment({
                from: marketData[batchId].buyer,
                to: farmer,
                amount: farmerAmount,
                batchId: batchId,
                reason: "Certified payment",
                timestamp: block.timestamp
            }));
            
            batchPayments[batchId].push(Payment({
                from: marketData[batchId].buyer,
                to: msg.sender,
                amount: certifierFee,
                batchId: batchId,
                reason: "Certifier fee",
                timestamp: block.timestamp
            }));
            
            marketData[batchId].farmerEscrow = 0;
            
            emit EscrowReleased(batchId, farmer, farmerAmount);
            emit CertifierPaid(batchId, msg.sender, certifierFee);
            emit PaymentMade(batchId, marketData[batchId].buyer, farmer, farmerAmount, "Certified payment");
        } else {
            marketData[batchId].rejected = true;
            marketData[batchId].onMarket = true;
            
            address buyer = marketData[batchId].buyer;
            uint256 fullRefund = marketData[batchId].escrowAmount;
            uint256 certifierFee = marketData[batchId].certifierFee;
            
            require(usdt.transfer(buyer, fullRefund), "Refund failed");
            
            require(farmerEscrowBalance[farmer] >= certifierFee, "Insufficient escrow");
            farmerEscrowBalance[farmer] -= certifierFee;
            
            require(usdt.transfer(msg.sender, certifierFee), "Certifier transfer failed");
            
            emit FarmerEscrowUsed(batchId, farmer, certifierFee, farmerEscrowBalance[farmer]);
            
            batchPayments[batchId].push(Payment({
                from: address(this),
                to: buyer,
                amount: fullRefund,
                batchId: batchId,
                reason: "Refund",
                timestamp: block.timestamp
            }));
            
            batchPayments[batchId].push(Payment({
                from: farmer,
                to: msg.sender,
                amount: certifierFee,
                batchId: batchId,
                reason: "Certifier rejection fee",
                timestamp: block.timestamp
            }));
            
            marketData[batchId].buyer = address(0);
            marketData[batchId].escrowAmount = 0;
            marketData[batchId].farmerAmount = 0;
            marketData[batchId].certifierPaid = false;
            marketData[batchId].certified = false;
            marketData[batchId].rejected = false;
            
            _marketBatches.push(batchId);
            _removeFromReservedBatches(batchId);
            
            emit EscrowRefunded(batchId, buyer, fullRefund);
            emit CertifierPaid(batchId, msg.sender, certifierFee);
        }
        
        emit BatchCertified(batchId, msg.sender, approved);
    }

    function payTransporter(uint256 batchId) external {
        require(!marketData[batchId].transporterPaid, "Already paid");
        require(marketData[batchId].transporterFee > 0, "No fee");
        
        uint256 iotCount = dppContract.getIoTDataCount(batchId);
        require(iotCount > 0, "No IoT data");
        
        (,,,, address recorder) = dppContract.getIoTData(batchId, 0);
        
        marketData[batchId].transporter = recorder;
        marketData[batchId].transporterPaid = true;
        
        uint256 fee = marketData[batchId].transporterFee;
        require(usdt.transfer(recorder, fee), "Transfer failed");
        
        batchPayments[batchId].push(Payment({
            from: marketData[batchId].buyer,
            to: recorder,
            amount: fee,
            batchId: batchId,
            reason: "Transporter fee",
            timestamp: block.timestamp
        }));
        
        emit TransporterPaid(batchId, recorder, fee);
        emit PaymentMade(batchId, marketData[batchId].buyer, recorder, fee, "Transporter fee");
    }

    // ========== VIEW FUNCTIONS ==========
    
    function getMarketBatches() external view returns (uint256[] memory) {
        return _marketBatches;
    }

    function getReservedBatches() external view returns (uint256[] memory) {
        return _reservedBatches;
    }

    function getBatchMarketData(uint256 batchId) external view returns (
        bool onMarket,
        address buyer,
        uint256 escrowAmount,
        uint256 farmerAmount,
        uint256 certifierFee,
        uint256 transporterFee,
        uint256 farmerEscrow,
        address certifier,
        address transporter,
        bool certified,
        bool rejected,
        bool certifierPaid,
        bool transporterPaid
    ) {
        MarketData memory md = marketData[batchId];
        return (
            md.onMarket,
            md.buyer,
            md.escrowAmount,
            md.farmerAmount,
            md.certifierFee,
            md.transporterFee,
            md.farmerEscrow,
            md.certifier,
            md.transporter,
            md.certified,
            md.rejected,
            md.certifierPaid,
            md.transporterPaid
        );
    }

    function getBatchPayments(uint256 batchId) external view returns (Payment[] memory) {
        return batchPayments[batchId];
    }

    // ========== HELPER FUNCTIONS ==========
    
    function _removeFromMarketBatches(uint256 batchId) private {
        for (uint256 i = 0; i < _marketBatches.length; i++) {
            if (_marketBatches[i] == batchId) {
                _marketBatches[i] = _marketBatches[_marketBatches.length - 1];
                _marketBatches.pop();
                break;
            }
        }
    }

    function _removeFromReservedBatches(uint256 batchId) private {
        for (uint256 i = 0; i < _reservedBatches.length; i++) {
            if (_reservedBatches[i] == batchId) {
                _reservedBatches[i] = _reservedBatches[_reservedBatches.length - 1];
                _reservedBatches.pop();
                break;
            }
        }
    }
}
