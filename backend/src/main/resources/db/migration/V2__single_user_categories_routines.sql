-- Categories are user-defined and replace the free-text habit category.
CREATE TABLE categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(32) NOT NULL,
    color VARCHAR(24) NOT NULL DEFAULT 'violet',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_user_name (user_id, name),
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO categories (user_id, name, color) SELECT DISTINCT user_id, category, 'violet' FROM habits;

ALTER TABLE habits ADD COLUMN category_id BIGINT NULL AFTER user_id;
ALTER TABLE habits ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE habits ADD COLUMN start_date DATE NOT NULL DEFAULT (CURRENT_DATE);
ALTER TABLE habits ADD CONSTRAINT fk_habits_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;

UPDATE habits h
JOIN categories c ON c.user_id = h.user_id AND c.name = h.category
SET h.category_id = c.id, h.start_date = DATE(h.created_at);

-- Weekly target is now derived from the scheduled days; colour comes from the category.
ALTER TABLE habits DROP CHECK chk_habits_weekly_target;
ALTER TABLE habits DROP COLUMN category, DROP COLUMN color, DROP COLUMN weekly_target;

ALTER TABLE routines ADD COLUMN color VARCHAR(24) NOT NULL DEFAULT 'amber';

CREATE TABLE routine_step_completions (
    step_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    PRIMARY KEY (step_id, entry_date),
    CONSTRAINT fk_step_completions_step FOREIGN KEY (step_id) REFERENCES routine_steps (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- The app runs without sign-in, so everything belongs to one local profile.
INSERT IGNORE INTO users (display_name, email, password_hash, time_zone)
VALUES ('You', 'local@daymark.app', '!', 'Asia/Kolkata');

SET @local_user = (SELECT id FROM users WHERE email = 'local@daymark.app');

INSERT IGNORE INTO categories (user_id, name, color, sort_order) VALUES
    (@local_user, 'Mind', 'violet', 0),
    (@local_user, 'Health', 'emerald', 1),
    (@local_user, 'Movement', 'coral', 2),
    (@local_user, 'Wellbeing', 'sky', 3),
    (@local_user, 'Creativity', 'rose', 4);
