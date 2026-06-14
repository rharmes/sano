-- Schema for sano server-side persistence. Apply once:
--   ssh sano-deploy 'mysql <db-flags> < schema.sql'
-- Connection credentials live in ~/sano-config.php on the server (never in git).

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until  DATETIME NULL,
  -- Daily reminder: whole-hour local time (0-23) + IANA zone. NULL = none set.
  reminder_hour TINYINT UNSIGNED NULL,
  reminder_tz   VARCHAR(64) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Existing DB: ALTER TABLE users
--   ADD COLUMN reminder_hour TINYINT UNSIGNED NULL,
--   ADD COLUMN reminder_tz VARCHAR(64) NULL;

CREATE TABLE app_state (
  user_id    INT UNSIGNED PRIMARY KEY,
  state      MEDIUMTEXT NOT NULL,
  revision   INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
  -- sha256 of the raw token; the raw token exists only in the user's cookie.
  token_hash CHAR(64) PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-IP signup throttle: one row per account-creation attempt that passed
-- validation. api/register.php counts rows from the last hour to rate-limit, and
-- prunes rows older than that. IP stored as packed bytes (INET6_ATON / inet_pton).
CREATE TABLE signup_attempts (
  ip         VARBINARY(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ip_time (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Web Push subscriptions: one row per browser/device that opted in to reminders.
-- A user can have many; the daily dispatcher iterates per-row.
CREATE TABLE push_subscriptions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  endpoint        VARCHAR(500) NOT NULL,
  p256dh          VARCHAR(255) NOT NULL,
  auth_secret     VARCHAR(255) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at DATETIME NULL,
  last_failure_at DATETIME NULL,
  failure_count   INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_endpoint (endpoint),
  KEY idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
