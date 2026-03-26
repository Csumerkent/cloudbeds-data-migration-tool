# Cloudbeds Data Migration Tool

A desktop application built with **Electron + React + TypeScript** to analyze, validate, and execute data migration and property configuration for Cloudbeds PMS.

---

## 🚀 Purpose

This tool is designed to:

- Evaluate Cloudbeds API capabilities
- Enable structured data migration
- Support property configuration via API
- Provide a controlled, simulation-driven execution workflow

---

## 🧠 Core Capabilities

### 1. Data Migration
- Reservations
- Profiles (Guests)
- Financial Data
- Invoices (limited / API-dependent)

### 2. Property Configuration
- Room Types
- Rooms
- Rate Plans
- Source Codes
- Transaction Codes
- Taxes

---

## 🏗️ Architecture Principles

- No backend service
- No database
- Fully self-contained desktop application
- File-based processing only (Excel / CSV)
- Template-driven mapping (NOT PMS-specific)

---

## 🔄 Workflow Overview

The system follows a structured, stage-based workflow:

1. **Project Setup**
2. **API Capability Analysis**
3. **Template Import**
4. **Validation**
5. **Transformation**
6. **Simulation (Dry Run)**
7. **Execution**
8. **Reporting**

📌 Detailed workflow:  
- [Workflow Baseline](docs/workflows/workflow-baseline.md)

---

## 🗺️ Project Roadmap

The project is developed in structured phases:

- Phase 0 — Application Foundation ✅
- Phase 1 — Project Foundation ✅
- Phase 2 — Candidate Scope Definition
- Phase 3 — API Capability Analysis
- Phase 4 — Template-Based Mapping & Transformation
- Phase 5 — Execution Engine Design
- Phase 6 — Implementation
- Phase 7 — Testing & Validation
- Phase 8 — Execution Strategy

📄 Full roadmap:  
- [Project Roadmap](docs/roadmap/project-roadmap.md)

---

## 📂 Project Structure

docs/
roadmap/
api-analysis/
architecture/
templates/
workflows/

electron/
src/


---

## ⚙️ How It Works

Instead of building PMS-specific integrations:


ANY PMS → Standard Template → Cloudbeds API


This ensures:

- Scalability
- Reusability
- Low maintenance
- Vendor independence

---

## ⚠️ Important Constraints

- No database layer
- No external dependencies
- No automatic full historical migration
- API limitations must be respected

---

## 🎯 Project Goal

> Provide a **safe, controlled, and transparent migration framework** for Cloudbeds integrations.

---

## 📌 Status

🚧 In active development  
(Currently in documentation and analysis phases)

---

## 🧩 Next Steps

- Define migration scope
- Analyze API capabilities
- Build mapping & transformation layer
- Design execution engine