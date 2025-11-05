// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IntegratedCottonDPP
 * @dev Complete katoen supply chain met DID, VC, IoT data en USDT betalingen
 */
contract IntegratedCottonDPP is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    
    IERC20 public usdt; // USDT token contract
    
    uint256 private _batchIdCounter;
    uint256 private _vcIdCounter;

    // DID Structuur
    struct DID {
        string identifier; // "did:cotton:0x..."
        string publicKey;
        string didType; // "farmer", "transporter", "certifier", "factory"
        uint256 registered;
        bool active;
    }

    // Verifiable Credential Structuur
    struct VerifiableCredential {
        uint256 id;
        address issuer; // Certificeerder
        address subject; // Boer
        string credentialType; // "OrganicCertificate", "QualityCertificate"
        string data; // JSON data
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
    }

    // Batch met volledige lifecycle en escrow
    struct Batch {
        uint256 id;
        address farmer;
        uint256 weight;
        uint256 initialQuality;
        string origin;
        uint256 createdAt;
        BatchStatus status;
        address currentOwner;
        uint256[] vcIds; // Gekoppelde credentials
        bool exists;
        // Markt & Escrow velden
        bool onMarket; // Is batch op markt?
        address buyer; // Inkoopcoöperatie die gekocht heeft
        uint256 escrowAmount; // Vastgezet bedrag in USDT
        bool certified; // Door certificeerder goedgekeurd?
        bool rejected; // Door certificeerder afgekeurd?
    }

    // IoT Data
    struct IoTData {
        int256 temperature;
        uint256 humidity;
        string location;
        uint256 timestamp;
        address recorder;
    }

    // Payment tracking
    struct Payment {
        address from;
        address to;
        uint256 amount;
        uint256 batchId;
        string reason; // "harvest", "transport", "quality_bonus"
        uint256 timestamp;
    }

    enum BatchStatus {
        Created,        // 0: Batch aangemaakt, op markt
        Reserved,       // 1: Gekocht door coöperatie, geld in escrow
        Verified,       // 2: Goedgekeurd door certificeerder
        Rejected,       // 3: Afgekeurd door certificeerder
        InTransit,      // 4: In transport
        QualityChecked, // 5: Kwaliteit gecontroleerd
        Delivered,      // 6: Afgeleverd
        Completed       // 7: Compleet
    }

    // Mappings
    mapping(address => DID) public dids;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => IoTData[]) public batchIoTData;
    mapping(uint256 => VerifiableCredential) public credentials;
    mapping(address => uint256[]) public farmerBatches;
    mapping(uint256 => Payment[]) public batchPayments;
    mapping(address => uint256[]) public subjectCredentials; // Track VCs per subject
    
    // Events
    event DIDRegistered(address indexed controller, string identifier, string didType);
    event VCIssued(uint256 indexed vcId, address indexed issuer, address indexed subject, string credentialType);
    event BatchCreated(uint256 indexed batchId, address indexed farmer, uint256 weight, uint256 quality);
    event BatchStatusUpdated(uint256 indexed batchId, BatchStatus status);
    event IoTDataAdded(uint256 indexed batchId, int256 temperature, uint256 humidity, string location);
    event PaymentMade(uint256 indexed batchId, address indexed from, address indexed to, uint256 amount, string reason);
    // Markt events
    event BatchPurchased(uint256 indexed batchId, address indexed buyer, uint256 escrowAmount);
    event BatchCertified(uint256 indexed batchId, address indexed certifier, bool approved);
    event EscrowReleased(uint256 indexed batchId, address indexed recipient, uint256 amount);
    event EscrowRefunded(uint256 indexed batchId, address indexed buyer, uint256 amount);
    event VCAttachedToBatch(uint256 indexed batchId, uint256 indexed vcId);

    constructor(address _usdtAddress) {
        usdt = IERC20(_usdtAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ========== DID FUNCTIONS ==========
    
    /**
     * @dev Registreer een DID voor een stakeholder
     */
    function registerDID(
        address controller,
        string memory publicKey,
        string memory didType
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!dids[controller].active, "DID already registered");
        require(bytes(didType).length > 0, "DID type required");
        
        string memory identifier = string(abi.encodePacked("did:cotton:", toHexString(controller)));
        
        dids[controller] = DID({
            identifier: identifier,
            publicKey: publicKey,
            didType: didType,
            registered: block.timestamp,
            active: true
        });
        
        // Assign role based on didType
        if (keccak256(bytes(didType)) == keccak256(bytes("farmer"))) {
            _setupRole(FARMER_ROLE, controller);
        } else if (keccak256(bytes(didType)) == keccak256(bytes("transporter"))) {
            _setupRole(TRANSPORTER_ROLE, controller);
        } else if (keccak256(bytes(didType)) == keccak256(bytes("certifier"))) {
            _setupRole(CERTIFIER_ROLE, controller);
        } else if (keccak256(bytes(didType)) == keccak256(bytes("factory"))) {
            _setupRole(FACTORY_ROLE, controller);
        }
        
        emit DIDRegistered(controller, identifier, didType);
    }

    // ========== VC FUNCTIONS ==========
    
    /**
     * @dev Geef een Verifiable Credential uit aan een boer
     */
    function issueCredential(
        address subject,
        string memory credentialType,
        string memory data,
        uint256 validityDays
    ) external onlyRole(CERTIFIER_ROLE) {
        require(dids[subject].active, "Subject must have DID");
        
        _vcIdCounter++;
        uint256 vcId = _vcIdCounter;
        
        credentials[vcId] = VerifiableCredential({
            id: vcId,
            issuer: msg.sender,
            subject: subject,
            credentialType: credentialType,
            data: data,
            issuedAt: block.timestamp,
            expiresAt: block.timestamp + (validityDays * 1 days),
            revoked: false
        });
        
        // Track VC for subject
        subjectCredentials[subject].push(vcId);
        
        emit VCIssued(vcId, msg.sender, subject, credentialType);
    }

    /**
     * @dev Koppel een VC aan een batch
     */
    function attachVCToBatch(uint256 batchId, uint256 vcId) external {
        require(batches[batchId].exists, "Batch does not exist");
        require(credentials[vcId].id != 0, "VC does not exist");
        require(credentials[vcId].subject == batches[batchId].farmer, "VC subject must be batch farmer");
        require(!credentials[vcId].revoked, "VC is revoked");
        require(block.timestamp < credentials[vcId].expiresAt, "VC expired");
        
        batches[batchId].vcIds.push(vcId);
        
        emit VCAttachedToBatch(batchId, vcId);
    }

    // ========== BATCH FUNCTIONS ==========
    
    /**
     * @dev Creëer nieuwe katoen batch
     */
    function createBatch(
        uint256 weight,
        uint256 initialQuality,
        string memory origin
    ) external onlyRole(FARMER_ROLE) {
        require(dids[msg.sender].active, "Farmer must have DID");
        require(initialQuality <= 100, "Quality must be 0-100");
        require(weight > 0, "Weight must be positive");
        
        _batchIdCounter++;
        uint256 newBatchId = _batchIdCounter;

        batches[newBatchId] = Batch({
            id: newBatchId,
            farmer: msg.sender,
            weight: weight,
            initialQuality: initialQuality,
            origin: origin,
            createdAt: block.timestamp,
            status: BatchStatus.Created,
            currentOwner: msg.sender,
            vcIds: new uint256[](0),
            exists: true,
            onMarket: true,           // Direct op markt
            buyer: address(0),         // Nog geen koper
            escrowAmount: 0,          // Nog geen escrow
            certified: false,         // Nog niet gecertificeerd
            rejected: false           // Nog niet afgekeurd
        });

        farmerBatches[msg.sender].push(newBatchId);

        emit BatchCreated(newBatchId, msg.sender, weight, initialQuality);
    }

    /**
     * @dev Inkoopcoöperatie koopt batch van markt
     * Betaling wordt in escrow vastgezet
     */
    function purchaseBatch(uint256 batchId) external onlyRole(FACTORY_ROLE) {
        require(batches[batchId].exists, "Batch does not exist");
        require(batches[batchId].onMarket, "Batch not on market");
        require(batches[batchId].status == BatchStatus.Created, "Batch already purchased");
        
        // Bereken betaling o.b.v. kwaliteit
        uint256 quality = batches[batchId].initialQuality;
        uint256 weight = batches[batchId].weight;
        
        uint256 ratePerKg = 10 * 10**6; // 10 USDT basis (6 decimals)
        if (quality >= 90) {
            ratePerKg = 13 * 10**6; // 13 USDT (+30%)
        } else if (quality >= 70) {
            ratePerKg = 115 * 10**5; // 11.5 USDT (+15%)
        }
        
        uint256 totalAmount = weight * ratePerKg; // weight (kg) * pricePerKg (USDT met 6 decimals)
        
        // Transfer USDT naar contract (escrow)
        require(usdt.transferFrom(msg.sender, address(this), totalAmount), "USDT transfer failed");
        
        // Update batch
        batches[batchId].status = BatchStatus.Reserved;
        batches[batchId].onMarket = false;
        batches[batchId].buyer = msg.sender;
        batches[batchId].escrowAmount = totalAmount;
        batches[batchId].currentOwner = msg.sender;
        
        emit BatchPurchased(batchId, msg.sender, totalAmount);
        emit BatchStatusUpdated(batchId, BatchStatus.Reserved);
    }

    /**
     * @dev Certificeerder keurt batch goed of af
     */
    function certifyBatch(uint256 batchId, bool approved) external onlyRole(CERTIFIER_ROLE) {
        require(batches[batchId].exists, "Batch does not exist");
        require(batches[batchId].status == BatchStatus.Reserved, "Batch must be reserved");
        require(!batches[batchId].certified && !batches[batchId].rejected, "Batch already certified");
        
        if (approved) {
            // Goedgekeurd: betaal boer uit escrow
            batches[batchId].certified = true;
            batches[batchId].status = BatchStatus.Verified;
            
            address farmer = batches[batchId].farmer;
            uint256 amount = batches[batchId].escrowAmount;
            
            require(usdt.transfer(farmer, amount), "USDT transfer to farmer failed");
            
            // Track payment
            batchPayments[batchId].push(Payment({
                from: batches[batchId].buyer,
                to: farmer,
                amount: amount,
                batchId: batchId,
                reason: "Certified batch payment",
                timestamp: block.timestamp
            }));
            
            emit EscrowReleased(batchId, farmer, amount);
            emit PaymentMade(batchId, batches[batchId].buyer, farmer, amount, "Certified batch payment");
        } else {
            // Afgekeurd: geld terug naar koper
            batches[batchId].rejected = true;
            batches[batchId].status = BatchStatus.Rejected;
            batches[batchId].onMarket = true; // Terug op markt
            
            address buyer = batches[batchId].buyer;
            uint256 amount = batches[batchId].escrowAmount;
            
            require(usdt.transfer(buyer, amount), "USDT refund failed");
            
            // Reset batch voor herverkoop
            batches[batchId].buyer = address(0);
            batches[batchId].escrowAmount = 0;
            batches[batchId].currentOwner = batches[batchId].farmer;
            
            emit EscrowRefunded(batchId, buyer, amount);
        }
        
        emit BatchCertified(batchId, msg.sender, approved);
        emit BatchStatusUpdated(batchId, batches[batchId].status);
    }

    /**
     * @dev Update batch status
     * Anyone with a valid role can update status based on their role permissions
     */
    function updateBatchStatus(uint256 batchId, BatchStatus newStatus) external {
        require(batches[batchId].exists, "Batch does not exist");
        
        // Reserved, Verified en Rejected worden nu via purchaseBatch en certifyBatch functies gezet
        require(
            newStatus != BatchStatus.Reserved && 
            newStatus != BatchStatus.Verified && 
            newStatus != BatchStatus.Rejected,
            "Use purchaseBatch/certifyBatch for these statuses"
        );
        
        // Check role-based permissions for status transitions
        if (newStatus == BatchStatus.InTransit) {
            require(hasRole(TRANSPORTER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Only transporter can set in transit");
        } else if (newStatus == BatchStatus.QualityChecked || newStatus == BatchStatus.Delivered || newStatus == BatchStatus.Completed) {
            require(hasRole(FACTORY_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Only factory can update to this status");
        } else {
            require(
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                batches[batchId].currentOwner == msg.sender,
                "Not authorized"
            );
        }
        
        batches[batchId].status = newStatus;
        
        emit BatchStatusUpdated(batchId, newStatus);
    }

    // ========== IOT FUNCTIONS ==========
    
    /**
     * @dev Voeg IoT sensor data toe
     */
    function addIoTData(
        uint256 batchId,
        int256 temperature,
        uint256 humidity,
        string memory location
    ) external onlyRole(TRANSPORTER_ROLE) {
        require(batches[batchId].exists, "Batch does not exist");
        
        batchIoTData[batchId].push(IoTData({
            temperature: temperature,
            humidity: humidity,
            location: location,
            timestamp: block.timestamp,
            recorder: msg.sender
        }));
        
        emit IoTDataAdded(batchId, temperature, humidity, location);
    }

    /**
     * @dev Voeg meerdere IoT sensor data toe in 1 transactie (BATCH)
     */
    function addBatchIoTData(
        uint256 batchId,
        int256[] memory temperatures,
        uint256[] memory humidities,
        string[] memory locations
    ) external onlyRole(TRANSPORTER_ROLE) {
        require(batches[batchId].exists, "Batch does not exist");
        require(
            temperatures.length == humidities.length && 
            temperatures.length == locations.length,
            "Array lengths must match"
        );
        
        for (uint256 i = 0; i < temperatures.length; i++) {
            batchIoTData[batchId].push(IoTData({
                temperature: temperatures[i],
                humidity: humidities[i],
                location: locations[i],
                timestamp: block.timestamp,
                recorder: msg.sender
            }));
            
            emit IoTDataAdded(batchId, temperatures[i], humidities[i], locations[i]);
        }
    }

    /**
     * @dev Haal IoT data op voor een batch
     */
    function getIoTData(uint256 batchId, uint256 index) external view returns (
        int256 temperature,
        uint256 humidity,
        string memory location,
        uint256 timestamp,
        address recorder
    ) {
        require(index < batchIoTData[batchId].length, "Index out of bounds");
        IoTData memory data = batchIoTData[batchId][index];
        return (data.temperature, data.humidity, data.location, data.timestamp, data.recorder);
    }

    /**
     * @dev Aantal IoT records voor een batch
     */
    function getIoTDataCount(uint256 batchId) external view returns (uint256) {
        return batchIoTData[batchId].length;
    }

    // ========== PAYMENT FUNCTIONS ==========
    
    /**
     * @dev Betaal voor een batch met USDT
     */
    function payForBatch(
        uint256 batchId,
        address to,
        uint256 amount,
        string memory reason
    ) external {
        require(batches[batchId].exists, "Batch does not exist");
        require(amount > 0, "Amount must be positive");
        
        // Transfer USDT van msg.sender naar 'to'
        require(usdt.transferFrom(msg.sender, to, amount), "USDT transfer failed");
        
        // Registreer payment
        batchPayments[batchId].push(Payment({
            from: msg.sender,
            to: to,
            amount: amount,
            batchId: batchId,
            reason: reason,
            timestamp: block.timestamp
        }));
        
        emit PaymentMade(batchId, msg.sender, to, amount, reason);
    }

    /**
     * @dev Betaal kwaliteitsbonus aan boer
     */
    function payQualityBonus(uint256 batchId) external {
        require(batches[batchId].exists, "Batch does not exist");
        Batch memory batch = batches[batchId];
        
        // Bereken bonus gebaseerd op kwaliteit
        uint256 baseAmount = batch.weight * 10 * 10**6; // 10 USDT per kg (6 decimals)
        uint256 bonus = 0;
        
        if (batch.initialQuality >= 90) {
            bonus = (baseAmount * 30) / 100; // +30%
        } else if (batch.initialQuality >= 70) {
            bonus = (baseAmount * 15) / 100; // +15%
        }
        
        uint256 totalAmount = baseAmount + bonus;
        
        // Transfer USDT
        require(usdt.transferFrom(msg.sender, batch.farmer, totalAmount), "USDT transfer failed");
        
        // Registreer payment
        batchPayments[batchId].push(Payment({
            from: msg.sender,
            to: batch.farmer,
            amount: totalAmount,
            batchId: batchId,
            reason: "quality_bonus",
            timestamp: block.timestamp
        }));
        
        emit PaymentMade(batchId, msg.sender, batch.farmer, totalAmount, "quality_bonus");
    }

    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Haal batch informatie op
     */
    function getBatch(uint256 batchId) external view returns (
        uint256,
        address,
        uint256,
        uint256,
        string memory,
        uint256,
        BatchStatus,
        address,
        uint256[] memory,
        bool,
        address,
        uint256,
        bool,
        bool
    ) {
        Batch storage batch = batches[batchId];
        require(batch.exists, "Batch does not exist");
        return (
            batch.id,
            batch.farmer,
            batch.weight,
            batch.initialQuality,
            batch.origin,
            batch.createdAt,
            batch.status,
            batch.currentOwner,
            batch.vcIds,
            batch.onMarket,
            batch.buyer,
            batch.escrowAmount,
            batch.certified,
            batch.rejected
        );
    }

    /**
     * @dev Haal alle batches op markt op
     */
    function getMarketBatches() external view returns (uint256[] memory) {
        uint256 count = 0;
        // Tel eerst hoeveel batches op markt staan
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (batches[i].onMarket && batches[i].status == BatchStatus.Created) {
                count++;
            }
        }
        
        // Maak array en vul met batch IDs
        uint256[] memory marketBatches = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (batches[i].onMarket && batches[i].status == BatchStatus.Created) {
                marketBatches[index] = i;
                index++;
            }
        }
        
        return marketBatches;
    }

    /**
     * @dev Haal alle gereserveerde batches op (wachten op certificering)
     */
    function getReservedBatches() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (batches[i].status == BatchStatus.Reserved) {
                count++;
            }
        }
        
        uint256[] memory reservedBatches = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (batches[i].status == BatchStatus.Reserved) {
                reservedBatches[index] = i;
                index++;
            }
        }
        
        return reservedBatches;
    }

    /**
     * @dev Haal alle batches van een boer op
     */
    function getFarmerBatches(address farmer) external view returns (uint256[] memory) {
        return farmerBatches[farmer];
    }

    /**
     * @dev Totaal aantal batches
     */
    function getTotalBatches() external view returns (uint256) {
        return _batchIdCounter;
    }

    /**
     * @dev Haal payments voor een batch op
     */
    function getBatchPayments(uint256 batchId) external view returns (Payment[] memory) {
        return batchPayments[batchId];
    }

    /**
     * @dev Check of address een DID heeft
     */
    function hasDID(address account) external view returns (bool) {
        return dids[account].active;
    }

    /**
     * @dev Haal credential op
     */
    function getCredential(uint256 vcId) external view returns (
        uint256 id,
        address issuer,
        address subject,
        string memory credentialType,
        string memory data,
        uint256 issuedAt,
        uint256 expiresAt,
        bool revoked
    ) {
        VerifiableCredential memory vc = credentials[vcId];
        return (
            vc.id,
            vc.issuer,
            vc.subject,
            vc.credentialType,
            vc.data,
            vc.issuedAt,
            vc.expiresAt,
            vc.revoked
        );
    }

    /**
     * @dev Haal alle VC IDs van een subject op
     */
    function getSubjectVCs(address subject) external view returns (uint256[] memory) {
        return subjectCredentials[subject];
    }

    // ========== HELPER FUNCTIONS ==========
    
    function toHexString(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint256 i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(addr)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i] = char(hi);
            s[2*i+1] = char(lo);
        }
        return string(abi.encodePacked("0x", string(s)));
    }

    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}
