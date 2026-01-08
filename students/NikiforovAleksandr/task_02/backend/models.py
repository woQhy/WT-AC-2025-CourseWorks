from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import re
from enum import Enum
from pydantic import BaseModel
from typing import Optional

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    TEACHER = "teacher"  # Можем добавить для расширения

class CourseStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class SubmissionStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    GRADED = "graded"
    LATE = "late"

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: UserRole = UserRole.USER

    @validator("email")
    def validate_email(cls, v):
        if not re.match(EMAIL_REGEX, v):
            raise ValueError("Invalid email format")
        return v

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    created_at: Optional[datetime] = None

class LessonResponse(BaseModel):
    id: int
    module_id: int
    title: str
    content: Optional[str] = ""
    order_index: int

class LessonCreate(BaseModel):
    module_id: int
    title: str = Field(..., max_length=200)
    content: Optional[str] = None
    order_index: Optional[int] = 0

class ModuleCreate(BaseModel):
    course_id: int
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    order_index: Optional[int] = 0

class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    order_index: Optional[int] = None  

class ModuleResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str] = ""
    order_index: int
    created_at: datetime
    lessons: List[LessonResponse] = []

class CourseCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty_level: str = Field("beginner", pattern="^(beginner|intermediate|advanced)$")
    is_public: bool = False

class CourseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty_level: str
    status: str
    author_id: int
    is_public: bool
    enrolled_count: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    modules: List[ModuleResponse] = []

class AssignmentType(str, Enum):
    QUIZ = "quiz"
    ESSAY = "essay" 
    CODE = "code" 
    PROJECT = "project"  

class AssignmentCreate(BaseModel):
    lesson_id: int
    title: str = Field(..., max_length=200)
    description: str
    assignment_type: AssignmentType = AssignmentType.QUIZ
    points_possible: int = Field(100, ge=1, le=1000)
    due_date: Optional[datetime] = None
    time_limit_minutes: Optional[int] = None  

class AssignmentResponse(BaseModel):
    id: int
    lesson_id: int
    title: str
    description: str
    assignment_type: AssignmentType
    points_possible: int
    due_date: Optional[datetime] = None
    time_limit_minutes: Optional[int] = None
    created_at: Optional[datetime] = None

class QuizQuestion(BaseModel):
    question: str
    options: List[str] 
    correct_answer: int
    points: int = 1

class QuizData(BaseModel):
    questions: List[QuizQuestion]
    shuffle_questions: bool = True
    shuffle_options: bool = True

class SubmissionCreate(BaseModel):
    assignment_id: int
    quiz_answers: Optional[Dict[str, Any]] = None 
    essay_text: Optional[str] = None
    code: Optional[str] = None
    attachments: Optional[List[str]] = None

class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    user_id: int
    status: SubmissionStatus
    quiz_answers: Optional[Dict[str, Any]] = None
    essay_text: Optional[str] = None
    code: Optional[str] = None
    attachments: Optional[List[str]] = None
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None
    comments: Optional[str] = None

class GradeCreate(BaseModel):
    submission_id: int
    points_earned: float
    feedback: Optional[str] = None

class GradeResponse(BaseModel):
    id: int
    submission_id: int
    grader_id: Optional[int] = None
    points_earned: float
    points_possible: float
    percentage: float
    feedback: Optional[str] = None
    created_at: Optional[datetime] = None

class EnrollmentCreate(BaseModel):
    course_id: int

class EnrollmentResponse(BaseModel):
    id: int
    course_id: int
    user_id: int
    enrolled_at: datetime
    completed_at: Optional[datetime] = None
    progress_percentage: float = 0.0

class LoginRequest(BaseModel):
    email: str
    password: str

    @validator("email")
    def validate_email(cls, v):
        if not re.match(EMAIL_REGEX, v):
            raise ValueError("Invalid email format")
        return v

class TokenResponse(BaseModel):
    token: str
    role: UserRole

class UserProgress(BaseModel):
    course_id: int
    completed_lessons: int
    total_lessons: int
    completed_assignments: int
    total_assignments: int
    average_grade: Optional[float] = None