 ## Source Configuration

### Endpoint
GET /getSources

### Purpose
Retrieve the list of available reservation sources (channels/origins) from Cloudbeds.

---

### Required Fields in Reservation
- sourceID
- thirdPartyIdentifier (optional but recommended for traceability)

---

### Core Decision

- Source values will NOT be created via API
- Source values will be fetched using `getSources`
- Mapping will be done manually + API lookup

---

### Mapping Logic

1. User enters a source name
2. Application calls `getSources`
3. Compare input value with `sourceName` from response
4. Matching rule:
   - case-insensitive exact match
5. If match is found:
   - extract corresponding `sourceID`
6. If no match:
   - leave sourceID empty
   - block reservation execution

---

### Matching Rule

- input: source name
- target: `sourceName`
- type: case-insensitive exact match

---

### Required Configuration

Two separate source values must be configured:

1. Old Reservations Source
2. New Reservations Source

Each must contain:
- source name (input)
- resolved sourceID (output)

---

### Validation Rules

- Reservation creation must be blocked if sourceID is missing
- Mapping must be completed before execution
- No fallback strategy (for now)

---

### Data Stored in Application State

- old source name
- old sourceID
- new source name
- new sourceID

---

### Risks

- Incorrect matching → incorrect reporting
- Source not found → migration blocked
- PMS naming inconsistencies → matching failures

---

### Open Questions

- Is there an API to create new sources?
- Is sourceID always required in reservation creation?
- Can inactive sources be used?

---

### Implementation Note

- Source resolution must happen BEFORE reservation creation
- Reservation requests must include only resolved `sourceID`


## Room Configuration

### Endpoints
- GET /getRoomTypes
- GET /getRooms

### Purpose
Retrieve Cloudbeds room type and room data required for reservation preparation and mapping.

---

### Core Decision

- Room types will NOT be created via API
- Rooms will NOT be created via API
- Both room types and rooms must already exist in Cloudbeds
- The application will only read and map them

---

### Data Retrieved

#### From `getRoomTypes`
- `roomTypeID`
- `roomTypeName`
- `roomTypeNameShort`

#### From `getRooms`
- `roomID`
- `roomName`
- `roomTypeID`

---

### Required Mapping Targets

Two separate mappings are required:

#### 1. Room Type Mapping
- Cloudbeds source field used for matching: `roomTypeNameShort`
- External/PMS value will be mapped to Cloudbeds room type

#### 2. Room Mapping
- Cloudbeds source field used for matching: `roomName`
- External/PMS room value will be mapped to Cloudbeds room

---

### Why This Configuration Is Required

Before reservation migration, the application must know:

- which room types exist in Cloudbeds
- which rooms exist under those room types
- how external room type values map to Cloudbeds room types
- how external room values map to Cloudbeds rooms

Without this mapping:
- reservation room assignment cannot be trusted
- roomTypeID cannot be resolved correctly
- room-level historical migration may become inconsistent

---

### Validation Rules

- Room type mapping must exist before reservation creation if room type is required
- Room mapping must exist before reservation creation if room assignment is required
- Unresolved room type mapping must block execution
- Unresolved room mapping should block execution when room-level migration is expected

---

### Data Stored in Application State

#### Room Types
- roomTypeID
- roomTypeName
- roomTypeNameShort

#### Rooms
- roomID
- roomName
- roomTypeID

#### Mapping Values
- external room type value
- mapped Cloudbeds roomTypeID
- external room value
- mapped Cloudbeds roomID

---

### Risks

- Room types may exist but room numbers may not be configured correctly
- PMS naming may not match Cloudbeds naming
- `roomTypeNameShort` may not always match PMS values directly
- Incorrect room mapping may assign reservations to wrong rooms
- Missing room mapping may break historical room-level accuracy

---

### Open Questions

- Is room assignment mandatory for all reservation migration scenarios?
- Is room type enough for some reservation flows?
- Can reservations be created using only roomTypeID without roomID?
- Are there any cases where room mapping can remain optional?

---

### Implementation Note

- Room configuration must be completed before reservation migration
- `getRoomTypes` and `getRooms` should be used as reference-loading endpoints
- Mapping must be completed before execution

## Rate Configuration

### Endpoint
GET /getRatePlans

### Purpose
Resolve the correct Cloudbeds rate to be used during reservation creation.

---

### Required Inputs

The application must have the following values before rate resolution:

- `roomTypeID`
- `arrival date`
- `departure date`
- `ratePlanNamePublic`

---

### Core Decision

- Rate values will NOT be created via API
- Rate values will NOT be stored as static `rateID`
- User / mapping layer will provide `ratePlanNamePublic`
- Application will resolve the correct `rateID` dynamically using API lookup

---

### Resolution Logic

1. Application already has resolved `roomTypeID`
2. Application reads reservation:
   - arrival date
   - departure date
3. Application reads configured / mapped `ratePlanNamePublic`
4. Application calls `getRatePlans`
5. Application filters API response using:
   - matching `roomTypeID`
   - matching `ratePlanNamePublic`
   - reservation date range
