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
        uint256 escrowAmount; // Totaal vastgezet bedrag in USDT (van buyer)
        uint256 farmerAmount; // Bedrag voor boer
        uint256 certifierFee; // Bedrag voor certificeerder
        uint256 transporterFee; // Bedrag voor transporteur
        uint256 farmerEscrow; // Escrow van boer (voor certificeerder fee bij afkeuring)
        address certifier; // Certificeerder die batch controleert
        address transporter; // Transporteur die IoT data toevoegt
        bool certified; // Door certificeerder goedgekeurd?
        bool rejected; // Door certificeerder afgekeurd?
        bool certifierPaid; // Certificeerder betaald?
        bool transporterPaid; // Transporteur betaald?
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
    // Lijst van alle adressen met een geregistreerde DID (voor off-chain discovery)
    address[] private _didControllers;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => IoTData[]) public batchIoTData;
    mapping(uint256 => VerifiableCredential) public credentials;
    mapping(address => uint256[]) public farmerBatches;
    mapping(uint256 => Payment[]) public batchPayments;
    mapping(address => uint256[]) public subjectCredentials; // Track VCs per subject
    
    // Farmer escrow balances (centrale escrow per farmer voor alle batches)
    mapping(address => uint256) public farmerEscrowBalance;
    
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
    event CertifierPaid(uint256 indexed batchId, address indexed certifier, uint256 amount);
    event TransporterPaid(uint256 indexed batchId, address indexed transporter, uint256 amount);
    event FarmerEscrowDeposited(address indexed farmer, uint256 amount, uint256 newBalance);
    event FarmerEscrowRefunded(address indexed farmer, uint256 amount, uint256 newBalance);
    event FarmerEscrowUsed(uint256 indexed batchId, address indexed farmer, uint256 amount, uint256 remainingBalance);

    // Fee structure - basis fee + per kilo
    // Transporteur: vaste basis fee + vast bedrag per kilo
    uint256 public constant TRANSPORTER_BASE_FEE = 50 * 10**6; // 50 USDT basis fee
    uint256 public constant TRANSPORTER_PER_KG = 0.20 * 10**6; // 0.20 USDT per kilo
    
    // Certificeerder: vaste basis fee + degressief tarief per kilo
    uint256 public constant CERTIFIER_BASE_FEE = 100 * 10**6; // 100 USDT basis fee
    // Degressieve tarieven per kilo (in USDT met 6 decimalen)
    // 0-500 kg: 1.00 USDT/kg
    // 501-1000 kg: 0.80 USDT/kg  
    // 1001-2000 kg: 0.60 USDT/kg
    // 2001+ kg: 0.40 USDT/kg
    
    uint256 public constant MIN_FARMER_ESCROW = 1000 * 10**6; // Minimum 1000 USDT escrow voor farmers

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

        _didControllers.push(controller);
        
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

    /**
     * @dev Haal alle DID controllers op (alle adressen met een geregistreerde DID)
     */
    function getAllDIDControllers() external view returns (address[] memory) {
        return _didControllers;
    }

    /**
     * @dev Haal een volledige DID op voor een adres
     */
    function getDID(address account) external view returns (string memory identifier, string memory publicKey, string memory didType, uint256 registered, bool active) {
        DID memory d = dids[account];
        return (d.identifier, d.publicKey, d.didType, d.registered, d.active);
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
        require(batches[batchId].exists, "Batch not found");
        require(credentials[vcId].id != 0, "VC not found");
        require(credentials[vcId].subject == batches[batchId].farmer, "VC subject mismatch");
        require(!credentials[vcId].revoked, "VC revoked");
        require(block.timestamp < credentials[vcId].expiresAt, "VC expired");
        
        batches[batchId].vcIds.push(vcId);
        
        emit VCAttachedToBatch(batchId, vcId);
    }

    // ========== BATCH FUNCTIONS ==========
    
    /**
     * @dev Creëer nieuwe katoen batch
     * Batch wordt aangemaakt maar NIET op markt gezet (boer moet putBatchOnMarket() aanroepen)
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
            onMarket: false,          // NIET op markt (moet apart op markt gezet worden)
            buyer: address(0),         // Nog geen koper
            escrowAmount: 0,          // Nog geen escrow
            farmerAmount: 0,          // Nog geen farmer betaling
            certifierFee: 0,          // Nog geen certificeerder fee
            transporterFee: 0,        // Nog geen transporteur fee
            farmerEscrow: 0,          // Nog geen farmer escrow
            certifier: address(0),    // Nog geen certificeerder
            transporter: address(0),  // Nog geen transporteur
            certified: false,         // Nog niet gecertificeerd
            rejected: false,          // Nog niet afgekeurd
            certifierPaid: false,     // Certificeerder nog niet betaald
            transporterPaid: false    // Transporteur nog niet betaald
        });

        farmerBatches[msg.sender].push(newBatchId);

        emit BatchCreated(newBatchId, msg.sender, weight, initialQuality);
    }

    /**
     * @dev Stort geld in farmer escrow (centrale escrow voor alle batches)
     * Boer moet minimaal MIN_FARMER_ESCROW storten
     */
    function depositFarmerEscrow(uint256 amount) external onlyRole(FARMER_ROLE) {
        require(amount >= MIN_FARMER_ESCROW, "Min escrow amount");
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        farmerEscrowBalance[msg.sender] += amount;
        
        emit FarmerEscrowDeposited(msg.sender, amount, farmerEscrowBalance[msg.sender]);
    }

    /**
     * @dev Haal geld terug uit farmer escrow (alleen als er geen batches op de markt staan)
     */
    function withdrawFarmerEscrow(uint256 amount) external onlyRole(FARMER_ROLE) {
        require(farmerEscrowBalance[msg.sender] >= amount, "Insufficient escrow balance");
        
        // Check of farmer actieve batches op markt heeft
        uint256[] memory farmerBatchIds = farmerBatches[msg.sender];
        for (uint256 i = 0; i < farmerBatchIds.length; i++) {
            uint256 batchId = farmerBatchIds[i];
            if (batches[batchId].onMarket && batches[batchId].buyer == address(0)) {
                revert("Cannot withdraw escrow while batches are on market");
            }
        }
        
        farmerEscrowBalance[msg.sender] -= amount;
        require(usdt.transfer(msg.sender, amount), "Escrow withdrawal failed");
        
        emit FarmerEscrowRefunded(msg.sender, amount, farmerEscrowBalance[msg.sender]);
    }

    /**
     * @dev Zet batch op de markt (vereist voldoende farmer escrow)
     * Check of farmer voldoende escrow heeft voor potentiële certificeerder fee
     */
    function putBatchOnMarket(uint256 batchId) external onlyRole(FARMER_ROLE) {
        require(batches[batchId].exists, "Batch not found");
        require(batches[batchId].farmer == msg.sender, "Not batch owner");
        require(!batches[batchId].onMarket, "Already on market");
        require(batches[batchId].buyer == address(0), "Already sold");
        
        // Bereken certificeerder fee: basis 100 USDT + degressief per kg
        uint256 weight = batches[batchId].weight;
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
        
        batches[batchId].farmerEscrow = requiredEscrow;
        batches[batchId].onMarket = true;
    }

    /**
     * @dev Inkoopcoöperatie koopt batch van markt
     * Betaling wordt in escrow vastgezet (inclusief fees voor certificeerder en transporteur)
     */
    function purchaseBatch(uint256 batchId) external onlyRole(FACTORY_ROLE) {
        require(batches[batchId].exists, "Batch does not exist");
        require(batches[batchId].onMarket, "Batch not on market");
        require(batches[batchId].status == BatchStatus.Created, "Batch already purchased");
        
        uint256 quality = batches[batchId].initialQuality;
        uint256 weight = batches[batchId].weight;
        
        uint256 ratePerKg = 10 * 10**6;
        if (quality >= 90) {
            ratePerKg = 13 * 10**6;
        } else if (quality >= 70) {
            ratePerKg = 115 * 10**5;
        }
        
        uint256 totalAmount = weight * ratePerKg;
        
        // Certificeerder fee: basis 100 USDT + degressief per kg
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
        
        // Transporteur fee: basis 50 USDT + 0.20 per kg
        uint256 transporterFee = TRANSPORTER_BASE_FEE + (weight * TRANSPORTER_PER_KG);
        
        uint256 farmerAmount = totalAmount - certifierFee - transporterFee;
        
        require(usdt.transferFrom(msg.sender, address(this), totalAmount), "USDT transfer failed");
        
        // Update batch
        batches[batchId].status = BatchStatus.Reserved;
        batches[batchId].onMarket = false;
        batches[batchId].buyer = msg.sender;
        batches[batchId].escrowAmount = totalAmount;
        batches[batchId].farmerAmount = farmerAmount;
        batches[batchId].certifierFee = certifierFee;
        batches[batchId].transporterFee = transporterFee;
        batches[batchId].currentOwner = msg.sender;
        
        emit BatchPurchased(batchId, msg.sender, totalAmount);
        emit BatchStatusUpdated(batchId, BatchStatus.Reserved);
    }

    /**
     * @dev Certificeerder keurt batch goed of af
     * Bij goedkeuring: farmer krijgt farmerAmount, certificeerder krijgt fee uit buyer escrow
     * Bij afkeuring: buyer krijgt refund MINUS certificeerder fee, certificeerder krijgt fee uit farmer escrow
     */
    function certifyBatch(uint256 batchId, bool approved) external onlyRole(CERTIFIER_ROLE) {
        require(batches[batchId].exists, "Batch does not exist");
        require(batches[batchId].status == BatchStatus.Reserved, "Batch must be reserved");
        require(!batches[batchId].certified && !batches[batchId].rejected, "Batch already certified");
        require(!batches[batchId].certifierPaid, "Certifier already paid");
        
        batches[batchId].certifier = msg.sender;
        batches[batchId].certifierPaid = true;
        
        if (approved) {
            // Goedgekeurd: betaal boer en certificeerder uit buyer escrow
            // Farmer escrow reservering vrijgeven (blijft in centrale balance)
            batches[batchId].certified = true;
            batches[batchId].status = BatchStatus.Verified;
            
            address farmer = batches[batchId].farmer;
            uint256 farmerAmount = batches[batchId].farmerAmount;
            uint256 certifierFee = batches[batchId].certifierFee;
            
            // Betaal farmer
            require(usdt.transfer(farmer, farmerAmount), "Farmer transfer failed");
            
            // Betaal certificeerder uit buyer escrow
            require(usdt.transfer(msg.sender, certifierFee), "Certifier transfer failed");
            
            // Track payments
            batchPayments[batchId].push(Payment({
                from: batches[batchId].buyer,
                to: farmer,
                amount: farmerAmount,
                batchId: batchId,
                reason: "Certified payment",
                timestamp: block.timestamp
            }));
            
            batchPayments[batchId].push(Payment({
                from: batches[batchId].buyer,
                to: msg.sender,
                amount: certifierFee,
                batchId: batchId,
                reason: "Certifier fee",
                timestamp: block.timestamp
            }));
            
            // Reset farmer escrow reservering (escrow blijft in centrale balance voor volgende batches)
            batches[batchId].farmerEscrow = 0;
            
            emit EscrowReleased(batchId, farmer, farmerAmount);
            emit CertifierPaid(batchId, msg.sender, certifierFee);
            emit PaymentMade(batchId, batches[batchId].buyer, farmer, farmerAmount, "Certified batch payment");
        } else {
            // Afgekeurd: buyer krijgt VOLLEDIGE refund
            // Certificeerder krijgt fee uit FARMER'S CENTRALE ESCROW
            batches[batchId].rejected = true;
            batches[batchId].status = BatchStatus.Rejected;
            batches[batchId].onMarket = true; // Terug op markt
            
            address buyer = batches[batchId].buyer;
            address farmer = batches[batchId].farmer;
            uint256 fullRefund = batches[batchId].escrowAmount;
            uint256 certifierFee = batches[batchId].certifierFee;
            
            // Refund buyer (VOLLEDIGE escrow bedrag)
            require(usdt.transfer(buyer, fullRefund), "Refund failed");
            
            // Trek certifier fee af van farmer's centrale escrow
            require(farmerEscrowBalance[farmer] >= certifierFee, "Insufficient escrow");
            farmerEscrowBalance[farmer] -= certifierFee;
            
            // Betaal certificeerder uit farmer's centrale escrow
            require(usdt.transfer(msg.sender, certifierFee), "Certifier transfer failed");
            
            emit FarmerEscrowUsed(batchId, farmer, certifierFee, farmerEscrowBalance[farmer]);
            
            // Track payments
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
                reason: "Certifier fee (rejected - from farmer escrow)",
                timestamp: block.timestamp
            }));
            
            // Reset batch voor herverkoop
            batches[batchId].buyer = address(0);
            batches[batchId].escrowAmount = 0;
            batches[batchId].farmerAmount = 0;
            batches[batchId].certifierFee = 0;
            batches[batchId].transporterFee = 0;
            batches[batchId].farmerEscrow = 0; // Reset batch escrow reservering
            batches[batchId].currentOwner = farmer;
            
            emit EscrowRefunded(batchId, buyer, fullRefund);
            emit CertifierPaid(batchId, msg.sender, certifierFee);
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
            require(hasRole(TRANSPORTER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Transporter only");
        } else if (newStatus == BatchStatus.QualityChecked || newStatus == BatchStatus.Delivered || newStatus == BatchStatus.Completed) {
            require(hasRole(FACTORY_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Factory only");
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
     * Betaal transporteur fee uit escrow bij eerste IoT data toevoeging
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
        
        // Betaal transporteur fee bij eerste IoT data toevoeging
        if (!batches[batchId].transporterPaid && batches[batchId].transporterFee > 0) {
            batches[batchId].transporter = msg.sender;
            batches[batchId].transporterPaid = true;
            
            uint256 fee = batches[batchId].transporterFee;
            require(usdt.transfer(msg.sender, fee), "USDT transfer to transporter failed");
            
            batchPayments[batchId].push(Payment({
                from: batches[batchId].buyer,
                to: msg.sender,
                amount: fee,
                batchId: batchId,
                reason: "Transporter fee for IoT data",
                timestamp: block.timestamp
            }));
            
            emit TransporterPaid(batchId, msg.sender, fee);
            emit PaymentMade(batchId, batches[batchId].buyer, msg.sender, fee, "Transporter fee");
        }
        
        emit IoTDataAdded(batchId, temperature, humidity, location);
    }

    /**
     * @dev Voeg meerdere IoT sensor data toe in 1 transactie (BATCH)
     * Betaal transporteur fee uit escrow bij eerste IoT data toevoeging
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
        
        // Betaal transporteur fee bij eerste IoT data toevoeging
        if (!batches[batchId].transporterPaid && batches[batchId].transporterFee > 0) {
            batches[batchId].transporter = msg.sender;
            batches[batchId].transporterPaid = true;
            
            uint256 fee = batches[batchId].transporterFee;
            require(usdt.transfer(msg.sender, fee), "USDT transfer to transporter failed");
            
            batchPayments[batchId].push(Payment({
                from: batches[batchId].buyer,
                to: msg.sender,
                amount: fee,
                batchId: batchId,
                reason: "Transporter fee for IoT data",
                timestamp: block.timestamp
            }));
            
            emit TransporterPaid(batchId, msg.sender, fee);
            emit PaymentMade(batchId, batches[batchId].buyer, msg.sender, fee, "Transporter fee");
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
        uint256,
        uint256,
        uint256,
        uint256,
        address,
        address,
        bool,
        bool,
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
            batch.farmerAmount,
            batch.certifierFee,
            batch.transporterFee,
            batch.farmerEscrow,
            batch.certifier,
            batch.transporter,
            batch.certified,
            batch.rejected,
            batch.certifierPaid,
            batch.transporterPaid
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
     * @dev Haal farmer escrow balance op
     */
    function getFarmerEscrowBalance(address farmer) external view returns (uint256) {
        return farmerEscrowBalance[farmer];
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
