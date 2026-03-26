# Migration Scope (Candidate)
CLOUDBEDS DATA MIGRATION TOOL

---

## 1. Migration Scope (Candidate)

---

### 1.1 Profiles

Aşağıdaki profil tipleri migration kapsamında yer alacaktır:

- Individual Profiles
- Company Profiles
- Travel Agents
- Group Profiles

> Not: Bu aşamada tüm profile tipleri kapsamda tutulur. Gerekirse Phase 3’te daraltılacaktır.

---

### 1.2 Reservations

#### Included

- Individual Reservations

- Group Reservations  
  - Group reservation oluşturulabilmesi için:
    - Öncelikle Group / Event yapısı oluşturulmalıdır
    - Reservation, bu yapı altında block veya group code ile ilişkilendirilmelidir  
  - Grup rezervasyonu, doğrudan değil, bu bağ üzerinden oluşur

- Cancelled Reservations  
- No-show Reservations  

---

#### Conditional / Future Scope

- Split Reservations  
  - Bu yapı Cloudbeds’e özgü bir davranıştır  
  - Kaynak PMS’te birebir karşılığı olmayabilir  
  - Bu nedenle:
    - Şu an aktif migration scope’unda değildir
    - Ancak future enhancement olarak açık bırakılacaktır

---

### 1.3 Financial Data

Financial veri doğrudan ayrı entity olarak değil, **reservation ile ilişkili şekilde** ele alınacaktır.

#### Included

- Payments  
- Folio Transactions  
- Taxes  
- Extras / Add-ons  

---

#### Business Decision (IMPORTANT)

- Taxes ve diğer financial bileşenlerin:
  - Ayrı ayrı mı taşınacağı
  - Yoksa Cloudbeds tarafında yeniden mi hesaplanacağı  
  → Phase 3’te netleştirilecektir

---

#### Payment Strategy (CRITICAL DESIGN DECISION)

Migration sırasında:

- Standart ödeme tipleri yerine:
  - **Custom bir payment type oluşturulacaktır**

- Tüm imported rezervasyonlar:
  - Bu özel payment type ile işaretlenecektir

Amaç:
- Gerçek ödeme detaylarını birebir taşımak yerine:
- Finansal dengeyi korumak
- Sistem içinde tutarlılık sağlamak

---

### 1.4 Invoices / Fiscal Data

#### Candidate Scope

- Invoice Header  
- Invoice Line Items  
- Invoice Status (Paid / Unpaid)  

---

#### Current Thinking (IMPORTANT)

- Invoice oluşturma yaklaşımı henüz net değildir

Alternatifler:

---

##### Option A — Full Invoice Migration
- Tüm invoice verisi taşınır
- Risk:
  - Duplicate financial data
  - Cloudbeds financial logic ile çakışma

---

##### Option B — No Invoice Migration (Preferred Candidate)

- Invoice data migrate edilmez
- Bunun yerine:
  - Reservation financials + payments üzerinden sistem dengelenir

---

##### Option C — Paid Status Simulation

- Invoice yerine:
  - Reservation veya folio “PAID” olarak işaretlenir
- Invoice fiziksel olarak oluşturulmaz

---

#### Decision Pending

Bu alan Phase 3’te API capability + Cloudbeds behavior’a göre finalize edilecektir.

---

## 🔥 Notes (Critical Observations)

- Financial migration, projenin en riskli alanıdır
- Invoice vs Payment vs Folio ayrımı netleştirilmeden implementasyon yapılmamalıdır
- Group reservation yapısı:
  - Direkt değil
  - Event / Block üzerinden kurgulanmalıdır

---

### 1.2 Field-Level Expectations

#### Profiles
- First Name / Last Name
- Email
- Phone (standardized format)
- Address (structured)
- Nationality
- ID / Passport Details
- Birthdate
- Notes

👉 Format expectations aligned with industry standards (ISO dates, UTF-8 text, etc.) :contentReference[oaicite:0]{index=0}

---

