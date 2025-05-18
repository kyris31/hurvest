-- Add plot_affected to planting_logs table
ALTER TABLE planting_logs
ADD COLUMN IF NOT EXISTS plot_affected TEXT;

-- Add plot_affected to cultivation_logs table
ALTER TABLE cultivation_logs
ADD COLUMN IF NOT EXISTS plot_affected TEXT;

-- Add indexes if this field will be frequently queried/filtered
CREATE INDEX IF NOT EXISTS idx_planting_logs_plot_affected ON planting_logs(plot_affected);
CREATE INDEX IF NOT EXISTS idx_cultivation_logs_plot_affected ON cultivation_logs(plot_affected);

COMMENT ON COLUMN planting_logs.plot_affected IS 'Specific plot, bed, or area identifier for the planting.';
COMMENT ON COLUMN cultivation_logs.plot_affected IS 'Specific plot, bed, or area identifier for the cultivation activity.';

SELECT 'Migration for plot_affected field applied.' AS status;