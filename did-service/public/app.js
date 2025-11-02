document.addEventListener('DOMContentLoaded', async () => {
    // Controleer of we op de registratiepagina zijn
    if (!document.getElementById('registerBtn')) {
        return; // We zijn niet op register.html, dus stop hier
    }

    async function postJson(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    function show(stepId) {
        ['form-step', 'progress-step', 'result-step'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(stepId).classList.remove('hidden');
    }

    // Event listener voor registratie
    document.getElementById('registerBtn').addEventListener('click', async () => {
        const naam = document.getElementById('naam').value.trim();
        const bedrijfsnaam = document.getElementById('bedrijfsnaam').value.trim();
        const urn = document.getElementById('urn').value.trim();
        const contact = document.getElementById('contact').value.trim();

        if (!naam || !bedrijfsnaam || !urn) {
            alert('Vul tenminste naam, bedrijfsnaam en URN in');
            return;
        }

        show('progress-step');

        try {
            // 1) Registreer (maakt wallet + did aan en slaat registratie op)
            const registration = await postJson('/api/register', {
                naam,
                bedrijfsnaam,
                urn,
                email: contact,
                telefoon: contact
            });

            // 2) Registreer direct op de blockchain met het verkregen wallet adres
            const onChainResult = await postJson('/api/register-on-chain', {
                walletAddress: registration.walletAddress
            });

            // Toon resultaten
            document.getElementById('out-did').textContent = registration.did;
            document.getElementById('out-address').textContent = registration.walletAddress;
            document.getElementById('out-key').textContent = registration.privateKey;
            document.getElementById('out-tx').textContent = onChainResult.txHash || onChainResult.receipt?.transactionHash || 'n.v.t.';

            show('result-step');
        } catch (error) {
            console.error('Registratiefout:', error);
            alert('Fout tijdens registratie: ' + error.message);
            show('form-step');
        }
    });

    // Nieuwe registratie knop
    document.getElementById('newBtn').addEventListener('click', () => {
        location.reload();
    });
});