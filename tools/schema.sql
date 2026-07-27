-- Schema for sano server-side persistence. Apply once:
--   ssh sano-deploy 'mysql <db-flags> < schema.sql'
-- Connection credentials live in ~/sano-config.php on the server (never in git).
-- Live changes: write a one-off idempotent migration, run it once, then fold the
-- change back here so a fresh DB matches — never re-apply this file to an existing DB.

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until  DATETIME NULL,
  -- Admin flag: only an admin account may use the /admin/ dashboard + endpoints.
  is_admin      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  -- Daily reminder: whole-hour local time (0-23) + IANA zone. NULL = none set.
  reminder_hour TINYINT UNSIGNED NULL,
  reminder_tz   VARCHAR(64) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
-- prunes rows older than that. IP stored as the packed bytes throttle_ip() returns:
-- IPv4 whole (4 bytes), IPv6 truncated to its /64 (8), since one end site owns a
-- whole /64 and keying on the full address is the same as having no limit (T57).
CREATE TABLE signup_attempts (
  ip         VARBINARY(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ip_time (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-IP login throttle: one row per failed login. api/login.php counts rows in
-- the last LOGIN_IP_WINDOW_MINUTES to bound credential-stuffing across usernames,
-- and prunes older rows. Same shape as signup_attempts.
CREATE TABLE login_attempts (
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

-- ── Traffic dashboard (T40) ─────────────────────────────────────────────────
-- Filled by tools/ingest-traffic.php (nightly cron, installed as
-- ~/sano-tools/ingest-traffic.php) from the Apache access logs, which Dreamhost
-- keeps for only ~7 days; read by api/admin-traffic.php. No raw IP is ever
-- stored: a "visitor" is a salted sha256(ip + user-agent) truncated to 16 bytes,
-- with the salt in ~/sano-config.php ('traffic_salt').

-- Per-day rollup. Doubles as the ingest ledger — a row exists only for a day that
-- has been parsed, which is how the nightly run knows what is left to do.
CREATE TABLE traffic_days (
  day          DATE PRIMARY KEY,
  requests     INT UNSIGNED NOT NULL DEFAULT 0,      -- human requests (post bot filter)
  bot_requests INT UNSIGNED NOT NULL DEFAULT 0,      -- everything the filter excluded
  bytes        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  errors_4xx   INT UNSIGNED NOT NULL DEFAULT 0,
  errors_5xx   INT UNSIGNED NOT NULL DEFAULT 0,
  ingested_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per visitor per day — the grain every headline number derives from.
-- is_new (their first day ever) and is_mine (a session touched /admin/, i.e. Ross)
-- are recomputed across the whole table after each ingest, so backfilling an older
-- day is self-correcting.
CREATE TABLE traffic_visitor_days (
  day      DATE NOT NULL,
  visitor  BINARY(16) NOT NULL,
  sessions SMALLINT UNSIGNED NOT NULL DEFAULT 1,     -- split on a 30-minute idle gap
  requests INT UNSIGNED NOT NULL DEFAULT 0,
  is_new   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_mine  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  country  CHAR(2) NULL,
  device   VARCHAR(16) NULL,
  browser  VARCHAR(16) NULL,
  PRIMARY KEY (day, visitor),
  KEY idx_visitor (visitor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Referrers, counted only on page requests (every asset carries the site itself
-- as its referer). Split by `mine` so the dashboard toggle applies here too.
CREATE TABLE traffic_referrers (
  day  DATE NOT NULL,
  mine TINYINT UNSIGNED NOT NULL DEFAULT 0,
  host VARCHAR(190) NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, mine, host)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Failed requests from human visitors only — a scanner 404ing on /wp-login.php
-- isn't a bug, but a 404 on an audio clip is.
CREATE TABLE traffic_errors (
  day    DATE NOT NULL,
  mine   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status SMALLINT UNSIGNED NOT NULL,
  path   VARCHAR(190) NOT NULL,
  hits   INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, mine, status, path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
