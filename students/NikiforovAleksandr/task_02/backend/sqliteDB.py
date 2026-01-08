import sqlite3
import json
from datetime import datetime

DB_PATH = "courses.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row 
    return conn

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
    
        cur.execute("PRAGMA foreign_keys = ON")
        
        tables = [
            """CREATE TABLE IF NOT EXISTS User (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'admin', 'teacher')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""",
            
            """CREATE TABLE IF NOT EXISTS Course (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT,
                difficulty_level TEXT NOT NULL CHECK(difficulty_level IN ('beginner', 'intermediate', 'advanced')),
                status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
                author_id INTEGER NOT NULL,
                is_public BOOLEAN DEFAULT FALSE,
                enrolled_count INTEGER DEFAULT 0,
                rating_avg REAL DEFAULT 0.0,
                rating_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(author_id) REFERENCES User(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Module (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(course_id) REFERENCES Course(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Lesson (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                video_url TEXT,
                duration_minutes INTEGER,
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(module_id) REFERENCES Module(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Assignment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                assignment_type TEXT NOT NULL CHECK(assignment_type IN ('quiz', 'essay', 'code', 'project')),
                quiz_data TEXT,  -- JSON для тестовых вопросов
                points_possible INTEGER NOT NULL,
                due_date DATETIME,
                time_limit_minutes INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(lesson_id) REFERENCES Lesson(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Enrollment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                progress_percentage REAL DEFAULT 0.0,
                UNIQUE(course_id, user_id),
                FOREIGN KEY(course_id) REFERENCES Course(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES User(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Submission (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'graded', 'late')),
                quiz_answers TEXT,  -- JSON для ответов на тест
                essay_text TEXT,
                code TEXT,
                attachments TEXT,  -- JSON список файлов
                submitted_at DATETIME,
                graded_at DATETIME,
                comments TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(assignment_id, user_id),
                FOREIGN KEY(assignment_id) REFERENCES Assignment(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES User(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Grade (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL UNIQUE,
                grader_id INTEGER,
                points_earned REAL NOT NULL,
                points_possible REAL NOT NULL,
                percentage REAL NOT NULL,
                feedback TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(submission_id) REFERENCES Submission(id) ON DELETE CASCADE,
                FOREIGN KEY(grader_id) REFERENCES User(id) ON DELETE SET NULL
            )""",
            
            """CREATE TABLE IF NOT EXISTS UserLessonProgress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                completed_at DATETIME,
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, lesson_id),
                FOREIGN KEY(user_id) REFERENCES User(id) ON DELETE CASCADE,
                FOREIGN KEY(lesson_id) REFERENCES Lesson(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Review (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, user_id),
                FOREIGN KEY(course_id) REFERENCES Course(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES User(id) ON DELETE CASCADE
            )""",
            
            """CREATE TABLE IF NOT EXISTS Badge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                icon_url TEXT
            )""",
            
            """CREATE TABLE IF NOT EXISTS UserBadge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                badge_id INTEGER NOT NULL,
                earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES User(id) ON DELETE CASCADE,
                FOREIGN KEY(badge_id) REFERENCES Badge(id) ON DELETE CASCADE
            )"""
        ]
        
        for table in tables:
            cur.execute(table)
        
        conn.commit()