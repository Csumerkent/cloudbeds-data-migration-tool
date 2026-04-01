# Cloudbeds Data Migration Tool - Project Roadmap

---

## 0. Overview

This project aims to build a **desktop-based operational tool** for Cloudbeds PMS using Electron + React + TypeScript.

The tool is designed as a migration-first system and extended into a full property onboarding and configuration workspace.

**Core capabilities:**

- Data Migration (Primary Objective)
- Property Configuration Control
- Onboarding Workspace (Step Tracking)
- Property-Scoped Local Persistence
- UI Automation for Non-API Features (Playwright)

---

## 1. Core Principles

- Migration-first delivery
- API-first validation
- Document-driven development
- No backend service
- No database server
- Fully standalone desktop application
- File-based and local persistence only
- Practical execution over theoretical design
- Property-scoped working model
- Real Cloudbeds limitations must drive scope decisions

---

## 2. Current Product Direction

**Primary priority:** Finish migration capability first

**Secondary capability areas:**

- Configuration control
- Onboarding tracking
- Local per-property persistence
- Playwright-based UI automation for non-API screens

---

## 3. Working Model

The application will work per property. Each property must keep its own local state, including:

- API configuration
- Migration configuration
- Mapping selections
- Onboarding checklist progress
- Configuration validation results
- Execution history
- Logs and reports

---

## 4. High-Level Delivery Order

1. Foundation
2. Scope validation
3. Migration engine
4. Configuration control
5. Onboarding workspace
6. Property persistence hardening
7. UI automation

---

---

## PHASE 0 - Application Foundation

### Goal

Establish the base application structure.

### Scope

- Electron setup
- React + TypeScript setup
- App shell
- Navigation
- Sidebar and page layout
- Local configuration foundation

### Status

COMPLETED

---

## PHASE 1 - Project Foundation

### Goal

Define the overall project direction and architecture baseline.

### Scope

- Project roadmap
- Architectural boundaries
- Module direction
- Repository structure
- High-level workflow

### Status

COMPLETED

---

## PHASE 2 - Scope Definition

### Goal

Define target business scope before technical validation.

### Candidate Scope

- Reservations
- Guest profiles
- Company profiles
- Travel agency profiles
- Historical financial handling
- Configuration control
- Onboarding tracking
- UI automation for unsupported areas

### Status

Completed at high level. Final scope depends on API validation.

---

## PHASE 3 - API Capability Validation

### Goal

Validate Cloudbeds API reality and convert desired scope into feasible scope.

### Scope

- Reservation create analysis
- Payment requirement analysis
- Room configuration analysis
- Source configuration analysis
- Rate configuration analysis
- Financial posting feasibility
- Profile update feasibility
- Configuration read/check feasibility
- Unsupported area identification

### Key Decisions Already Reached

- API configuration is implemented and working
- Real test connection exists
- Config values are persisted locally
- Room configuration uses real fetch
- Room types and rooms load successfully
- Current temporary room fetch uses `getRooms` with `pageSize=100`
- Source configuration uses `getSources`
- Source match rule is case-insensitive exact match on `sourceName`
- `sourceID` must be resolved before reservation execution
- Room type matching field is `roomTypeNameShort`
- Room matching field is `roomName`
- No mapping option exists for room configuration
- Rate configuration stores `ratePlanNamePublic`
- `rateID` is not stored statically
- `rateID` must be resolved at runtime using `roomTypeID`, stay dates, and configured `ratePlanNamePublic`
- Reservation payload uses resolved `roomRateID`
- Reservation creation has a minimum contract
- Payment is part of reservation create context
- Current practical payment direction is cash or credit selection
- Raw credit card number handling is not part of the migration design

### Exit Criteria

- Final reservation create contract confirmed
- Runtime-resolved fields confirmed
- Payment handling direction confirmed
- Unsupported areas clearly separated from API-supported areas

---

## PHASE 4 - Migration Engine

### Goal

Implement the real migration flow of the product.

### Core Principle

Migration is reservation-first, not profile-first.

### Business Migration Order

1. Import reservations first
2. Complete guest profiles after reservation creation
3. Apply past reservation financial closure only for past stays
4. Import company profiles
5. Import travel agency profiles

### Reservation Categories

- Past reservations
- Future reservations

