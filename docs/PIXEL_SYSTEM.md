# Pixel System

**Source of truth:** `docs/PRD.md` §14 (pixel rules), §15 (wall rendering requirements). This document defines the concrete geometry, allocation algorithm, and rendering strategy that satisfy those rules at a scale of 10,000,000+ pixels.

---

## 1. Core Rule (from PRD §14)

**₹1 = 1 pixel.** A contribution of ₹101 receives exactly 101 pixels, allocated as one contiguous range, only after the contribution reaches a verified `PAID` state (`docs/PAYMENT.md` §2).

---

## 2. Global Pixel Index & Allocation Algorithm

### 2.1 Global index space

Pixels are addressed by a single monotonically increasing integer, the **global pixel index**, starting at `0`. This index is independent of any 2D layout — the 2D mapping (for rendering) is a pure function of the index, defined in §3.

The index space is **unbounded upward**: the campaign target is ₹1 crore (10,000,000 pixels), but PRD §14 explicitly requires the system to "support 10,000,000+ pixels," so the wall must keep growing if total contributions exceed the goal (contributions are voluntary and PRD does not cap them). The wall is designed as a fixed-width, indefinitely-tall mural (see §3.1) rather than a fixed grid, so overshoot never requires a redesign or a "wall is full" state.

### 2.2 Allocation cursor

A single-row table, `pixel_cursor` (`docs/DATABASE.md` §3.5), tracks the next unallocated index:

```sql
-- Atomically reserves `pixel_count` consecutive indices and returns the
-- start of the reserved range, in one statement.
UPDATE pixel_cursor
SET next_index = next_index + :pixel_count, updated_at = now()
WHERE id = 1
RETURNING next_index - :pixel_count AS reserved_start;
```

This single `UPDATE ... RETURNING` is the entire concurrency mechanism. Postgres serializes concurrent `UPDATE`s to the same row via its normal row-level locking — there is no separate application lock, no `SELECT ... FOR UPDATE` step, and no read-then-write race window, because the read (`next_index - :pixel_count`) and the write happen as one atomic statement.

### 2.3 Allocation transaction (exactly-once)

Executed as one DB transaction, triggered only from the single code path described in `docs/PAYMENT.md` §2:

```text
BEGIN;

-- 1. Conditional state transition — aborts (ROLLBACK) if another process
--    already moved this contribution out of VERIFYING. This is the
--    idempotency guard: a retried/duplicate call to this function is a
--    guaranteed no-op past this point.
UPDATE contributions
SET status = 'PAID', paid_at = now()
WHERE id = :contribution_id AND status = 'VERIFYING'
RETURNING amount_paise;                          -- 0 rows => ROLLBACK, return "already processed"

-- 2. Reserve the pixel range (§2.2).
UPDATE pixel_cursor
SET next_index = next_index + :pixel_count
WHERE id = 1
RETURNING next_index - :pixel_count AS reserved_start;

-- 3. Record the allocation. UNIQUE(contribution_id) + the GiST exclusion
--    constraint on pixel_range (docs/DATABASE.md §3.4) make this insert
--    fail loudly if steps 1–2 were somehow bypassed — defense in depth,
--    not the primary guard.
INSERT INTO pixel_allocations (contribution_id, start_pixel, end_pixel)
VALUES (:contribution_id, :reserved_start, :reserved_start + :pixel_count);

UPDATE contributions
SET status = 'PIXELS_ASSIGNED'
WHERE id = :contribution_id;

-- 4. Update the O(1) read cache in the same transaction (docs/ARCHITECTURE.md §6).
UPDATE campaign_totals
SET total_verified_amount_paise = total_verified_amount_paise + :amount_paise,
    verified_contributor_count = verified_contributor_count + 1,
    total_pixels_allocated = total_pixels_allocated + :pixel_count,
    updated_at = now()
WHERE id = 1;

UPDATE contributions SET status = 'PUBLISHED', published_at = now()
WHERE id = :contribution_id;

COMMIT;
```

