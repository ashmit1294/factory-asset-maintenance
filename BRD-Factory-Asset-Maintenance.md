# Business Requirements Document (BRD)
## Factory Asset Maintenance System

**Version:** 1.0  
**Date:** March 9, 2026  
**Project Code:** FAM-2026  
**Prepared By:** Ashmit Nigam  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Objectives](#2-business-objectives)
3. [Scope](#3-scope)
4. [Stakeholders & Roles](#4-stakeholders--roles)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Data Model Specifications](#7-data-model-specifications)
8. [State Machine & Workflow](#8-state-machine--workflow)
9. [Security & Authorization Requirements](#9-security--authorization-requirements)
10. [API Specifications](#10-api-specifications)
11. [Edge Cases & Constraints](#11-edge-cases--constraints)
12. [Success Criteria](#12-success-criteria)
13. [Technical Constraints](#13-technical-constraints)
14. [Out of Scope](#14-out-of-scope)

---

## 1. Executive Summary

### 1.1 Project Overview
The Factory Asset Maintenance System is a **role-based task lifecycle management application** that automates the machinery maintenance workflow for factory operations. The system manages the complete lifecycle from issue reporting to resolution confirmation, with strict role-based access control enforced at the database query layer.

### 1.2 Problem Statement
Factory maintenance currently lacks:
- Automated task assignment and tracking
- Role-based visibility and authorization
- Material request workflow with inventory management
- Audit trail for accountability
- Prevention of task assignment conflicts and material approval loops

### 1.3 Solution Statement
A web-based application built with Next.js 14, TypeScript, MongoDB, and JWT authentication that provides:
- Automated task code generation (TSK-XXXX-YYY format)
- State machine-driven workflow with 13 distinct states
- Role-scoped data visibility (Users, Managers, Technicians)
- Atomic inventory management with transaction support
- Complete audit trail via embedded event logs
- 20+ edge case protections (race conditions, privilege escalation, infinite loops)

---

## 2. Business Objectives

### 2.1 Primary Objectives
1. **Automate maintenance workflows** - Reduce manual tracking by 80%
2. **Enforce accountability** - Every action logged with timestamp and actor
3. **Prevent operational failures** - Guard against double-assignments, negative inventory, infinite approval loops
4. **Enable data-driven decisions** - Maintenance history, SLA tracking, recurring failure patterns

### 2.2 Success Metrics
- Task resolution time reduction: Target 30%
- Zero double-assignments (enforced via optimistic locking)
- 100% audit trail completeness
- Role-based security: Zero unauthorized data access
- System uptime: 99.5%

---

## 3. Scope

### 3.1 In Scope
- User authentication and role management (4 roles)
- Task creation, assignment, and lifecycle management (13 states)
- Material request workflow with inventory deduction
- Machinery master data management
- Search, filter, and pagination on all list views
- REST API for external integrations
- Full audit trail via event logs
- Automated taskCode generation with collision protection
- SLA breach detection
- Escalation handling for material request loops
- Duplicate task detection

### 3.2 Out of Scope (Phase 1)
- Mobile native applications (web-responsive only)
- Real-time notifications (email/SMS)
- Advanced analytics/reporting dashboards
- Multi-tenant support
- Internationalization (English only)
- File attachments (images of machinery issues)
- Predictive maintenance AI models

---

## 4. Stakeholders & Roles

### 4.1 System Roles

| Role | Responsibilities | Data Visibility |
|------|-----------------|-----------------|
| **USER** | Report machinery issues, monitor own tasks | Only tasks they reported |
| **TECHNICIAN** | Pick assigned tasks, request materials, mark completion | Only tasks assigned to them |
| **MANAGER** | Review tasks, assign technicians, approve materials, confirm completion | All tasks |
| **SENIOR_MANAGER** | Same as Manager + resolve escalations | All tasks |

### 4.2 Business Stakeholders
- **Factory Floor Supervisor** - Primary user, reports issues
- **Maintenance Manager** - Assigns work, approves material
- **Warehouse Manager** - Monitors inventory levels
- **Factory Operations Director** - Reviews SLA compliance and audit trails

---

## 5. Functional Requirements

### 5.1 User Management

**FR-UM-001: User Authentication**
- System MUST support email/password authentication
- System MUST issue JWT tokens (8-hour expiry)
- System MUST check `User.isActive` on every request (with 60s LRU cache)
- Deactivated users MUST be blocked immediately (within cache TTL)

**FR-UM-002: Role Assignment**
- Each user MUST have exactly one role: USER | TECHNICIAN | MANAGER | SENIOR_MANAGER
- Role MUST NOT be changeable via API by the user themselves
- Role changes MUST be logged in a separate admin audit log

**FR-UM-003: User Deactivation**
- Setting `User.isActive = false` MUST invalidate future API calls
- Existing JWTs MUST fail authentication after cache refresh (max 60s delay)

---

### 5.2 Machinery Management

**FR-MM-001: Machinery Master**
- System MUST store: name, serialNumber (unique), location, type, status
- Status values: ACTIVE | DECOMMISSIONED
- DECOMMISSIONED machines MUST NOT allow new task creation

**FR-MM-002: Maintenance History**
- System MUST automatically append to `Machinery.maintenanceHistory[]` when task reaches CONFIRMED or CANCELLED state
- History entry MUST include: taskId, taskCode (snapshot), resolvedAt, summary

**FR-MM-003: Machinery Status Transition**
- Only MANAGER or SENIOR_MANAGER can change status to DECOMMISSIONED
- All IN_PROGRESS tasks on a machine being decommissioned MUST transition to PAUSED with reason "Machine decommissioned"

---

### 5.3 Task Management

**FR-TM-001: Task Creation**
- USER role MUST be able to create tasks
- System MUST auto-generate taskCode in format `TSK-XXXX-YYY` (4 digits, 3 uppercase letters)
- taskCode MUST be unique (DB-level unique index)
- System MUST validate:
  - machineryId exists
  - Machinery.status === 'ACTIVE'
  - Soft duplicate: same user + same machine + open status in last 24h → return 409 with existing task reference

**FR-TM-002: Task Code Generation**
- System MUST attempt up to 5 unique code generations
- On collision, retry with new random code
- DB unique index is the final safety net

**FR-TM-003: Task Fields**
Required fields:
- title (string, min 3 chars)
- description (string, min 10 chars)
- machineryId (ObjectId, must reference active machinery)
- priority: LOW | MEDIUM | HIGH | CRITICAL
- slaDeadline (Date, auto-calculated based on priority)

Auto-generated fields (server-side only):
- taskCode
- status (initial: REPORTED)
- reportedBy (from JWT)
- createdAt, updatedAt
- eventLog (initial entry: CREATED)

**FR-TM-004: Task List View**
- System MUST return paginated results (default 20, max 100 per page)
- System MUST apply role-based visibility filter on ALL queries
- System MUST support filters: status, priority, machineryId, assignedTo, reportedBy
- System MUST support full-text search on title + description (MongoDB text index)
- System MUST support sorting by: createdAt, updatedAt, priority, slaDeadline

**FR-TM-005: Single Task Fetch**
- System MUST apply role-based visibility filter on single-document fetch
- Unauthorized access MUST return 404 (not 403) to prevent task ID enumeration
- Response MUST include populated: machinery details, assignedTo user name, reportedBy user name

**FR-TM-006: Task Assignment**
- Only MANAGER or SENIOR_MANAGER can assign tasks
- System MUST validate:
  - assignedTo user exists
  - assignedTo user has role = TECHNICIAN
  - assignedTo user is active (isActive = true)
- Assignment MUST use optimistic locking (__v field) to prevent race conditions
- On version conflict, return 409 with message "Task was modified by another user. Please refresh."

**FR-TM-007: Event Log**
- Every state transition MUST append an entry to `Task.eventLog[]`
- Event log entry structure:
  ```json
  {
    "action": "string",
    "fromStatus": "string",
    "toStatus": "string", 
    "performedBy": {
      "userId": "ObjectId",
      "name": "string",
      "role": "string"
    },
    "note": "string",
    "timestamp": "Date"
  }
  ```
- performedBy MUST snapshot user name and role (survives user deletion)

---

### 5.4 State Machine

**FR-SM-001: Task States**
System MUST support exactly 13 states:
- REPORTED
- UNDER_REVIEW
- ASSIGNED
- IN_PROGRESS
- MATERIAL_REQUESTED
- PAUSED
- ESCALATED
- COMPLETED
- REOPENED
- CONFIRMED (terminal)
- REJECTED (terminal)
- CANCELLED (terminal)

**FR-SM-002: State Transitions**
All transitions MUST be validated by `lib/transitionGuard.ts`

Valid transitions:

```
REPORTED → UNDER_REVIEW (Manager)
REPORTED → CANCELLED (Manager, requires cancellationReason)

UNDER_REVIEW → ASSIGNED (Manager, requires active Technician)
UNDER_REVIEW → REJECTED (Manager, requires rejectionReason)
UNDER_REVIEW → CANCELLED (Manager, requires cancellationReason)

ASSIGNED → IN_PROGRESS (Technician, only assignedTo user)
ASSIGNED → CANCELLED (Manager, requires cancellationReason)

IN_PROGRESS → MATERIAL_REQUESTED (Technician, only assignedTo user, no existing PENDING MR)
IN_PROGRESS → PAUSED (Manager, requires pauseReason)
IN_PROGRESS → COMPLETED (Technician, only assignedTo user)

MATERIAL_REQUESTED → IN_PROGRESS (Manager, on approve or reject)
MATERIAL_REQUESTED → ESCALATED (System auto, when rejectionCount >= 3)
MATERIAL_REQUESTED → CANCELLED (Manager, requires cancellationReason)

ESCALATED → IN_PROGRESS (Manager/Senior Manager, NOT the last rejecter)
ESCALATED → CANCELLED (Manager, requires cancellationReason OR auto after 7 days)

PAUSED → IN_PROGRESS (Manager only)
PAUSED → CANCELLED (Manager, requires cancellationReason)

COMPLETED → CONFIRMED (Manager, NOT the reportedBy user if other managers exist)
COMPLETED → REOPENED (Manager, requires reopenReason)

REOPENED → IN_PROGRESS (Technician, same assignedTo)
REOPENED → ASSIGNED (Manager, can reassign to different technician)
```

**FR-SM-003: Transition Guards**
System MUST enforce:
- Role-based permissions (see transition table above)
- Field requirements (cancellationReason, rejectionReason, reopenReason, pauseReason)
- assignedTo validation (only the assigned technician can act)
- Conflict of interest (manager who reported task cannot confirm it, unless sole manager)
- Escalation resolution (manager who last rejected cannot resolve escalation)
- No PENDING material request exists before creating new one

**FR-SM-004: Server-Set Timestamps**
System MUST set these fields server-side (NEVER accept from client):
- completedAt (set when status → COMPLETED)
- confirmedAt (set when status → CONFIRMED)
- escalatedAt (set when status → ESCALATED)

---

### 5.5 Material Request Management

**FR-MR-001: Material Request Creation**
- Only TECHNICIAN role can create material requests
- Only for tasks where assignedTo === current user
- System MUST validate:
  - items array has at least 1 item
  - Each item: name (min 1 char), quantity (min 1), unit (enum: pcs|kg|litres|metres|boxes)
- System MUST prevent multiple PENDING material requests on same task (guard at service layer)

**FR-MR-002: Material Request Approval**
- Only MANAGER or SENIOR_MANAGER can approve
- Approval MUST:
  - Set MaterialRequest.status = APPROVED
  - Set MaterialRequest.approvedBy = current user
  - Deduct inventory for each item atomically
  - Set Task.status = IN_PROGRESS
  - All above in a MongoDB transaction (commit or rollback)
- If insufficient inventory for any item:
  - Transaction MUST rollback
  - Return 400 with error: "Insufficient stock for: [itemName]"

**FR-MR-003: Material Request Rejection**
- Only MANAGER or SENIOR_MANAGER can reject
- Rejection MUST:
  - Set MaterialRequest.status = REJECTED
  - Set MaterialRequest.rejectionNote from request body
  - Increment MaterialRequest.rejectionCount
  - Keep Task.status = MATERIAL_REQUESTED (technician can retry)
  - If rejectionCount >= ESCALATION_REJECTION_THRESHOLD (env var, default 3):
    - Set Task.status = ESCALATED
    - Set Task.escalatedAt = current timestamp

**FR-MR-004: Escalation Resolution**
- Any MANAGER or SENIOR_MANAGER can move ESCALATED → IN_PROGRESS
- System MUST prevent the manager who last rejected from resolving
- Resolution requires material approval or cancellation decision

---

### 5.6 Inventory Management

**FR-IM-001: Inventory Schema**
- itemName (unique)
- quantity (number, cannot go negative)
- unit (enum: pcs|kg|litres|metres|boxes)
- reorderLevel (number, for future alerting)
- updatedAt

**FR-IM-002: Atomic Deduction**
- Inventory deduction MUST be atomic with MaterialRequest approval
- Use MongoDB multi-document transaction
- Deduction query MUST include guard: `{ quantity: { $gte: item.quantity } }`
- If guard fails (insufficient stock), transaction MUST rollback

**FR-IM-003: Inventory Visibility**
- Only MANAGER and SENIOR_MANAGER can view inventory levels
- GET /api/inventory returns all items with current stock

---

### 5.7 Search & Filter

**FR-SF-001: Full-Text Search**
- System MUST create MongoDB text index on Task.title and Task.description
- Search query param: `?search=conveyor belt`
- Search MUST apply role-based visibility filter BEFORE text search

**FR-SF-002: Pagination**
- Default page size: 20
- Max page size: 100 (enforced)
- Query params: `?page=1&limit=20`
- Response MUST include: tasks[], total, page, totalPages

**FR-SF-003: Filters**
Supported filters on GET /api/tasks:
- status (exact match)
- priority (exact match)
- machineryId (exact match)
- assignedTo (exact match)
- reportedBy (exact match)
- slaBreached (boolean)
- search (full-text)

All filters MUST be combined with AND logic.

---

### 5.8 SLA Management

**FR-SLA-001: SLA Deadline Calculation**
On task creation, set slaDeadline based on priority:
- CRITICAL: +4 hours
- HIGH: +24 hours
- MEDIUM: +72 hours
- LOW: +168 hours (7 days)

**FR-SLA-002: SLA Breach Detection**
- Task.slaBreached is a virtual field (computed on read)
- Formula: `slaDeadline < currentTime AND status NOT IN ['CONFIRMED', 'CANCELLED', 'REJECTED']`
- Cron job (hourly) MUST persist breach flag to DB for reporting
- SLA breach MUST be visible in task list view with red indicator

**FR-SLA-003: SLA Exemptions**
Tasks in these states are SLA-exempt:
- PAUSED (clock stopped)
- ESCALATED (clock stopped)
- CANCELLED, REJECTED, CONFIRMED (terminal)

---

### 5.9 Duplicate Detection

**FR-DD-001: Soft Duplicate Check**
On POST /api/tasks, system MUST check:
```
Find tasks where:
  reportedBy = current user
  machineryId = same machine
  status NOT IN ['CONFIRMED', 'CANCELLED', 'REJECTED']
  createdAt >= 24 hours ago
```
If match found:
- Return HTTP 409 Conflict
- Response body:
  ```json
  {
    "warning": "A similar task was recently reported.",
    "existingTask": {
      "taskCode": "TSK-1234-ABC",
      "_id": "..."
    }
  }
  ```

---

### 5.10 Automated Actions

**FR-AA-001: Maintenance History Auto-Append**
When task reaches CONFIRMED:
- Append entry to Machinery.maintenanceHistory[]
- Entry: { taskId, taskCode, resolvedAt: now, summary: task.title }

**FR-AA-002: Escalation Auto-Cancel**
Cron job (daily):
- Find tasks where status = ESCALATED AND escalatedAt < (now - 7 days)
- Set status = CANCELLED
- Set cancellationReason = "Auto-cancelled: escalation unresolved after 7 days"
- Append eventLog entry with performedBy = SYSTEM

**FR-AA-003: Machine Decommission Cascade**
When Machinery.status changes to DECOMMISSIONED:
- Find all tasks where machineryId = this machine AND status IN ['ASSIGNED', 'IN_PROGRESS', 'MATERIAL_REQUESTED']
- Set status = PAUSED
- Set pauseReason = "Machine decommissioned"

---

## 6. Non-Functional Requirements

### 6.1 Performance

**NFR-PERF-001: Response Times**
- API response time (p95): < 500ms for list queries
- API response time (p95): < 200ms for single document fetch
- Full-text search: < 1s for up to 100k tasks

-----------------------------------------------------------------------------
| Method | Endpoint                         | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| POST   | /api/auth/login                  | Login and get JWT             |
| GET    | /api/tasks                       | Fetch tasks (role-filtered)   |
| POST   | /api/tasks                       | Create a new task             |
| PATCH  | /api/tasks/[id]/status           | Update task status            |
| POST   | /api/tasks/[id]/material-request | Technician requests materials |
| PATCH  | /api/tasks/[id]/approve-material | Manager approves material     |
| GET    | /api/tasks/[id]                  | Fetch single task detail      |
-----------------------------------------------------------------------------


Task: { taskCode: 1 } unique, { status: 1 }, { reportedBy: 1 }, { assignedTo: 1 }, { priority: 1, slaDeadline: 1 }, { title: 'text', description: 'text' }
Machinery: { serialNumber: 1 } unique, { status: 1 }
MaterialRequest: { taskId: 1 }, { requestedBy: 1 }, { status: 1 }
Inventory: { itemName: 1 } unique
```

**NFR-PERF-003: Concurrency**
- System MUST handle 50 concurrent API requests without degradation
- Optimistic locking MUST prevent double-assignment under concurrent manager operations

---

### 6.2 Scalability

**NFR-SCALE-001: Horizontal Scaling**
- Stateless JWT authentication enables multiple server instances
- No server-side session storage
- MongoDB replica set for high availability

**NFR-SCALE-002: Data Volume**
- System MUST support 100,000+ tasks without query degradation
- Event log MUST be capped at 500 entries per task (configurable)

---

### 6.3 Security

**NFR-SEC-001: Authentication**
- JWT tokens MUST expire after 8 hours (configurable)
- JWT secret MUST be minimum 32 characters
- Passwords MUST be hashed with bcrypt (12 rounds)

**NFR-SEC-002: Authorization**
- All API endpoints MUST verify JWT
- All data queries MUST apply role-based visibility filter
- Unauthorized access MUST return 404 (not 403) to prevent ID enumeration

**NFR-SEC-003: Rate Limiting**
- Login endpoint: 5 attempts per IP per minute
- Task creation: 10 tasks per user per hour
- Implemented at Next.js edge middleware layer

**NFR-SEC-004: Input Validation**
- All user inputs MUST be validated at Mongoose schema level
- No SQL injection (MongoDB parameterized queries)
- No NoSQL injection (sanitize operator keys)

---

### 6.4 Reliability

**NFR-REL-001: Data Integrity**
- Material approval + inventory deduction MUST be atomic (MongoDB transactions)
- Task assignment MUST use optimistic locking to prevent race conditions
- taskCode MUST be enforced unique at DB level

**NFR-REL-002: Audit Trail**
- 100% of state transitions MUST be logged in eventLog
- eventLog MUST include actor snapshot (name + role) to survive user deletion
- eventLog MUST be immutable (append-only)

**NFR-REL-003: Error Handling**
- All API errors MUST return structured JSON: `{ error: "message", code: "ERROR_CODE" }`
- Transaction failures MUST rollback completely (no partial writes)
- Database connection failures MUST be logged and retried (3 attempts)

---

### 6.5 Usability

**NFR-USE-001: API Response Format**
Consistent response structure:
```json
// Success
{ "data": {...}, "meta": { "page": 1, "total": 100 } }

// Error
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "details": [...] }
```

**NFR-USE-002: Error Messages**
- User-facing errors MUST be human-readable
- Technical errors MUST be logged server-side with stack traces
- Never expose database errors directly to client

---

## 7. Data Model Specifications

### 7.1 User Collection
```typescript
{
  _id: ObjectId,
  name: string,                          // required, min 2 chars
  email: string,                         // required, unique, lowercase, email format
  passwordHash: string,                  // bcrypt hash, never in API responses
  role: 'USER' | 'MANAGER' | 'SENIOR_MANAGER' | 'TECHNICIAN',
  isActive: boolean,                     // default: true
  createdAt: Date,                       // auto
  updatedAt: Date                        // auto
}
```

### 7.2 Machinery Collection
```typescript
{
  _id: ObjectId,
  name: string,                          // required
  serialNumber: string,                  // required, unique
  location: string,                      // required
  type: string,                          // required
  status: 'ACTIVE' | 'DECOMMISSIONED',  // default: ACTIVE
  maintenanceHistory: [{
    taskId: ObjectId,
    taskCode: string,
    resolvedAt: Date,
    summary: string
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### 7.3 Task Collection
```typescript
{
  _id: ObjectId,
  taskCode: string,                      // unique, auto-generated, indexed
  title: string,                         // required, min 3 chars
  description: string,                   // required, min 10 chars
  machineryId: ObjectId,                 // ref: Machinery, required
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  slaDeadline: Date,                     // auto-calculated on creation
  slaBreached: boolean,                  // virtual field + cron-persisted
  status: TaskStatus,                    // see state machine, indexed
  reportedBy: ObjectId,                  // ref: User, indexed
  assignedTo: ObjectId | null,           // ref: User, indexed
  cancellationReason: string | null,
  rejectionReason: string | null,
  escalatedAt: Date | null,
  completedAt: Date | null,              // server-set only
  confirmedAt: Date | null,              // server-set only
  __v: number,                           // optimistic concurrency
  eventLog: [{
    action: string,
    fromStatus: string,
    toStatus: string,
    performedBy: {
      userId: ObjectId,
      name: string,
      role: string
    },
    note: string,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### 7.4 MaterialRequest Collection
```typescript
{
  _id: ObjectId,
  taskId: ObjectId,                      // ref: Task, indexed
  requestedBy: ObjectId,                 // ref: User, indexed
  items: [{
    name: string,                        // required, min 1 char
    quantity: number,                    // required, min 1
    unit: 'pcs' | 'kg' | 'litres' | 'metres' | 'boxes'
  }],
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  rejectionCount: number,                // default: 0
  approvedBy: ObjectId | null,
  rejectionNote: string | null,
  createdAt: Date
}
```

### 7.5 Inventory Collection
```typescript
{
  _id: ObjectId,
  itemName: string,                      // unique, indexed
  quantity: number,                      // required, min 0
  unit: 'pcs' | 'kg' | 'litres' | 'metres' | 'boxes',
  reorderLevel: number,                  // required
  updatedAt: Date
}
```

---

## 8. State Machine & Workflow

### 8.1 State Definitions

| State | Description | Terminal | Who Can Trigger |
|-------|-------------|----------|-----------------|
| REPORTED | User reported an issue | No | USER |
| UNDER_REVIEW | Manager reviewing task | No | MANAGER |
| ASSIGNED | Task assigned to technician | No | MANAGER |
| IN_PROGRESS | Technician working on task | No | TECHNICIAN |
| MATERIAL_REQUESTED | Technician needs materials | No | TECHNICIAN |
| PAUSED | Task temporarily halted | No | MANAGER |
| ESCALATED | Material request loop exceeded threshold | No | SYSTEM |
| COMPLETED | Technician finished work | No | TECHNICIAN |
| REOPENED | Manager rejected completion | No | MANAGER |
| CONFIRMED | Manager verified completion | Yes | MANAGER |
| REJECTED | Manager rejected task as invalid | Yes | MANAGER |
| CANCELLED | Task cancelled (various reasons) | Yes | MANAGER |

### 8.2 Transition Rules Matrix

See Section 5.4 (FR-SM-002) for complete transition table.

### 8.3 Workflow Examples

**Example 1: Happy Path**
```
REPORTED (User) 
→ UNDER_REVIEW (Manager reviews) 
→ ASSIGNED (Manager assigns to Tech-A) 
→ IN_PROGRESS (Tech-A picks up) 
→ COMPLETED (Tech-A finishes) 
→ CONFIRMED (Manager verifies)
```

**Example 2: Material Request Flow**
```
IN_PROGRESS 
→ MATERIAL_REQUESTED (Tech needs parts)
→ IN_PROGRESS (Manager approves, inventory deducted atomically)
→ COMPLETED
→ CONFIRMED
```

**Example 3: Escalation Flow**
```
MATERIAL_REQUESTED (Manager rejects, count = 1)
→ MATERIAL_REQUESTED (Manager rejects again, count = 2)
→ MATERIAL_REQUESTED (Manager rejects again, count = 3)
→ ESCALATED (auto-transition, escalatedAt set)
→ IN_PROGRESS (Different manager resolves)
→ COMPLETED
→ CONFIRMED
```

**Example 4: Rejection & Cancellation**
```
REPORTED
→ UNDER_REVIEW
→ REJECTED (Manager marks as duplicate, rejectionReason required)
[Terminal]
```

**Example 5: Machine Decommission**
```
IN_PROGRESS (task active on Machine-X)
→ [Manager decommissions Machine-X]
→ PAUSED (auto-transition, pauseReason = "Machine decommissioned")
→ CANCELLED (Manager cancels as machine is permanently offline)
[Terminal]
```

---

## 9. Security & Authorization Requirements

### 9.1 Role-Based Access Control (RBAC)

**Authorization Matrix:**
--------------------------------------------------------------------------
| Action                  | USER | TECHNICIAN | MANAGER | SENIOR_MANAGER |
|-------------------------|------|------------|---------|----------------|
| Create task             | ✅   | ❌        | ✅      | ✅            |
| View own reported tasks | ✅   | ❌        | ✅      | ✅            |
| View assigned tasks     | ❌   | ✅        | ✅      | ✅            |
| View all tasks          | ❌   | ❌        | ✅      | ✅            |
| Assign task             | ❌   | ❌        | ✅      | ✅            |
| Pick up assigned task   | ❌   | ✅        | ❌      | ❌            |
| Request materials       | ❌   | ✅        | ❌      | ❌            |
| Approve/Reject materials| ❌   | ❌        | ✅      | ✅            |
| Mark task complete      | ❌   | ✅        | ❌      | ❌            |
| Confirm task            | ❌   | ❌        | ✅*     | ✅*           |
| Reject task             | ❌   | ❌        | ✅      | ✅            |
| Cancel task             | ❌   | ❌        | ✅      | ✅            |
| Resolve escalation      | ❌   | ❌        | ✅**    | ✅**          |
| View inventory          | ❌   | ❌        | ✅      | ✅            |
| View machinery history  | ❌   | ❌        | ✅      | ✅            |
--------------------------------------------------------------------------

*Cannot confirm a task they reported (if other managers exist)  
**Cannot resolve if they last rejected the material request

### 9.2 Data Visibility Rules

**Implemented in:** `lib/visibility.ts` - `applyVisibilityFilter(role, userId)`

```typescript
// USER: sees only tasks they reported
{ reportedBy: userId }

// TECHNICIAN: sees only tasks assigned to them
{ assignedTo: userId }

// MANAGER / SENIOR_MANAGER: sees all tasks
{}
```

**Applied to:**
- GET /api/tasks (list)
- GET /api/tasks/:id (single)
- PATCH /api/tasks/:id/* (all update endpoints)

**Material Request Visibility:**
```typescript
// TECHNICIAN: sees only their material requests
{ requestedBy: userId }

// MANAGER / SENIOR_MANAGER: sees all material requests
{}
```

### 9.3 Privilege Escalation Prevention

**Horizontal Privilege Escalation Guards:**

1. **Single Task Fetch:**
   - Apply visibility filter: `Task.findOne({ _id, ...scopeFilter })`
   - If no match: return 404 (not 403)
   - Prevents: USER-A fetching task reported by USER-B

2. **State Transition:**
   - Check: `task.assignedTo === req.user._id` for TECHNICIAN actions
   - Prevents: TECHNICIAN-A completing TECHNICIAN-B's task

3. **Material Request:**
   - Check: `materialRequest.requestedBy === req.user._id` (not used for approval, only for tech view)
   - Prevents: TECHNICIAN-A viewing TECHNICIAN-B's material requests

**Vertical Privilege Escalation Guards:**

1. **Role Check in Middleware:**
   - All state transitions checked against TRANSITION_GUARDS table
   - Prevents: USER calling PATCH /status to mark task CONFIRMED

2. **JWT Role Verification:**
   - Role read from JWT payload (signed, cannot be forged)
   - Verified against User collection on every request (with cache)

---

## 10. API Specifications

### 10.1 Authentication Endpoints

**POST /api/auth/login**
```
Request:
{
  "email": "string",
  "password": "string"
}

Response 200:
{
  "token": "jwt-token-string",
  "user": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}

Response 401:
{
  "error": "Invalid email or password",
  "code": "AUTH_FAILED"
}
```

---

### 10.2 Task Endpoints

**GET /api/tasks**
```
Query Params:
  ?status=IN_PROGRESS
  &priority=HIGH
  &machineryId=abc123
  &assignedTo=userId
  &reportedBy=userId
  &slaBreached=true
  &search=conveyor
  &page=1
  &limit=20
  &sortBy=createdAt
  &sortOrder=desc

Response 200:
{
  "data": [
    {
      "_id": "string",
      "taskCode": "TSK-1234-ABC",
      "title": "string",
      "description": "string",
      "machinery": { "_id": "...", "name": "..." },
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "reportedBy": { "_id": "...", "name": "..." },
      "assignedTo": { "_id": "...", "name": "..." },
      "slaDeadline": "2026-03-10T12:00:00Z",
      "slaBreached": false,
      "createdAt": "2026-03-09T10:00:00Z",
      "updatedAt": "2026-03-09T11:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**POST /api/tasks**
```
Request:
{
  "title": "string (min 3 chars)",
  "description": "string (min 10 chars)",
  "machineryId": "ObjectId string",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL"
}

Response 201:
{
  "data": {
    "_id": "string",
    "taskCode": "TSK-1234-ABC",
    "status": "REPORTED",
    ...
  }
}

Response 409 (Duplicate):
{
  "warning": "A similar task was recently reported.",
  "existingTask": {
    "taskCode": "TSK-5678-XYZ",
    "_id": "..."
  }
}

Response 400:
{
  "error": "Cannot report a task for a decommissioned machine.",
  "code": "VALIDATION_ERROR"
}
```

**GET /api/tasks/:id**
```
Response 200:
{
  "data": {
    "_id": "string",
    "taskCode": "TSK-1234-ABC",
    ...,
    "eventLog": [
      {
        "action": "CREATED",
        "fromStatus": null,
        "toStatus": "REPORTED",
        "performedBy": { "userId": "...", "name": "John Doe", "role": "USER" },
        "note": "",
        "timestamp": "2026-03-09T10:00:00Z"
      }
    ]
  }
}

Response 404:
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

**PATCH /api/tasks/:id/status**
```
Request:
{
  "nextStatus": "IN_PROGRESS",
  "__v": 2,
  "note": "optional note"
}

Response 200:
{
  "data": {
    "_id": "...",
    "status": "IN_PROGRESS",
    "__v": 3,
    ...
  }
}

Response 409 (Optimistic Lock Conflict):
{
  "error": "Task was modified by another user. Please refresh.",
  "code": "CONFLICT"
}

Response 403:
{
  "error": "Only the assigned technician can pick up this task.",
  "code": "FORBIDDEN"
}

Response 422:
{
  "error": "Invalid state transition: REPORTED → COMPLETED",
  "code": "INVALID_TRANSITION"
}
```

**PATCH /api/tasks/:id/assign**
```
Request:
{
  "assignedTo": "ObjectId string",
  "__v": 1
}

Response 200:
{
  "data": {
    "_id": "...",
    "assignedTo": { "_id": "...", "name": "Tech Name" },
    "status": "ASSIGNED",
    "__v": 2,
    ...
  }
}

Response 400:
{
  "error": "Cannot assign to an inactive technician.",
  "code": "VALIDATION_ERROR"
}
```

**GET /api/tasks/:id/event-log**
```
Response 200:
{
  "data": [
    {
      "action": "STATUS_CHANGED",
      "fromStatus": "REPORTED",
      "toStatus": "UNDER_REVIEW",
      "performedBy": { "userId": "...", "name": "Manager", "role": "MANAGER" },
      "note": "",
      "timestamp": "2026-03-09T10:05:00Z"
    }
  ]
}
```

---

### 10.3 Material Request Endpoints

**POST /api/tasks/:id/material-request**
```
Request:
{
  "items": [
    { "name": "Ball bearing", "quantity": 5, "unit": "pcs" },
    { "name": "Hydraulic oil", "quantity": 2, "unit": "litres" }
  ]
}

Response 201:
{
  "data": {
    "_id": "string",
    "taskId": "...",
    "requestedBy": { "_id": "...", "name": "..." },
    "items": [...],
    "status": "PENDING",
    "rejectionCount": 0,
    "createdAt": "2026-03-09T11:00:00Z"
  }
}

Response 409:
{
  "error": "A material request is already pending for this task.",
  "code": "CONFLICT"
}

Response 400:
{
  "error": "At least one item is required in a material request.",
  "code": "VALIDATION_ERROR"
}
```

**GET /api/tasks/:id/material-requests**
```
Response 200:
{
  "data": [
    {
      "_id": "...",
      "status": "APPROVED",
      "items": [...],
      "approvedBy": { "name": "..." },
      "createdAt": "..."
    }
  ]
}
```

**PATCH /api/tasks/:id/material-request/:mrId/approve**
```
Response 200:
{
  "data": {
    "_id": "...",
    "status": "APPROVED",
    "approvedBy": { "_id": "...", "name": "..." }
  }
}

Response 400:
{
  "error": "Insufficient stock for: Ball bearing",
  "code": "INSUFFICIENT_INVENTORY"
}
```

**PATCH /api/tasks/:id/material-request/:mrId/reject**
```
Request:
{
  "rejectionNote": "Quantity too high, request again with 2 units"
}

Response 200:
{
  "data": {
    "_id": "...",
    "status": "REJECTED",
    "rejectionCount": 1,
    "rejectionNote": "..."
  }
}

Response 200 (Auto-escalation):
{
  "data": {
    "_id": "...",
    "status": "REJECTED",
    "rejectionCount": 3
  },
  "taskStatus": "ESCALATED"
}
```

---

### 10.4 Supporting Endpoints

**GET /api/machinery**
```
Response 200:
{
  "data": [
    {
      "_id": "...",
      "name": "Conveyor Belt A",
      "serialNumber": "CB-001",
      "location": "Assembly Line 1",
      "type": "Conveyor",
      "status": "ACTIVE"
    }
  ]
}
```

**GET /api/machinery/:id/history**
```
Response 200:
{
  "data": {
    "machinery": { "_id": "...", "name": "..." },
    "maintenanceHistory": [
      {
        "taskId": "...",
        "taskCode": "TSK-1234-ABC",
        "resolvedAt": "2026-03-08T15:00:00Z",
        "summary": "Replaced worn belt"
      }
    ]
  }
}
```

**GET /api/inventory**
```
Response 200:
{
  "data": [
    {
      "_id": "...",
      "itemName": "Ball bearing",
      "quantity": 120,
      "unit": "pcs",
      "reorderLevel": 20
    }
  ]
}
```

**GET /api/users/technicians**
```
Response 200:
{
  "data": [
    {
      "_id": "...",
      "name": "Tech A",
      "email": "tech1@factory.com",
      "isActive": true
    }
  ]
}
```

---

## 11. Edge Cases & Constraints

### 11.1 Resolved Edge Cases

| # | Edge Case | Resolution |
|---|---|---|
| 1 | Concurrent task assignment race condition | Optimistic locking with `__v` field |
| 2 | Inventory deduction not atomic | MongoDB multi-document transaction |
| 3 | Multiple simultaneous MaterialRequests | Guard: check for PENDING MR before creating new |
| 4 | Task on decommissioned machine | Validation on create: machinery.status must be ACTIVE |
| 5 | JWT valid after user deactivation | Check `isActive` in auth middleware (60s cache) |
| 6 | eventLog loses user context on deletion | Snapshot `{ userId, name, role }` not just ID |
| 7 | taskCode collision under concurrency | Retry loop (5 attempts) + DB unique index |
| 8 | ESCALATED has no clear owner | Guard: last rejecter cannot resolve escalation |
| 9 | SLA has no breach tracking | Virtual field + hourly cron to persist flag |
| 10 | Assigning to inactive technician | Validation: check role=TECHNICIAN and isActive=true |
| 11 | Duplicate task flooding | Soft duplicate: same user + same machine + 24h → 409 |
| 12 | PAUSED resume not defined | Explicit guard: only MANAGER can resume |
| 13 | MaterialRequest items not validated | Mongoose validators: quantity min 1, unit enum, array min 1 |
| 14 | Timestamps forgeable by client | completedAt/confirmedAt always set server-side |
| 15 | Single manager conflict-of-interest deadlock | Allow if no other active managers exist (logged with warning) |
| 16 | No pagination defaults | Default 20, max 100, hard-enforced |
| 17 | Search is a full collection scan | MongoDB text index on title + description |
| 18 | No rate limiting | Edge middleware: 5 login/min, 10 tasks/hr |
| 19 | maintenanceHistory never written | Auto-append on CONFIRMED via hook |
| 20 | ESCALATED tasks can sit forever | Cron auto-cancels after 7 days |

### 11.2 Constraints

**Business Constraints:**
- Maximum 1 PENDING material request per task at a time
- Material request rejection threshold: 3 (configurable via env var)
- Escalation auto-cancel: 7 days (configurable via env var)
- SLA deadline cannot be in the past
- Task title minimum 3 characters, description minimum 10 characters
- Machinery serialNumber must be unique across all machines

**Technical Constraints:**
- MongoDB version 4.2+ required (for multi-document transactions)
- Node.js version 18+ required
- JWT secret minimum 32 characters
- eventLog array capped at 500 entries per task (configurable)
- Maximum 100 items per page in paginated responses
- Rate limit: 5 login attempts per IP per minute
- Rate limit: 10 task creations per user per hour

---

## 12. Success Criteria

### 12.1 Functional Success Criteria
- ✅ User can report task → receives unique taskCode
- ✅ Manager can assign task → technician receives assignment
- ✅ Technician can request materials → manager can approve/reject
- ✅ Material approval deducts inventory atomically
- ✅ 3rd material rejection escalates task automatically
- ✅ Task reaches CONFIRMED state after manager verification
- ✅ Full audit trail available via event log
- ✅ Role-based visibility enforced: USER sees only own tasks
- ✅ Duplicate task detection prevents spam
- ✅ SLA breach tracked and visible

### 12.2 Non-Functional Success Criteria
- ✅ 100% test coverage on state transitions
- ✅ Zero horizontal privilege escalation vulnerabilities
- ✅ Zero race conditions on concurrent assignment
- ✅ API response time < 500ms (p95)
- ✅ System handles 50 concurrent users
- ✅ All 20 identified edge cases resolved

### 12.3 Acceptance Criteria
**Scenario 1: User Reports Issue**
```
GIVEN a USER is logged in
WHEN they submit a task for an ACTIVE machine
THEN they receive a task with a unique taskCode (TSK-XXXX-YYY format)
AND task status is REPORTED
AND they can view this task in their task list
AND they cannot view tasks reported by other users
```

**Scenario 2: Manager Assigns Task**
```
GIVEN a MANAGER is reviewing a task in UNDER_REVIEW status
WHEN they assign it to an active TECHNICIAN
THEN task status changes to ASSIGNED
AND the technician can see this task in their task list
AND other technicians cannot see this task
AND concurrent assignment by another manager is prevented (optimistic lock)
```

**Scenario 3: Material Request Escalation**
```
GIVEN a TECHNICIAN has requested materials
WHEN a MANAGER rejects the request 3 times
THEN task status automatically changes to ESCALATED
AND the rejecting manager cannot resolve the escalation
AND a different manager can approve materials to resolve
```

**Scenario 4: Atomic Inventory Deduction**
```
GIVEN a MANAGER approves a material request
WHEN inventory has sufficient stock
THEN MaterialRequest status changes to APPROVED
AND inventory quantity is deducted
AND task status changes to IN_PROGRESS
AND all changes commit atomically (or all rollback on failure)
```

---

## 13. Technical Constraints

### 13.1 Technology Stack (Fixed)
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5
- **Backend:** Next.js API Routes (Node.js 18+)
- **Database:** MongoDB 6+ (replica set for transactions)
- **ODM:** Mongoose 8
- **Authentication:** JWT (jsonwebtoken library)
- **Testing:** Jest + Supertest
- **Deployment:** Vercel (or any Node.js platform)

### 13.2 Environment Variables Required
```env
MONGODB_URI=mongodb://...
JWT_SECRET=minimum-32-characters
JWT_EXPIRES_IN=8h
NEXT_PUBLIC_APP_URL=http://localhost:3000
ESCALATION_REJECTION_THRESHOLD=3
ESCALATION_AUTO_CANCEL_DAYS=7
BCRYPT_ROUNDS=12
```

### 13.3 Database Requirements
- MongoDB replica set (for transactions)
- Minimum version: 4.2
- All indexes defined in section 6.1 must be created
- Connection pooling: min 5, max 50 connections

---

## 14. Out of Scope

The following features are explicitly OUT OF SCOPE for Phase 1:

### 14.1 Features Not Included
- ❌ Real-time notifications (email, SMS, push)
- ❌ Mobile native applications (iOS/Android)
- ❌ File attachments (images, PDFs)
- ❌ Advanced analytics dashboard
- ❌ Export to Excel/PDF reports
- ❌ Multi-tenant support
- ❌ Internationalization (i18n)
- ❌ Dark mode UI
- ❌ Recurring maintenance schedules
- ❌ Predictive maintenance ML models
- ❌ Integration with ERP systems (SAP, Oracle)
- ❌ Barcode/QR code scanning for machines
- ❌ Offline mode
- ❌ WebSocket real-time updates

### 14.2 Potential Future Enhancements (Phase 2+)
- Email notifications on task assignment
- SMS alerts for SLA breaches
- Mobile app for technicians
- Photo upload for machinery issues
- Advanced reporting: MTTR, MTBF, recurring failure analysis
- Integration with inventory management systems
- Shift management and technician scheduling
- Preventive maintenance calendar

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Task** | A work order to address a machinery issue |
| **taskCode** | Unique identifier in format TSK-XXXX-YYY |
| **Event Log** | Immutable audit trail of all actions on a task |
| **Material Request** | Request by technician for parts/materials |
| **Escalation** | Auto-triggered state when material rejections exceed threshold |
| **Optimistic Locking** | Concurrency control using version field (__v) |
| **Role-Based Visibility** | Query-level filter ensuring users see only authorized data |
| **SLA Breach** | Task past its deadline while still open |
| **Soft Duplicate** | Warning (409) when similar task exists in last 24h |
| **Terminal State** | Final state: CONFIRMED, CANCELLED, or REJECTED |
| **Atomic Transaction** | All-or-nothing database operation (commit or rollback) |

---

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-09 | Ashmit Nigam | Initial BRD with all 20 edge cases resolved |

---

## Appendix C: References

- MongoDB Transactions: https://www.mongodb.com/docs/manual/core/transactions/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Mongoose Optimistic Concurrency: https://mongoosejs.com/docs/guide.html#optimisticConcurrency

---

**END OF BRD**

This document is the single source of truth for the Factory Asset Maintenance System. All development, testing, and deployment decisions must align with the requirements specified herein. Any deviations must be documented and approved through a formal change request process.