6. If a matching row is found:
   - extract corresponding `rateID`
7. Use resolved `rateID` in reservation creation request

---

### Matching Rule

- input: `ratePlanNamePublic`
- target: `ratePlanNamePublic`
- type: case-insensitive exact match

Additional required filter:
- `roomTypeID` must match exactly

---

### Reservation Usage

The reservation request must include the resolved rate value as:

- `roomRateID` = resolved `rateID`

`ratePlanNamePublic` is used only for lookup and resolution.  
It must NOT be sent directly as the reservation rate field.

---

### Why This Configuration Is Required

Before reservation creation, the application must know:

- which Cloudbeds room type is being used
- which public rate code/name should apply
- which exact `rateID` is valid for that room type and reservation dates

Without this resolution:
- the application cannot reliably populate reservation pricing context
- the wrong rate may be assigned
- reservation creation may fail or use incorrect pricing rules

---

### Validation Rules

- `roomTypeID` must be resolved before rate resolution
- `ratePlanNamePublic` must be provided before execution
- If no matching rate is found, reservation execution must be blocked
- If rate resolution fails, reservation must not be created

---

### Data Stored in Application State

- configured / mapped `ratePlanNamePublic`
- resolved `roomTypeID`
- resolved `rateID` (runtime / per reservation)

---

### Risks

- Same `ratePlanNamePublic` may exist across multiple room types
- Same public rate name may exist across different date ranges
- Missing or incorrect room type mapping may produce wrong rate resolution
- Missing rate match will block reservation creation

---

### Open Questions

- Does `getRatePlans` always return enough date-specific detail for exact rate resolution?
- Can multiple valid rows exist for the same room type + public rate name + date range?
- Should ambiguous matches block execution instead of selecting one automatically?

---

### Implementation Note

- Rate resolution must happen AFTER room type resolution
- Rate resolution must happen BEFORE reservation creation
- Reservation requests must include only resolved `roomRateID`
- `ratePlanNamePublic` is a logical mapping value, not the final reservation payload value


## API Configuration

### Purpose

Define the connection settings required for the application to communicate with Cloudbeds APIs.

This configuration is for service base URLs only.

It must NOT be used to configure individual endpoint paths.

---

### Required Fields

The application must allow configuration of:

- API Key
- Property ID
- Main API URL

In addition, the application must provide a separate section for:

### Other API URLs

A total of 10 editable URL fields must be available under this section.

These fields represent service base URLs, not endpoint paths.

In the UI, these fields may be displayed using generic slot labels such as:

- Other API URL 1
- Other API URL 2
- Other API URL 3
- ...
- Other API URL 10

The meaning of each known service URL is determined by slot order and default value, not by a separate editable service-name field.

---

### Prefilled Default Values

#### Main API URL
- `https://api.cloudbeds.com/api/v1.3`

#### Other API URL Slots
- Other API URL 1 = `https://api.cloudbeds.com/accounting/v1.0`
- Other API URL 2 = `https://api.cloudbeds.com/fiscal-document/v1`
- Other API URL 3 = `https://api.cloudbeds.com/group-profile/v1`
- Other API URL 4 = `https://api.cloudbeds.com/payments/v2`
- Other API URL 5 = `https://api.cloudbeds.com/datainsights/v1.1`
- Other API URL 6 = empty
- Other API URL 7 = empty
- Other API URL 8 = empty
- Other API URL 9 = empty
- Other API URL 10 = empty

The first five slots are prefilled with known Cloudbeds service base URLs.

The remaining slots must stay empty and editable for future use.

---

### Critical Rule

Other API URLs means service base URLs only.

The application must NOT ask users to configure endpoint paths such as:

- `/getRoomTypes`
- `/getRooms`
- `/getSources`
- `/getRatePlans`
- `/postReservation`

Endpoint paths must remain internal to the application logic and must be appended in code to the configured base URLs.

---

### Connection Test Rules

A real API connection test must be available in API Configuration.

#### Main API Test
The main Test Connection action must call:

- `GET {Main API URL}/getHotelDetails?propertyID={Property ID}`

Request headers:
- `x-api-key: {API Key}`
- `accept: application/json`

Main API connection is considered successful only if:
- HTTP status is 200
- and response contains `success = true`

This test validates the actual Cloudbeds main API access for the configured property.

---

### Service URL Reachability Test

In addition to the main API test, the application should test all configured Other API URL slots individually.

Each configured URL slot should display its own result indicator.

The UI should show a status marker next to:
- Main API URL
- each Other API URL field

Example status behavior:
- reachable / accepted
- failed
- not tested

For service URL slot testing, a URL may be considered reachable even if the response is not a business-success response.

Examples of acceptable reachability responses:
- validation error
- missing required header error
- permission denied
- unauthorized
- forbidden

These responses still prove that:
- the base URL is valid
- the endpoint is reachable
- the service is responding

The following should generally be treated as reachable:
- HTTP 200
- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 422

