from fastapi import APIRouter, HTTPException, Depends
from models import CourseCreate, CourseResponse
from sqliteDB import get_db
from utilities import verify_token
import sqlite3

router = APIRouter()

# Создание курса (только admin)
@router.post("/courses", response_model=CourseResponse)
def create_course(course: CourseCreate, token: dict = Depends(verify_token)):
    if token.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Только преподаватели могут создавать курсы")

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("""
            INSERT INTO Course (title, description, category, difficulty_level, is_public, author_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            course.title,
            course.description,
            course.category,
            course.difficulty_level,
            int(course.is_public),
            token["user_id"],
            "draft"
        ))
        db.commit()
        course_id = cursor.lastrowid
    except sqlite3.Error as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при создании курса: {e}")
    finally:
        db.close()

    return {
        "id": course_id,
        "title": course.title,
        "description": course.description,
        "category": course.category,
        "difficulty_level": course.difficulty_level,
        "status": "draft",
        "author_id": token["user_id"],
        "is_public": course.is_public,
        "enrolled_count": 0,
        "rating_avg": 0.0,
        "rating_count": 0,
        "created_at": None,
        "updated_at": None
    }
