-- Create partial unique indexes on likes table
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_like ON likes(literature_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_device_like ON likes(literature_id, device_hash) WHERE user_id IS NULL;