#### Reservations
- Reservation ID (external + internal mapping)
- Check-in / Check-out Dates
- Booking Date
- Room Type
- Assigned Room (optional)
- Adults / Children
- Rate Plan Code
- Source (OTA / Direct / etc.)
- Status (Confirmed / Cancelled / No-show / Checked-out)
- Group Reference

---

#### Financials
- Room Revenue
- Tax Amounts
- Extras (itemized)
- Total Amount
- Paid Amount
- Balance

---

#### Payments
- Payment Date
- Payment Amount
- Payment Method (Cash, CC, Bank, etc.)

---

#### Invoices
- Invoice Number
- Invoice Date
- Linked Reservation ID
- Total Amount
- Tax Breakdown
- Status

---

This section defines the desired data depth at field level.

At this stage:
- This is NOT constrained by API capabilities
- This represents the ideal data we want to migrate

Final supported fields will be validated in Phase 3.

---

#### Note

Field-level feasibility (what can actually be created/read via API)
will be evaluated in Phase 3 — API Validation.

### 1.3 Business Rules

#### Identity & Matching
- Profiles must be uniquely identifiable (email or external ID)
- Duplicate profiles should be avoided or merged

#### Reservation Integrity
- Each reservation must:
  - Have valid date range
  - Be linked to a profile
  - Be linked to a valid room type

#### Financial Consistency
- Reservation Total = Room + Tax + Extras
- Payments must not exceed total
- Balance must match remaining amount

#### Status Mapping
- PMS statuses must be mapped to standard states:
  - Confirmed
  - Cancelled
  - No-show
  - Checked-in
  - Checked-out

---

At this stage, business rules are intentionally kept flexible.

The goal is to:
- Identify critical logic areas
- Avoid over-constraining the migration before API validation

---

#### Current Minimal Rules

- Reservation statuses must support:
  - Cancelled
  - No-show

These are considered essential for operational continuity.

---

#### Open / Flexible Areas

The following areas are intentionally left open and will be defined later if required:

- Profile deduplication logic
- Financial validation rules (totals, balances)
- Payment vs invoice relationship
- Reservation status mapping beyond basic states
- Group reservation behavior

---

#### Design Principle

- Migration engine should remain flexible
- Rules should be configurable rather than hardcoded
- Additional rules may be introduced based on:
  - API limitations (Phase 3)
  - Real project requirements

---

### 1.4 Inclusion / Exclusion Logic

#### INCLUDED
- All future reservations
- Historical reservations (based on strategy)
- Cancelled & no-show bookings
- Full guest profiles
- Payments and financial data (if available)

👉 Cloudbeds import service also supports full reservation + financial data when available :contentReference[oaicite:1]{index=1}

---

### 1.5 Custom Objects & Extended Fields (Candidate)

In addition to standard PMS entities, the migration tool must support
custom and property-specific data structures.

---

#### Current Understanding

- Standard PMS structures are NOT sufficient for all properties
- Hotels often require:
  - Custom fields
  - Custom classifications
  - Operational flags
  - Region-specific data (e.g. tax, ID, segmentation)

---

#### Initial Scope

- A minimum of **4 predefined custom objects/fields** will be included
  (based on current project requirements)

- Additional custom fields will be supported dynamically:
  - Initial assumption: up to **7 total custom fields**

---

#### Design Approach

Custom data will follow this flow:

PMS → Custom Field → Template (Excel/CSV) → Migration Tool → Cloudbeds

---

#### Rules

- Custom fields must:
  - Be defined at template level (Excel structure)
  - Be explicitly mapped during migration
  - Not be hardcoded in the system

- If a property requires a new field:
  1. Field is created in PMS (source)
  2. Field is added to template
  3. Field is mapped in migration tool

---

#### Constraints (Candidate)

- Number of custom fields should be limited (initially ~7)
- Field types should remain simple:
  - Text
  - Numeric
  - Date

---

#### Open Questions (Phase 3)

- How are custom fields handled in Cloudbeds?
- Are they:
  - Fully supported?
  - Limited to specific entities (profile, reservation)?
- Is there a limit on number of custom fields?
- Can they be created dynamically via API?

