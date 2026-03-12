# Module: General

**Path:** `src/components/General/`

## Overview
Shared project and milestone management used as a foundation across multiple domains. Not domain-specific — represents the generic "project" concept that Retail, Supervision, and Funding build on top of.

## Sub-modules

### Projects
**Path:** `General/Projects/`
- Base project CRUD with milestone timeline.
- `useProjectForm.ts` — create/edit project form state
- `useMilestoneManagement.ts` — milestone CRUD within a project
- `projectService.ts` — Supabase queries for projects
- `projectDetailsService.ts` — extended project detail queries
- `milestoneService.ts` — Supabase queries for milestones
- Views: `ProjectCard`, `ProjectDetails`, `ProjectDetailsEnhanced`, `MilestoneTimeline`
- `utils.ts` — project-specific helpers

## Notes
- This is the canonical project model — Retail/Projects and Supervision/SiteManagement are domain-specific extensions of this pattern
- When adding project-level features that apply across domains, consider whether they belong here first
