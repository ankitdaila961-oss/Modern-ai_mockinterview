const pool = require('./db');

async function initDB() {
  try {
    // Create users table (includes resume_path from the start)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(100)  NOT NULL,
        email       VARCHAR(150)  NOT NULL UNIQUE,
        password    VARCHAR(255)  NOT NULL,
        resume_path VARCHAR(500)  DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create interviews table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        question    TEXT DEFAULT NULL,
        answer      TEXT DEFAULT NULL,
        score       INT DEFAULT NULL,
        feedback    TEXT DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create questions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        interview_id   INT NOT NULL,
        question_text  TEXT NOT NULL,
        user_answer    TEXT DEFAULT NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migration: add resume_path if the table already existed without it
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_path VARCHAR(500) DEFAULT NULL;
      `);
    } catch (_) { /* column already exists in older MySQL versions – safe to ignore */ }

    // Migration: add columns to interviews table
    try {
      await pool.query(`ALTER TABLE interviews ADD COLUMN question TEXT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE interviews ADD COLUMN answer TEXT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE interviews ADD COLUMN score INT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE interviews ADD COLUMN feedback TEXT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE interviews ADD COLUMN communication_score INT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE interviews ADD COLUMN technical_score INT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE interviews ADD COLUMN confidence_score INT DEFAULT NULL;`);
    } catch (_) { /* columns may already exist */ }

    console.log('✅ Database tables are ready.');
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    console.error('   → Make sure MySQL is running and the DB_* values in .env are correct.');
    console.error('   → Then run: mysql -u root -p < setup.sql');
  }
}

module.exports = initDB;
