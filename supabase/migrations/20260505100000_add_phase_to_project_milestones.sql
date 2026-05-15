ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS phase text;

CREATE INDEX IF NOT EXISTS project_milestones_phase_idx
  ON public.project_milestones (project_id, phase);