**Non-critical side effects, deliberately kept outside this transaction:** recording a `referral_events(event_type = CONTRIBUTION)` row (PRD §20, `docs/API.md` §2.1) when this contribution used a referral code is a best-effort step performed immediately *after* this transaction commits, not a fifth step inside it. Referral attribution is analytics/recognition (PRD §20 — "use recognition instead" of cash commissions), not money or pixel state, so it does not need the same all-or-nothing guarantee as steps 1–4; keeping it out of the transaction also means the correctness-critical allocation path never grows new failure modes as non-critical features are added in later phases (`docs/TASKS.md` Phase 9). The same applies to badge-award evaluation (PRD §21) once implemented.

**Why this satisfies every PRD §14 requirement:**
- *Allocation only after verified PAID state* — step 1 is the gate.
- *Atomic* — one transaction; either all four effects happen or none do.
- *No overlapping allocations* — guaranteed twice over: the cursor update in step 2 hands out disjoint ranges by construction, and the GiST exclusion constraint (`docs/DATABASE.md` §3.4) makes an overlap a hard DB error even if that invariant were ever violated by a bug.
- *No duplicate allocations* — the conditional update in step 1 plus `UNIQUE(pixel_allocations.contribution_id)` (`docs/DATABASE.md` §3.4) make a second attempt for the same contribution a guaranteed no-op or hard failure, never a second allocation.
- *Each allocation belongs to a contribution* — `pixel_allocations.contribution_id` is `NOT NULL` and unique.
- *Deterministic pixel IDs/coordinates* — the global index is assigned in a fixed, reproducible order (order of verification, not of payment or creation), and the index → (row, col) mapping in §3 is a pure function with no randomness.

### 2.4 Concurrency scenario walkthrough

