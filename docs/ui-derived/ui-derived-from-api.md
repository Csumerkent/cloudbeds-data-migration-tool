## Source Configuration UI Requirements

### Purpose
Provide a simple interface to resolve and store Cloudbeds `sourceID` values before reservation creation.

---

### Layout

The UI must contain two rows:

1. **For Old Reservations**
2. **For New Reservations**

Each row must include:
- Source Name input field
- "Get" button
- Source ID output field (read-only)

---

### Behavior

For each row:

1. User enters a source name
2. User clicks "Get"
3. Application calls `GET /getSources`
4. Application compares input with `sourceName` values
5. Matching rule:
   - case-insensitive exact match
6. If match is found:
   - display corresponding `sourceID`
7. If no match:
   - do not populate sourceID
   - show error or warning

---

### Validation

- Source ID must be resolved before proceeding
- Reservation flow must be blocked if sourceID is missing

---

### Data Handling

After successful resolution, store:
- source name
- sourceID

for both:
- old reservations
- new reservations

These values must remain available for reservation creation.

---

### Notes

- Source values are not created in UI
- UI only resolves existing Cloudbeds sources
- Matching is based on API response, not hardcoded values

### Instruction Note

When entering the Source Configuration section:

- For old reservations:
  - Go to: Settings → Property → Sources → Add Primary Source
  - Create a source named **FORMERPMS**
  - Ensure all tax settings are correctly configured

- For new reservations:
  - Use the same menu (Settings → Property → Sources)
  - Decide the appropriate source that will be used for new reservations

This instruction must be displayed at the top of the Source Configuration UI.

## Room Configuration

### Instruction Note

Room configuration is managed in Cloudbeds under:

**Settings → Property → Accommodation**

At minimum:
- room types must be defined
- room numbers must be created under each room type

This should be shown as an instruction note at the top of the Room Configuration UI.

---

### Purpose
Provide a UI to load Cloudbeds room types and rooms, display them, and map them to external/PMS room type and room values.

---

### Required API Calls
- GET /getRoomTypes
- GET /getRooms

---

### Data to Display

#### From `getRoomTypes`
- roomTypeID
- roomTypeName
- roomTypeNameShort

#### From `getRooms`
- roomID
- roomName
- roomTypeID

---

### UI Behavior

The Room Configuration section must include a **Get** button.

When clicked:
1. Call `getRoomTypes`
2. Call `getRooms`
3. Display room types and rooms together in a structured way

---

### Display Requirements

#### Room Types
For each room type, display:
- roomTypeName
- roomTypeNameShort
- roomTypeID

#### Rooms
Under each room type, display:
- roomName
- roomID

Rooms must appear grouped under their related room type using `roomTypeID`.

---

### Mapping Requirements

The same screen must allow mapping with external/PMS values.

#### Room Type Mapping
- Cloudbeds side: `roomTypeNameShort`
- External/PMS side: empty editable field for mapped value

#### Room Mapping
- Cloudbeds side: `roomName`
- External/PMS side: empty editable field for mapped value

---

### Validation

- Mapping must be completed before reservation execution when required
- Unmapped required room types must block execution
- Unmapped required rooms must block execution when room-level migration is used

---

### Optional Mapping Behavior

A checkbox option labeled **"No Mapping"** must be available in both Room Type and Room mapping screens.

- If mapping is applied:
  - Source values are mapped to Cloudbeds IDs

- If **"No Mapping"** is selected:
  - Values retrieved from the API are used directly (roomTypeID / roomID)

### Notes

- This screen does not create room types or rooms
- It only reads and maps existing Cloudbeds room data
- Room types and rooms must already be configured in Cloudbeds

## Rate Configuration UI Requirements

### Purpose
Provide a UI to define the public rate code/name to be used for reservation rate resolution.

The UI does NOT ask the user to enter `rateID` directly.

Instead:
- user provides `ratePlanNamePublic`
- application resolves the correct `rateID` dynamically before reservation creation

---

### Layout

The UI must contain:

1. **For Old Reservations**
2. **For New Reservations**

Each row must include:
- Rate Plan Public Name input field
- Resolved Rate output field (read-only, optional display at runtime)

---

### Behavior

For each reservation during execution:

1. Application reads configured `ratePlanNamePublic`
2. Application reads:
   - reservation arrival date
   - reservation departure date
   - resolved `roomTypeID`
3. Application calls `GET /getRatePlans`
4. Application compares configured value with `ratePlanNamePublic` values from API response
5. Matching rules:
   - case-insensitive exact match on `ratePlanNamePublic`
   - exact match on `roomTypeID`
   - reservation date range must be valid for returned rate
6. If match is found:
   - extract corresponding `rateID`
   - use it as reservation `roomRateID`
