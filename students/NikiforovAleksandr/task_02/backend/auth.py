from fastapi import APIRouter, HTTPException, Depends
from models import UserCreate, LoginRequest, TokenResponse, UserResponse
from sqliteDB import get_db
from utilities import hash_password, verify_password, create_access_token, verify_token
from datetime import datetime
import sqlite3

router = APIRouter()

# Регистрация пользователя
@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate):
    db = get_db()
    hashed_password = hash_password(user.password)
    role_value = user.role if user.role in ["user", "admin"] else "user"

    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO User (email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (user.email, user.name, hashed_password, role_value, datetime.utcnow())
        )
        db.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    return {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "role": role_value,
        "created_at": datetime.utcnow()
    }

# Логин пользователя
@router.post("/login", response_model=TokenResponse)
def login_user(request: LoginRequest):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM User WHERE email = ?", (request.email,))
    row = cursor.fetchone()

    if not row or not verify_password(request.password, row["password"]):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")

    token_data = {"user_id": row["id"], "role": row["role"]}
    token = create_access_token(token_data)
    return {"token": token, "role": row["role"]}

# Получение профиля
@router.get("/profile", response_model=UserResponse)
def get_profile(credentials: dict = Depends(verify_token)):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM User WHERE id = ?", (credentials["user_id"],))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "created_at": row["created_at"]
    }
