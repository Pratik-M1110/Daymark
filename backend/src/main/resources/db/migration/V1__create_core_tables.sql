CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    display_name VARCHAR(80) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE habits (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    category VARCHAR(32) NOT NULL,
    icon VARCHAR(24) NOT NULL DEFAULT 'flower',
    color VARCHAR(24) NOT NULL DEFAULT 'green',
    goal VARCHAR(40) NOT NULL DEFAULT 'Once',
    weekly_target TINYINT UNSIGNED NOT NULL DEFAULT 5,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_habits_user_order (user_id, sort_order, id),
    CONSTRAINT fk_habits_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_habits_weekly_target CHECK (weekly_target BETWEEN 1 AND 7)
) ENGINE=InnoDB;

CREATE TABLE habit_schedule_days (
    habit_id BIGINT NOT NULL,
    day_of_week VARCHAR(9) NOT NULL,
    PRIMARY KEY (habit_id, day_of_week),
    CONSTRAINT fk_habit_schedule_habit FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE habit_check_ins (
    id BIGINT NOT NULL AUTO_INCREMENT,
    habit_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    value DECIMAL(10, 2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_habit_checkin_date (habit_id, entry_date),
    KEY idx_checkins_user_date (user_id, entry_date, completed),
    CONSTRAINT fk_checkins_habit FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
    CONSTRAINT fk_checkins_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE routines (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    scheduled_time TIME NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_routines_user_order (user_id, sort_order, id),
    CONSTRAINT fk_routines_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE routine_steps (
    id BIGINT NOT NULL AUTO_INCREMENT,
    routine_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_routine_steps_order (routine_id, sort_order, id),
    CONSTRAINT fk_routine_steps_routine FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE
) ENGINE=InnoDB;
