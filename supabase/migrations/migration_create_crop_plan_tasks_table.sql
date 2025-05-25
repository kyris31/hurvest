CREATE TABLE public.crop_plan_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_plan_stage_id UUID NOT NULL REFERENCES public.crop_plan_stages(id) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    planned_due_date DATE NOT NULL,
    actual_completion_date DATE,
    status TEXT DEFAULT 'TODO' NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED')),
    assigned_to_user_id UUID, -- Nullable, assuming user IDs are UUIDs if you have user management
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    _last_modified BIGINT DEFAULT (extract(epoch from now()) * 1000),
    _synced BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.crop_plan_tasks IS 'Tasks generated from crop plan stages, for actionable tracking.';
COMMENT ON COLUMN public.crop_plan_tasks.status IS 'Current status of the task.';
COMMENT ON COLUMN public.crop_plan_tasks.assigned_to_user_id IS 'User assigned to this task, if applicable.';

-- Indexes
CREATE INDEX idx_crop_plan_tasks_crop_plan_stage_id ON public.crop_plan_tasks(crop_plan_stage_id);
CREATE INDEX idx_crop_plan_tasks_planned_due_date ON public.crop_plan_tasks(planned_due_date);
CREATE INDEX idx_crop_plan_tasks_status ON public.crop_plan_tasks(status);
CREATE INDEX idx_crop_plan_tasks_assigned_to_user_id ON public.crop_plan_tasks(assigned_to_user_id);

-- RLS Policies
ALTER TABLE public.crop_plan_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage crop_plan_tasks" ON public.crop_plan_tasks
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to crop_plan_tasks" ON public.crop_plan_tasks
    FOR SELECT
    USING (true);