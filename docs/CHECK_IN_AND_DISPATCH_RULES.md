# Check-In and Guide Dispatch Rules

Rules agreed on 2026-10-18 to unblock Phase 5 (check-in and dispatch) in [`PROJECT_MILESTONES.md`](PROJECT_MILESTONES.md). They apply to every supported trail.

> **Implemented (2026-10-20).** The rules now live in [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) §5.2–5.3, and the endpoints are in [`API_CONTRACT_V1.md`](API_CONTRACT_V1.md) §5–6. This file is kept as the record of the original agreement.
>
> Decisions made while implementing:
> - Availability is set by the coordinator on the web, and by the guide through `/api/v1/guides/me/availability`. The guide app will use that endpoint.
> - The coordinator marks treks completed for now. The guide app's complete step will reuse the same rule.
> - Waiting groups get a guide only when the coordinator clicks "Assign next guide".

---

## 1. Check-in

### Who can be checked in

- Only `CONFIRMED` bookings.
- Only on the booking's scheduled date (Asia/Manila calendar date).
- A group arriving on another day must reschedule first.

### When the number of arrivals differs from the booking

| Case                                | Example             | Rule                                                                                                                                                       |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fewer arrive                        | Booked 5, arrived 3 | Coordinator marks each listed participant **present** or **absent**. At least 1 must be present. Package price stays the same.                             |
| More arrive, still within 1 package | Booked 3, arrived 5 | Coordinator adds the extra people as **walk-ins** (name, age, address) at check-in. Present + walk-ins must not exceed 5. Package price stays the same.    |
| More than 1 package arrives         | Booked 3, arrived 7 | Check in **at most 5** on the booking. Arrangements for the extra people (another package/guide) remain **TBD** and are handled outside TrailSync for now. |

---

## 2. Guide availability

Guide states:

| State       | Meaning                                | Set by                 |
| ----------- | -------------------------------------- | ---------------------- |
| `OFF_DUTY`  | Not at the office; not in the queue    | Guide (or coordinator) |
| `AVAILABLE` | Reported in; waiting in the FIFO queue | Guide (or coordinator) |
| `ASSIGNED`  | Dispatched to a checked-in group       | System only (dispatch) |

- A guide on an assigned trek cannot go off duty until the trek is completed.
- During the discussion we assumed the coordinator sets `AVAILABLE`/`OFF_DUTY` on the web because no guide app existed. The team has a separate guide mobile app repo, so decide whether the guide sets their own availability there, the coordinator does it on the web, or both.

---

## 3. FIFO queue

- The queue is the `AVAILABLE` guides, ordered by **when they became available**.
- Becoming available puts the guide at the **end** of the queue. Going off duty removes them from it.
- Dispatch always takes the guide at the **front**. **No skipping.**
- If the front guide isn't present, they are marked off duty, and they rejoin at the end when they become available again.

Example:

```text
Queue: Juan, Pedro, Maria, Carlo
Juan is assigned          → Pedro, Maria, Carlo
Juan completes the trek   → Pedro, Maria, Carlo, Juan
```

---

## 4. Dispatch timing

- Check-in **automatically assigns** the guide at the front of the queue, in the same transaction.
- If no guide is available, the booking stays **checked in (waiting)**. The coordinator assigns the next guide once one becomes available.
- Assignment must be transactional so one guide can never be assigned to two groups, even when two check-ins happen at the same time.

---

## 5. Trek completion and return to the queue

- When the group returns, the trek is marked **completed**.
- The guide then becomes `AVAILABLE` again at the **end** of the queue.
- During the discussion we assumed the coordinator marks completion. With the guide app, this likely becomes the guide's own complete-and-check-out step. Confirm this with the app team.

---

## 6. Booking lifecycle with these rules

```text
PENDING_CONFIRMATION → CONFIRMED → CHECKED_IN → GUIDE_ASSIGNED → COMPLETED
```

- Rescheduling moves `CONFIRMED` back to `PENDING_CONFIRMATION`. This is existing behavior.
- Check-in goes straight to `GUIDE_ASSIGNED` when a guide is available. Otherwise the booking waits in `CHECKED_IN`.

---

## 7. Still TBD

- Packages and guides for groups larger than 5 (the "booked 3, arrived 7" case).
- No-show handling.
- ~~Who sets guide availability and trek completion~~ — decided 2026-10-23 (Phase 6): both. The guide sets availability and starts/completes the trek in the guide app; the coordinator can set availability and complete a trek on the web as a fallback.
