-- Habits can be tracked as yes/no or as a measured amount against a target.
ALTER TABLE habits
    ADD COLUMN track_type VARCHAR(12) NOT NULL DEFAULT 'YES_NO' AFTER goal,
    ADD COLUMN target_value DECIMAL(10, 2) NULL AFTER track_type,
    ADD COLUMN unit VARCHAR(24) NULL AFTER target_value;

-- Time-based reminders with their own repetition rules.
CREATE TABLE habit_reminders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    habit_id BIGINT NOT NULL,
    remind_at TIME NOT NULL,
    repeat_kind VARCHAR(16) NOT NULL DEFAULT 'HABIT_DAYS',
    days VARCHAR(80) NULL,
    interval_days TINYINT UNSIGNED NULL,
    message VARCHAR(120) NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    KEY idx_reminders_habit (habit_id, remind_at),
    CONSTRAINT fk_reminders_habit FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A routine step can point at an existing habit; completing the step checks the habit in.
ALTER TABLE routine_steps
    ADD COLUMN habit_id BIGINT NULL AFTER name,
    ADD CONSTRAINT fk_routine_steps_habit FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE SET NULL;
