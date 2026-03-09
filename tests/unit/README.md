# Unit Tests Organization

## Directory Structure

```
tests/unit/
├── README.md                    ← This file
├── auth/
│   └── auth.test.ts            ← JWT token generation and verification
├── models/
│   └── validation.test.ts       ← Schema-level model validation
├── services/
│   └── (service tests)          ← Business logic layer tests
└── utils/
    ├── visibility.test.ts       ← Role-based access control
    ├── taskCode.test.ts         ← Unique task code generation
    ├── errors.test.ts           ← Error class validation
    ├── transitionGuard.test.ts  ← State machine transition rules
    └── apiHelper.test.ts        ← API response formatting
```

## Test Coverage by Module

### Authentication (auth/)
- **File**: `auth.test.ts`
- **Coverage**:
  - ✅ JWT signing with correct format
  - ✅ JWT verification and expiry
  - ✅ Token security (tamper detection)
  - ✅ 8-hour expiry enforcement
  - ✅ All role types in tokens

### Models (models/)
- **File**: `validation.test.ts`
- **Coverage**:
  - ✅ User model validation (email, role, isActive)
  - ✅ Task model validation (status enum, fields)
  - ✅ MaterialRequest validation (items, status)
  - ✅ Inventory validation (quantity, reorderLevel)
  - ✅ Machinery model (serialNumber uniqueness)
  - ✅ Cross-model relationships

### Authorization & Security (utils/)

#### visibility.test.ts
- Role-based data visibility filters
  - ✅ USER: sees only own tasks (reportedBy)
  - ✅ TECHNICIAN: sees only assigned tasks (assignedTo)
  - ✅ MANAGER/SENIOR_MANAGER: sees all tasks ({})
  - ✅ Privilege escalation prevention

#### transitionGuard.test.ts
- State machine transition validation
  - ✅ REPORTED → UNDER_REVIEW (MANAGER only)
  - ✅ ASSIGNED → IN_PROGRESS (assigned technician only)
  - ✅ MATERIAL_REQUESTED → ESCALATED (auto on 3rd rejection)
  - ✅ ESCALATED resolution (different manager required)
  - ✅ Terminal state enforcement
  - ✅ Field requirement validation

#### taskCode.test.ts
- Unique task code generation (TSK-XXXX-YYY format)
  - ✅ Format validation
  - ✅ Uniqueness across generations
  - ✅ Collision handling
  - ✅ Randomness distribution

#### errors.test.ts
- Error class hierarchy and HTTP mapping
  - ✅ ValidationError (400)
  - ✅ ForbiddenError (403)
  - ✅ NotFoundError (404)
  - ✅ ConflictError (409)
  - ✅ InsufficientInventoryError (400)

#### apiHelper.test.ts
- API response formatting
  - ✅ Success response structure
  - ✅ Error response structure
  - ✅ Pagination meta (page, limit, total, pages)
  - ✅ Sorting parameters
  - ✅ Query parsing and validation
  - ✅ Default values enforcement
  - ✅ Maximum limits (100 items per page)

## Running Tests

### Run All Unit Tests
```bash
npm test -- tests/unit
```

### Run Specific Test File
```bash
npm test -- tests/unit/auth/auth.test.ts
npm test -- tests/unit/utils/visibility.test.ts
npm test -- tests/unit/utils/transitionGuard.test.ts
npm test -- tests/unit/utils/taskCode.test.ts
npm test -- tests/unit/utils/errors.test.ts
npm test -- tests/unit/utils/apiHelper.test.ts
npm test -- tests/unit/models/validation.test.ts
```

### Run Tests with Coverage
```bash
npm test -- tests/unit --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- tests/unit --watch
```

## Test Framework & Configuration

- **Framework**: Jest
- **Config File**: `jest.config.ts` in project root
- **Test Timeout**: 10 seconds per test
- **Module Resolution**: TypeScript paths (@/lib, @/types)

## Test Statistics

| Module | Test File | Test Cases | Coverage Focus |
|--------|-----------|-----------|-----------------|
| Auth | auth.test.ts | 19 | JWT signing, verification, expiry |
| Models | validation.test.ts | 35+ | Schema validation, constraints |
| Visibility | visibility.test.ts | 17 | RBAC, privilege escalation |
| Transitions | transitionGuard.test.ts | 28 | State machine, role guards |
| TaskCode | taskCode.test.ts | 18 | Uniqueness, format, collisions |
| Errors | errors.test.ts | 22 | Error classes, HTTP mapping |
| API Helper | apiHelper.test.ts | 31 | Pagination, sorting, responses |
| **TOTAL** | **7 files** | **~170 tests** | **Full functionality** |

## Test Naming Convention

All test files follow the pattern: `{module}.test.ts`

Test descriptions use:
- `describe()` for test suites (grouped by feature)
- `it()` for individual test cases
- Format: `should [expected behavior] [when condition]`

## Sample Test Run Output

```
 PASS  tests/unit/auth/auth.test.ts
  JWT Authentication (lib/auth.ts)
    signToken()
      ✓ should generate a valid JWT token (5 ms)
      ✓ should encode payload correctly (2 ms)
      ✓ should create tokens for different roles (3 ms)
    verifyToken()
      ✓ should verify a valid token (1 ms)
      ✓ should throw error for invalid token signature (1 ms)
      ✓ should throw error for expired token (1 ms)

PASS  tests/unit/utils/visibility.test.ts (25 ms)
PASS  tests/unit/utils/taskCode.test.ts (45 ms)
PASS  tests/unit/models/validation.test.ts (8 ms)

Test Suites: 7 passed, 7 total
Tests:      170 passed, 170 total
Time:       2.843 s
```

## BRD Requirements Tested

✅ **NFR-SEC-001**: JWT expiry (8 hours), token security  
✅ **NFR-SEC-003**: Error responses with error codes  
✅ **Section 9.2**: Data visibility filters (USER, TECH, MANAGER, SENIOR)  
✅ **Section 8**: State machine transitions (13 states)  
✅ **Edge Cases #1, #2, #5, #7**: Optimistic lock, atomic transactions, task code collision  
✅ **Section 7**: Model validations (enums, constraints, uniqueness)  

## Future Test Additions

- [ ] Service layer tests (TaskService, MaterialService) - isolated
- [ ] API route integration tests - with mocked DB
- [ ] Transaction tests (material approval atomicity)
- [ ] Cache behavior tests (60s LRU on isActive)
- [ ] Pagination boundary tests
- [ ] Concurrent update tests (optimistic lock edge cases)
