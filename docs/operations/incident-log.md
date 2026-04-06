# Incident Log

> **Purpose:** Durable record of production incidents, near misses, mitigations, and lessons learned.
> **Rule:** If a production issue changes user trust, launch confidence, or founder load, log it.
> **Working surface:** `/admin/systems#incident-log` is now the live incident and drill trail. This doc keeps the template and longer-form write-up structure when a fuller narrative is worth preserving in-repo.
> **Automation:** `/admin/systems#automation` is the centralized history view for sweep runs, escalations, commitment shepherd records, retro follow-up generation, and review-draft runs. The daily systems sweep now turns `follow_up_pending` incidents and drills into suggested weekly hardening commitments, and it still opens a drill-cadence follow-up when no recent failure drill is logged.
> **Review loop:** The cockpit is the place to monitor whether the automation ran, what it opened, and whether the resulting follow-ups were acknowledged or resolved. Use the suggested draft and commitment trails there before adding extra narrative here.

---

## Incident Template

### [INC-YYYY-MM-DD-01] Title

- **Date:** YYYY-MM-DD
- **Severity:** P0 / P1 / P2 / Near miss
- **Status:** Open / Mitigated / Resolved / Follow-up pending
- **Reported by:**
- **Detected by:** Alert / User report / Manual review / Audit / Other
- **Systems affected:**
- **User impact:**
- **Time to acknowledge:**
- **Time to mitigate:**
- **Time to fully resolve:**

#### Timeline

| Time | Event |
| ---- | ----- |
|      |       |

#### Root cause

-

#### Mitigation

-

#### Permanent fixes

-

#### Follow-up owner

- ***

## Incident History

_Add newest incidents to the top._
