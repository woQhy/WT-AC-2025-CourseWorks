import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import api from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import toast from "react-hot-toast"

const ModuleDetail = () => {
  const { courseId, moduleId } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [module, setModule] = useState(null)
  const [loading, setLoading] = useState(true)

  // редактирование модуля
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  // уроки
  const [newLessonTitle, setNewLessonTitle] = useState("")
  const [expandedLesson, setExpandedLesson] = useState(null)
  const [lessonAssignments, setLessonAssignments] = useState({})

  // создание задания
  const [creatingForLessonId, setCreatingForLessonId] = useState(null)
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("")
  const [newAssignmentDescription, setNewAssignmentDescription] = useState("")

  const errorMessage = (e, fallback = "Ошибка") => {
    const detail = e?.response?.data?.detail

    if (!detail) return fallback

    // FastAPI 422: detail = [{ msg, loc, type, ...}, ...]
    if (Array.isArray(detail)) {
      const msgs = detail.map((d) => d?.msg).filter(Boolean)
      return msgs.length ? msgs.join(", ") : fallback
    }

    // FastAPI иногда: detail = { ... } или строка
    if (typeof detail === "string") return detail
    if (typeof detail === "object") return JSON.stringify(detail)

    return fallback
  }

  useEffect(() => {
    fetchModule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchModule = async () => {
    setLoading(true)
    try {
      const url = courseId
        ? `/courses/${courseId}/modules/${moduleId}`
        : `/modules/${moduleId}`
      const res = await api.get(url)
      setModule(res.data)
      setTitle(res.data.title)
      setDescription(res.data.description || "")
    } catch (err) {
      console.error(err)
      toast.error("Ошибка загрузки модуля")
    } finally {
      setLoading(false)
    }
  }

  const saveModule = async () => {
    try {
      const url = courseId
        ? `/courses/${courseId}/modules/${moduleId}`
        : `/modules/${moduleId}`
      const res = await api.patch(url, { title, description })
      setModule(res.data)
      setEditing(false)
      toast.success("Модуль обновлён")
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка сохранения модуля"))
    }
  }

  const addLesson = async () => {
    if (!newLessonTitle.trim()) return
    try {
      const res = await api.post(`/modules/${moduleId}/lessons`, {
        module_id: Number(moduleId), // ✅ важно: бэк ждёт module_id
        title: newLessonTitle,
        content: "",
        order_index: 0,
      })
      setModule((prev) => ({
        ...prev,
        lessons: [...(prev.lessons || []), res.data],
      }))
      setNewLessonTitle("")
      toast.success("Урок добавлен")
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка добавления урока"))
    }
  }

  const deleteLesson = async (lessonId) => {
    try {
      await api.delete(`/lessons/${lessonId}`)
      setModule((prev) => ({
        ...prev,
        lessons: (prev.lessons || []).filter((l) => l.id !== lessonId),
      }))
      toast.success("Урок удалён")
      if (expandedLesson === lessonId) setExpandedLesson(null)
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка удаления урока"))
    }
  }

  const toggleLesson = async (lessonId) => {
    if (expandedLesson === lessonId) {
      setExpandedLesson(null)
      return
    }
    setExpandedLesson(lessonId)
    try {
      const res = await api.get(`/lessons/${lessonId}/assignments`)
      setLessonAssignments((prev) => ({ ...prev, [lessonId]: res.data }))
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка загрузки заданий"))
    }
  }

  const startAssignment = async (assignmentId, lessonId) => {
    try {
      await api.post(`/assignments/${assignmentId}/start`)
      setLessonAssignments((prev) => ({
        ...prev,
        [lessonId]: (prev[lessonId] || []).map((a) =>
          a.id === assignmentId ? { ...a, status: "started" } : a
        ),
      }))
      toast.success("Задание начато")
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка старта задания"))
    }
  }

  const completeAssignment = async (assignmentId, lessonId) => {
    try {
      await api.post(`/assignments/${assignmentId}/complete`)
      setLessonAssignments((prev) => ({
        ...prev,
        [lessonId]: (prev[lessonId] || []).map((a) =>
          a.id === assignmentId ? { ...a, status: "completed" } : a
        ),
      }))
      toast.success("Задание завершено")
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка завершения задания"))
    }
  }

  const createAssignment = async (lessonId) => {
    if (!newAssignmentTitle.trim()) {
      toast.error("Введите название задания")
      return
    }

    try {
      const res = await api.post(`/lessons/${lessonId}/assignments`, {
        lesson_id: Number(lessonId), // ✅ важно: бэк ждёт lesson_id
        title: newAssignmentTitle,
        description: newAssignmentDescription || "—",
        assignment_type: "quiz",
        points_possible: 100,
        due_date: null,
        time_limit_minutes: null,
      })

      setLessonAssignments((prev) => ({
        ...prev,
        [lessonId]: [...(prev[lessonId] || []), res.data],
      }))

      setNewAssignmentTitle("")
      setNewAssignmentDescription("")
      setCreatingForLessonId(null)

      toast.success("Задание создано")
    } catch (err) {
      toast.error(errorMessage(err, "Ошибка создания задания"))
    }
  }

  if (loading) return <div>Загрузка...</div>
  if (!module) return <div>Модуль не найден</div>

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow rounded-xl mt-8">
      {editing ? (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border p-2 w-full mb-2"
            placeholder="Название модуля"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border p-2 w-full mb-4"
            rows={4}
            placeholder="Описание модуля"
          />
          <div className="flex space-x-2">
            <button
              onClick={saveModule}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Сохранить
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setTitle(module.title)
                setDescription(module.description || "")
              }}
              className="px-4 py-2 bg-gray-400 text-white rounded"
            >
              Отмена
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{module.title}</h2>
              {module.description && (
                <p className="text-gray-600 mt-2 whitespace-pre-line">
                  {module.description}
                </p>
              )}
            </div>
            {isAdmin() && (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1 bg-yellow-500 text-white rounded"
              >
                Редактировать
              </button>
            )}
          </div>

          {isAdmin() && (
            <div className="flex mb-4">
              <input
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                className="border p-2 flex-1 mr-2"
                placeholder="Название урока"
              />
              <button
                onClick={addLesson}
                className="px-4 py-2 bg-purple-600 text-white rounded"
              >
                Добавить урок
              </button>
            </div>
          )}

          <ul className="space-y-2">
            {module.lessons?.length > 0 ? (
              module.lessons.map((lesson) => (
                <li key={lesson.id} className="border p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span
                      onClick={() => toggleLesson(lesson.id)}
                      className="cursor-pointer font-medium"
                    >
                      {lesson.title}
                    </span>
                    {isAdmin() && (
                      <button
                        onClick={() => deleteLesson(lesson.id)}
                        className="text-red-600"
                      >
                        Удалить
                      </button>
                    )}
                  </div>

                  {expandedLesson === lesson.id && (
                    <div className="mt-2 pl-2">
                      {isAdmin() && (
                        <div className="mb-3">
                          {creatingForLessonId !== lesson.id ? (
                            <button
                              onClick={() => {
                                setCreatingForLessonId(lesson.id)
                                setNewAssignmentTitle("")
                                setNewAssignmentDescription("")
                              }}
                              className="px-3 py-1 bg-purple-600 text-white rounded"
                            >
                              + Добавить задание
                            </button>
                          ) : (
                            <div className="border rounded p-3 space-y-2">
                              <input
                                value={newAssignmentTitle}
                                onChange={(e) =>
                                  setNewAssignmentTitle(e.target.value)
                                }
                                className="border p-2 w-full rounded"
                                placeholder="Название задания"
                              />
                              <textarea
                                value={newAssignmentDescription}
                                onChange={(e) =>
                                  setNewAssignmentDescription(e.target.value)
                                }
                                className="border p-2 w-full rounded"
                                rows={3}
                                placeholder="Описание (опционально)"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => createAssignment(lesson.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded"
                                >
                                  Создать
                                </button>
                                <button
                                  onClick={() => setCreatingForLessonId(null)}
                                  className="px-3 py-1 bg-gray-400 text-white rounded"
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <ul className="space-y-1">
                        {(lessonAssignments[lesson.id] || []).length > 0 ? (
                          (lessonAssignments[lesson.id] || []).map((a) => (
                            <li
                              key={a.id}
                              className="flex justify-between items-center border p-2 rounded"
                            >
                              <button
                                onClick={() =>
                                  navigate(`/assignments/${a.id}`)
                                }
                                className="text-left hover:underline"
                              >
                                {a.title}
                              </button>

                              <div className="flex space-x-2">
                                {a.status !== "started" && (
                                  <button
                                    onClick={() =>
                                      startAssignment(a.id, lesson.id)
                                    }
                                    className="px-2 py-1 bg-green-500 text-white rounded"
                                  >
                                    Начать
                                  </button>
                                )}
                                {a.status === "started" && (
                                  <button
                                    onClick={() =>
                                      completeAssignment(a.id, lesson.id)
                                    }
                                    className="px-2 py-1 bg-blue-500 text-white rounded"
                                  >
                                    Завершить
                                  </button>
                                )}
                                {a.status === "completed" && (
                                  <span className="text-gray-500">Готово</span>
                                )}
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="text-gray-500">Заданий пока нет</li>
                        )}
                      </ul>
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="text-gray-500">Уроков пока нет</li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}

export default ModuleDetail
