const API_URL = 'http://localhost:3002';

document.addEventListener('DOMContentLoaded', () => {
    async function postJson(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    function show(stepId) {
        ['form-step', 'verify-step', 'progress-step', 'result-step'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(stepId).classList.remove('hidden');
    }

    async function loadDIDs() {
        try {
            const response = await fetch(`${API_URL}/api/registrations`);
            const registrations = await response.json();
            
            const listDiv = document.getElementById('did-list');
            if (registrations.length === 0) {
                listDiv.innerHTML = '<p style="color:#6b7280;text-align:center">Nog geen DIDs geregistreerd</p>';
                return;
            }
            
            listDiv.innerHTML = registrations.map(reg => {
                const roleClass = `role-${reg.role || 'farmer'}`;
                const roleNames = {
                    farmer: '🌾 Boer',
                    processor: '🏭 Verwerker',
                    manufacturer: '🏗️ Fabrikant',
                    retailer: '🏪 Detailhandelaar',
                    auditor: '🔍 Auditor'
                };
                const roleName = roleNames[reg.role] || '🌾 Boer';
                const status = reg.txHash ? '✅ On-chain' : '⚠️ Pending';
                
                return `
                    <div class="did-item">
                        <strong>${reg.naam} - ${reg.bedrijfsnaam} <span class="role-badge ${roleClass}">${roleName}</span></strong>
                        <div style="font-family:monospace;font-size:12px;color:#4b5563;margin:4px 0">${reg.did}</div>
                        <small>URN: ${reg.urn} | ${status}</small>
                        <small style="display:block">Geregistreerd: ${new Date(reg.timestamp).toLocaleString('nl-NL')}</small>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading DIDs:', error);
            document.getElementById('did-list').innerHTML = '<p style="color:#ef4444">Fout bij laden DIDs</p>';
        }
    }

    // Step 1: Request verification code
    document.getElementById('requestBtn').addEventListener('click', async () => {
        const naam = document.getElementById('naam').value.trim();
        const bedrijfsnaam = document.getElementById('bedrijfsnaam').value.trim();
        const urn = document.getElementById('urn').value.trim();
        const contact = document.getElementById('contact').value.trim();
        const role = document.getElementById('role').value;

        if (!naam || !bedrijfsnaam || !urn || !contact) {
            alert('Vul alle verplichte velden in (inclusief email)');
            return;
        }

        try {
            const result = await postJson(`${API_URL}/api/request-verification`, {
                naam,
                bedrijfsnaam,
                urn,
                email: contact,
                telefoon: contact,
                didType: role
            });

            console.log('✅ Verification code sent:', result.code);
            alert(`Verificatie code: ${result.code}\n(Check ook de console logs van de DID service)`);
            show('verify-step');
        } catch (error) {
            console.error('Verification request error:', error);
            alert('Error bij aanvragen verificatie: ' + error.message);
        }
    });

    // Step 2: Verify code and create wallet
    document.getElementById('verifyBtn').addEventListener('click', async () => {
        const code = document.getElementById('verificationCode').value.trim();

        if (!code) {
            alert('Vul de verificatie code in');
            return;
        }

        show('progress-step');

        try {
            console.log('Step 1: Verifying code and creating wallet...');
            const registration = await postJson(`${API_URL}/api/verify-and-create-wallet`, {
                verificationCode: code
            });

            console.log('Step 2: Registering on-chain...', registration.walletAddress);
            const onChainResult = await postJson(`${API_URL}/api/register-on-chain`, {
                walletAddress: registration.walletAddress
            });

            console.log('Registration complete!', onChainResult);
            
            document.getElementById('out-did').textContent = registration.did;
            document.getElementById('out-address').textContent = registration.walletAddress;
            document.getElementById('out-key').textContent = registration.privateKey;
            document.getElementById('out-tx').textContent = onChainResult.txHash || 'n.v.t.';

            show('result-step');
            loadDIDs();
        } catch (error) {
            console.error('Verification error:', error);
            alert('Error tijdens verificatie: ' + error.message);
            show('verify-step');
        }
    });

    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        show('form-step');
    });

    document.getElementById("registerBtn").addEventListener("click", async () => {
        const naam = document.getElementById("naam").value.trim();
        const bedrijfsnaam = document.getElementById("bedrijfsnaam").value.trim();
        const urn = document.getElementById("urn").value.trim();
        const contact = document.getElementById("contact").value.trim();
        const role = document.getElementById("role").value;

        if (!naam || !bedrijfsnaam || !urn) {
            alert("Vul naam, bedrijfsnaam en URN in");
            return;
        }

        show("progress-step");

        try {
            console.log("Step 1: Creating wallet and DID...");
            const registration = await postJson(`${API_URL}/api/register`, {
                naam,
                bedrijfsnaam,
                urn,
                email: contact,
                telefoon: contact,
                role: role
            });

            console.log("Step 2: Registering on-chain...", registration.walletAddress);
            const onChainResult = await postJson(`${API_URL}/api/register-on-chain`, {
                walletAddress: registration.walletAddress
            });

            console.log("Registration complete!", onChainResult);
            
            document.getElementById("out-did").textContent = registration.did;
            document.getElementById("out-address").textContent = registration.walletAddress;
            document.getElementById("out-key").textContent = registration.privateKey;
            document.getElementById("out-tx").textContent = onChainResult.txHash || "n.v.t.";

            show("result-step");
            loadDIDs(); // Refresh the list
        } catch (error) {
            console.error("Registration error:", error);
            alert("Error tijdens registratie: " + error.message);
            show("form-step");
        }
    });

    document.getElementById("newBtn").addEventListener("click", () => {
        location.reload();
    });

    document.getElementById("refreshBtn").addEventListener("click", () => {
        loadDIDs();
    });

    // Load DIDs on page load
    loadDIDs();
});
