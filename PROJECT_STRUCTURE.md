# Factory Asset Maintenance System - Project Structure

```
factory-asset-maintenance/
│
├── ROOT CONFIGURATION FILES
├── .env.local                         ← MONGODB_URI, JWT_SECRET, NODE_ENV
├── .gitignore
├── BRD-Factory-Asset-Maintenance.md  ← Complete business requirements (13 states, 20 edge cases)
├── README.md
├── package.json                       ← Dependencies: Next.js, Mongoose, JWT, Tailwind v4
├── package-lock.json
├── next.config.ts                     ← Turbopack · serverExternalPackages: [mongoose]
├── tsconfig.json                      ← Path alias: @/* → ./src/*
├── tsconfig.seed.json
├── tailwind.config.ts                 ← Content paths for Next.js App Router
├── postcss.config.js                  ← @tailwindcss/postcss plugin for v4
├── jest.config.ts
├── jest.setup.ts
│
├── scripts/
│   └── seed.ts                        ← Seeds MongoDB with:
│                                        7 users (roles: USER, TECH, MGR, SR-MGR)
│                                        6 machines (ACTIVE + DECOMMISSIONED)
│                                        10 inventory items (pcs, kg, litres, etc)
│
└── src/
    │
    ├── TYPES & INTERFACES
    ├── types/
    │   └── index.ts                   ├─ Role (USER | TECHNICIAN | MANAGER | SENIOR_MANAGER)
    │                                  ├─ TaskStatus (13 states: REPORTED → CONFIRMED/REJECTED/CANCELLED)
    │                                  ├─ Priority (LOW | MEDIUM | HIGH | CRITICAL)
    │                                  ├─ Unit (pcs | kg | litres | metres | boxes)
    │                                  ├─ EventLogEntry · IMaterialItem · JWTPayload
    │                                  ├─ AuthenticatedRequest · PaginatedResponse
    │                                  ├─ SLA_HOURS · TERMINAL_STATES · ESCALATION_EXEMPT_STATES
    │                                  └─ Export via types.ts
    │
    ├── CONTEXT & STATE MANAGEMENT
    ├── context/
    │   └── AuthContext.tsx            ├─ AuthProvider (wraps app)
    │                                  ├─ useAuth() hook
    │                                  ├─ Methods: login() · logout() · getAuthUser()
    │                                  ├─ State: user · token · isLoading · canManage · isTechnician
    │                                  ├─ JWT decode: localStorage → JWT payload check
    │                                  ├─ Expiry validation: payload.exp * 1000 > Date.now()
    │                                  └─ 60s LRU cache on isActive verification
    │
    ├── LIBRARY UTILITIES
    ├── lib/
    │   ├── db.ts                      ├─ MongoDB connection (singleton)
    │   │                              ├─ mongoose.connect() with retry logic
    │   │                              ├─ Pooling: min 5, max 50 connections
    │   │                              └─ Exported: connectDB()
    │   │
    │   ├── errors.ts                  ├─ AppError (base class)
    │   │                              ├─ ValidationError · ForbiddenError
    │   │                              ├─ NotFoundError · ConflictError
    │   │                              ├─ InsufficientInventoryError
    │   │                              └─ All with structured error codes
    │   │
    │   ├── auth.ts                    ├─ signToken(payload): string
    │   │                              ├─ verifyToken(token): JWTPayload
    │   │                              ├─ getAuthUser(req): JWTPayload + isActive check
    │   │                              ├─ requireRoles(...roles): validator
    │   │                              ├─ LRU cache: 60s TTL on isActive
    │   │                              └─ Auto logout on 401 from apiClient
    │   │
    │   ├── visibility.ts              ├─ applyVisibilityFilter(role, userId)
    │   │                              ├─ USER scope: { reportedBy: userId }
    │   │                              ├─ TECHNICIAN scope: { assignedTo: userId }
    │   │                              ├─ MANAGER/SENIOR scope: {} (all)
    │   │                              ├─ Applied to Task queries only
    │   │                              └─ Returns MongoDB query object
    │   │
    │   ├── taskCode.ts                ├─ generateTaskCode(): TSK-XXXX-YYY
    │   │                              ├─ generateUniqueTaskCode()
    │   │                              ├─ Retry loop: 5 attempts max
    │   │                              ├─ Format: TSK + 4 digits + 3 uppercase letters
    │   │                              └─ DB unique index is final guard
    │   │
    │   ├── transitionGuard.ts         ├─ validateTransition(task, nextStatus, user, ctx)
    │   │                              ├─ 13 states × role-based rules
    │   │                              ├─ Guards: permission · field requirements
    │   │                              ├─ assignedTo validation · conflict-of-interest checks
    │   │                              ├─ Escalation resolution guards
    │   │                              ├─ No pending MR check before new request
    │   │                              └─ Returns validated or throws error
    │   │
    │   ├── apiHelper.ts               ├─ successResponse(data, status)
    │   │                              ├─ errorResponse(error)
    │   │                              ├─ paginatedResponse(tasks, meta)
    │   │                              ├─ getPaginationParams(searchParams)
    │   │                              ├─ getSortParams(searchParams)
    │   │                              └─ All return NextResponse
    │   │
    │   └── apiClient.ts               ├─ ApiClientError class
    │                                  ├─ apiClient.get/post/patch/put/delete()
    │                                  ├─ Auto-adds Authorization header (JWT)
    │                                  ├─ Auto-redirect to /login on 401
    │                                  ├─ Structured error parsing
    │                                  └─ Type-safe response: ApiResponse<T>
    │
    ├── DATA MODELS & SCHEMAS
    ├── models/
    │   ├── User.ts                    ├─ Interface: IUser
    │   │                              ├─ Fields: name · email · passwordHash · role · isActive
    │   │                              ├─ Mongoose schema with validators
    │   │                              ├─ Bcrypt hashing (pre-save hook)
    │   │                              ├─ comparePassword() method
    │   │                              ├─ toJSON excludes: passwordHash · __v
    │   │                              ├─ Unique index: email
    │   │                              ├─ Compound index: (role, isActive)
    │   │                              └─ Database collection: users
    │   │
    │   ├── Machinery.ts               ├─ Interface: IMachinery
    │   │                              ├─ Fields: name · serialNumber · location · type
    │   │                              ├─ status: ACTIVE | DECOMMISSIONED
    │   │                              ├─ maintenanceHistory[]: taskId · taskCode · resolvedAt · summary
    │   │                              ├─ Unique index: serialNumber
    │   │                              ├─ Index: status (for decommission queries)
    │   │                              ├─ toJSON excludes: __v
    │   │                              └─ Database collection: machinery
    │   │
    │   ├── Task.ts                    ├─ Interface: ITask
    │   │                              ├─ Core: taskCode · title · description · machineryId · priority
    │   │                              ├─ Status: 13 states + initial REPORTED
    │   │                              ├─ Tracking: reportedBy · assignedTo · slaDeadline · slaBreached
    │   │                              ├─ Reason fields: cancellationReason · rejectionReason
    │   │                              ├─ Timestamps: completedAt · confirmedAt · escalatedAt
    │   │                              ├─ Optimistic lock: __v field
    │   │                              ├─ Event log: immutable audit trail[]
    │   │                              ├─ Unique index: taskCode
    │   │                              ├─ Indexes: status · reportedBy · assignedTo
    │   │                              ├─ Compound: (priority, slaDeadline)
    │   │                              ├─ Text index: (title, description)
    │   │                              ├─ Virtual: isSlaBreached (computed on read)
    │   │                              └─ Database collection: tasks
    │   │
    │   ├── MaterialRequest.ts         ├─ Interface: IMaterialRequest
    │   │                              ├─ Fields: taskId · requestedBy · items[]
    │   │                              ├─ Items: name · quantity · unit (enum)
    │   │                              ├─ Status tracking: status · rejectionCount · rejectionNote
    │   │                              ├─ Approval: approvedBy · rejectionNote
    │   │                              ├─ Indexes: taskId · requestedBy · status
    │   │                              ├─ Compound: (taskId, status)
    │   │                              ├─ Validation: items array min 1, quantity min 1
    │   │                              └─ Database collection: materialrequests
    │   │
    │   └── Inventory.ts               ├─ Interface: IInventory
    │                                  ├─ Fields: itemName · quantity · unit · reorderLevel
    │                                  ├─ Unique index: itemName
    │                                  ├─ Quantity constraint: min 0 (cannot go negative)
    │                                  ├─ toJSON excludes: __v
    │                                  ├─ Guard on deduction: quantity >= required
    │                                  └─ Database collection: inventories
    │
    ├── BUSINESS LOGIC SERVICES
    ├── services/
    │   ├── TaskService.ts             ├─ createTask(input, actor)
    │   │                              │ └─ Dup detection: same user + machine + 24h → 409
    │   │                              ├─ listTasks(input): paginated + filtered
    │   │                              │ └─ Applies visibility filter + text search
    │   │                              ├─ getTaskById(id, actor): single + visibility
    │   │                              ├─ assignTask(id, technicianId, actor)
    │   │                              │ └─ Optimistic lock check (__v)
    │   │                              ├─ transitionStatus(id, nextStatus, actor, ctx)
    │   │                              │ └─ Calls transitionGuard + updates status
    │   │                              ├─ getEventLog(taskId, actor)
    │   │                              │ └─ Returns audit trail
    │   │                              └─ appendToMaintHistory(machineId, task)
    │   │                                └─ Auto-called on CONFIRMED
    │   │
    │   └── MaterialService.ts         ├─ createMaterialRequest(taskId, items, actor)
    │   │                              │ └─ Guard: only TECHNICIAN, only assigned task
    │   │                              ├─ listMaterialRequests(taskId, actor)
    │   │                              │ └─ Role-scoped visibility
    │   │                              ├─ approveMaterialRequest(mrId, actor)
    │   │                              │ └─ MongoDB transaction:
    │   │                              │    1. Check inventory sufficient
    │   │                              │    2. Deduct all items atomically
    │   │                              │    3. Update MR status → APPROVED
    │   │                              │    4. Update Task status → IN_PROGRESS
    │   │                              │    Rollback on any failure
    │   │                              ├─ rejectMaterialRequest(mrId, reason, actor)
    │   │                              │ └─ Increment rejectionCount
    │   │                              │    Auto-escalate Task if count >= 3
    │   │                              └─ Error: InsufficientInventoryError on stock fail
    │
    ├── UI COMPONENTS
    ├── components/
    │   ├── StatusBadge.tsx            ├─ Props: status · size (sm|md)
    │   │                              ├─ Renders: 13 state colors + icon
    │   │                              └─ Used in: task lists, task detail
    │   │
    │   └── PriorityBadge.tsx          ├─ Props: priority · size
    │                                  ├─ Renders: 4 priority colors + label
    │                                  └─ Used in: stat cards, task rows
    │
    ├── FRONTEND PAGES & ROUTES
    └── app/
        │
        ├── layout.tsx                 ├─ Root layout wraps {children}
        │                              ├─ Imports: Inter font · globals.css
        │                              ├─ **CRITICAL**: AuthProvider wrapper here
        │                              └─ Metadata: Factory Asset Maintenance
        │
        ├── page.tsx                   ├─ Home page
        │                              ├─ Branding & system status message
        │                              └─ Redirect or entry point
        │
        ├── globals.css                ├─ @import "tailwindcss" (v4 syntax)
        │                              └─ Global styles
        │
        ├── (auth)/
        │   ├── layout.tsx             ├─ Auth layout (no sidebar)
        │   │                          ├─ Minimal responsive layout
        │   │                          └─ For login page only
        │   │
        │   └── login/
        │       └── page.tsx           ├─ LoginPage component
        │                              ├─ Email + password form
        │                              ├─ Demo credentials display
        │                              ├─ Login flow: apiClient.post()
        │                              ├─ Success: store JWT + redirect /dashboard
        │                              ├─ Error: validation messages
        │                              └─ Already logged in: redirect /dashboard
        │
        └── (dashboard)/
            │
            ├── dashboard/
            │   ├── layout.tsx         ├─ Dashboard main layout
            │   │                      ├─ Sidebar navigation (role-based)
            │   │                      ├─ User profile card + logout
            │   │                      ├─ Nav items: Dashboard · Tasks · Machinery · Inventory
            │   │                      ├─ Applies visibility rules for nav
            │   │                      └─ Content area: flex-1 overflow-y-auto
            │   │
            │   ├── page.tsx           ├─ Dashboard home / stats page
            │   │                      ├─ Header: greeting + report button
            │   │                      ├─ Stat cards: role-dependent layout
            │   │                      │  └─ Manager: Reported · Under Review · Escalated · SLA Breached
            │   │                      │  └─ Technician: Assigned · In Progress · Total
            │   │                      │  └─ User: My Tasks · In Progress · Completed
            │   │                      ├─ SLA breach banner (managers only)
            │   │                      ├─ Recent tasks table (5 most recent)
            │   │                      └─ Fetch: /api/tasks?limit=5&sortBy=createdAt
            │   │
            │   ├── tasks/
            │   │   ├── page.tsx       ├─ Task list view
            │   │   │                  ├─ Search · filter by status/priority
            │   │   │                  ├─ Sort · paginate (default 20/page)
            │   │   │                  ├─ Status badges · priority colors
            │   │   │                  ├─ SLA indicator (red dot if breached)
            │   │   │                  ├─ Machinery + taskCode columns
            │   │   │                  ├─ Click row → task detail
            │   │   │                  └─ Fetch: /api/tasks?[filters]
            │   │   │
            │   │   ├── new/
            │   │   │   └── page.tsx   ├─ Create task form (USER/MANAGER only)
            │   │   │                  ├─ Title · description · machinery select
            │   │   │                  ├─ Priority picker (4 options)
            │   │   │                  ├─ Duplicate warning modal
            │   │   │                  ├─ Submit → /api/tasks POST
            │   │   │                  └─ Success: redirect to task detail
            │   │   │
            │   │   └── [id]/
            │   │       └── page.tsx   ├─ Task detail view
            │   │                      ├─ Header: taskCode · title · machinery
            │   │                      ├─ Status history: eventLog items
            │   │                      ├─ Task fields: description · priority · SLA
            │   │                      ├─ Action buttons (role + status dependent):
            │   │                      │  ├─ Manager: Assign · Review · Reject · Cancel
            │   │                      │  ├─ Technician: Pick up · Mark Complete · Request Materials
            │   │                      │  └─ All: View event log · history
            │   │                      ├─ Material request section:
            │   │                      │  ├─ Display any existing requests
            │   │                      │  ├─ Approve/reject buttons (managers)
            │   │                      │  └─ Form to create new request (technician)
            │   │                      └─ Fetch: /api/tasks/:id
            │   │
            │   ├── machinery/
            │   │   └── page.tsx       ├─ Machinery list (MANAGER only)
            │   │                      ├─ Search · filter by status
            │   │                      ├─ Machine cards: name · serial · location · type
            │   │                      ├─ Status indicator: ACTIVE (green) / DECOMMISSIONED (gray)
            │   │                      ├─ "View History" button → maintenance modal
            │   │                      ├─ Modal shows: past tasks on this machine
            │   │                      └─ Fetch: /api/machinery + /api/machinery/:id/history
            │   │
            │   └── inventory/
            │       └── page.tsx       ├─ Inventory view (MANAGER only)
            │                          ├─ Table: itemName · quantity · unit · reorderLevel
            │                          ├─ Status column: "In Stock" (green) / "Low Stock" (red)
            │                          ├─ Low stock = quantity ≤ reorderLevel
            │                          ├─ Search filter
            │                          ├─ Last updated column (date)
            │                          └─ Fetch: /api/inventory
            │
            └── api/
                │
                ├── auth/
                │   └── login/route.ts ├─ POST /api/auth/login
                │                      ├─ Parse email + password from body
                │                      ├─ Find User by email
                │                      ├─ bcrypt.compare(password, hash)
                │                      ├─ signToken(payload)
                │                      ├─ Response: { token, user }
                │                      ├─ Error 401: "Invalid credentials"
                │                      └─ Rate limit: 5/min per IP
                │
                ├── tasks/
                │   ├── route.ts       ├─ GET /api/tasks
                │   │                  │ ├─ Auth check
                │   │                  │ ├─ Apply visibility filter
                │   │                  │ ├─ Parse query: status · priority · search · page · limit · sort
                │   │                  │ ├─ MongoDB query: filters + text search + pagination
                │   │                  │ ├─ Return: paginated data + meta
                │   │                  │ └─ Response 200: { data, meta }
                │   │                  │
                │   │                  └─ POST /api/tasks
                │   │                   ├─ Auth check: USER or MANAGER
                │   │                   ├─ Validate: title · description · machineryId · priority
                │   │                   ├─ Duplicate check: same user + machine + 24h
                │   │                   ├─ If dup: return 409 with existingTask
                │   │                   ├─ generateUniqueTaskCode()
                │   │                   ├─ Calculate slaDeadline from priority
                │   │                   ├─ Create Task doc + initial eventLog
                │   │                   └─ Rate limit: 10/hour per user
                │   │
                │   └── [id]/
                │       ├── route.ts   ├─ GET /api/tasks/:id
                │       │              ├─ Auth check
                │       │              ├─ Apply visibility filter
                │       │              ├─ Populate: machinery · assignedTo · reportedBy
                │       │              ├─ Return 404 if not found (not 403)
                │       │              └─ Prevent ID enumeration
                │       │
                │       ├── status/
                │       │   └── route.ts  ├─ PATCH /api/tasks/:id/status
                │       │                 ├─ Auth + visibility check
                │       │                 ├─ Validate nextStatus via transitionGuard
                │       │                 ├─ Check optimistic lock: __v matches
                │       │                 ├─ Return 409 if __v mismatch
                │       │                 ├─ Set server timestamps: completedAt · confirmedAt · escalatedAt
                │       │                 ├─ Append eventLog entry
                │       │                 ├─ Auto-append to maintenanceHistory if → CONFIRMED
                │       │                 └─ Response: updated task + new __v
                │       │
                │       ├── assign/
                │       │   └── route.ts  ├─ PATCH /api/tasks/:id/assign
                │       │                 ├─ Auth check: MANAGER/SENIOR_MANAGER
                │       │                 ├─ Visibility + optimistic lock check
                │       │                 ├─ Validate: user exists · role=TECHNICIAN · isActive=true
                │       │                 ├─ Update: assignedTo · status=ASSIGNED
                │       │                 ├─ Append eventLog
                │       │                 └─ Response: updated task
                │       │
                │       ├── event-log/
                │       │   └── route.ts  ├─ GET /api/tasks/:id/event-log
                │       │                 ├─ Auth + visibility check
                │       │                 ├─ Return: task.eventLog[]
                │       │                 └─ Full audit trail (immutable)
                │       │
                │       └── material-request/
                │           ├── route.ts  ├─ GET /api/tasks/:id/material-requests
                │           │             ├─ Auth + role-scoped visibility
                │           │             └─ Return: all MRs for this task
                │           │
                │           │             ├─ POST /api/tasks/:id/material-request
                │           │             ├─ Auth check: TECHNICIAN
                │           │             ├─ Verify: task.assignedTo === user._id
                │           │             ├─ Guard: no PENDING MR already exists
                │           │             ├─ Validate items: min 1, quantity min 1, unit enum
                │           │             ├─ Create MaterialRequest doc
                │           │             ├─ Update Task.status → MATERIAL_REQUESTED
                │           │             └─ Response 201: new MR object
                │           │
                │           └── [mrId]/
                │               ├── approve/
                │               │   └── route.ts   ├─ PATCH approve
                │               │                  ├─ Auth: MANAGER/SENIOR_MANAGER
                │               │                  ├─ MongoDB transaction (all-or-nothing):
                │               │                  │  ├─ Session.startTransaction()
                │               │                  │  ├─ Find items + check stock: quantity >= required
                │               │                  │  ├─ If insufficient: throw error + rollback
                │               │                  │  ├─ Deduct inventory for all items
                │               │                  │  ├─ Update MR: status=APPROVED · approvedBy
                │               │                  │  ├─ Update Task: status=IN_PROGRESS
                │               │                  │  ├─ Session.commitTransaction()
                │               │                  │  └─ On error: rollback (no partial writes)
                │               │                  └─ Response 200 or 400 InsufficientInventoryError
                │               │
                │               └── reject/
                │                   └── route.ts   ├─ PATCH reject
                │                                  ├─ Auth: MANAGER/SENIOR_MANAGER
                │                                  ├─ Update MR: status=REJECTED · rejectionNote
                │                                  ├─ Increment: rejectionCount++
                │                                  ├─ Keep Task.status = MATERIAL_REQUESTED
                │                                  ├─ If rejectionCount >= 3:
                │                                  │  ├─ Update Task: status=ESCALATED
                │                                  │  ├─ Set Task.escalatedAt = now
                │                                  │  └─ Append eventLog
                │                                  └─ Response 200: updated MR
                │
                ├── machinery/
                │   ├── route.ts       ├─ GET /api/machinery
                │   │                  ├─ Auth check (MANAGER only)
                │   │                  ├─ Query filter: ?status=ACTIVE (default ACTIVE)
                │   │                  ├─ Search support: name · serialNumber · location
                │   │                  ├─ Return: array of machines
                │   │                  └─ Response 200: { data: Machinery[] }
                │   │
                │   └── [id]/
                │       └── history/
                │           └── route.ts  ├─ GET machinery history
                │                         ├─ Auth check
                │                         ├─ Fetch machinery + maintenanceHistory[]
                │                         ├─ Return: { machinery, maintenanceHistory, totalRecords }
                │                         └─ Response 200
                │
                ├── inventory/
                │   └── route.ts       ├─ GET /api/inventory
                │                      ├─ Auth check: MANAGER/SENIOR_MANAGER only
                │                      ├─ Query filter: ?search=bearing
                │                      ├─ Search: itemName (regex, case-insensitive)
                │                      ├─ Return: all items + current quantities
                │                      └─ Response 200: { data: Inventory[] }
                │
                └── users/
                    └── technicians/
                        └── route.ts   ├─ GET /api/users/technicians
                                      ├─ Auth check
                                      ├─ Find: role=TECHNICIAN · isActive=true
                                      ├─ Return: _id · name · email
                                      └─ For machinery/task assignment dropdowns
```

