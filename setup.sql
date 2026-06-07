-- AI Mock Interview Platform - Database Setup
-- Run this script in your MySQL client before starting the server

CREATE DATABASE IF NOT EXISTS ai_interview_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_interview_db;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  resume_path VARCHAR(500)  DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  question    TEXT DEFAULT NULL,
  answer      TEXT DEFAULT NULL,
  score       INT DEFAULT NULL,
  feedback    TEXT DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  interview_id   INT NOT NULL,
  question_text  TEXT NOT NULL,
  user_answer    TEXT DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
);