Two admins click "verify" on the same contribution within milliseconds of each other (PRD §34 "concurrent payments," "pixel allocation race condition"):
1. Both requests reach step 1's conditional `UPDATE` concurrently.
2. Postgres serializes the two `UPDATE`s on the same row. The first to commit changes `status` from `VERIFYING` to `PAID` and returns 1 row.
3. The second `UPDATE` finds `status` is no longer `VERIFYING` (it's now `PAID`), matches 0 rows, and the transaction aborts before ever touching `pixel_cursor`.
4. Only one pixel range is ever reserved for this contribution.

No mutex, distributed lock, or queue is needed for this guarantee — it falls out of standard relational transaction semantics.

---

## 3. Wall Geometry & Coordinate Mapping

### 3.1 Fixed width, growing height

The wall is modeled as a mural of fixed width `W = 4000` columns, with rows added as needed:

```text
row = floor(global_index / W)
col = global_index mod W
```

At exactly 10,000,000 pixels (the ₹1 crore goal), the wall is `4000 × 2500` — a landscape mural, matching the scale of the campaign's headline goal. Beyond that, additional rows simply extend the wall downward; there is no reconfiguration, migration, or "wall full" event when the goal is exceeded, satisfying PRD §14's "10,000,000+ pixels."

`W = 4000` is an engineering choice (not specified in PRD); it was chosen so that 10,000,000 pixels produces a clean, presentable aspect ratio at the ₹1 crore milestone. It is a single configuration constant — changing it before launch only requires the coordinate-mapping function and chunk size to stay consistent (§3.2); it must **not** change after real allocations exist, since it would silently reshuffle every previously-allocated pixel's visual position.

### 3.2 Chunking for rendering

Per PRD §15 ("do not render 10 million DOM elements... use canvas/WebGL or chunked/virtualized rendering... only visible chunks should be loaded/rendered"):

Because the wall has a **fixed width and only grows in height** (§3.1), a chunk is defined as a full-width horizontal band, not a 2D tile. This is a deliberate choice: it keeps a chunk's pixels **contiguous in the global index**, so the same `int8range` exclusion index that guarantees no-overlap on write (`docs/DATABASE.md` §3.4) can also answer "which allocations intersect this chunk" directly, with no separate 2D bounding-box query.

- A **chunk** spans `chunkHeight = 25` rows at the full wall width (`W = 4000` columns) → `25 × 4000 = 100,000` pixels/chunk.
- Chunk address: `chunkIndex = floor(row / chunkHeight)`, serialized as `chunkId = "chunk_{chunkIndex}"` (matches `docs/API.md` §2.6's `chunkId` format).
- Chunk's global index bounds: `chunkPixelStart = chunkIndex * chunkHeight * W`, `chunkPixelEnd = chunkPixelStart + chunkHeight * W` (exclusive) — a single contiguous range.
- At the ₹1 crore baseline (`4000 × 2500`), there are `2500 / 25 = 100` chunks. The chunk sequence grows with the wall (new chunks appended at the bottom) exactly as the pixel grid does.
- The client's canvas/WebGL renderer requests only the chunks intersecting the current viewport's **vertical** range (plus a small prefetch margin for smooth scroll), via `GET /api/pixels?chunk={chunkId}` (`docs/API.md` §2.6). Each chunk response is rendered as one `4000 × 25` texture/draw call, not 100,000 individual DOM nodes or draw calls. Because the width is fixed and always fetched in full, horizontal pan/zoom at a given vertical scroll position never requires fetching a *different* chunk — only already-loaded chunks are re-rendered at a new zoom/pan transform client-side.
- Zoomed-out views (PRD §15 "zoom," §8.4) render chunks at reduced resolution (e.g. a downsampled representative color per chunk row, computed server-side or client-side from the chunk's allocation density) rather than fetching full pixel detail — exact zoom-level rendering tiers are a frontend implementation detail, not a product requirement, as long as the interactions in §4 work at every zoom level.

### 3.3 Read query for a chunk

```sql
SELECT contribution_id, start_pixel, end_pixel
FROM pixel_allocations
WHERE pixel_range && int8range(:chunkPixelStart, :chunkPixelEnd, '[)')
```

Because a chunk's bounds are already a contiguous global-index range (§3.2), this is a direct range-intersection query — no 2D bounding-box logic is needed. The GiST index backing the exclusion constraint (`docs/DATABASE.md` §3.4) also serves this query efficiently, so no separate index is needed for reads vs. the write-side overlap guarantee.

### 3.4 Single-pixel lookup

```sql
SELECT contribution_id, start_pixel, end_pixel
FROM pixel_allocations
WHERE pixel_range @> :pixelIndex::int8
```

Backs `GET /api/pixels/{pixelId}` (`docs/API.md` §2.6.1) and the "tap/click claimed pixel → show public contributor information" interaction (PRD §8.4, §15).

---

## 4. Pixel Interactions (from PRD §15, §8.4)

| Interaction | Implementation note |
|---|---|
| Hover/tap pixel | Client already has the chunk's allocation list loaded; resolves locally without a new request, falling back to §3.4's lookup only for a direct deep link. |
| Show public display name / Anonymous | Response already carries `displayName`/`anonymous` per allocation (`docs/API.md` §2.6) — client never needs to separately fetch contribution details for display. |
| Zoom / Pan | Frontend canvas/WebGL concern; triggers chunk (re)fetching per §3.2. |
| Search by contributor name/pixel ID | Name search goes through `GET /api/contributors?search=` (`docs/API.md` §2.7), scoped to `PUBLISHED` contributions only, per PRD §15 "subject to privacy rules." Pixel ID search goes through §3.4. |
| Deep-link to a pixel location | A URL encoding a global pixel index (or `chunkId`) is sufficient for the client to jump the viewport to that location and fetch the relevant chunk(s). |

---

## 5. Scale Characteristics

- **Write path:** one allocation transaction per verified contribution — bounded by verification throughput (admin-driven in MVP), not by pixel count. Millions of pixels does not mean millions of writes; it means one row in `pixel_allocations` per contribution, however large its pixel range.
- **Read path:** chunk queries hit a GiST-indexed range column; cost scales with the number of allocations intersecting a chunk, not with total pixel count across the whole wall.
- **No physical per-pixel rows** (`docs/DATABASE.md` §2) — this is what keeps both the write and storage cost independent of the 10,000,000+ pixel count.

---

## 6. Open Decisions

1. **Visual design of the wall** (color per pixel/contribution, palette, zoomed-out aggregation rendering) — a design/product decision, not covered here; this document only fixes the addressing and data-serving scheme that any visual design sits on top of.
2. **Chunk size and wall width (`W = 4000`, 25-row/100,000-pixel chunks)** are engineering defaults chosen for a clean baseline shape at the ₹1 crore goal; confirm before real allocations begin, since they should not change afterward (§3.1).
3. **Zoomed-out rendering tiers** (e.g. whether a low-zoom view is server-aggregated or purely client-side downsampling) — left to frontend implementation.