The following should generally be treated as failed:
- network error
- DNS / host resolution error
- timeout
- malformed URL
- no response
- server unavailable / repeated 5xx behavior

---

### Save Behavior

If the main API connection test succeeds, the application should ask the user whether the API configuration should be saved.

This save prompt applies to at least:
- API Key
- Property ID

The application should persist API configuration locally so that values are not lost when the user changes tabs.

At minimum, the following values should persist locally:
- API Key
- Property ID
- Main API URL
- configured Other API URLs

---

### Behavior

- All API calls must include:
  - API Key for authentication when required
  - Property ID for property context when required

- Main API URL must be used for the main Cloudbeds API flow
- Other service-specific base URLs must be configurable separately
- Known default service URLs must be assigned by slot order
- The UI may show generic labels for the 10 URL fields
- User must be allowed to override any configured URL field
- Empty additional URL fields must remain available for future Cloudbeds service endpoints

- Property ID must remain constant during execution
- API Key must be validated before any configuration step

---

### Validation Rules

- API Key must not be empty
- Property ID must not be empty
- Main API URL must not be empty
- Other API URL fields are optional
- Main API connection should be tested before proceeding to configuration steps
- Other API URL fields should be testable individually

---

### Why This Configuration Is Required

Cloudbeds services do not all use a single identical base URL structure.

Different services may use different service roots and version paths.
Because of this, the application must allow the main API URL and additional service base URLs to be configured separately.

User configuration should define only service roots.

Operational endpoints belong to the implementation layer, not to the configuration UI.

This design also provides future flexibility if Cloudbeds introduces new service endpoints.

Local persistence is also required so that users do not lose configuration while navigating between sections.

---

### Data Stored in Application State

- API Key
- Property ID
- Main API URL
- configured Other API URLs
- per-URL test status

If local persistence is enabled, these values should also be stored in local application storage.

---

### Risks

- Incorrect service base URL configuration may break API calls
- Missing Main API URL will block execution
- Wrong Property ID may cause calls to fail or use incorrect property context
- Confusing base URLs with endpoint paths may cause invalid configuration design
- Incorrect slot ordering may map a known service URL to the wrong intended use
- Reachability does not always mean the service is fully authorized for actual business use

---

### Open Questions

- Should the save prompt appear only after successful main API validation, or also when the user manually changes fields later?
- Should local persistence be automatic or user-confirmed only on successful connection?
- Should each service URL have its own dedicated internal endpoint for testing in later phases?

---

### Implementation Note

- API Configuration must be completed before Source / Room / Rate configuration
- Main API URL should be prefilled with the current main API default
- Other API URL slots 1–5 should be prefilled with the current known service defaults
- Other API URL slots 6–10 should remain editable and blank until needed
- UI must display service base URLs only
- UI may use generic labels such as Other API URL 1–10
- Endpoint paths must remain internal to the application logic
- Main API test must use `getHotelDetails`
- The application should preserve configuration values locally between tab/page switches

---

## Excel Data Requirements

### Purpose

Define which reservation fields are expected from the source Excel file.

---

### Required Excel Fields

The Excel file must include the following columns:

- startDate
- endDate
- guestFirstName
- guestLastName
- guestCountry
- guestEmail
- roomType (external value)
- roomQuantity
- adultQuantity
- childQuantity

---

### Optional Excel Fields

- thirdPartyIdentifier (recommended)

---

## Date Format Rules

### Standard

All date fields must follow:

- ISO 8601 date format
- Format: YYYY-MM-DD

This applies to:
- startDate
- endDate

This requirement is aligned with Cloudbeds data compatibility rules. :contentReference[oaicite:0]{index=0}

---

### Validation

- startDate must be <= endDate
- Dates must be valid calendar dates
- Invalid date format must block execution

---

## Data Format Rules

### Guest Data

- guestFirstName → string (UTF-8)
- guestLastName → string (UTF-8)
- guestEmail → valid email format

Email must follow standard email format rules (RFC compliant). :contentReference[oaicite:1]{index=1}

---

### Country

- guestCountry must follow ISO country codes (2-letter format recommended)

Example:
- TR
- US
- DE

---

### Numeric Fields

- roomQuantity → integer ≥ 1
- adultQuantity → integer ≥ 1
- childQuantity → integer ≥ 0

---

## Payment Rules

### Past Reservations

- paymentMethod = cash (fixed)

---

### Future Reservations

- paymentMethod behavior will be defined later
- must be configurable

---

## Migration Constraints

### Known Limitations

- Daily rates are not preserved per day and may be distributed evenly :contentReference[oaicite:2]{index=2}
- Taxes and fees are recalculated based on current Cloudbeds configuration :contentReference[oaicite:3]{index=3}

---

## Execution Dependency

Before reservation creation:

The following must already be configured and resolved:

- API configuration (API Key + Property ID)
- Source configuration (sourceID)
- Room configuration (roomTypeID / roomID if applicable)
- Rate resolution logic

Execution must be blocked if any of the above is missing.
 
---