## Key Architectural Points:

### 📂 **Route Organization**
- **Public routes**: `/login`, `/` (home)
- **Protected routes**: `/dashboard/*` (all require auth)
- **API routes**: `/api/*` with role-based access control

### 🔐 **Security Layers**
1. **AuthContext**: JWT management + auto-logout on 401
2. **Auth middleware**: `getAuthUser()` in every route
3. **Visibility filters**: Applied at query layer (not UI layer)
4. **Optimistic locking**: `__v` field prevents concurrent updates

## Refined Architectural Flow (BRD-Compliant):

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Browser (Next.js Frontend)                                       │
│  ├─ AuthContext: JWT management + localStorage persistence      │
│  ├─ apiClient: Bearer token injection + 401 auto-redirect       │
│  └─ Components: StatusBadge, PriorityBadge (UI rendering)       │
└─────────────────────────────────────────────────────────────────┘
       ↓ HTTP/REST with JWT header
┌─────────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER (Next.js Edge)                              │
├─────────────────────────────────────────────────────────────────┤
│ Rate Limiting Middleware (NFR-SEC-003)                          │
│  ├─ Login: 5 attempts/IP/minute                                 │
│  ├─ Task creation: 10 tasks/user/hour                           │
│  └─ Blocks requests exceeding limits (429 response)             │
└─────────────────────────────────────────────────────────────────┘
       ↓ Pass rate-limit check
