# Nieuwe Batch Markt & Escrow Flow

## 🎯 Overzicht
Batches worden op een markt geplaatst waar inkoopcoöperaties kunnen kopen. Betaling wordt vastgezet in escrow totdat certificeerder goedkeurt.

## 📋 Flow

### 1. Boer maakt batch aan
- Status: `Created` (0)
- `onMarket`: `true`
- Batch verschijnt op marktplaats

### 2. Inkoopcoöperatie koopt batch
- Functie: `purchaseBatch(batchId)`
- Betaling (USDT) gaat naar smart contract (escrow)
- Status: `Reserved` (1)
- `onMarket`: `false`
- `buyer`: adres inkoopcoöperatie
- `escrowAmount`: betaalbedrag

### 3. Certificeerder keurt goed/af
- Functie: `certifyBatch(batchId, approved)`

#### ✅ Goedgekeurd (approved = true):
- Status: `Verified` (2)
- `certified`: `true`
- Escrow → Boer (USDT transfer)
- Event: `EscrowReleased`

#### ❌ Afgekeurd (approved = false):
- Status: `Rejected` (3)
- `rejected`: `true`
- Escrow → Inkoopcoöperatie (refund)
- `onMarket`: `true` (terug op markt)
- `buyer`: reset naar `address(0)`
- Event: `EscrowRefunded`

## 🔢 Nieuwe Statussen

```solidity
enum BatchStatus {
    Created,        // 0: Op markt
    Reserved,       // 1: Gekocht, in escrow
    Verified,       // 2: Goedgekeurd
    Rejected,       // 3: Afgekeurd
    InTransit,      // 4: Transport
    QualityChecked, // 5: Kwaliteitscheck
    Delivered,      // 6: Afgeleverd
    Completed       // 7: Compleet
}
```

## 📊 Nieuwe Smart Contract Functies

### `purchaseBatch(uint256 batchId)`
- Rol: FACTORY_ROLE
- Berekent betaling o.b.v. kwaliteit (10/11.5/13 USDT/kg)
- Transfer USDT naar contract
- Update batch status naar Reserved

### `certifyBatch(uint256 batchId, bool approved)`
- Rol: CERTIFIER_ROLE
- Approved: betaal boer uit escrow
- Rejected: refund koper, batch terug op markt

### `getMarketBatches()` → uint256[]
- Returns array van batch IDs die op markt staan

### `getReservedBatches()` → uint256[]
- Returns array van gereserveerde batches (wachten op certificering)

### `getBatch()` - Uitgebreid
- Nieuwe return values:
  - `bool onMarket`
  - `address buyer`
  - `uint256 escrowAmount`
  - `bool certified`
  - `bool rejected`

## 🎨 Frontend Aanpassingen Nodig

### 1. Factory Dashboard (stakeholder.html/app.js)
- **Marktplaats Tab**
  - Toon alle batches met status Created
  - Per batch: boer, gewicht, kwaliteit, prijs
  - Knop: "Koop Batch" → `purchaseBatch()`
  
- **Mijn Gekochte Batches**
  - Toon batches met status Reserved waar buyer = mijn adres
  - Status: "Wacht op certificering"

### 2. Certificeerder (vc-aanvraag.html)
- **Batch Certificering Tab**
  - Toon alle Reserved batches
  - Per batch: boer info, kwaliteit, escrow bedrag
  - Knoppen: "✅ Goedkeuren" / "❌ Afkeuren"
  - Call `certifyBatch(batchId, true/false)`

### 3. Boer Dashboard
- **Mijn Batches**
  - Status indicators:
    - "Op Markt" (Created)
    - "Verkocht - Wacht op Certificering" (Reserved)
    - "Goedgekeurd - Betaald!" (Verified)
    - "Afgekeurd - Terug op Markt" (Rejected)

### 4. DPP Viewer
- Toon escrow status
- Toon certificerings beslissing
- Timeline: Aangemaakt → Gekocht → Gecertificeerd → etc.

## ⚠️ Belangrijke Wijzigingen

1. **Oude `updateBatchStatus` kan NIET meer** Reserved/Verified/Rejected zetten
2. **Oude `payQualityBonus` vervangen** door escrow systeem
3. **USDT approve** moet nu naar contract adres (niet meer naar eindgebruiker)
4. **Betaling berekening** zit nu in `purchaseBatch` functie

## 📝 Contract Addressen
- USDT: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- IntegratedCottonDPP: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
