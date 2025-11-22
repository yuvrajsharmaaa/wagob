# WajoB Smart Contracts Documentation

## Overview

This document provides comprehensive technical documentation for the three core smart contracts powering the WajoB platform on TON blockchain.

---

## 1. JobRegistry Contract (`job_registry.fc`)

### Purpose
Manages immutable job postings with detailed metadata, supporting queries by poster and status.

### Data Structures

#### Storage Layout
```
- job_counter: uint32        // Auto-incrementing job ID counter
- jobs_dict: hashmap         // job_id -> job_data
- poster_jobs_dict: hashmap  // poster_hash -> list of job_ids
- owner_address: MsgAddress  // Contract owner
```

#### Job Data Structure
```
- job_id: uint32
- poster_address: MsgAddress
- worker_address: MsgAddress (empty initially)
- job_title: slice (256 bits)
- job_description: slice (512 bits)
- location: slice (256 bits)
- category: slice (128 bits)
- wages: Coins (nanotons)
- duration_hours: uint16
- status: uint8
- created_at: uint64 (timestamp)
- updated_at: uint64 (timestamp)
- is_verified: uint1
```

### Job Status Flags
| Status | Value | Description |
|--------|-------|-------------|
| OPEN | 1 | Job is posted and available |
| ASSIGNED | 2 | Worker has been assigned |
| IN_PROGRESS | 3 | Work has started |
| COMPLETED | 4 | Work is completed |
| CANCELLED | 5 | Job was cancelled |
| DISPUTED | 6 | Dispute raised |

### Operations

#### OP_CREATE_JOB (0x7362d09c)
Creates a new job posting.

**Input:**
```
- title: slice (256 bits)
- description: slice (512 bits)
- location: slice (256 bits)
- category: slice (128 bits)
- wages: Coins
- duration: uint16
```

**Output:**
- Confirmation message with job_id
- Job stored in jobs_dict
- Job_id added to poster's list

**Gas Efficiency:** O(1) with dictionary lookup

#### OP_UPDATE_STATUS (0x5fcc3d14)
Updates job status (poster only).

**Input:**
```
- job_id: uint32
- new_status: uint8
```

**Authorization:** Only job poster

**Output:**
- Updated job in dictionary
- Confirmation with new status

#### OP_ASSIGN_WORKER (0x235caf52)
Assigns a worker to the job.

**Input:**
```
- job_id: uint32
- worker_address: MsgAddress
```

**Authorization:** Only job poster

**Output:**
- Job status set to ASSIGNED
- Worker address stored

#### OP_GET_JOB (0x2d4fa84f)
Retrieves job data.

**Input:**
```
- job_id: uint32
```

**Output:**
- Complete job data cell

### Get Methods

#### get_job_data(job_id: int) -> cell
Returns complete job data as a cell.

#### get_job_count() -> int
Returns total number of jobs created.

#### get_owner() -> slice
Returns contract owner address.

#### get_jobs_by_poster(poster_address: slice) -> tuple
Returns tuple of job_ids created by the poster.

### Error Codes
- **100:** ERROR_UNAUTHORIZED - Sender not authorized
- **101:** ERROR_JOB_NOT_FOUND - Job ID doesn't exist
- **102:** ERROR_INVALID_STATUS - Invalid status value
- **103:** ERROR_INSUFFICIENT_PAYMENT - Insufficient funds sent

### Gas Optimization
- Uses hashmaps for O(1) lookups
- Separate cells for text data to avoid overflow
- Lazy loading - only loads necessary data
- Efficient packing with minimal padding

---

## 2. Escrow Contract (`escrow.fc`)

### Purpose
Secure escrow payment system with atomic locking, mutual confirmation, and dispute resolution.

### Data Structures

#### Storage Layout
```
- escrow_counter: uint32
- escrows_dict: hashmap       // escrow_id -> escrow_data
- owner_address: MsgAddress
- fee_percentage: uint16       // In basis points (250 = 2.5%)
```

#### Escrow Data Structure
```
- escrow_id: uint32
- job_id: uint32
- employer_address: MsgAddress
- worker_address: MsgAddress
- amount: Coins
- state: uint8
- created_at: uint64
- locked_at: uint64
- completed_at: uint64
- dispute_raised_at: uint64
- employer_confirmed: uint1
- worker_confirmed: uint1
```

### Escrow States
| State | Value | Description |
|-------|-------|-------------|
| CREATED | 1 | Escrow created, not funded |
| FUNDED | 2 | Employer deposited funds |
| LOCKED | 3 | Worker accepted, funds locked |
| COMPLETED | 4 | Job completed, funds released |
| DISPUTED | 5 | Dispute raised |
| REFUNDED | 6 | Funds returned to employer |

### Operations

#### OP_CREATE_ESCROW (0x8f4a33db)
Creates new escrow for a job.

**Input:**
```
- job_id: uint32
- worker_address: MsgAddress
- amount: Coins
```

**Output:**
- Escrow record created
- State: CREATED

#### OP_FUND_ESCROW (0x2fcb26a8)
Employer funds the escrow.