┌─────────────────────────────────────────────────────────────────┐
│ API ROUTES LAYER (Next.js App Router)                            │
├─────────────────────────────────────────────────────────────────┤
│ /api/auth/login                                                 │
│ /api/tasks, /api/tasks/:id, /api/tasks/:id/status              │
│ /api/tasks/:id/material-request/:mrId/[approve|reject]         │
│ /api/machinery, /api/inventory, /api/users/technicians         │
└─────────────────────────────────────────────────────────────────┘
       ↓ 
┌─────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION LAYER (lib/auth.ts)                               │
├─────────────────────────────────────────────────────────────────┤
│ getAuthUser(req): Verify JWT + 60s LRU cache on isActive       │
│  ├─ Check token expiry (must be within 8h)                     │
│  ├─ Verify signature (JWT_SECRET)                              │
│  ├─ Cache hit: return cached user (prevent repeated DB hits)   │
│  └─ Cache miss: fetch User from DB + check isActive            │
└─────────────────────────────────────────────────────────────────┘
       ↓ authenticated user object
┌─────────────────────────────────────────────────────────────────┐
│ AUTHORIZATION LAYER (lib/visibility.ts + transitionGuard.ts)   │
├─────────────────────────────────────────────────────────────────┤
│ applyVisibilityFilter(role, userId):                            │
│  ├─ USER: { reportedBy: userId } (see only own tasks)          │
│  ├─ TECHNICIAN: { assignedTo: userId } (see assigned tasks)    │
│  ├─ MANAGER/SENIOR: {} (see all tasks)                         │
│  └─ Applied BEFORE query execution (prevents data leaks)       │
│                                                                  │
│ validateTransition(task, nextStatus, user):                    │
│  ├─ Check role-based permission (from TRANSITION_GUARDS)       │
│  ├─ Validate required fields (e.g., cancellationReason)        │
│  ├─ Check conflict-of-interest (last rejecter ≠ escalation fix)│
│  └─ Guard: no PENDING MR check before new MR request           │
└─────────────────────────────────────────────────────────────────┘
       ↓ visibility filter + validation passed
