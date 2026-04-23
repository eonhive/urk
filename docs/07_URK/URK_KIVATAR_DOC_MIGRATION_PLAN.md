# URK + Kivatar Doc Migration Plan

**Purpose:** Collapse the current draft/supporting markdown set into the final canonical doc trees for the URK repo and Kivatar repo.  
**Date:** 2026-04-10

---

## Why this migration is needed

The current draft set is useful, but it is too wide and repetitive to remain the long-term canonical layout.

The strongest canon now is:
- URK = web-first runtime kernel, standalone-first, adapter-based, controller-driven, lighter than EnHive fileciteturn29file0
- Kivatar = private layered product above URK with identity, behavior, memory, communication, expression, and guide systems fileciteturn29file2 fileciteturn29file9

The doc tree should now reflect that clearly.

---

## Target repo doc trees

### URK
Use the structure from `URK_CANONICAL_DOCSET.md`.

### Kivatar
Use the structure from `KIVATAR_CANONICAL_DOCSET.md`.

---

## Current draft files and their fate

### URK drafts
- `URK_STATUS_UPDATE_2026-04-10.md` -> archive or merge into implementation/decision docs
- `URK_BOUNDARY.md` -> canonical `docs/BOUNDARY.md`
- `URK_IMPLEMENTATION_TASKS.md` -> canonical `docs/IMPLEMENTATION_PLAN.md`
- `URK_README.md` -> canonical `README.md`
- `URK_ARCHITECTURE.md` -> canonical `docs/ARCHITECTURE.md`
- `URK_DEFERRED.md` -> canonical `docs/DEFERRED.md`
- `URK_DECISIONS.md` -> canonical `docs/DECISIONS.md`

### Kivatar drafts
- `KIVATAR_STATUS_UPDATE_2026-04-10.md` -> archive or merge into implementation/decision docs
- `KIVATAR_BOUNDARY_AND_PACKAGES.md` -> canonical `docs/BOUNDARY.md`
- `KIVATAR_OVERVIEW.md` -> canonical `README.md` or `docs/OVERVIEW.md`
- `KIVATAR_IDENTITY_MODEL.md` -> canonical `docs/IDENTITY_MODEL.md`
- `KIVATAR_BEHAVIOR_BRAIN.md` -> canonical `docs/BEHAVIOR_BRAIN.md`
- `KIVATAR_COMMUNICATION_PROFILE.md` -> canonical `docs/COMMUNICATION_PROFILE.md`
- `KIVATAR_GUIDE_COMMUNICATION_SYSTEM.md` -> canonical `docs/GUIDE_SYSTEM.md`
- `KIVATAR_V1_SCOPE.md` -> canonical `docs/V1_SCOPE.md`
- `KIVATAR_DEFERRED.md` -> canonical `docs/DEFERRED.md`
- `KIVATAR_DECISIONS.md` -> canonical `docs/DECISIONS.md`

---

## Merge rules

### Rule 1
Boundary docs win over drifting summaries.

### Rule 2
Status update docs are transitional. Their durable content should move into:
- decisions
- scope
- implementation plan
- deferred

### Rule 3
Do not keep multiple docs saying the same thing in slightly different words.

### Rule 4
Kivatar docs should preserve the newer architectural decisions now captured in the status update:
- no-gender identity framing
- behavior brain > LLM
- hybrid intelligence model
- guide system first-class
- multilingual/nonverbal communication profiles
- web-first, one-rig, one-pack discipline fileciteturn29file8 fileciteturn29file10 fileciteturn29file11

---

## Recommended execution order

1. Finalize `README.md` for each repo
2. Finalize `BOUNDARY.md` for each repo
3. Finalize architecture/identity/behavior docs
4. Finalize `DECISIONS.md`
5. Finalize `IMPLEMENTATION_PLAN.md`
6. Finalize `DEFERRED.md`
7. Archive the dated status update files

---

## Definition of done

This migration is done when:
- each repo has one obvious canonical doc tree
- boundary and architecture are no longer duplicated across many files
- status updates are archived or demoted
- implementation-facing names are stable
- new contributors can understand repo structure without reading the whole history