**Input:**
```
- escrow_id: uint32
```

**Requirements:**
- msg_value >= escrow.amount
- Sender is employer
- State is CREATED

**Output:**
- Funds locked in contract
- State: FUNDED
- Worker notified

#### OP_LOCK_ESCROW (0x5de7c0ab)
Worker accepts job, locks escrow.

**Input:**
```
- escrow_id: uint32
```

**Authorization:** Only worker

**Output:**
- State: LOCKED
- locked_at timestamp set

#### OP_CONFIRM_COMPLETION (0x6a8d4f12)
Confirm job completion (mutual).

**Input:**
```
- escrow_id: uint32
```

**Authorization:** Employer OR Worker

**Logic:**
- Sets confirmation flag for sender
- If both confirmed:
  - Calculate fee: `fee = amount * fee_percentage / 10000`
  - Send `amount - fee` to worker
  - Send `fee` to platform owner
  - State: COMPLETED

**Output:**
- Automatic payment release
- State: COMPLETED

#### OP_RAISE_DISPUTE (0x7b3e5c91)
Raise a dispute.

**Input:**
```
- escrow_id: uint32
```

**Authorization:** Employer OR Worker

**Output:**
- State: DISPUTED
- dispute_raised_at timestamp set

#### OP_RESOLVE_DISPUTE (0x4f2a9d63)
Resolve dispute (owner only).

**Input:**
```
- escrow_id: uint32
- release_to_worker: uint1
```

**Authorization:** Only contract owner

**Output:**
- Funds released to worker OR refunded to employer
- State: COMPLETED or REFUNDED

### Get Methods

#### get_escrow_data(escrow_id: int) -> cell
Returns complete escrow data.

#### get_escrow_count() -> int
Returns total escrow count.

#### get_fee_percentage() -> int
Returns platform fee in basis points.

### Error Codes
- **200:** ERROR_UNAUTHORIZED
- **201:** ERROR_ESCROW_NOT_FOUND
- **202:** ERROR_INVALID_STATE
- **203:** ERROR_INSUFFICIENT_FUNDS
- **204:** ERROR_ALREADY_RELEASED
- **205:** ERROR_DISPUTE_TIMEOUT

### Security Features
1. **Atomic Operations:** All fund transfers are atomic
2. **State Machine:** Strict state transitions prevent exploits
3. **Mutual Confirmation:** Requires both parties for release
4. **Dispute Resolution:** Platform can intervene in disputes
5. **Time Locks:** 30-day auto-release timeout (optional)

### Gas Optimization
- Efficient state machine with minimal storage
- Single dictionary lookup per operation
- Batched confirmations
- Lazy evaluation of calculations

---

## 3. Reputation Contract (`reputation.fc`)

### Purpose
Immutable on-chain reputation system with ratings, reviews, and cumulative scores.

### Data Structures

#### Storage Layout
```
- rating_counter: uint32
- ratings_dict: hashmap           // rating_id -> rating_data
- user_ratings_dict: hashmap      // user_hash -> aggregated_reputation
- job_ratings_dict: hashmap       // job_id -> list of rating_ids
- owner_address: MsgAddress
```

#### Rating Data Structure
```
- rating_id: uint32
- job_id: uint32
- rater_address: MsgAddress
- ratee_address: MsgAddress
- rating_score: uint8 (1-5)
- review_text: slice (512 bits)
- created_at: uint64
- is_employer_to_worker: uint1
```

#### Reputation Data Structure
```
- total_ratings: uint32
- sum_ratings: uint32
- average_rating: uint16 (scaled by 100)
- completed_jobs: uint32
```

### Rating Constraints
- **MIN_RATING:** 1
- **MAX_RATING:** 5
- **RATING_SCALE:** 100 (for precision)
- **MAX_REVIEW_LENGTH:** 512 bits

### Operations

#### OP_SUBMIT_RATING (0x9e6f2a84)
Submit a rating and review.

**Input:**
```
- job_id: uint32
- ratee_address: MsgAddress
- rating_score: uint8 (1-5)
- review_text: slice (512 bits)
- is_employer_to_worker: uint1
```

**Validation:**
- Rating score between 1-5
- Cannot rate same job twice
- Must be participant in the job

**Output:**
- Rating stored immutably
- Ratee's reputation updated
- Ratee notified

**Reputation Update Logic:**
```func
total_ratings = previous_total + 1
sum_ratings = previous_sum + rating_score
average_rating = (sum_ratings * RATING_SCALE) / total_ratings
completed_jobs = previous_jobs + 1
```

#### OP_GET_REPUTATION (0x4d8b3c71)
Retrieve user reputation.

**Input:**
```
- user_address: MsgAddress
```

**Output:**
- Aggregated reputation data

#### OP_GET_RATING_HISTORY (0x6c2f9a15)
Get all ratings for a job.

**Input:**
```
- job_id: uint32
```

**Output:**
- List of rating_ids

### Get Methods

#### get_user_reputation(user_address: slice) -> (int, int, int, int)
Returns:
- total_ratings
- sum_ratings  
- average_rating
- completed_jobs