---

### 4.1 Reservation Migration

**Goal:** Create reservations in Cloudbeds using the minimum supported contract and runtime resolution logic.

**Includes:**

- Standardized reservation input
- Date handling
- Guest basic data handling
- Room type resolution
- Optional room resolution
- Source resolution
- Rate resolution
- Payment method assignment
- Reservation creation result tracking

**Reservation Input Fields:**

- `startDate`
- `endDate`
- `guestFirstName`
- `guestLastName`
- `guestCountry`
- `guestEmail`
- `roomType`
- `roomQuantity`
- `adultQuantity`
- `childQuantity`
- optional `thirdPartyIdentifier`

**Date Format:** `YYYY-MM-DD`

**Reservation Runtime Resolution:**

Before reservation execution, the app must resolve:

- `sourceID`
- `roomTypeID`
- optional `roomID`
- `rateID`

**Reservation Create Logic:**

Reservation creation must use:

- Configured reservation data from input
- Resolved Cloudbeds IDs from configuration and lookup
- Selected payment method

---

### 4.2 Past Reservation Flow

**Goal:** Handle historical stays so they reflect finalized operational history.

**Flow:**

1. Create reservation
2. Post historical totals
3. Apply dedicated migration payment
4. Close balance
5. Set reservation to checked out

**Historical Totals Rule:** Historical totals will be posted as room revenue only, or room plus F&B revenue. This must be configurable according to the migration scenario.

**Payment Closure Rule:** Past reservations must be closed using a dedicated migration payment method or equivalent defined project approach.

**Checkout Rule:** Past reservations must end in checked-out state.

---

### 4.3 Future Reservation Flow

**Goal:** Handle future stays without historical closure logic.

**Flow:** Create reservation only.

**Explicit Exclusions:**

- No historical revenue posting
- No balance closure
- No checkout action

---

### 4.4 Guest Profile Completion

**Goal:** Complete missing guest details after reservation creation.

**Principle:** Reservation creation may start with only the guest fields required for reservation creation. Full profile enrichment happens after the reservation exists.

**Scope:**

- Update guest profile details
- Complete missing profile fields
- Push additional profile information not required during initial reservation creation

---

### 4.5 Company Profile Migration

**Goal:** Import company profiles after the core reservation flow is stable.

**Scope:**

- Standardized company profile input
- Profile creation or update strategy
- Linkability to reservation/business context where needed

---

### 4.6 Travel Agency Profile Migration

**Goal:** Import travel agency profiles after the core reservation flow is stable.

**Scope:**

- Standardized agency profile input
- Profile creation or update strategy
- Linkability to reservation/business context where needed

---

### 4.7 Migration Template and Input Model

**Goal:** Use a controlled and standardized import format.

**Input Formats:**

- Excel
- CSV

**Template Principle:** No free-form mapping model. The product must use a controlled template with fixed columns and predictable structure.

**Template Coverage:**

- Reservation fields
- Guest basic fields
- Profile enrichment fields
- Historical financial fields
- Company profile fields
- Travel agency profile fields

---

### 4.8 Mapping and Transformation

**Goal:** Convert standardized source input into executable Cloudbeds payloads.

**Responsibilities:**

- Field mapping
- Type normalization
- Enum normalization
- Code-to-ID resolution
- Payload preparation
- Runtime dependency resolution

---

### 4.9 Validation

**Goal:** Stop bad data before execution.

**Validation Scope:**

- Required field validation
- Date validation
- Format validation
- Duplicate detection
- Unsupported value detection
- Lookup resolution validation
- Execution readiness validation

---

### 4.10 Migration Execution Flow

**Stages:**

1. Intake
2. Parse
3. Transform
4. Resolve
5. Validate
6. Execute
7. Report

**Execution Rules:**

- No execution without validation
- No unresolved critical dependencies
- Controlled execution only
- Safe retry approach
- Record-level result tracking

---

### Exit Criteria

- Reservation migration works end-to-end
- Past and future logic is separated and working
- Profile completion works after reservation creation
- Historical financial closure works for past stays
- Company profile migration is working
- Travel agency profile migration is working

---

## PHASE 5 - Configuration Control

### Goal

Allow the user to verify Cloudbeds configuration areas that can be checked through API.

### Business Role