---

#### Design Principle

- Migration tool must be **extensible**
- Must NOT depend only on predefined schema
- Must support property-specific variations without code change

---

#### EXCLUDED (Candidate)
- Credit card details (PCI restrictions)
- System logs / audit trails
- Internal PMS-only fields
- Unsupported custom objects

👉 Credit card data cannot be migrated due to PCI rules :contentReference[oaicite:2]{index=2}

---

---

## 2. Configuration Scope (Candidate)

This defines what we want to SETUP automatically in Cloudbeds before or during migration.

---

### 2.1 Entities

#### Core Configuration
- Room Types
- Rooms
- Rate Plans
- Taxes
- Transaction Codes
- Source Codes

---

### 2.2 Dependencies

Configuration must follow strict order:

1. Room Types
2. Rooms (linked to room types)
3. Rate Plans (linked to room types)
4. Taxes
5. Transaction Codes
6. Sources

---

### 2.3 Risks

- Incorrect room type mapping → reservation mismatch
- Tax configuration mismatch → financial discrepancies
- Rate plan mismatch → pricing inconsistencies
- Historical tax changes not supported

👉 Cloudbeds recalculates taxes based on current setup → discrepancies possible :contentReference[oaicite:3]{index=3}

---

---

## 3. Data Depth Strategy

Defines how much historical data will be migrated.

---

### 3.1 Options

#### Option A — Minimal
- Future reservations only
- Basic profiles

#### Option B — Standard
- Future + limited historical (e.g., last 1–2 years)
- Profiles + reservations
- Limited financials

#### Option C — Full Migration (Preferred Candidate)
- Full reservation history
- Full profiles
- Payments + invoices
- Cancelled / no-show included

👉 Cloudbeds supports full historical + future reservations import :contentReference[oaicite:4]{index=4}

---

### 3.2 Cutover Assumptions

- Final data extraction happens at go-live
- All past reservations become:
  - Checked-out
  - Fully paid (default behavior)

👉 Historical reservations are imported as checked-out and paid :contentReference[oaicite:5]{index=5}

---

---

## 4. Operation Expectations

Defines expected system behavior per entity.

---

| Entity        | Read | Create | Update |
|--------------|------|--------|--------|
| Profiles      | Yes  | Yes    | Yes    |
| Reservations  | Yes  | Yes    | Limited |
| Financials    | Yes  | Yes    | Limited |
| Payments      | Yes  | Yes    | No     |
| Invoices      | Yes  | Yes    | No     |
| Configuration | Yes  | Yes    | Yes    |

---

### Notes

- Updates after migration are expected to be minimal
- Migration is primarily a **CREATE operation**
- Some entities (financials, invoices) are **immutable after creation**

---

---

## 5. Explicit Assumptions

These assumptions MUST be validated in Phase 3.

---

- Target system (Cloudbeds) supports:
  - Full reservation lifecycle import
  - Financial data import (payments, folios)
- External PMS data is:
  - Extractable
  - Structured or transformable
- Room types and rate plans can be mapped 1:1
- Taxes can be standardized
- No dependency on PMS-specific logic

---

---

## 6. Open Questions (Phase 3 Input)

These are critical unknowns to validate against API.

---

### Data

- Can invoices be created independently of reservations?
- Can historical balances remain unpaid?
- Can we import partial payments?

---

### Configuration

- Can we fully create:
  - Rate plans?
  - Taxes?
  - Transaction codes?

---

### Financials

- Can we preserve:
  - Original tax values?
  - Daily rate breakdowns?

👉 Daily rates may be re-distributed equally during import :contentReference[oaicite:6]{index=6}

---

### Edge Cases

- Split reservations handling
- Multi-room reservations
- Group + block linkage

---

### Technical

- ID mapping strategy (external → Cloudbeds)
- Duplicate detection strategy
- Error handling & retry logic

---

---

## FINAL NOTE

This document represents the **ideal migration scope**.

- NOT constrained by API yet
- Designed for maximum coverage
- Will be validated and reduced in Phase 3

---

END OF DOCUMENT