7. If no match is found:
   - do not proceed with reservation creation
   - show error or warning

---

### Configuration Requirement

Two separate rate values must be configurable:

1. Old Reservations Rate
2. New Reservations Rate

Each must contain:
- public rate name/code input (`ratePlanNamePublic`)

---

### Validation

- Rate value must be configured before proceeding
- Reservation flow must be blocked if rate cannot be resolved
- Room type must already be resolved before rate resolution

---

### Data Handling

Store in configuration:
- old reservations `ratePlanNamePublic`
- new reservations `ratePlanNamePublic`

Resolve at runtime:
- `rateID`

Use in reservation request:
- `roomRateID` = resolved `rateID`

---

### Notes

- UI does not create rates
- UI does not store static `rateID`
- UI only stores logical public rate name/code
- Final reservation payload must use resolved `roomRateID`
- Rate resolution depends on:
  - configured `ratePlanNamePublic`
  - reservation dates
  - resolved `roomTypeID`

### Instruction Note

When entering the Rate Configuration section:

- Go to the Cloudbeds area where rate plans are managed
- Identify the public rate code/name that should be used for:
  - old reservations
  - new reservations
- Enter the exact public rate value as configured in Cloudbeds

This instruction must be displayed at the top of the Rate Configuration UI.

## API Configuration UI Requirements

### Purpose
Provide a UI section where the user enters the API connection values required before any Cloudbeds configuration or reservation execution step.

---

### Layout

The UI must contain input fields for:

- API Base URL
- API Key
- Property ID

It must also contain:

- Test Connection button

---

### Behavior

1. User enters:
   - API Base URL
   - API Key
   - Property ID
2. User clicks **Test Connection**
3. Application performs a validation API call using the provided values
4. If connection is successful:
   - configuration section is marked as valid
5. If connection fails:
   - show blocking error
   - do not allow proceeding to Source / Room / Rate configuration

---

### Validation

- API Base URL must not be empty
- API Key must not be empty
- Property ID must not be empty
- Connection must be validated before proceeding

---

### Notes

- Property ID is a required execution context value
- API Key is required for authentication
- These values must remain available for all configuration and execution steps

---

## Reservation Excel Input UI Requirements

### Purpose
Provide a clear UI for uploading and validating the reservation Excel file used for migration.

---

### Required Excel Columns

The UI must clearly show that the uploaded Excel file must contain:

- startDate
- endDate
- guestFirstName
- guestLastName
- guestCountry
- guestEmail
- roomType
- roomQuantity
- adultQuantity
- childQuantity

---

### Optional Excel Columns

- thirdPartyIdentifier

---

### Upload Behavior

The UI must contain:

- File Upload control
- Validate File button

When user uploads a file and clicks validation:

1. Application checks that all required columns exist
2. Application validates field formats
3. Application reports:
   - missing columns
   - invalid values
   - row-level validation errors

If validation fails:
- file must not be accepted for execution

---

### Display Requirements

After validation, the UI must display:

- file name
- total row count
- valid row count
- invalid row count

If there are errors, the UI must show them in a structured way.

---

### Date Format Notes

The UI must display a note that:

- `startDate` and `endDate` must use format `YYYY-MM-DD`
- these fields must be valid calendar dates
- `startDate` must not be later than `endDate`

This date format is aligned with Cloudbeds data compatibility guidance. :contentReference[oaicite:0]{index=0}

---

### Guest Field Format Notes

The UI must display a note that:

- `guestFirstName` must be text
- `guestLastName` must be text
- `guestEmail` must be a valid email format
- `guestCountry` should use a 2-letter country code

Cloudbeds compatibility guidance expects standard date, email, and country formats. :contentReference[oaicite:1]{index=1}

---

### Quantity Validation Notes

The UI must display a note that:

- `roomQuantity` must be an integer greater than or equal to 1
- `adultQuantity` must be an integer greater than or equal to 1
- `childQuantity` must be an integer greater than or equal to 0

---

### Payment Method Note

The UI must display:

- For old reservations, payment method will be fixed as `cash`
- For new reservations, payment method behavior will be configured later

---

### Migration Limitation Notes

The UI should display the following warning notes in the reservation import area:

- Daily rates may not remain historically exact because totals can be distributed across stay dates and rooms. :contentReference[oaicite:2]{index=2}
- Taxes and fees may differ from historical PMS values because Cloudbeds calculates them using current configuration. :contentReference[oaicite:3]{index=3}

---

### Execution Dependency Note

The UI must indicate that reservation execution requires completed configuration for:

- API Configuration
- Source Configuration
- Room Configuration
- Rate Configuration

Reservation execution must remain blocked until all required sections are completed.