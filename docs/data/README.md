# Reference data

Source material kept for planning, not consumed by any code. Nothing here is
imported, fetched, or built against — if that changes, move the file to where it
is used.

| File | What it is |
|---|---|
| `Platform_Challenges_and_Solutions.csv` | Real-estate data platform constraints — MLS licensing, county record aggregation, pre-foreclosure and deed access — with the direction taken on each. Still the reference for lead-sourcing scope. |
| `HPD_Code_Violations_Data_Dictionary.xlsx` | Field dictionary for municipal code-violation records. The lead-sourcing edge functions (`fetch-real-estate-leads`, `enrich-real-estate-leads`) read this shape of data. |

Four inherited files were removed on 2026-08-29: timesheet logs from an
unrelated project, a UX audit written for consumer finance apps, a 725 KB
duplicate of `public/logo.png`, and a lead-generation flowchart describing
components (`SearchPage`, `SearchContextProvider`, `SimpleMapTest`) that have
never existed in this codebase.
