## 2. Configuration Scope (Candidate)

This section defines the desired system configuration to be created in Cloudbeds
prior to or during migration.

At this stage:
- This is a **candidate scope**
- Not constrained by API capabilities
- Final implementation will be validated in Phase 3

---

### 2.1 Core Configuration Entities

The following configuration elements are expected to be created and/or aligned:

- Room Types  
- Rooms  
- Rate Plans  
- Taxes  
- Transaction Codes  
- Source Codes  

---

### 2.2 Dependency Order (High-Level)

Configuration must follow a logical dependency sequence:

1. Room Types  
2. Rooms (linked to Room Types)  
3. Rate Plans (linked to Room Types)  
4. Taxes  
5. Transaction Codes  
6. Source Codes  

> Note: Final dependency flow may change after API validation

---

### 2.3 Mapping Strategy (Candidate)

- Mapping will be **template-driven (Excel / CSV)**
- No PMS-specific logic will be embedded

Each configuration element:
- Will have a source value (PMS)
- Will be mapped to a target value (Cloudbeds)

---

### 2.4 Matching vs Creation Strategy

For each configuration entity:

- If already exists in target → match
- If not exists → create

This behavior should be:
- Configurable
- Not hardcoded

---

### 2.5 Risks (High-Level)

- Room type mismatch → reservation failure
- Rate plan mismatch → incorrect pricing
- Tax configuration mismatch → financial inconsistency
- Missing configuration → migration failure

---

### 2.6 Open Areas (To Be Validated in Phase 3)

- Can all configuration entities be created via API?
- Are there limitations for:
  - Rate plans?
  - Taxes?
  - Transaction codes?
- Can existing configurations be updated?
- Is bulk configuration supported?

---

### 2.7 Design Principles

- Configuration should be:
  - Minimal but sufficient
  - Reusable across migrations
  - Independent from source PMS

- Migration tool should:
  - Not depend on manual setup
  - But allow manual override if needed

---

### 2.8 Out of Scope (Candidate)

- Advanced pricing rules
- Revenue management logic
- Channel manager configurations
- Automation rules

These may be handled separately or manually.

---