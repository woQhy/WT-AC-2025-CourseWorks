# Мини-LMS «Учись, не болей» (Вариант 03)

## Описание проекта

Full-stack веб-приложение (вариант №03 курсового проекта): мини-LMS для обучения с короткими уроками и заданиями.  
Пользователи могут просматривать курсы, проходить уроки, начинать и сдавать задания, а преподаватель — создавать контент и оценивать работы.

**Питч:** короткие уроки, длинные знания.

---

## MVP (обязательный минимум)

- Курсы: создание/просмотр/редактирование, публикация.
- Структура: Course → Module → Lesson.
- Задания: Assignment внутри уроков.
- Сдачи: Submission (старт/сдача/статусы).
- Оценивание: Grade (0–100 + комментарий).
- Роли: student / teacher / admin (teacher и admin имеют равные права на учебный контент; admin дополнительно видит статистику).
- API ресурсы: `/courses`, `/modules`, `/lessons`, `/assignments`, `/submissions`, `/grades`.
- Frontend: SPA на React (Vite), маршрутизация.
- Backend: FastAPI + SQLite.
- Валидация: Pydantic (backend), базовая на UI.

---

## Бонусы (реализовано/частично)

- Документация API: Swagger UI (FastAPI) доступна на `/docs`.
- Админ-панель: агрегированная статистика и последняя активность (`/admin/stats`).
- (Опционально на будущее): плагиат-чек (заглушка), рубрики, бейджи, CI, Kubernetes.

---

## Требования

- Python **3.11.8**
- Node.js (рекомендуется 18+)
- Git
- Windows (инструкция ниже ориентирована на Windows + venv)

---

## Структура репозитория (пример)

```text
task_02/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── auth.py
│   ├── courses.py
│   ├── sqliteDB.py
│   ├── utilities.py
│   └── requirements.txt
│
├── doc/
│   └── README.md
│
├── src/
│   ├── components/
│   │   ├── Card.jsx
│   │   ├── CourseCard.jsx
│   │   ├── Header.jsx
│   │   ├── Layout.jsx
│   │   ├── PrivateRoute.jsx
│   │   ├── ProgressBar.jsx
│   │   └── Sidebar.jsx
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx
│   │
│   ├── hooks/
│   │   └── useAuth.js
│   │
│   ├── pages/
│   │   ├── Admin.jsx
│   │   ├── AssignmentDetail.jsx
│   │   ├── Assignments.jsx
│   │   ├── CourseDetail.jsx
│   │   ├── Courses.jsx
│   │   ├── CreateCourse.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Grades.jsx
│   │   ├── LessonDetail.jsx
│   │   ├── Lessons.jsx
│   │   ├── Login.jsx
│   │   ├── ModuleDetail.jsx
│   │   ├── Profile.jsx
│   │   ├── Register.jsx
│   │   └── Submissions.jsx
│   │
│   ├── services/
│   │   ├── api.js
│   │   └── courseService.js
│   │
│   ├── utils/
│   │   └── formatDate.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
````

---

## Установка и запуск (Backend)

### 1) Создать и активировать виртуальное окружение

Из корня проекта:

```bat
python -m venv venv
venv\Scripts\activate
```

### 2) Установить зависимости

```bat
pip install -r backend\requirements.txt
```

### 3) Запуск FastAPI сервера

Перейди в папку backend (если требуется) или запускай из неё:

```bat
cd backend
uvicorn main:app --reload
```

После запуска:

- API будет доступно на: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

---

## Установка и запуск (Frontend)

Открой **второе окно CMD/Terminal**, затем:

```bat
cd frontend
npm install
npm run dev
```

Frontend обычно доступен на:

- `http://localhost:5173`

---

## Роли и доступы (кратко)

- **Student**

  - записаться на курс
  - смотреть уроки/задания
  - начать и сдать задание
  - смотреть свои сдачи и оценки

- **Teacher**

  - создавать/редактировать курсы, модули, уроки, задания
  - видеть сдачи студентов по заданиям
  - выставлять оценки 0–100 + комментарий

- **Admin**

  - все права Teacher
  - просмотр статистики платформы (админ-панель)

---

## Основные маршруты UI (кратко)

- `/login` — вход
- `/courses` — список курсов
- `/courses/:courseId` — курс (модули/уроки)
- `/modules/:moduleId` — модуль
- `/lessons/:lessonId` — урок и его задания
- `/assignments` — список заданий (по роли)
- `/assignments/:assignmentId` — страница задания (старт/сдача/оценивание)
- `/submissions` — сдачи (реальные, без демо)
- `/grades` — оценки (только студент)
- `/profile` — профиль и статистика
- `/admin` — админ-панель/статистика (teacher/admin)

---

## API (кратко)

> Большинство эндпоинтов требует JWT в заголовке
> `Authorization: Bearer <token>`
> Исключения: `/register`, `/login`

### Auth

- `POST /register` — регистрация
- `POST /login` — вход (JWT)

### Courses / Content

- `GET /courses`
- `POST /courses` (teacher/admin)
- `GET /courses/{id}`
- `PATCH /courses/{id}` (teacher/admin)
- `POST /courses/{id}/enroll` (student)
- `POST /courses/{course_id}/modules` (teacher/admin)
- `POST /modules/{module_id}/lessons` (teacher/admin)
- `POST /lessons/{lesson_id}/assignments` (teacher/admin)

### Assignments / Submissions / Grades

- `GET /assignments/{id}`
- `POST /assignments/{id}/start` (student)
- `POST /assignments/{id}/submit-simple` (student)
- `GET /assignments/my` (student)
- `GET /teaching/assignments` (teacher/admin)
- `GET /assignments/{id}/submissions` (teacher/admin)
- `POST /submissions/{id}/grade` (teacher/admin)
- `GET /my/submissions` (student)
- `GET /grades/detailed` (student)

### Admin

- `GET /admin/stats` (teacher/admin)