┌─────────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER (services/)                                │
├─────────────────────────────────────────────────────────────────┤
│ TaskService:                                                     │
│  ├─ createTask(): Dup detection + taskCode generation           │
│  ├─ listTasks(): Apply visibility filter + text search + paginate│
│  ├─ transitionStatus(): Validate + append eventLog             │
│  └─ assignTask(): Optimistic lock check (__v)                  │
│                                                                  │
│ MaterialService:                                                │
│  ├─ approveMaterialRequest(): MongoDB transaction (atomic)      │
│  │  ├─ Check inventory sufficient                              │
│  │  ├─ Deduct inventory                                        │
│  │  ├─ Update MR status → APPROVED                             │
│  │  ├─ Update Task status → IN_PROGRESS                        │
│  │  └─ Commit all or rollback all                              │
│  └─ rejectMaterialRequest(): Increment count + auto-escalate    │
└─────────────────────────────────────────────────────────────────┘
       ↓ business logic applied
┌─────────────────────────────────────────────────────────────────┐
│ DATA ACCESS LAYER (Mongoose ODM)                                │
├─────────────────────────────────────────────────────────────────┤
│ Model.findOne/find/updateOne({ ...visibilityFilter, ... })     │
│ Indexes: taskCode (unique) · status · reportedBy · assignedTo  │
│ Virtual fields: isSlaBreached                                   │
│ Hooks: bcrypt pre-save, maintenanceHistory append on CONFIRMED  │
└─────────────────────────────────────────────────────────────────┘
       ↓ parameterized queries (no injection)
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER (MongoDB)                                         │
├─────────────────────────────────────────────────────────────────┤
│ Collections:                                                     │
│  ├─ users                 (roles: USER, TECHNICIAN, MANAGER)    │
│  ├─ tasks                 (13 states, eventLog, optimistic lock)│
│  ├─ materialrequests      (PENDING→APPROVED/REJECTED)          │
│  ├─ machinery             (ACTIVE/DECOMMISSIONED status)        │
│  └─ inventories           (quantities, reorderLevel)            │
│                                                                  │
│ Transaction Support:                                             │
│  ├─ Material approval + inventory deduction (all-or-nothing)    │
│  ├─ Requires: replica set, MongoDB 4.2+                        │
│  └─ Rollback on error: no partial writes allowed                │
│                                                                  │
│ Optimistic Locking:                                              │
│  ├─ __v field on Task document                                  │
│  ├─ Concurrent updates detected (409 conflict)                  │
│  └─ Prevents: race conditions on task assignment                │
└─────────────────────────────────────────────────────────────────┘
       ↓ structured response
