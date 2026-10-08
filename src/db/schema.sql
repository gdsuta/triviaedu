-- Trivia Education portal schema (MariaDB 10.4+ / MySQL 8)
-- Safe to run repeatedly: every statement is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin','tutor') NOT NULL DEFAULT 'tutor',
  phone         VARCHAR(40)  NULL,
  subjects      VARCHAR(255) NULL,
  hourly_rate   DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  grade        VARCHAR(40)  NULL,
  school       VARCHAR(160) NULL,
  parent_name  VARCHAR(120) NULL,
  parent_phone VARCHAR(40)  NULL,
  parent_email VARCHAR(190) NULL,
  notes        TEXT NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which tutor teaches which student, and in which subject
CREATE TABLE IF NOT EXISTS assignments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tutor_id   INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  subject    VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assignment (tutor_id, student_id, subject),
  CONSTRAINT fk_asg_tutor   FOREIGN KEY (tutor_id)   REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_asg_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Weekly availability: one row per 30-minute slot the tutor is free
CREATE TABLE IF NOT EXISTS availability (
  tutor_id    INT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,  -- 1 = Monday ... 7 = Sunday
  slot_start  CHAR(5) NOT NULL,           -- 'HH:MM'
  PRIMARY KEY (tutor_id, day_of_week, slot_start),
  CONSTRAINT fk_av_tutor FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Timesheet: each tutoring session a tutor logs
CREATE TABLE IF NOT EXISTS sessions_log (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tutor_id     INT UNSIGNED NOT NULL,
  student_id   INT UNSIGNED NOT NULL,
  subject      VARCHAR(120) NOT NULL,
  session_date DATE NOT NULL,
  start_time   CHAR(5) NOT NULL,
  end_time     CHAR(5) NOT NULL,
  minutes      INT UNSIGNED NOT NULL,
  mode         ENUM('online','offline') NOT NULL DEFAULT 'online',
  topic        VARCHAR(255) NULL,
  notes        TEXT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note   VARCHAR(255) NULL,
  reviewed_by  INT UNSIGNED NULL,
  reviewed_at  DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tutor_date (tutor_id, session_date),
  KEY idx_status (status),
  CONSTRAINT fk_sl_tutor   FOREIGN KEY (tutor_id)   REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_sl_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monthly progress report per student/subject
CREATE TABLE IF NOT EXISTS progress_reports (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tutor_id     INT UNSIGNED NOT NULL,
  student_id   INT UNSIGNED NOT NULL,
  subject      VARCHAR(120) NOT NULL,
  period       CHAR(7) NOT NULL,          -- 'YYYY-MM'
  rating       TINYINT UNSIGNED NULL,     -- 1..5 overall progress
  covered      TEXT NULL,
  strengths    TEXT NULL,
  improvements TEXT NULL,
  next_steps   TEXT NULL,
  status       ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
  submitted_at DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (tutor_id, student_id, subject, period),
  CONSTRAINT fk_pr_tutor   FOREIGN KEY (tutor_id)   REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_pr_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
