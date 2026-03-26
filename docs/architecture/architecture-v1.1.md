#Cloudbeds Data Migration Tool — Architecture v1.1

## Version
v1.1

### Purpose


This document defines the initial technical architecture of the CLOUDBEDS DATA MIGRATION TOOL application.

The goal is, before starting development, to:

clearly define the core modules
separate responsibilities of each module
establish the data flow
provide a foundation for the repository structure

This architecture is based on the template-driven migration approach defined in the project master prompt.

1. Architecture Goal

The application must be capable of:

creating a migration project
fetching Cloudbeds reference/configuration data
generating a standard XLSX template
accepting a filled template file
parsing and transforming data into an internal model
resolving references and dependencies
performing validation
generating simulation / dry run output
executing migration after approval
producing state, logs, and reports
supporting resume / rerun for failed records

2. High-Level Architecture

The system consists of the following core modules:

Desktop UI Module
Project & Configuration Module
Cloudbeds Discovery Module
Template Management Module
File Intake & Parsing Module
Canonical Data Model Module
Resolution & Validation Module
Simulation & Planning Module
Execution Module
State, Logging & Reporting Module

3. Module ### Responsibilities

3.1 Desktop UI Module

This is the interaction layer between the user and the application.

### Responsibilities

project creation UI
credential / configuration UI
discovery initiation
template export/import
validation review
simulation approval
execution monitoring
reporting dashboards
resume / rerun triggers

### Note

The UI does not contain business logic
It only orchestrates module/service calls

3.2 Project & Configuration Module

Manages the operational context of the application.

### Responsibilities

project creation
project metadata
property context
API credentials
source PMS definition
scope selection
run configuration
local project storage paths

### Outputs

project config
run config
scope definition
3.3 Cloudbeds Discovery Module

Collects lookup and configuration data from Cloudbeds.

### Responsibilities

room types
room numbers
payment types
source types / source codes
custom transaction codes
other required reference datasets
normalization of discovery results
preparing local cache/store

### Outputs

lookup datasets
normalized reference store
property-specific migration context
3.4 Template Management Module

Generates standardized migration templates enriched with discovery data.

### Responsibilities

XLSX template generation
entity sheet creation
predefined column contracts
lookup sheets
enrichment with Cloudbeds reference data
template metadata
template version management

### Outputs

blank template
enriched template
template version information

### Note

The system does not support free-form mapping
It enforces a controlled, standardized template model
3.5 File Intake & Parsing Module

Accepts uploaded files and converts them into readable records.

### Responsibilities

file upload handling
file type validation
workbook version validation
required sheet validation
required column validation
row extraction
parsing error handling

### Outputs

uploaded workbook snapshot
parsed row sets
parsing issues

### Note

Parsing is not business validation
3.6 Canonical Data Model Module

Transforms parsed rows into the internal data model.

### Responsibilities

field normalization
data type standardization
entity-specific internal objects
date / amount / ID normalization
preparation of inter-record relationships

### Outputs

canonical profiles
canonical companies
canonical reservations
canonical financial / note objects

### Note

The internal model is not the same as the API payload
3.7 Resolution & Validation Module

Handles reference resolution and business validation.

Resolution Responsibilities

lookup resolution
external code → Cloudbeds ID mapping
parent-child relationship resolution
dependency preparation
unresolved reference detection

Validation Responsibilities

required fields
lookup validity
enum validation
duplicate detection
date logic checks
cross-record validations
blocking error vs warning classification

### Outputs

resolved records
unresolved references
validation findings
record readiness status
3.8 Simulation & Planning Module

Pre-execution planning and dry-run layer.

### Responsibilities

dry run execution
migration sequencing
batch planning
estimated create/update/skip breakdown
execution readiness summary
approval-ready simulation output

### Outputs

simulation results
execution plan
batch groups
pre-execution summary
3.9 Execution Module

Executes migration after approval.

### Responsibilities

payload creation
API orchestration
entity execution ordering
batch execution
response handling
retry policies
partial failure handling
per-record result tracking

### Outputs

migrated records
failed records
skipped records
retry candidates

### Note

Execution only runs on validated and planned records
3.10 State, Logging & Reporting Module

Operational backbone of the system.

State Tracking Responsibilities

record lifecycle tracking
run history
resume support
rerun support
record-level status visibility

Logging Responsibilities

configuration events
discovery events
parsing logs
validation logs
simulation logs
execution logs
request/response tracking
failure and retry details

Reporting Responsibilities

validation report
simulation summary
execution summary
failure report
retry report
final migration report

### Outputs

state store
structured logs
operational reports

4. Core Data Flow

```text
Project Setup
 → Cloudbeds Discovery
  → Template Generation / Enrichment
  → Offline Data Entry
  → File Upload
  → Parsing
  → Canonical Transformation
  → Reference Resolution
  → Validation
  → Simulation / Planning
  → Execution
  → State Tracking / Logging
  → Reporting
  → Resume / Rerun
 ...
 
5. Workflow to Architecture Mapping
| Workflow Step               | Module                               |
| --------------------------- | ------------------------------------ |
| Project Setup               | Desktop UI + Project & Configuration |
| Cloudbeds Discovery         | Cloudbeds Discovery Module           |
| Template Preparation        | Template Management Module           |
| File Intake                 | File Intake & Parsing Module         |
| Internal Transformation     | Canonical Data Model Module          |
| ID / Reference Resolution   | Resolution & Validation Module       |
| Validation                  | Resolution & Validation Module       |
| Simulation / Dry Run        | Simulation & Planning Module         |
| Execution Planning          | Simulation & Planning Module         |
| Migration Execution         | Execution Module                     |
| State / Logging / Reporting | State, Logging & Reporting Module    |

6. Default Execution Dependency Order

Unless proven otherwise:

Profiles
Companies
Reservations
Folio / Financial Records

### Notes / Additional Linked Data

This order is the baseline for orchestration, simulation, and execution planning.

7. Architectural Rules

Rule 1
Parsing is not validation.

Rule 2
Canonical model ≠ API payload.

Rule 3
Execution must follow:
Upload → Parse → Resolve → Validate → Simulate → Approve → Execute

Rule 4
State tracking is mandatory.

Rule 5
Logging must be structured and sufficient for debugging/audit.

Rule 6
Reports must be generated from structured state and results, not reconstructed from logs.

Rule 7
UI must not contain business logic.

8. Suggested Internal Technical Boundaries

These may not be separate modules initially, but should be considered boundaries:

API Client Layer
Payload Builder
Workbook Reader / Writer
Lookup Resolver
Rule Engine
Run Orchestrator
Local Persistence Layer
Report Exporter
9. MVP-Oriented Implementation Direction

MVP Focus

single desktop application
single local project context
controlled template import/export
validation + simulation focused core
limited entity scope
basic resume / rerun support

Avoid Early

fully flexible mapping UI
overly generic ETL engine
early multi-tenant complexity
unnecessary microservices

10. Open Technical Decisions
local persistence strategy
SQLite vs file-based hybrid
initial entity scope
profile + reservation first?
include finance in phase 1?
retry granularity
record-level vs batch-level
template versioning strategy
strict versioning vs backward compatibility
batching strategy
fixed size vs entity-specific

11. Initial Repo Documentation Usage

This document should be used to:

define repository structure
create module-based issues
serve as a base for AI/code prompts
derive UI screens
clarify service boundaries

12. Recommended Next Document

Module-to-Folder Mapping v1

Should include:

module → folder mapping
repository structure
service ownership boundaries
UI ↔ service separation