# Configuration & API Analysis

This document defines the configuration parameters required by the Cloudbeds Data Migration Tool and their relationship to the Cloudbeds API surface.

## API Configuration

The API Configuration section captures the credentials and service base URLs needed to communicate with the Cloudbeds platform. These are **service-level base URLs**, not individual endpoint paths.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| API Key | string | *(empty)* | Cloudbeds API key used for authentication |
| Property ID | string | *(empty)* | Target Cloudbeds property identifier |
| Main API URL | string | `https://api.cloudbeds.com/api/v1.3` | Primary Cloudbeds API base URL |

### Other API URLs

In addition to the main API URL, the Cloudbeds platform exposes several auxiliary services at distinct base URLs. The application provides **10 editable URL fields** for these:

| # | Service Name | Default Value |
|---|---|---|
| 1 | Accounting API URL | `https://api.cloudbeds.com/accounting/v1.0` |
| 2 | Fiscal Document API URL | `https://api.cloudbeds.com/fiscal-document/v1` |
| 3 | Group Profile API URL | `https://api.cloudbeds.com/group-profile/v1` |
| 4 | Pay by Link API URL | `https://api.cloudbeds.com/payments/v2` |
| 5 | Insights API URL | `https://api.cloudbeds.com/datainsights/v1.1` |
| 6 | PMS v2 API URL | `https://api.cloudbeds.com` |
| 7 | *(empty)* | *(empty)* |
| 8 | *(empty)* | *(empty)* |
| 9 | *(empty)* | *(empty)* |
| 10 | *(empty)* | *(empty)* |

Known service URLs are prefilled with their defaults. Remaining fields are empty and editable, available for future services or environment-specific overrides.

### Important rules

- **These are service base URLs only.** Individual endpoint paths (e.g. `/getRoomTypes`, `/postReservation`, `/getSources`) must **not** be configured by the user.
- Endpoint paths remain internal to the application logic. The application code appends the appropriate endpoint path to the configured base URL at runtime.
- Users may override base URLs to point to staging, sandbox, or proxy environments, but the endpoint path structure is fixed by the application.

### Test Connection

A **Test Connection** button is provided in the UI. When connected to the backend, it will validate that the configured API key, property ID, and main API URL can reach the Cloudbeds API. Until backend wiring is implemented, this is a local UI placeholder only.

## Excel Data Requirements

*(To be defined in a future iteration.)*
