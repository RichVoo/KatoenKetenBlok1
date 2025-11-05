// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CottonVC {
    uint256 public nextId = 1;

    struct Credential {
        uint256 id;
        address issuer;
        address subject;
        string data; // could be IPFS hash or JSON string
        bool valid;
    }

    mapping(uint256 => Credential) public credentials;

    event Issued(uint256 indexed id, address indexed issuer, address indexed subject, string data);
    event Revoked(uint256 indexed id);

    function issueCredential(address subject, string calldata data) external returns (uint256) {
        uint256 id = nextId++;
        credentials[id] = Credential({
            id: id,
            issuer: msg.sender,
            subject: subject,
            data: data,
            valid: true
        });
        emit Issued(id, msg.sender, subject, data);
        return id;
    }

    function verifyCredential(uint256 id) external view returns (bool valid, address issuer, address subject, string memory data) {
        Credential storage c = credentials[id];
        return (c.valid, c.issuer, c.subject, c.data);
    }

    function revokeCredential(uint256 id) external {
        Credential storage c = credentials[id];
        require(c.issuer == msg.sender, "Only issuer can revoke");
        require(c.valid, "Already revoked");
        c.valid = false;
        emit Revoked(id);
    }
}