┌─────────────────────────────────────────────────────────────────┐
│ RESPONSE LAYER (apiHelper.ts)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Success: { data: {...}, meta: { page, total, sortBy } }         │
│ Error: { error: "message", code: "ERROR_CODE", details: [...] } │
│ Includes pagination info, audit trail (eventLog)               │
└─────────────────────────────────────────────────────────────────┘
       ↓ HTTP/JSON
       → Browser (UI updates via React state)
```

## Key BRD-Compliance Points:

✅ **Rate Limiting (NFR-SEC-003)**: Edge middleware BEFORE API routes  
✅ **Auth Verification (NFR-SEC-001)**: 8-hour JWT expiry, 60s isActive cache  
✅ **Authorization RBAC (9.1)**: Role-based permission checks via transitionGuard  
✅ **Data Visibility (9.2)**: Applied at query layer (BEFORE MongoDB)  
✅ **Optimistic Locking (11.1 #1)**: __v field prevents race conditions  
✅ **Atomic Transactions (11.1 #2)**: MongoDB multi-doc transaction on material approval  
✅ **Privilege Escalation Prevention (9.3)**: Visibility filter + conflict-of-interest guards  
✅ **Audit Trail (NFR-REL-002)**: eventLog append-only, immutable  
✅ **Error Handling (NFR-REL-003)**: Structured JSON responses with error codes  

---

### 💾 **Database Collections**
- `users` - Authentication + roles
- `tasks` - Main workflow (13 states)
- `materialrequests` - Material tracking
- `machinery` - Asset master data
- `inventories` - Stock levels

### 🎯 **State Management**
- **Frontend**: AuthContext + local state in components
- **Backend**: Mongoose schemas + MongoDB transactions
- **Sync**: API calls via `apiClient` singleton

### 📊 **Data Flow**
```
Browser (Next.js UI)
  ↓ JWT in header
API Route (Auth check)
  ↓ Service layer
MongoDB (with transactions for atomic operations)
  ↓ Response
UI updates (via apiClient hooks)
```

### ✅ **Testing Structure**
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Jest + Supertest configured
- Seed DB for test scenarios
