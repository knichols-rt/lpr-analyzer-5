-- Manual Database Setup for LPR Analyzer
-- Run this as postgres superuser

-- Create database and user
CREATE DATABASE lpr_analyzer;
CREATE USER lpr_user WITH ENCRYPTED PASSWORD 'lpr_password';
GRANT ALL PRIVILEGES ON DATABASE lpr_analyzer TO lpr_user;

-- Connect to the new database
\c lpr_analyzer

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO lpr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO lpr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO lpr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO lpr_user;