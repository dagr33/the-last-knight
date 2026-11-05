CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX users_username_lower ON users(LOWER(username));
CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE games(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,started_at INTEGER NOT NULL);
CREATE INDEX games_user_idx ON games(user_id);
CREATE TABLE results(id TEXT PRIMARY KEY,game_id TEXT NOT NULL UNIQUE REFERENCES games(id),user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,score INTEGER NOT NULL CHECK(score>=0),wave INTEGER NOT NULL CHECK(wave>=1),kills INTEGER NOT NULL CHECK(kills>=0),duration INTEGER NOT NULL CHECK(duration>=0),created_at INTEGER NOT NULL);
CREATE INDEX results_user_idx ON results(user_id);
CREATE INDEX results_rank_idx ON results(score);
CREATE TABLE rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