#### get_rating_data(rating_id: int) -> cell
Returns complete rating data.

#### get_rating_count() -> int
Returns total ratings in system.

#### get_job_ratings(job_id: int) -> tuple
Returns tuple of rating_ids for job.

#### calculate_reputation_score(user_address: slice) -> int
Calculates weighted reputation score (0-100).

**Formula:**
```
rating_component = (average_rating * 70) / 100
job_component = min((completed_jobs * 30) / 10, 30 * RATING_SCALE)
reputation_score = (rating_component + job_component) * 100 / (5 * RATING_SCALE)
```

**Weighting:**
- 70% average rating quality
- 30% number of jobs (capped at 10)

#### can_rate_job(user_address: slice, job_id: int) -> int
Returns -1 if can rate, 0 if already rated.

### Error Codes
- **300:** ERROR_UNAUTHORIZED
- **301:** ERROR_RATING_NOT_FOUND
- **302:** ERROR_ALREADY_RATED
- **303:** ERROR_INVALID_RATING
- **304:** ERROR_JOB_NOT_COMPLETED

### Immutability Guarantees
1. **No Delete Operation:** Ratings cannot be deleted
2. **No Update Operation:** Ratings cannot be modified
3. **Append-Only:** Only new ratings can be added
4. **Cryptographic Verification:** All ratings are on-chain

### Anti-Gaming Measures
1. **One Rating Per Job:** Cannot spam ratings
2. **Job Verification:** Must be actual job participant
3. **Weighted Scoring:** Early ratings have same weight as later ones
4. **Job Cap:** Maximum influence from job count

### Gas Optimization
- Dictionary-based storage for O(1) lookups
- Aggregated reputation for fast queries
- Lazy loading of rating details
- Separate cells for review text

---

## Cross-Contract Integration

### Job Lifecycle with All Contracts

```
1. JobRegistry: Create job (OP_CREATE_JOB)
2. Escrow: Create escrow (OP_CREATE_ESCROW)
3. Escrow: Fund escrow (OP_FUND_ESCROW)
4. JobRegistry: Assign worker (OP_ASSIGN_WORKER)
5. Escrow: Lock escrow (OP_LOCK_ESCROW)
6. JobRegistry: Update status to IN_PROGRESS
7. [Work happens off-chain]
8. Escrow: Confirm completion (OP_CONFIRM_COMPLETION) × 2
9. [Automatic payment release]
10. Reputation: Submit ratings (OP_SUBMIT_RATING) × 2
11. JobRegistry: Update status to COMPLETED
```

### Dispute Flow
```
1. Escrow: Raise dispute (OP_RAISE_DISPUTE)
2. JobRegistry: Update status to DISPUTED
3. [Off-chain investigation]
4. Escrow: Resolve dispute (OP_RESOLVE_DISPUTE)
5. [Funds released based on resolution]
6. Reputation: Optional ratings
```

---

## Deployment Configuration

### Network Parameters
- **Mainnet:** TON mainnet
- **Testnet:** TON testnet
- **Local:** TON local blockchain

### Contract Addresses (After Deployment)
```
JobRegistry: EQ...
Escrow: EQ...
Reputation: EQ...
```

### Initial Parameters
```
JobRegistry:
  - owner_address: [deployer]
  - job_counter: 0

Escrow:
  - owner_address: [deployer]
  - escrow_counter: 0
  - fee_percentage: 250 (2.5%)

Reputation:
  - owner_address: [deployer]
  - rating_counter: 0
```

---

## Testing Strategy

### Unit Tests
- ✅ Job creation and storage
- ✅ Status updates and authorization
- ✅ Escrow lifecycle (create → fund → lock → release)
- ✅ Mutual confirmation logic
- ✅ Dispute raising and resolution
- ✅ Rating submission and validation
- ✅ Reputation calculation
- ✅ Anti-spam measures

### Integration Tests
- ✅ Full job lifecycle
- ✅ Cross-contract messaging
- ✅ Error handling
- ✅ Edge cases

### Gas Tests
- ✅ Operation costs
- ✅ Storage efficiency
- ✅ Optimization validation

---

## Security Considerations

### Audited Features
1. **Reentrancy Protection:** No recursive calls
2. **Integer Overflow:** Safe math operations
3. **Access Control:** Role-based permissions
4. **State Validation:** Strict state machine
5. **Gas Limits:** Efficient operations

### Known Limitations
1. **Review Length:** Limited to 512 bits
2. **Job Count Cap:** Reputation capped at 10 jobs influence
3. **Dispute Resolution:** Centralized (platform owner)

---

## Maintenance & Upgrades

### Upgrade Path
Contracts are immutable but can be redeployed with migration scripts.

### Monitoring
- Transaction success rates
- Error frequencies
- Gas consumption trends
- Contract balances

---

## API Reference

See individual operation codes and get methods above for complete API documentation.

---

**Version:** 1.0.0  
**Last Updated:** November 22, 2025  
**License:** TBD
