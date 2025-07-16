-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fasts table
CREATE TABLE fasts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_fasts_user_id ON fasts(user_id);
CREATE INDEX idx_fasts_started_at ON fasts(started_at);
CREATE INDEX idx_fasts_ended_at ON fasts(ended_at);

-- Constraints for one fast per day
CREATE UNIQUE INDEX idx_unique_fast_start_per_day 
ON fasts(user_id, date(started_at));

CREATE UNIQUE INDEX idx_unique_fast_end_per_day 
ON fasts(user_id, date(ended_at)) 
WHERE ended_at IS NOT NULL;