This phase is not the first delivery priority, but it is one of the main product purposes.

### Scope

- Room types
- Rooms
- Rate plans
- Sources
- Payment-related configuration where exposed
- Transaction codes
- Other API-checkable configuration areas
- Expected-vs-actual comparison using user-provided templates or drafts

### Working Principle

The user provides the target or expected structure. The app checks actual Cloudbeds state through API and highlights:

- Matches
- Mismatches
- Missing configuration
- Unexpected extra values

### Output

- Configuration validation result per area
- Status summary
- Actionable mismatch report

---

## PHASE 6 - Onboarding Workspace

### Goal

Turn the app into a guided onboarding workspace for each property.

### Purpose

The app must show onboarding steps, allow step completion tracking, and persist progress.

### Scope

- Step-by-step onboarding view
- Manual completion checkmarks
- Per-step notes or state
- Saved progress per property
- Resume capability when reopening the application

### Output

- Persistent onboarding checklist
- Progress visibility per property

---

## PHASE 7 - Property-Scoped Persistence

### Goal

Persist all important property-level working state locally.

### Scope

- API config
- Migration settings
- Mapping decisions
- Selected payment mode
- Onboarding checklist progress
- Configuration control results
- Run history
- Logs
- Reports

### Storage Direction

- Local persistence only
- Property-scoped
- No external service
- No backend
- No server database

### Principle

When the application is installed or used for a property, it must retain the property state locally and reopen with continuity.

---

## PHASE 8 - UI Automation (Playwright)

### Goal

Automate Cloudbeds UI for areas not supported by public API.

### Core Rule

If API is not available for the required configuration action, the fallback approach must be UI automation using Playwright.

### Technology Decision

- Playwright is mandatory for this capability
- It must run locally inside the Electron application
- It must not depend on external paid services

### UI Automation Scope

- Non-API configuration screens
- Repetitive onboarding actions
- Guided configuration execution paths
- Taxes and fees maintenance
- Other unsupported UI-only flows when clearly validated

### Session Strategy

- Prefer manual login and session reuse
- Handle session expiration safely
- Avoid fragile automation design

### Stability Rules

- Prefer stable selectors
- Avoid brittle locator chains
- Centralize locator definitions
- Add retry logic
- Log every action and outcome

### First Target - Cloudbeds Finance: Taxes and Fees Automation

**Why This Is Needed:**

Cloudbeds public API does not support creating or updating Taxes and Fees master data, so this area must be handled through UI automation rather than API.

**Taxes and Fees Automation Objective:** Design and implement a module that reads structured input, creates Taxes and Fees entries in Cloudbeds UI, validates creation results, prevents duplicate creation, and produces execution logs.

**Taxes and Fees UI Automation Flow:**

For each record:

1. Ensure authenticated session
2. Navigate to Finance - Taxes and Fees
3. Start creation flow
4. Fill all required form fields
5. Submit
6. Validate creation in the list
7. Handle duplicate code checks before creation

**Automation Architecture Direction:**

```
/automation
  playwrightRunner.ts
  loginHandler.ts
  taxFormFiller.ts
  validator.ts
```

**Risks:**

- UI changes may break automation
- DOM structure may change
- Bot detection or extra auth may interfere

**Mitigation:**

- Abstract selectors
- Centralize locator definitions
- Keep flows modular
- Keep execution logs detailed

---

## MASTER PROMPT - Cloudbeds Taxes & Fees Automation

### Context

This project includes a requirement to automate the **Cloudbeds Finance - Taxes and Fees** screen.

**Important constraint:**

- Cloudbeds public API **does NOT support creating/updating Taxes & Fees master data**
- Only accounting-related mappings and transactions are available via API

Therefore: This feature MUST be implemented using **UI Automation**, not API.

---

### Objective

Design and implement a module that:

- Automatically creates Taxes & Fees entries in Cloudbeds
- Uses structured input (JSON / CSV / Excel)
- Eliminates manual UI work
- Ensures consistency and repeatability

---

### Approach

**Core Strategy: Browser Automation**

The system must:

- Simulate real user interaction with Cloudbeds UI
- Navigate to the Taxes & Fees screen
- Fill and submit forms programmatically

---

### Technology Decision

**Use: Playwright**

**Requirements:**

