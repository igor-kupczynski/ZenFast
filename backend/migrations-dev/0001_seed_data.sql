-- ⚠️  DEVELOPMENT SEED DATA - DO NOT RUN IN PRODUCTION! ⚠️
-- This file contains test users with KNOWN PASSWORDS
-- It is intended ONLY for local development environments
-- 
-- If you see this running against production, STOP IMMEDIATELY!

-- Test users with bcrypt hashed passwords (cost factor 10)
INSERT INTO users (id, email, name, password_hash) VALUES 
-- Password: testpass123
('550e8400-e29b-41d4-a716-446655440001', 'alice@test.local', 'Alice Test', '$2b$10$00OA8JHkboHtJVG8ydgcgedehvf6qrPYSCXKS7JEck/i9696kVAmK'),
('550e8400-e29b-41d4-a716-446655440002', 'bob@test.local', 'Bob Test', '$2b$10$00OA8JHkboHtJVG8ydgcgedehvf6qrPYSCXKS7JEck/i9696kVAmK'),
('550e8400-e29b-41d4-a716-446655440003', 'charlie@test.local', 'Charlie Test', '$2b$10$00OA8JHkboHtJVG8ydgcgedehvf6qrPYSCXKS7JEck/i9696kVAmK');

-- Sample fasts for Alice (user 1)
-- Completed fast from yesterday
INSERT INTO fasts (id, user_id, started_at, ended_at) VALUES 
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 
  datetime('now', '-1 day', '-16 hours'), datetime('now', '-1 day'));

-- Currently active fast (started 14 hours ago)
INSERT INTO fasts (id, user_id, started_at, ended_at) VALUES 
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 
  datetime('now', '-14 hours'), NULL);

-- Sample fasts for Bob (user 2) - historical data
INSERT INTO fasts (id, user_id, started_at, ended_at) VALUES 
('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 
  datetime('now', '-7 days', '-18 hours'), datetime('now', '-7 days', '-2 hours')),
('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 
  datetime('now', '-5 days', '-20 hours'), datetime('now', '-5 days', '-4 hours')),
('650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 
  datetime('now', '-3 days', '-16 hours'), datetime('now', '-3 days'));

-- Charlie has no fasts yet (new user)