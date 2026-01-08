from fastapi import FastAPI, HTTPException, Depends, status, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import sqlite3
import logging
import json
from datetime import datetime, timedelta

from sqliteDB import get_db, init_db
from models import *
from utilities import hash_password, verify_password, create_access_token, verify_token
from fastapi import HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from fastapi import Depends
from models import UserResponse
from models import LessonCreate, LessonResponse

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Learning Platform API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

security = HTTPBearer()

from auth import router as auth_router
app.include_router(auth_router, prefix="/api/auth")

from courses import router as courses_router
app.include_router(courses_router, prefix="/api/courses")

# Утилиты для работы с БД
def execute_db(query: str, params: tuple = (), fetchone: bool = False, fetchall: bool = False):
    """Универсальная функция для выполнения SQL запросов"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(query, params)
        if fetchone:
            row = cur.fetchone()
            return dict(row) if row and hasattr(row, 'keys') else row
        if fetchall:
            rows = cur.fetchall()
            return [dict(row) for row in rows] if rows and hasattr(rows[0], 'keys') else rows
        conn.commit()
        return cur.lastrowid
    except sqlite3.Error as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()

def check_admin_access(user: dict):
    """Проверка прав администратора или преподавателя"""
    if user.get("role") not in [UserRole.ADMIN, UserRole.TEACHER]:
        raise HTTPException(status_code=403, detail="Admin/Teacher access required")

def check_course_access(course_id: int, user: dict):
    """Проверка доступа к курсу"""
    course = execute_db(
        "SELECT author_id, status, is_public FROM Course WHERE id = ?",
        (course_id,), fetchone=True
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Админы и авторы имеют полный доступ
    if user.get("role") == UserRole.ADMIN or course["author_id"] == user.get("id"):
        return course
    
    # Для опубликованных публичных курсов или если пользователь записан
    if course["status"] == CourseStatus.PUBLISHED and course["is_public"]:
        return course
    
    # Проверяем запись на курс
    enrollment = execute_db(
        "SELECT id FROM Enrollment WHERE course_id = ? AND user_id = ?",
        (course_id, user.get("id")), fetchone=True
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    return course

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Получение текущего пользователя из токена"""
    payload = verify_token(credentials.credentials)
    if not payload or not (user_id := payload.get("user_id")):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = execute_db(
        "SELECT id, email, name, role, created_at FROM User WHERE id = ?", 
        (user_id,), fetchone=True
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return UserResponse(**user)

def get_course_by_id(course_id: int):
    """Возвращает курс по ID или None, если не найден"""
    course = execute_db(
        """SELECT id, title, description, category, difficulty_level, status,
                  author_id, is_public, enrolled_count, rating_avg, rating_count,
                  created_at, updated_at
       FROM Course WHERE id = ?""",
        (course_id,),
        fetchone=True
    )
    return course

# Основные эндпоинты
@app.get("/health")
def health():
    return {"status": "ok", "service": "learning-platform", "timestamp": datetime.utcnow()}

@app.post("/register", response_model=UserResponse)
def register(user: UserCreate):
    """Регистрация нового пользователя"""
    try:
        # Проверяем существование email
        existing = execute_db(
            "SELECT id FROM User WHERE email = ?", 
            (user.email,), fetchone=True
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Создаем пользователя
        user_id = execute_db(
            "INSERT INTO User (email, name, password, role) VALUES (?, ?, ?, ?)",
            (user.email, user.name, hash_password(user.password), user.role.value)
        )
        
        # Возвращаем созданного пользователя
        new_user = execute_db(
            "SELECT id, email, name, role, created_at FROM User WHERE id = ?",
            (user_id,), fetchone=True
        )
        
        return UserResponse(**new_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    """Аутентификация пользователя"""
    user = execute_db(
        "SELECT id, email, password, role FROM User WHERE email = ?",
        (data.email,), fetchone=True
    )
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    if not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid password")
    
    token = create_access_token({
        "sub": user["email"], 
        "user_id": user["id"], 
        "role": user["role"]
    })
    
    return TokenResponse(token=token, role=UserRole(user["role"]))

@app.get("/profile/stats")
def get_profile_stats(current: UserResponse = Depends(get_current_user)):
    """
    Реальная статистика пользователя (в основном для студентов).
    """
    # 1) Активные курсы (зачисления)
    active_courses_row = execute_db(
        "SELECT COUNT(*) AS cnt FROM Enrollment WHERE user_id = ?",
        (current.id,),
        fetchone=True
    )
    active_courses = int(active_courses_row["cnt"] or 0)

    # 2) Сданные работы (submitted/graded/late)
    submitted_row = execute_db(
        """
        SELECT COUNT(*) AS cnt
        FROM Submission
        WHERE user_id = ?
          AND status IN ('submitted','graded','late')
        """,
        (current.id,),
        fetchone=True
    )
    submitted_works = int(submitted_row["cnt"] or 0)

    # 3) Всего заданий во всех курсах студента
    total_assignments_row = execute_db(
        """
        SELECT COUNT(DISTINCT a.id) AS cnt
        FROM Enrollment e
        JOIN Course c ON c.id = e.course_id
        JOIN Module m ON m.course_id = c.id
        JOIN Lesson l ON l.module_id = m.id
        JOIN Assignment a ON a.lesson_id = l.id
        WHERE e.user_id = ?
        """,
        (current.id,),
        fetchone=True
    )
    total_assignments = int(total_assignments_row["cnt"] or 0)

    # 4) Прогресс (%): сдано / всего заданий
    progress = 0.0
    if total_assignments > 0:
        progress = (submitted_works / total_assignments) * 100.0
        if progress > 100:
            progress = 100.0

    # 5) Средняя оценка (%)
    avg_grade_row = execute_db(
        """
        SELECT AVG(g.percentage) AS avgp
        FROM Grade g
        JOIN Submission s ON s.id = g.submission_id
        WHERE s.user_id = ?
        """,
        (current.id,),
        fetchone=True
    )
    avg_grade = float(avg_grade_row["avgp"] or 0.0)

    return {
        "active_courses": active_courses,
        "submitted_works": submitted_works,
        "total_assignments": total_assignments,
        "progress_percent": round(progress, 1),
        "average_grade_percent": round(avg_grade, 1),
    }

@app.get("/profile", response_model=UserResponse)
def profile(current: UserResponse = Depends(get_current_user)):
    """Получение профиля текущего пользователя"""
    return current

# --- Создание курса ---
@app.post("/courses", response_model=CourseResponse)
def create_course(data: CourseCreate, current: UserResponse = Depends(get_current_user)):
    """Создание нового курса (только для админов/преподавателей)"""
    check_admin_access(current.dict())
    
    try:
        course_id = execute_db(
            """INSERT INTO Course (title, description, category, difficulty_level, 
                                   author_id, is_public, status) VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (data.title, data.description, data.category, data.difficulty_level, 
             current.id, data.is_public, "draft")  # статус 'draft' по умолчанию
        )
        
        course = get_course_by_id(course_id)
        return CourseResponse(**course)
    except Exception as e:
        logger.error(f"Create course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create course")



# --- Получение списка курсов ---
@app.get("/courses", response_model=List[CourseResponse])
def get_courses(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    status: Optional[str] = "published",
    search: Optional[str] = None,
    current: UserResponse = Depends(get_current_user)
):
    """Получение списка курсов"""
    query = """
        SELECT id, title, description, category, difficulty_level, status,
               author_id, is_public, enrolled_count, rating_avg, rating_count,
               created_at, updated_at FROM Course WHERE 1=1
    """
    params = []
    
    if current.role != UserRole.ADMIN:
        query += " AND status = 'published'"
        query += " AND (is_public = 1 OR author_id = ?)"
        params.append(current.id)
    elif status:
        query += " AND status = ?"
        params.append(status)
    
    if category:
        query += " AND category = ?"
        params.append(category)
    
    if difficulty:
        query += " AND difficulty_level = ?"
        params.append(difficulty)
    
    if search:
        query += " AND (title LIKE ? OR description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    
    query += " ORDER BY created_at DESC"
    
    courses = execute_db(query, tuple(params), fetchall=True)
    return [CourseResponse(**course) for course in courses]


# --- Получение конкретного курса ---
@app.get("/courses/{course_id}", response_model=CourseResponse)
def get_course(course_id: int, current: UserResponse = Depends(get_current_user)):
    """Получение информации о курсе вместе с модулями и уроками"""
    course = execute_db(
        """SELECT id, title, description, category, difficulty_level, status,
                  author_id, is_public, enrolled_count, rating_avg, rating_count,
                  created_at, updated_at
           FROM Course WHERE id = ?""",
        (course_id,), fetchone=True
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    check_course_access(course_id, current.dict())

    # Получаем модули курса
    modules = execute_db(
        """SELECT id, course_id, title, description, order_index, created_at
           FROM Module WHERE course_id = ? ORDER BY order_index""",
        (course_id,), fetchall=True
    )

    # Для каждого модуля получаем уроки
    for mod in modules:
        lessons = execute_db(
            """SELECT id, module_id, title, content, order_index
               FROM Lesson WHERE module_id = ? ORDER BY order_index""",
            (mod["id"],), fetchall=True
        )
        mod["lessons"] = lessons or []

    course["modules"] = modules

    return CourseResponse(**course)


# --- Обновление курса (для редактирования и публикации) ---
class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty_level: Optional[str] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None  # 'draft' или 'published'

class GradeInput(BaseModel):
    points_earned: float = Field(..., ge=0, le=100)
    feedback: Optional[str] = None

@app.patch("/courses/{course_id}", response_model=CourseResponse)
def update_course(course_id: int, course: CourseUpdate, current: UserResponse = Depends(get_current_user)):
    """Редактирование курса и публикация (только автор или админ)"""
    db_course = get_course_by_id(course_id)
    if not db_course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    # Только автор или админ могут редактировать
    if db_course["author_id"] != current.id and current.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Нет доступа")

    update_fields = course.dict(exclude_unset=True)
    if update_fields:
        set_clause = ", ".join(f"{k} = ?" for k in update_fields.keys())
        params = list(update_fields.values()) + [course_id]
        try:
            execute_db(f"UPDATE Course SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", tuple(params))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка обновления курса: {e}")

    updated_course = get_course_by_id(course_id)
    return CourseResponse(**updated_course)


# Модули
@app.post("/courses/{course_id}/modules", response_model=ModuleResponse)
def create_module(
    course_id: int,
    data: ModuleCreate,
    current: UserResponse = Depends(get_current_user)
):
    """Создание модуля в курсе (только для автора или админа)"""
    course = check_course_access(course_id, current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")
    
    module_id = execute_db(
        """INSERT INTO Module (course_id, title, description, order_index) 
           VALUES (?, ?, ?, ?)""",
        (course_id, data.title, data.description, data.order_index or 0)
    )
    
    module = execute_db(
        "SELECT id, course_id, title, description, order_index, created_at FROM Module WHERE id = ?",
        (module_id,), fetchone=True
    )
    
    return ModuleResponse(**module)

# --- Обновление модуля ---
@app.patch("/courses/{course_id}/modules/{module_id}", response_model=ModuleResponse)
def update_module(
    course_id: int,
    module_id: int,
    data: ModuleUpdate,
    current: UserResponse = Depends(get_current_user)
):
    # Проверка доступа к курсу
    course = check_course_access(course_id, current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")

    # Проверяем, что модуль существует
    module = execute_db(
        "SELECT id FROM Module WHERE id = ? AND course_id = ?",
        (module_id, course_id),
        fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Собираем поля для обновления
    fields = []
    values = []

    if data.title is not None:
        fields.append("title = ?")
        values.append(data.title)

    if data.description is not None:
        fields.append("description = ?")
        values.append(data.description)

    if data.order_index is not None:
        fields.append("order_index = ?")
        values.append(data.order_index)

    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    values.append(module_id)

    execute_db(
        f"UPDATE Module SET {', '.join(fields)} WHERE id = ?",
        tuple(values)
    )

    updated = execute_db(
        """SELECT id, course_id, title, description, order_index, created_at
           FROM Module WHERE id = ?""",
        (module_id,),
        fetchone=True
    )

    return ModuleResponse(**updated)

@app.patch("/modules/{module_id}", response_model=ModuleResponse)
def update_module_short(module_id: int, data: ModuleUpdate, current: UserResponse = Depends(get_current_user)):
    module = execute_db(
        "SELECT id, course_id, title, description, order_index, created_at FROM Module WHERE id = ?",
        (module_id,), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    course = check_course_access(module["course_id"], current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")

    fields = []
    values = []

    if data.title is not None:
        fields.append("title = ?")
        values.append(data.title)
    if data.description is not None:
        fields.append("description = ?")
        values.append(data.description)
    if data.order_index is not None:
        fields.append("order_index = ?")
        values.append(data.order_index)
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    values.append(module_id)
    execute_db(f"UPDATE Module SET {', '.join(fields)} WHERE id = ?", tuple(values))

    updated = execute_db(
        "SELECT id, course_id, title, description, order_index, created_at FROM Module WHERE id = ?",
        (module_id,), fetchone=True
    )

    # Добавляем уроки
    lessons = execute_db(
        "SELECT id, module_id, title, content, order_index, created_at FROM Lesson WHERE module_id = ?",
        (module_id,), fetchall=True
    )
    updated["lessons"] = lessons or []

    return ModuleResponse(**updated)

# --- Удаление модуля ---
@app.delete("/courses/{course_id}/modules/{module_id}")
def delete_module(
    course_id: int,
    module_id: int,
    current: UserResponse = Depends(get_current_user)
):
    # Проверяем доступ к курсу
    course = check_course_access(course_id, current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")

    # Проверяем, что модуль существует и принадлежит курсу
    module = execute_db(
        "SELECT id FROM Module WHERE id = ? AND course_id = ?",
        (module_id, course_id),
        fetchone=True
    )

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Удаляем модуль
    execute_db(
        "DELETE FROM Module WHERE id = ?",
        (module_id,)
    )

    return {"message": "Module deleted"}



@app.get("/modules/{module_id}", response_model=ModuleResponse)
def get_module_short(module_id: int, current: UserResponse = Depends(get_current_user)):
    # ищем модуль и его course_id по module_id
    module = execute_db(
        "SELECT id, course_id, title, description, order_index, created_at FROM Module WHERE id = ?",
        (module_id,), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    lessons = execute_db(
        "SELECT id, module_id, title, content, order_index, created_at FROM Lesson WHERE module_id = ?",
        (module_id,), fetchall=True
    )

    module["lessons"] = lessons or []
    return ModuleResponse(**module)

# Уроки 
@app.post("/modules/{module_id}/lessons", response_model=LessonResponse)
def create_lesson(module_id: int, lesson: LessonCreate, current=Depends(get_current_user)):
    """Создать новый урок в модуле"""
    # Проверка, существует ли модуль
    module = execute_db("SELECT id FROM Module WHERE id = ?", (module_id,), fetchone=True)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Вставка урока в базу
    new_lesson_id = execute_db(
        "INSERT INTO Lesson (module_id, title, content, order_index) VALUES (?, ?, ?, ?)",
        (module_id, lesson.title, lesson.content or "", lesson.order_index or 0)
    )
    # Получаем сохранённый урок
    saved_lesson = execute_db(
        "SELECT id, module_id, title, content, order_index FROM Lesson WHERE id = ?",
        (new_lesson_id,), fetchone=True
    )
    return LessonResponse(**saved_lesson)

@app.delete("/lessons/{lesson_id}")
def delete_lesson(lesson_id: int, current: UserResponse = Depends(get_current_user)):
    lesson = execute_db(
        "SELECT id, module_id FROM Lesson WHERE id = ?",
        (lesson_id,),
        fetchone=True
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Проверяем, что текущий юзер может редактировать модуль
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?",
        (lesson["module_id"],),
        fetchone=True
    )
    course = check_course_access(module["course_id"], current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete lesson")

    execute_db("DELETE FROM Lesson WHERE id = ?", (lesson_id,))
    return {"message": "Lesson deleted"}

# Задания
@app.post("/modules/{module_id}/assignments", response_model=LessonResponse)
def create_lesson(
    module_id: int,
    data: LessonCreate,
    current: UserResponse = Depends(get_current_user)
):
    """Создание урока в модуле (только для автора или админа)"""
    # Получаем модуль и проверяем доступ к курсу
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?", (module_id,), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = check_course_access(module["course_id"], current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")
    
    lesson_id = execute_db(
        """INSERT INTO Lesson (module_id, title, content, video_url, 
                               duration_minutes, order_index) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        (module_id, data.title, data.content, data.video_url, 
         data.duration_minutes, data.order_index or 0)
    )
    
    lesson = execute_db(
        """SELECT id, module_id, title, content, video_url, duration_minutes,
                  order_index, created_at FROM Lesson WHERE id = ?""",
        (lesson_id,), fetchone=True
    )
    
    return LessonResponse(**lesson)

# Задания

@app.get("/lessons/{lesson_id}/assignments")
def get_assignments(lesson_id: int, current: UserResponse = Depends(get_current_user)):
    lesson = execute_db("SELECT id, module_id FROM Lesson WHERE id = ?", (lesson_id,), fetchone=True)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    module = execute_db("SELECT course_id FROM Module WHERE id = ?", (lesson["module_id"],), fetchone=True)
    course = check_course_access(module["course_id"], current.dict())

    assignments = execute_db(
        "SELECT id, title, description FROM Assignment WHERE lesson_id = ?",
        (lesson_id,), fetchall=True
    )
    return assignments or []

@app.post("/lessons/{lesson_id}/assignments", response_model=AssignmentResponse)
def create_assignment(
    lesson_id: int,
    data: AssignmentCreate,
    current: UserResponse = Depends(get_current_user)
):
    """Создание задания к уроку (только для автора или админа)"""
    # Получаем урок и проверяем доступ
    lesson = execute_db(
        "SELECT module_id FROM Lesson WHERE id = ?", (lesson_id,), fetchone=True
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?", (lesson["module_id"],), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = check_course_access(module["course_id"], current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")
    
    # Для тестовых заданий нужно добавить данные вопросов позже
    assignment_id = execute_db(
        """INSERT INTO Assignment (lesson_id, title, description, assignment_type,
                                   points_possible, due_date, time_limit_minutes) 
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (lesson_id, data.title, data.description, data.assignment_type.value,
         data.points_possible, data.due_date, data.time_limit_minutes)
    )
    
    assignment = execute_db(
        """SELECT id, lesson_id, title, description, assignment_type, points_possible,
                  due_date, time_limit_minutes, created_at FROM Assignment WHERE id = ?""",
        (assignment_id,), fetchone=True
    )
    
    return AssignmentResponse(**assignment)

@app.get("/assignments/{assignment_id}")
def get_assignment_detail(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    """
    Детали задания + submission текущего пользователя (если есть).
    Доступ: автор/админ или записан на курс / публичный опубликованный курс.
    """
    row = execute_db("""
        SELECT 
            a.id,
            a.lesson_id,
            a.title,
            a.description,
            a.assignment_type,
            a.points_possible,
            a.due_date,
            a.time_limit_minutes,
            l.module_id,
            m.course_id
        FROM Assignment a
        JOIN Lesson l ON l.id = a.lesson_id
        JOIN Module m ON m.id = l.module_id
        WHERE a.id = ?
    """, (assignment_id,), fetchone=True)

    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # проверка доступа к курсу
    check_course_access(row["course_id"], current.dict())

    sub = execute_db("""
        SELECT id, status, submitted_at, graded_at
        FROM Submission
        WHERE assignment_id = ? AND user_id = ?
    """, (assignment_id, current.id), fetchone=True)

    return {
        "id": row["id"],
        "lesson_id": row["lesson_id"],
        "title": row["title"],
        "description": row["description"],
        "assignment_type": row["assignment_type"],
        "points_possible": row["points_possible"],
        "due_date": row["due_date"],
        "time_limit_minutes": row["time_limit_minutes"],
        "course_id": row["course_id"],
        "submission": sub or None
    }


@app.post("/assignments/{assignment_id}/complete")
def complete_assignment(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    submission = execute_db(
        "SELECT id FROM Submission WHERE assignment_id = ? AND user_id = ?",
        (assignment_id, current.id),
        fetchone=True
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    execute_db("UPDATE Submission SET status = 'graded' WHERE id = ?", (submission["id"],))
    return {"message": "Assignment completed"}

@app.post("/assignments/{assignment_id}/submit-simple")
def submit_assignment_simple(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    """
    MVP: Сдать задание без контента (просто смена статуса).
    Создаёт Submission если его нет, либо обновляет существующий.
    """
    # Проверяем, что задание существует
    assignment = execute_db(
        "SELECT lesson_id FROM Assignment WHERE id = ?",
        (assignment_id,),
        fetchone=True
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Проверяем доступ к курсу
    lesson = execute_db(
        "SELECT module_id FROM Lesson WHERE id = ?",
        (assignment["lesson_id"],),
        fetchone=True
    )
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?",
        (lesson["module_id"],),
        fetchone=True
    )
    check_course_access(module["course_id"], current.dict())

    # Обязательно: студент должен быть записан на курс
    enrollment = execute_db(
        "SELECT id FROM Enrollment WHERE course_id = ? AND user_id = ?",
        (module["course_id"], current.id),
        fetchone=True
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")

    existing = execute_db(
        "SELECT id FROM Submission WHERE assignment_id = ? AND user_id = ?",
        (assignment_id, current.id),
        fetchone=True
    )

    if existing:
        execute_db(
            "UPDATE Submission SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?",
            (existing["id"],)
        )
        return {"message": "Assignment submitted", "submission_id": existing["id"], "status": "submitted"}

    sub_id = execute_db(
        "INSERT INTO Submission (assignment_id, user_id, status, submitted_at) VALUES (?, ?, 'submitted', CURRENT_TIMESTAMP)",
        (assignment_id, current.id)
    )
    return {"message": "Assignment submitted", "submission_id": sub_id, "status": "submitted"}


@app.post("/assignments/{assignment_id}/start")
def start_assignment(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    assignment = execute_db(
        "SELECT lesson_id FROM Assignment WHERE id = ?",
        (assignment_id,),
        fetchone=True
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # доступ к курсу
    lesson = execute_db("SELECT module_id FROM Lesson WHERE id = ?", (assignment["lesson_id"],), fetchone=True)
    module = execute_db("SELECT course_id FROM Module WHERE id = ?", (lesson["module_id"],), fetchone=True)
    check_course_access(module["course_id"], current.dict())

    existing = execute_db(
        "SELECT id, status FROM Submission WHERE assignment_id = ? AND user_id = ?",
        (assignment_id, current.id),
        fetchone=True
    )
    if existing:
        return {"message": "Assignment already started", "submission_id": existing["id"], "status": existing["status"]}

    sub_id = execute_db(
        "INSERT INTO Submission (assignment_id, user_id, status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        (assignment_id, current.id, "pending")
    )
    return {"message": "Assignment started", "submission_id": sub_id, "status": "pending"}

@app.delete("/assignments/{assignment_id}/my-submission")
def delete_my_submission(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    """
    Удалить свою сдачу (Submission) по заданию.
    Если была оценка (Grade), тоже удаляем.
    """
    sub = execute_db(
        "SELECT id FROM Submission WHERE assignment_id = ? AND user_id = ?",
        (assignment_id, current.id),
        fetchone=True
    )
    if not sub:
        return {"message": "No submission to delete"}

    # удаляем grade, если есть
    execute_db("DELETE FROM Grade WHERE submission_id = ?", (sub["id"],))
    # удаляем submission
    execute_db("DELETE FROM Submission WHERE id = ?", (sub["id"],))

    return {"message": "Submission deleted"}

@app.get("/my/submissions")
def get_my_submissions(current: UserResponse = Depends(get_current_user)):
    """
    Возвращает реальные сдачи текущего пользователя (без демо),
    вместе с данными задания/урока/курса и оценкой (если есть).
    """
    rows = execute_db(
        """
        SELECT
          s.id                AS submission_id,
          s.status            AS submission_status,
          s.submitted_at      AS submitted_at,
          s.graded_at         AS graded_at,
          s.created_at        AS created_at,

          a.id                AS assignment_id,
          a.title             AS assignment_title,
          a.points_possible   AS points_possible,

          l.id                AS lesson_id,
          l.title             AS lesson_title,

          c.id                AS course_id,
          c.title             AS course_title,

          g.points_earned     AS points_earned,
          g.percentage        AS percentage,
          g.feedback          AS feedback,
          g.created_at        AS grade_created_at
        FROM Submission s
        JOIN Assignment a ON a.id = s.assignment_id
        JOIN Lesson l ON l.id = a.lesson_id
        JOIN Module m ON m.id = l.module_id
        JOIN Course c ON c.id = m.course_id
        LEFT JOIN Grade g ON g.submission_id = s.id
        WHERE s.user_id = ?
          AND s.status IN ('submitted','graded','late')
        ORDER BY COALESCE(s.submitted_at, s.created_at) DESC
        """,
        (current.id,),
        fetchall=True
    )
    return rows or []

@app.get("/teaching/submissions")
def get_teaching_submissions(
    status: Optional[str] = None,  # submitted/graded/late (optional)
    current: UserResponse = Depends(get_current_user)
):
    """
    Для преподавателя/админа: все сдачи по его курсам + студент + оценка.
    """
    params = []
    where = []

    # доступ: админ — все курсы, преподаватель — только свои
    if current.role != UserRole.ADMIN:
        where.append("c.author_id = ?")
        params.append(current.id)

    if status:
        where.append("s.status = ?")
        params.append(status)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    rows = execute_db(f"""
        SELECT
          s.id                AS submission_id,
          s.status            AS submission_status,
          s.submitted_at      AS submitted_at,
          s.graded_at         AS graded_at,
          s.created_at        AS created_at,

          u.id                AS student_id,
          u.name              AS student_name,
          u.email             AS student_email,

          a.id                AS assignment_id,
          a.title             AS assignment_title,
          a.points_possible   AS points_possible,

          l.id                AS lesson_id,
          l.title             AS lesson_title,

          c.id                AS course_id,
          c.title             AS course_title,

          g.points_earned     AS points_earned,
          g.percentage        AS percentage,
          g.feedback          AS feedback
        FROM Submission s
        JOIN User u       ON u.id = s.user_id
        JOIN Assignment a ON a.id = s.assignment_id
        JOIN Lesson l     ON l.id = a.lesson_id
        JOIN Module m     ON m.id = l.module_id
        JOIN Course c     ON c.id = m.course_id
        LEFT JOIN Grade g ON g.submission_id = s.id
        {where_sql}
        ORDER BY COALESCE(s.submitted_at, s.created_at) DESC
    """, tuple(params), fetchall=True)

    return rows or []


@app.get("/teaching/assignments")
def get_teaching_assignments(
    current: UserResponse = Depends(get_current_user)
):
    """
    Для преподавателя/админа: все задания в курсах, где current — автор.
    (Админ видит все.)
    """
    if current.role == UserRole.ADMIN:
        rows = execute_db("""
            SELECT
                a.id,
                a.title,
                a.description,
                a.assignment_type,
                a.points_possible,
                a.due_date,
                a.lesson_id,
                l.title as lesson_title,
                c.id as course_id,
                c.title as course_title,
                COUNT(CASE WHEN s.status = 'submitted' THEN 1 END) as submitted_count
            FROM Assignment a
            JOIN Lesson l ON l.id = a.lesson_id
            JOIN Module m ON m.id = l.module_id
            JOIN Course c ON c.id = m.course_id
            LEFT JOIN Submission s ON s.assignment_id = a.id
            GROUP BY a.id
            ORDER BY a.created_at DESC
        """, fetchall=True)
    else:
        # teacher: только свои курсы
        rows = execute_db("""
            SELECT
                a.id,
                a.title,
                a.description,
                a.assignment_type,
                a.points_possible,
                a.due_date,
                a.lesson_id,
                l.title as lesson_title,
                c.id as course_id,
                c.title as course_title,
                COUNT(CASE WHEN s.status = 'submitted' THEN 1 END) as submitted_count
            FROM Assignment a
            JOIN Lesson l ON l.id = a.lesson_id
            JOIN Module m ON m.id = l.module_id
            JOIN Course c ON c.id = m.course_id
            LEFT JOIN Submission s ON s.assignment_id = a.id
            WHERE c.author_id = ?
            GROUP BY a.id
            ORDER BY a.created_at DESC
        """, (current.id,), fetchall=True)

    return [dict(r) for r in (rows or [])]

@app.get("/users/me/assignments")
def get_my_assignments(
    status: Optional[str] = None,
    current: UserResponse = Depends(get_current_user)
):
    """
    Все задания пользователя из курсов, где он записан.
    Если Submission нет — считаем pending.
    """
    params = [current.id]
    query = """
        SELECT
            a.id as assignment_id,
            a.title,
            a.description,
            a.assignment_type,
            a.points_possible,
            a.due_date,
            a.lesson_id,
            l.title as lesson_title,
            c.id as course_id,
            c.title as course_title,
            s.id as submission_id,
            s.status as submission_status,
            s.submitted_at,
            s.graded_at
        FROM Enrollment e
        JOIN Course c ON c.id = e.course_id
        JOIN Module m ON m.course_id = c.id
        JOIN Lesson l ON l.module_id = m.id
        JOIN Assignment a ON a.lesson_id = l.id
        LEFT JOIN Submission s 
          ON s.assignment_id = a.id AND s.user_id = e.user_id
        WHERE e.user_id = ?
    """

    if status:
        if status == "pending":
            query += " AND (s.id IS NULL OR s.status = 'pending')"
        else:
            query += " AND s.status = ?"
            params.append(status)

    query += " ORDER BY a.due_date IS NULL, a.due_date ASC, a.created_at DESC"

    rows = execute_db(query, tuple(params), fetchall=True)

    return [
        {
            "id": r["assignment_id"],
            "title": r["title"],
            "description": r["description"],
            "assignment_type": r["assignment_type"],
            "points_possible": r["points_possible"],
            "due_date": r["due_date"],
            "lesson_id": r["lesson_id"],
            "lesson_title": r["lesson_title"],
            "course_id": r["course_id"],
            "course_title": r["course_title"],
            "status": r["submission_status"] or "pending",
            "submission_id": r["submission_id"],
            "submitted_at": r["submitted_at"],
            "graded_at": r["graded_at"],
        }
        for r in (rows or [])
    ]

@app.get("/grades/detailed")
def get_grades_detailed(current: UserResponse = Depends(get_current_user)):
    """
    Оценки текущего пользователя + названия курса и задания.
    """
    rows = execute_db("""
        SELECT
          g.id,
          g.submission_id,
          g.points_earned,
          g.points_possible,
          g.percentage,
          g.feedback,
          g.created_at,

          a.id    AS assignment_id,
          a.title AS assignment_title,

          c.id    AS course_id,
          c.title AS course_title
        FROM Grade g
        JOIN Submission s ON s.id = g.submission_id
        JOIN Assignment a ON a.id = s.assignment_id
        JOIN Lesson l ON l.id = a.lesson_id
        JOIN Module m ON m.id = l.module_id
        JOIN Course c ON c.id = m.course_id
        WHERE s.user_id = ?
        ORDER BY g.created_at DESC
    """, (current.id,), fetchall=True)

    return rows or []


@app.post("/submissions/{submission_id}/grade")
def grade_submission(submission_id: int, data: GradeInput, current: UserResponse = Depends(get_current_user)):
    """
    Поставить оценку за сдачу: создаёт/обновляет Grade и переводит Submission в graded.
    Доступ: admin или автор курса.
    """
    # достаём сдачу + assignment_id
    sub = execute_db(
        "SELECT id, assignment_id, user_id, status FROM Submission WHERE id = ?",
        (submission_id,),
        fetchone=True
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    # достаём points_possible и автора курса
    row = execute_db("""
        SELECT 
            a.points_possible,
            c.author_id
        FROM Assignment a
        JOIN Lesson l ON l.id = a.lesson_id
        JOIN Module m ON m.id = l.module_id
        JOIN Course c ON c.id = m.course_id
        WHERE a.id = ?
    """, (sub["assignment_id"],), fetchone=True)

    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if current.role not in [UserRole.ADMIN, UserRole.TEACHER] and row["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")

    points_possible = float(row["points_possible"] or 100)
    points_earned = float(data.points_earned)
    percentage = (points_earned / points_possible * 100) if points_possible > 0 else 0

    existing_grade = execute_db(
        "SELECT id FROM Grade WHERE submission_id = ?",
        (submission_id,),
        fetchone=True
    )

    if existing_grade:
        execute_db(
            """UPDATE Grade
               SET grader_id = ?, points_earned = ?, points_possible = ?, percentage = ?, feedback = ?, created_at = CURRENT_TIMESTAMP
               WHERE submission_id = ?""",
            (current.id, points_earned, points_possible, percentage, data.feedback, submission_id)
        )
    else:
        execute_db(
            """INSERT INTO Grade (submission_id, grader_id, points_earned, points_possible, percentage, feedback)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (submission_id, current.id, points_earned, points_possible, percentage, data.feedback)
        )

    execute_db(
        """UPDATE Submission
           SET status = 'graded', graded_at = CURRENT_TIMESTAMP, comments = ?
           WHERE id = ?""",
        (data.feedback, submission_id)
    )

    return {"message": "Graded", "submission_id": submission_id, "points_earned": points_earned, "percentage": percentage}


@app.get("/assignments/{assignment_id}/submissions")
def get_assignment_submissions(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    """
    Список сдач по заданию. Доступ: админ или автор курса.
    """
    # найдём course_id и author_id через цепочку
    row = execute_db("""
        SELECT c.id as course_id, c.author_id
        FROM Assignment a
        JOIN Lesson l ON l.id = a.lesson_id
        JOIN Module m ON m.id = l.module_id
        JOIN Course c ON c.id = m.course_id
        WHERE a.id = ?
    """, (assignment_id,), fetchone=True)

    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # доступ: admin или автор курса
    if current.role != UserRole.ADMIN and row["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")

    subs = execute_db("""
        SELECT 
            s.id,
            s.user_id,
            u.name as user_name,
            u.email as user_email,
            s.status,
            s.submitted_at,
            s.graded_at,
            g.points_earned,
            g.points_possible,
            g.percentage,
            g.feedback
        FROM Submission s
        JOIN User u ON u.id = s.user_id
        LEFT JOIN Grade g ON g.submission_id = s.id
        WHERE s.assignment_id = ?
        ORDER BY s.submitted_at DESC
    """, (assignment_id,), fetchall=True)

    return [dict(x) for x in (subs or [])]

@app.get("/assignments/{assignment_id}")
def get_assignment_detail(assignment_id: int, current: UserResponse = Depends(get_current_user)):
    """
    Получить детали задания.
    Доступ: автор курса/админ или пользователь, записанный на курс.
    Возвращаем также статус сдачи (submission_status) для текущего пользователя, если есть.
    """
    # 1) Находим задание + цепочку lesson->module->course
    row = execute_db("""
        SELECT 
            a.id,
            a.lesson_id,
            a.title,
            a.description,
            a.assignment_type,
            a.points_possible,
            a.due_date,
            a.time_limit_minutes,
            l.module_id,
            m.course_id,
            c.author_id
        FROM Assignment a
        JOIN Lesson l ON l.id = a.lesson_id
        JOIN Module m ON m.id = l.module_id
        JOIN Course c ON c.id = m.course_id
        WHERE a.id = ?
    """, (assignment_id,), fetchone=True)

    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # 2) Проверяем доступ к курсу (автор/админ/или записан на курс/публичный опубликованный)
    check_course_access(row["course_id"], current.dict())

    # 3) Подтягиваем submission текущего пользователя (если есть)
    sub = execute_db("""
        SELECT id, status, submitted_at, graded_at
        FROM Submission
        WHERE assignment_id = ? AND user_id = ?
    """, (assignment_id, current.id), fetchone=True)

    return {
        "id": row["id"],
        "lesson_id": row["lesson_id"],
        "title": row["title"],
        "description": row["description"],
        "assignment_type": row["assignment_type"],
        "points_possible": row["points_possible"],
        "due_date": row["due_date"],
        "time_limit_minutes": row["time_limit_minutes"],
        "course_id": row["course_id"],
        "submission": sub or None
    }

@app.post("/assignments/{assignment_id}/quiz-questions")
def add_quiz_questions(
    assignment_id: int,
    quiz_data: QuizData,
    current: UserResponse = Depends(get_current_user)
):
    """Добавление вопросов к тестовому заданию"""
    # Проверяем, что задание существует и является тестом
    assignment = execute_db(
        "SELECT lesson_id, assignment_type FROM Assignment WHERE id = ?",
        (assignment_id,), fetchone=True
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment["assignment_type"] != "quiz":
        raise HTTPException(status_code=400, detail="Assignment is not a quiz")
    
    # Проверяем права доступа (аналогично create_assignment)
    lesson = execute_db(
        "SELECT module_id FROM Lesson WHERE id = ?", (assignment["lesson_id"],), fetchone=True
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?", (lesson["module_id"],), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    course = check_course_access(module["course_id"], current.dict())
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")
    
    # Сохраняем вопросы в JSON
    quiz_json = json.dumps(quiz_data.dict())
    execute_db(
        "UPDATE Assignment SET quiz_data = ? WHERE id = ?",
        (quiz_json, assignment_id)
    )
    
    return {"message": "Quiz questions added", "questions_count": len(quiz_data.questions)}

# Запись на курсы
@app.post("/courses/{course_id}/enroll", response_model=EnrollmentResponse)
def enroll_in_course(
    course_id: int,
    current: UserResponse = Depends(get_current_user)
):
    """Запись пользователя на курс"""
    course = execute_db(
        "SELECT status, is_public FROM Course WHERE id = ?", (course_id,), fetchone=True
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course["status"] != CourseStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Course is not published")
    
    if not course["is_public"] and current.role != UserRole.ADMIN:
        # Проверяем, приглашен ли пользователь (можно расширить)
        raise HTTPException(status_code=403, detail="Course is private")
    
    # Проверяем, не записан ли уже
    existing = execute_db(
        "SELECT id FROM Enrollment WHERE course_id = ? AND user_id = ?",
        (course_id, current.id), fetchone=True
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled")
    
    enrollment_id = execute_db(
        "INSERT INTO Enrollment (course_id, user_id) VALUES (?, ?)",
        (course_id, current.id)
    )
    
    # Обновляем счетчик записанных
    execute_db(
        "UPDATE Course SET enrolled_count = enrolled_count + 1 WHERE id = ?",
        (course_id,)
    )
    
    enrollment = execute_db(
        """SELECT id, course_id, user_id, enrolled_at, completed_at, 
                  progress_percentage FROM Enrollment WHERE id = ?""",
        (enrollment_id,), fetchone=True
    )
    
    return EnrollmentResponse(**enrollment)

# Сдача заданий
@app.post("/assignments/{assignment_id}/submit", response_model=SubmissionResponse)
def submit_assignment(
    assignment_id: int,
    submission: SubmissionCreate,
    current: UserResponse = Depends(get_current_user)
):
    """Сдача задания"""
    # Проверяем задание
    assignment = execute_db(
        """SELECT lesson_id, assignment_type, points_possible, due_date 
           FROM Assignment WHERE id = ?""",
        (assignment_id,), fetchone=True
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Проверяем доступ к уроку (пользователь должен быть записан на курс)
    lesson = execute_db(
        "SELECT module_id FROM Lesson WHERE id = ?", (assignment["lesson_id"],), fetchone=True
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?", (lesson["module_id"],), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Проверяем, записан ли пользователь на курс
    enrollment = execute_db(
        "SELECT id FROM Enrollment WHERE course_id = ? AND user_id = ?",
        (module["course_id"], current.id), fetchone=True
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Проверяем дедлайн
    status = SubmissionStatus.SUBMITTED
    if assignment["due_date"] and datetime.fromisoformat(assignment["due_date"]) < datetime.utcnow():
        status = SubmissionStatus.LATE
    
    # Проверяем тип задания и соответствующие данные
    if assignment["assignment_type"] == "quiz" and not submission.quiz_answers:
        raise HTTPException(status_code=400, detail="Quiz answers required for quiz assignment")
    elif assignment["assignment_type"] == "essay" and not submission.essay_text:
        raise HTTPException(status_code=400, detail="Essay text required for essay assignment")
    elif assignment["assignment_type"] == "code" and not submission.code:
        raise HTTPException(status_code=400, detail="Code required for code assignment")
    
    # Сохраняем ответы в JSON если нужно
    quiz_answers_json = json.dumps(submission.quiz_answers) if submission.quiz_answers else None
    attachments_json = json.dumps(submission.attachments) if submission.attachments else None
    
    # Создаем или обновляем сдачу
    existing = execute_db(
        "SELECT id FROM Submission WHERE assignment_id = ? AND user_id = ?",
        (assignment_id, current.id), fetchone=True
    )
    
    if existing:
        execute_db(
            """UPDATE Submission SET status = ?, quiz_answers = ?, essay_text = ?, 
                                  code = ?, attachments = ?, submitted_at = CURRENT_TIMESTAMP 
               WHERE id = ?""",
            (status.value, quiz_answers_json, submission.essay_text, 
             submission.code, attachments_json, existing["id"])
        )
        submission_id = existing["id"]
    else:
        submission_id = execute_db(
            """INSERT INTO Submission (assignment_id, user_id, status, quiz_answers,
                                      essay_text, code, attachments, submitted_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (assignment_id, current.id, status.value, quiz_answers_json,
             submission.essay_text, submission.code, attachments_json)
        )
    
    # Если это тест, автоматически проверяем
    if assignment["assignment_type"] == "quiz" and submission.quiz_answers:
        grade_quiz_assignment(submission_id, assignment_id, current.id)
    
    sub = execute_db(
        """SELECT id, assignment_id, user_id, status, quiz_answers, essay_text,
                  code, attachments, submitted_at, graded_at, comments
           FROM Submission WHERE id = ?""",
        (submission_id,), fetchone=True
    )
    
    # Конвертируем JSON обратно в dict
    if sub["quiz_answers"]:
        sub["quiz_answers"] = json.loads(sub["quiz_answers"])
    if sub["attachments"]:
        sub["attachments"] = json.loads(sub["attachments"])
    
    return SubmissionResponse(**sub)

def grade_quiz_assignment(submission_id: int, assignment_id: int, user_id: int):
    """Автоматическая проверка тестового задания"""
    try:
        # Получаем данные теста
        assignment = execute_db(
            "SELECT quiz_data, points_possible FROM Assignment WHERE id = ?",
            (assignment_id,), fetchone=True
        )
        if not assignment or not assignment["quiz_data"]:
            return
        
        quiz_data = json.loads(assignment["quiz_data"])
        questions = quiz_data.get("questions", [])
        
        # Получаем ответы пользователя
        submission = execute_db(
            "SELECT quiz_answers FROM Submission WHERE id = ?", (submission_id,), fetchone=True
        )
        if not submission or not submission["quiz_answers"]:
            return
        
        user_answers = json.loads(submission["quiz_answers"])
        
        # Проверяем ответы
        correct_answers = 0
        total_points = 0
        max_points = 0
        
        for i, question in enumerate(questions):
            question_id = str(i)
            max_points += question.get("points", 1)
            
            if question_id in user_answers and user_answers[question_id] == question["correct_answer"]:
                correct_answers += 1
                total_points += question.get("points", 1)
        
        percentage = (total_points / max_points * 100) if max_points > 0 else 0
        
        # Сохраняем оценку
        grade_id = execute_db(
            """INSERT INTO Grade (submission_id, points_earned, points_possible, percentage) 
               VALUES (?, ?, ?, ?)""",
            (submission_id, total_points, max_points, percentage)
        )
        
        # Обновляем статус сдачи
        execute_db(
            """UPDATE Submission SET status = 'graded', graded_at = CURRENT_TIMESTAMP,
                  comments = ? WHERE id = ?""",
            (f"Automatically graded: {correct_answers}/{len(questions)} correct", submission_id)
        )
        
        # Проверяем бейдж "Отличник"
        if percentage == 100:
            check_and_award_badge(user_id, "Отличник")
        
    except Exception as e:
        logger.error(f"Error grading quiz: {e}")

def check_and_award_badge(user_id: int, badge_name: str):
    """Награждение пользователя бейджем"""
    try:
        # Получаем ID бейджа
        badge = execute_db(
            "SELECT id FROM Badge WHERE name = ?", (badge_name,), fetchone=True
        )
        if not badge:
            return
        
        # Проверяем, есть ли уже этот бейдж у пользователя
        existing = execute_db(
            "SELECT id FROM UserBadge WHERE user_id = ? AND badge_id = ?",
            (user_id, badge["id"]), fetchone=True
        )
        if not existing:
            execute_db(
                "INSERT INTO UserBadge (user_id, badge_id) VALUES (?, ?)",
                (user_id, badge["id"])
            )
    except Exception as e:
        logger.error(f"Error awarding badge: {e}")

# Получение оценок
@app.get("/grades", response_model=List[GradeResponse])
def get_user_grades(
    course_id: Optional[int] = None,
    current: UserResponse = Depends(get_current_user)
):
    """Получение оценок пользователя"""
    query = """
        SELECT g.id, g.submission_id, g.grader_id, g.points_earned, 
               g.points_possible, g.percentage, g.feedback, g.created_at
        FROM Grade g
        JOIN Submission s ON g.submission_id = s.id
        JOIN Assignment a ON s.assignment_id = a.id
        JOIN Lesson l ON a.lesson_id = l.id
        JOIN Module m ON l.module_id = m.id
        WHERE s.user_id = ?
    """
    params = [current.id]
    
    if course_id:
        query += " AND m.course_id = ?"
        params.append(course_id)
    
    query += " ORDER BY g.created_at DESC"
    
    grades = execute_db(query, tuple(params), fetchall=True)
    return [GradeResponse(**grade) for grade in grades]

# Прогресс пользователя
@app.get("/progress/{course_id}", response_model=UserProgress)
def get_course_progress(course_id: int, current: UserResponse = Depends(get_current_user)):
    """Получение прогресса пользователя по курсу"""
    # Проверяем запись на курс
    enrollment = execute_db(
        "SELECT id FROM Enrollment WHERE course_id = ? AND user_id = ?",
        (course_id, current.id), fetchone=True
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Получаем статистику по урокам
    lessons_stats = execute_db("""
        SELECT 
            COUNT(DISTINCT l.id) as total_lessons,
            COUNT(DISTINCT ulp.lesson_id) as completed_lessons
        FROM Lesson l
        JOIN Module m ON l.module_id = m.id
        LEFT JOIN UserLessonProgress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
        WHERE m.course_id = ?
    """, (current.id, course_id), fetchone=True)
    
    # Получаем статистику по заданиям
    assignments_stats = execute_db("""
        SELECT 
            COUNT(DISTINCT a.id) as total_assignments,
            COUNT(DISTINCT s.id) as completed_assignments
        FROM Assignment a
        JOIN Lesson l ON a.lesson_id = l.id
        JOIN Module m ON l.module_id = m.id
        LEFT JOIN Submission s ON a.id = s.assignment_id AND s.user_id = ?
        WHERE m.course_id = ?
    """, (current.id, course_id), fetchone=True)
    
    # Получаем среднюю оценку
    avg_grade = execute_db("""
        SELECT AVG(g.percentage) as average_grade
        FROM Grade g
        JOIN Submission s ON g.submission_id = s.id
        JOIN Assignment a ON s.assignment_id = a.id
        JOIN Lesson l ON a.lesson_id = l.id
        JOIN Module m ON l.module_id = m.id
        WHERE s.user_id = ? AND m.course_id = ?
    """, (current.id, course_id), fetchone=True)
    
    return UserProgress(
        course_id=course_id,
        completed_lessons=lessons_stats["completed_lessons"] or 0,
        total_lessons=lessons_stats["total_lessons"] or 0,
        completed_assignments=assignments_stats["completed_assignments"] or 0,
        total_assignments=assignments_stats["total_assignments"] or 0,
        average_grade=avg_grade["average_grade"] if avg_grade["average_grade"] else None
    )

# Отметка урока как пройденного
@app.post("/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: int, current: UserResponse = Depends(get_current_user)):
    """Отметка урока как пройденного"""
    # Проверяем доступ к уроку
    lesson = execute_db(
        "SELECT module_id FROM Lesson WHERE id = ?", (lesson_id,), fetchone=True
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    module = execute_db(
        "SELECT course_id FROM Module WHERE id = ?", (lesson["module_id"],), fetchone=True
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Проверяем запись на курс
    enrollment = execute_db(
        "SELECT id FROM Enrollment WHERE course_id = ? AND user_id = ?",
        (module["course_id"], current.id), fetchone=True
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Отмечаем урок как пройденный
    existing = execute_db(
        "SELECT id FROM UserLessonProgress WHERE user_id = ? AND lesson_id = ?",
        (current.id, lesson_id), fetchone=True
    )
    
    if existing:
        execute_db(
            "UPDATE UserLessonProgress SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
            (existing["id"],)
        )
    else:
        execute_db(
            """INSERT INTO UserLessonProgress (user_id, lesson_id, completed, completed_at) 
               VALUES (?, ?, 1, CURRENT_TIMESTAMP)""",
            (current.id, lesson_id)
        )
    
    # Обновляем общий прогресс по курсу
    update_course_progress(module["course_id"], current.id)
    
    # Проверяем бейдж "Первые шаги"
    total_completed = execute_db(
        "SELECT COUNT(*) as count FROM UserLessonProgress WHERE user_id = ? AND completed = 1",
        (current.id,), fetchone=True
    )
    if total_completed["count"] == 1:
        check_and_award_badge(current.id, "Первые шаги")
    
    return {"message": "Lesson marked as completed"}

def update_course_progress(course_id: int, user_id: int):
    """Обновление общего прогресса по курсу"""
    # Считаем процент завершенных уроков
    progress = execute_db("""
        SELECT 
            COUNT(DISTINCT ulp.lesson_id) as completed,
            COUNT(DISTINCT l.id) as total
        FROM Lesson l
        JOIN Module m ON l.module_id = m.id
        LEFT JOIN UserLessonProgress ulp ON l.id = ulp.lesson_id AND ulp.user_id = ?
        WHERE m.course_id = ? AND ulp.completed = 1
    """, (user_id, course_id), fetchone=True)
    
    percentage = (progress["completed"] / progress["total"] * 100) if progress["total"] > 0 else 0
    
    execute_db(
        "UPDATE Enrollment SET progress_percentage = ? WHERE course_id = ? AND user_id = ?",
        (percentage, course_id, user_id)
    )
    
    # Если курс завершен на 100%, награждаем бейджем
    if percentage == 100:
        check_and_award_badge(user_id, "Завершитель курса")
        execute_db(
            "UPDATE Enrollment SET completed_at = CURRENT_TIMESTAMP WHERE course_id = ? AND user_id = ?",
            (course_id, user_id)
        )

# Административные эндпоинты
@app.put("/courses/{course_id}/publish", response_model=CourseResponse)
def publish_course(course_id: int, current: UserResponse = Depends(get_current_user)):
    """Публикация курса (только для автора или админа)"""
    course = get_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if current.role != UserRole.ADMIN and course["author_id"] != current.id:
        raise HTTPException(status_code=403, detail="Not course author")
    
    execute_db(
        "UPDATE Course SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (course_id,)
    )
    
    updated_course = get_course_by_id(course_id)
    return CourseResponse(**updated_course)  # Возвращаем курс для фронта


@app.get("/admin/stats")
def admin_stats(current: UserResponse = Depends(get_current_user)):
    # Разрешаем админ-панель и админу, и преподавателю
    if current.role not in [UserRole.ADMIN, UserRole.TEACHER]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # 1) Базовые счётчики
    total_users = execute_db("SELECT COUNT(*) AS cnt FROM User", fetchone=True)["cnt"] or 0
    total_courses = execute_db("SELECT COUNT(*) AS cnt FROM Course", fetchone=True)["cnt"] or 0
    total_enrollments = execute_db("SELECT COUNT(*) AS cnt FROM Enrollment", fetchone=True)["cnt"] or 0
    total_submissions = execute_db("SELECT COUNT(*) AS cnt FROM Submission", fetchone=True)["cnt"] or 0

    # 2) Распределение прогресса (по Enrollment.progress_percentage)
    # Диапазоны: 0-25, 26-50, 51-75, 76-100
    total_rows = execute_db("SELECT COUNT(*) AS cnt FROM Enrollment", fetchone=True)["cnt"] or 0

    def range_count(lo, hi):
        return execute_db(
            "SELECT COUNT(*) AS cnt FROM Enrollment WHERE progress_percentage >= ? AND progress_percentage <= ?",
            (lo, hi),
            fetchone=True
        )["cnt"] or 0

    r1 = range_count(0, 25)
    r2 = range_count(26, 50)
    r3 = range_count(51, 75)
    r4 = range_count(76, 100)

    def pct(x):
        return round((x / total_rows) * 100, 1) if total_rows else 0.0

    progress_ranges = [
        {"label": "0–25%", "percentage": pct(r1), "color": "bg-red-500"},
        {"label": "26–50%", "percentage": pct(r2), "color": "bg-yellow-500"},
        {"label": "51–75%", "percentage": pct(r3), "color": "bg-blue-500"},
        {"label": "76–100%", "percentage": pct(r4), "color": "bg-green-500"},
    ]

    # 3) Топ курсов по числу записей
    course_rows = execute_db(
        """
        SELECT c.title AS title, COUNT(e.id) AS students
        FROM Course c
        LEFT JOIN Enrollment e ON e.course_id = c.id
        GROUP BY c.id
        ORDER BY students DESC, c.id DESC
        LIMIT 8
        """,
        fetchall=True
    ) or []

    courses = [{"title": row["title"], "students": int(row["students"] or 0)} for row in course_rows]

    # 4) Последняя активность (смешаем: enrollments + submissions + grades)
    # Берём по 6–8 из каждого, смешиваем в python и сортируем по времени
    enrolls = execute_db(
        """
        SELECT e.enrolled_at AS ts, u.name AS user_name, u.email AS user_email, c.title AS course_title
        FROM Enrollment e
        JOIN User u ON u.id = e.user_id
        JOIN Course c ON c.id = e.course_id
        ORDER BY e.enrolled_at DESC
        LIMIT 8
        """,
        fetchall=True
    ) or []

    submits = execute_db(
        """
        SELECT s.submitted_at AS ts, u.name AS user_name, u.email AS user_email, a.title AS assignment_title
        FROM Submission s
        JOIN User u ON u.id = s.user_id
        JOIN Assignment a ON a.id = s.assignment_id
        WHERE s.status IN ('submitted', 'graded', 'late')
        AND s.submitted_at IS NOT NULL
        ORDER BY s.submitted_at DESC
        LIMIT 8
        """,
        fetchall=True
    ) or []

    grades = execute_db(
        """
        SELECT g.created_at AS ts, u.name AS user_name, u.email AS user_email, a.title AS assignment_title, g.percentage AS percentage
        FROM Grade g
        JOIN Submission s ON s.id = g.submission_id
        JOIN User u ON u.id = s.user_id
        JOIN Assignment a ON a.id = s.assignment_id
        ORDER BY g.created_at DESC
        LIMIT 8
        """,
        fetchall=True
    ) or []

    def fmt_ts(ts: Any) -> str:
        # SQLite может вернуть строку; оставим просто красивую (YYYY-MM-DD HH:MM)
        if ts is None:
            return ""
        s = str(ts)
        # если "2026-01-07 10:11:12" -> "2026-01-07 10:11"
        return s[:16] if len(s) >= 16 else s

    activities = []

    for r in enrolls:
        activities.append({
            "ts": str(r["ts"]),
            "user": r["user_name"] or r["user_email"] or "Пользователь",
            "action": f"записался(ась) на курс “{r['course_title']}”",
            "time": fmt_ts(r["ts"])
        })

    for r in submits:
        activities.append({
    "ts": str(r["ts"]),
    "user": r["user_name"] or r["user_email"] or "Пользователь",
    "action": f"сдал(а) задание “{r['assignment_title']}”",
    "time": fmt_ts(r["ts"])
})

    for r in grades:
        p = r["percentage"]
        p_txt = f"{round(float(p), 1)}%" if p is not None else ""
        activities.append({
            "ts": str(r["ts"]),
            "user": r["user_name"] or r["user_email"] or "Пользователь",
            "action": f"получил(а) оценку {p_txt} за “{r['assignment_title']}”",
            "time": fmt_ts(r["ts"])
        })

    # сортировка по времени (строки вида YYYY-MM-DD HH:MM:SS сортируются корректно)
    activities.sort(key=lambda x: x["ts"], reverse=True)
    recent_activities = activities[:10]

    return {
        "total_users": int(total_users),
        "total_courses": int(total_courses),
        "total_enrollments": int(total_enrollments),
        "total_submissions": int(total_submissions),
        "progressRanges": progress_ranges,
        "courses": courses,
        "recentActivities": recent_activities,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)