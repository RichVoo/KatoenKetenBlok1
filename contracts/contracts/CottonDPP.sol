// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CottonDPP
 * @dev Katoen supply chain - DID, VC, Batch & IoT data management
 */
contract CottonDPP is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    
    uint256 private _batchIdCounter;
    uint256 private _vcIdCounter;

    // DID Structuur
    struct DID {
        string identifier;
        string publicKey;
        string didType;
        uint256 registered;
        bool active;
    }

    // Verifiable Credential Structuur
    struct VerifiableCredential {
        uint256 id;
        address issuer;
        address subject;
        string credentialType;
        string data;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
    }

    // Batch structuur
    struct Batch {
        uint256 id;
        address farmer;
        uint256 weight;
        uint256 initialQuality;
        string origin;
        uint256 createdAt;
        BatchStatus status;
        address currentOwner;
        uint256[] vcIds;
        bool exists;
    }

    // IoT Data
    struct IoTData {
        int256 temperature;
        uint256 humidity;
        string location;
        uint256 timestamp;
        address recorder;
    }

    enum BatchStatus {
        Created,
        Reserved,
        Verified,
        Rejected,
        InTransit,
        QualityChecked,
        Delivered,
        Completed
    }

    // Mappings
    mapping(address => DID) public dids;
    address[] private _didControllers;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => IoTData[]) public batchIoTData;
    mapping(uint256 => VerifiableCredential) public credentials;
    mapping(address => uint256[]) public farmerBatches;
    mapping(address => uint256[]) public subjectCredentials;
    
    // Events
    event DIDRegistered(address indexed controller, string identifier, string didType);
    event VCIssued(uint256 indexed vcId, address indexed issuer, address indexed subject, string credentialType);
    event BatchCreated(uint256 indexed batchId, address indexed farmer, uint256 weight, uint256 quality);
    event BatchStatusUpdated(uint256 indexed batchId, BatchStatus status);
    event IoTDataAdded(uint256 indexed batchId, int256 temperature, uint256 humidity, string location);
    event VCAttachedToBatch(uint256 indexed batchId, uint256 indexed vcId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ========== DID FUNCTIONS ==========
    
    function registerDID(
        address controller,
        string memory publicKey,
        string memory didType
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!dids[controller].active, "DID exists");
        require(bytes(didType).length > 0, "Type required");
        
        string memory identifier = string(abi.encodePacked("did:cotton:", toHexString(controller)));
        
        dids[controller] = DID({
            identifier: identifier,
            publicKey: publicKey,
            didType: didType,
            registered: block.timestamp,
            active: true
        });

        _didControllers.push(controller);
        
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

    function getAllDIDControllers() external view returns (address[] memory) {
        return _didControllers;
    }

    function getDID(address account) external view returns (string memory identifier, string memory publicKey, string memory didType, uint256 registered, bool active) {
        DID memory d = dids[account];
        return (d.identifier, d.publicKey, d.didType, d.registered, d.active);
    }

    function hasDID(address account) external view returns (bool) {
        return dids[account].active;
    }

    // ========== VC FUNCTIONS ==========
    
    function issueCredential(
        address subject,
        string memory credentialType,
        string memory data,
        uint256 validityDays
    ) external onlyRole(CERTIFIER_ROLE) {
        require(dids[subject].active, "No DID");
        
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
        
        subjectCredentials[subject].push(vcId);
        
        emit VCIssued(vcId, msg.sender, subject, credentialType);
    }

    function attachVCToBatch(uint256 batchId, uint256 vcId) external {
        require(batches[batchId].exists, "Batch not found");
        require(credentials[vcId].id != 0, "VC not found");
        require(credentials[vcId].subject == batches[batchId].farmer, "VC subject mismatch");
        require(!credentials[vcId].revoked, "VC revoked");
        require(block.timestamp < credentials[vcId].expiresAt, "VC expired");
        
        batches[batchId].vcIds.push(vcId);
        
        emit VCAttachedToBatch(batchId, vcId);
    }

    function getSubjectVCs(address subject) external view returns (uint256[] memory) {
        return subjectCredentials[subject];
    }

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
        return (vc.id, vc.issuer, vc.subject, vc.credentialType, vc.data, vc.issuedAt, vc.expiresAt, vc.revoked);
    }

    // ========== BATCH FUNCTIONS ==========
    
    function createBatch(
        uint256 weight,
        uint256 initialQuality,
        string memory origin
    ) external onlyRole(FARMER_ROLE) returns (uint256) {
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
            exists: true
        });

        farmerBatches[msg.sender].push(newBatchId);

        emit BatchCreated(newBatchId, msg.sender, weight, initialQuality);
        return newBatchId;
    }

    function updateBatchStatus(uint256 batchId, BatchStatus newStatus) external {
        require(batches[batchId].exists, "Batch not found");
        
        require(
            newStatus != BatchStatus.Reserved && 
            newStatus != BatchStatus.Verified && 
            newStatus != BatchStatus.Rejected,
            "Use marketplace for these"
        );
        
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

    function getBatch(uint256 batchId) external view returns (
        uint256 id,
        address farmer,
        uint256 weight,
        uint256 quality,
        string memory origin,
        uint256 createdAt,
        BatchStatus status,
        address currentOwner,
        uint256[] memory vcIds
    ) {
        Batch memory b = batches[batchId];
        return (b.id, b.farmer, b.weight, b.initialQuality, b.origin, b.createdAt, b.status, b.currentOwner, b.vcIds);
    }

    function getFarmerBatches(address farmer) external view returns (uint256[] memory) {
        return farmerBatches[farmer];
    }

    // ========== IOT FUNCTIONS ==========
    
    function addIoTData(
        uint256 batchId,
        int256 temperature,
        uint256 humidity,
        string memory location
    ) external onlyRole(TRANSPORTER_ROLE) {
        require(batches[batchId].exists, "Batch not found");
        
        batchIoTData[batchId].push(IoTData({
            temperature: temperature,
            humidity: humidity,
            location: location,
            timestamp: block.timestamp,
            recorder: msg.sender
        }));
        
        emit IoTDataAdded(batchId, temperature, humidity, location);
    }

    function addBatchIoTData(
        uint256 batchId,
        int256[] memory temperatures,
        uint256[] memory humidities,
        string[] memory locations
    ) external onlyRole(TRANSPORTER_ROLE) {
        require(batches[batchId].exists, "Batch not found");
        require(temperatures.length == humidities.length && temperatures.length == locations.length, "Array length mismatch");
        
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

    function getIoTDataCount(uint256 batchId) external view returns (uint256) {
        return batchIoTData[batchId].length;
    }

    // ========== HELPER FUNCTIONS ==========
    
    function toHexString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes20 value = bytes20(addr);
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
