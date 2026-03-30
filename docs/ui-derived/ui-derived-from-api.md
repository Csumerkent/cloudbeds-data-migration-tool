# UI Derived from API

This document defines the UI requirements derived from the Cloudbeds API surface and the configuration model. Each section describes what the UI must present, its fields, behavior, and constraints.

## API Configuration UI Requirements

The API Configuration page allows the user to enter credentials and configure the service base URLs used by the application.

### Layout

1. **API Key** — text input, required
2. **Property ID** — text input, required
3. **Main API URL** — text input, prefilled with `https://api.cloudbeds.com/api/v1.3`
4. **Other API URLs** — a grouped section containing exactly 10 editable rows

### Other API URLs section

Each row contains two fields:
- **Service Name** — editable text label identifying the service
- **Base URL** — editable text input for the service base URL

Prefilled rows:

| Service Name | Default Base URL |
|---|---|
| Accounting API URL | `https://api.cloudbeds.com/accounting/v1.0` |
| Fiscal Document API URL | `https://api.cloudbeds.com/fiscal-document/v1` |
| Group Profile API URL | `https://api.cloudbeds.com/group-profile/v1` |
| Pay by Link API URL | `https://api.cloudbeds.com/payments/v2` |
| Insights API URL | `https://api.cloudbeds.com/datainsights/v1.1` |
| PMS v2 API URL | `https://api.cloudbeds.com` |

Remaining 4 rows are empty and editable.

### Key constraints

- All URL fields in this section represent **service base URLs**, not endpoint paths.
- Endpoint paths (e.g. `/getRoomTypes`, `/postReservation`, `/getRatePlans`) are **not** user-configurable. They are internal to the application logic.
- The application code appends the correct endpoint path to the configured base URL when making API calls.
- Users may change base URLs to point to different environments (staging, sandbox, proxy) without affecting endpoint routing.

### Test Connection

- A **Test Connection** button is displayed below the URL fields.
- A status area shows the connection result (idle / success / error).
- Until backend logic is wired, this is a local UI placeholder only — no real API call is made.

## Reservation Excel Input UI Requirements

*(Defined separately — see existing implementation and docs.)*