- Must be implemented using **Playwright**
- Must run locally inside the Electron application
- Must NOT rely on external paid services

**Playwright is:**

- Open-source
- Free
- Cross-browser compatible
- Suitable for production automation

---

### Functional Flow

**Input:** System must accept structured data:

- JSON (primary)
- CSV / Excel (optional future support)

**Example:**

```json
[
  {
    "type": "Tax",
    "title": "VAT 10%",
    "category": "Inclusive",
    "classification": "VAT",
    "amount": 10,
    "code": "VAT_10"
  }
]
```

---

### Execution Flow

For each record:

1. Ensure user is authenticated (manual login preferred)
2. Navigate to: Finance - Taxes and Fees
3. Click: "New tax or fee"
4. Fill form fields: Type, Title, Category, Classification, Amount, Code
5. Submit form
6. Validate creation in list

---

### Pre-Validation

Before creating a record:

- Read existing entries from UI
- If same `code` exists: Skip OR mark as duplicate

---

### Architecture Requirements

```
/automation
  playwrightRunner.ts
  loginHandler.ts
  taxFormFiller.ts
  validator.ts
```

**Responsibilities:**

- `playwrightRunner` - browser lifecycle
- `loginHandler` - session handling (optional)
- `taxFormFiller` - UI interactions
- `validator` - post-create verification

---

### Constraints

- Do NOT attempt to implement via API
- Do NOT assume hidden/private endpoints
- Do NOT hardcode fragile selectors

---

### Best Practices

- Prefer stable selectors: labels, roles, visible text
- Avoid long XPath chains
- Implement retry logic for UI delays
- Log every step (success / failure)

---

### Security & Stability

- Prefer manual login + session reuse
- Handle MFA if present
- Handle session expiration
- Prevent duplicate record creation

---

### Risks

- UI changes may break automation
- Cloudbeds may update DOM structure
- CAPTCHA / bot detection may interfere

**Mitigation:**

- Keep selectors abstracted
- Centralize locator definitions

---

### Expected Outcome

A working automation module that:

- Reads structured input
- Creates Taxes & Fees entries via UI
- Validates results
- Produces execution logs

---

### Final Rule

If API is not available, ALWAYS fall back to UI automation using Playwright.

---

## PHASE 9 - Testing and Reliability

### Goal

Ensure predictable and safe behavior across migration, validation, persistence, and automation.

### Scope

- Template parsing tests
- Mapping tests
- Validation rule tests
- Resolution tests
- Reservation execution tests
- Past reservation closure tests
- Profile update tests
- Configuration control tests
- Persistence tests
- Playwright automation tests where practical

### Scenario Coverage

- Happy path
- Missing required data
- Invalid mappings
- Unresolved lookups
- Partial success
- Duplicate data
- Retry scenarios
- Property resume scenarios

### Success Conditions

- No silent data corruption
- Deterministic output
- Safe retry behavior
- Clear logs and reports

---

## PHASE 10 - Execution Strategy and Operations

### Goal

Define how the tool is used in real onboarding and migration projects.

### Run Modes

- Discovery
- Validation
- Migration execution
- Configuration control
- Retry
- Reporting

### Operational Rules

- Migration comes before secondary capabilities
- No execution without validation
- No silent assumptions on critical IDs
- Per-property traceability is mandatory
- Logs and reports must be kept for operational follow-up

### Post-Execution Expectations

- Migration result review
- Configuration review
- Onboarding checklist continuation
- Stored property state for next session

---

## Near-Term Implementation Priority

The next implementation priority should remain inside migration.

**Recommended near-term order:**

1. Finalize source configuration implementation
2. Finalize rate configuration implementation
3. Finalize payment selection handling
4. Implement reservation migration flow
5. Implement past versus future split
6. Implement profile completion flow
7. Implement historical financial closure flow

---

## Success Criteria

- Reservations can be migrated reliably
- Past and future stays are processed differently and correctly
- Guest profiles can be completed after reservation creation
- Past reservation totals can be posted and closed correctly
- Company and travel agency profiles can be migrated
- Configuration control can compare expected versus actual values
- Onboarding progress can be tracked per property
- Property state persists locally across sessions
- Non-API configuration areas can be automated through Playwright
- The tool works as a practical property onboarding workspace, not only as a one-time importer
