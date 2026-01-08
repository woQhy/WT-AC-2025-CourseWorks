import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import api from "../services/api"
import toast from "react-hot-toast"

const CourseDetail = () => {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [difficulty, setDifficulty] = useState("")

  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [editingModuleId, setEditingModuleId] = useState(null)
  const [editingModuleTitle, setEditingModuleTitle] = useState("")

  useEffect(() => {
    fetchCourse()
  }, [])

  const fetchCourse = async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}`)
      setCourse(data)
      setTitle(data.title)
      setDescription(data.description)
      setCategory(data.category)
      setDifficulty(data.difficulty_level)
    } catch {
      toast.error("Ошибка загрузки курса")
    } finally {
      setLoading(false)
    }
  }

  const saveCourseEdits = async () => {
    try {
      const { data } = await api.patch(`/courses/${courseId}`, {
        title,
        description,
        category,
        difficulty_level: difficulty,
      })
      setCourse(data)
      setEditing(false)
      toast.success("Курс обновлён")
    } catch {
      toast.error("Ошибка сохранения курса")
    }
  }

  const addModule = async () => {
    if (!newModuleTitle.trim()) return
    try {
      const { data } = await api.post(`/courses/${courseId}/modules`, {
        course_id: Number(courseId),
        title: newModuleTitle,
        order_index: 0,
      })
      setCourse(prev => ({
        ...prev,
        modules: [...prev.modules, data],
      }))
      setNewModuleTitle("")
      toast.success("Модуль добавлен")
    } catch {
      toast.error("Ошибка добавления модуля")
    }
  }

  const saveModuleEdit = async (moduleId) => {
    try {
      const { data } = await api.patch(
        `/courses/${courseId}/modules/${moduleId}`,
        { title: editingModuleTitle }
      )
      setCourse(prev => ({
        ...prev,
        modules: prev.modules.map(m =>
          m.id === moduleId ? data : m
        ),
      }))
      setEditingModuleId(null)
      setEditingModuleTitle("")
      toast.success("Модуль обновлён")
    } catch {
      toast.error("Ошибка обновления модуля")
    }
  }

  const deleteModule = async (moduleId) => {
    try {
      await api.delete(`/courses/${courseId}/modules/${moduleId}`)
      setCourse(prev => ({
        ...prev,
        modules: prev.modules.filter(m => m.id !== moduleId),
      }))
      toast.success("Модуль удалён")
    } catch {
      toast.error("Ошибка удаления модуля")
    }
  }

  if (loading) return <div>Загрузка...</div>
  if (!course) return <div>Курс не найден</div>

  const canEdit = isAdmin()

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow rounded-xl mt-8">
      {editing ? (
        <>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="border p-2 w-full mb-2"
            placeholder="Название курса"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="border p-2 w-full mb-2"
            placeholder="Описание"
          />
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border p-2 w-full mb-2"
            placeholder="Категория"
          />
          <input
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            className="border p-2 w-full mb-4"
            placeholder="Сложность"
          />
          <button
            onClick={saveCourseEdits}
            className="px-4 py-2 bg-blue-600 text-white rounded mr-2"
          >
            Сохранить
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 bg-gray-400 text-white rounded"
          >
            Отмена
          </button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-2">{course.title}</h1>

<p className="mb-4 text-gray-700">
  {course.description}
</p>

<div className="mb-4 text-sm text-gray-600 space-y-1">
  <div>
    <span className="font-medium">Категория:</span>{" "}
    {course.category || "—"}
  </div>
  <div>
    <span className="font-medium">Сложность:</span>{" "}
    {course.difficulty_level || "—"}
  </div>
  <div>
    <span className="font-medium">Статус:</span>{" "}
    {course.status === "draft" ? "Черновик" : "Опубликован"}
  </div>
</div>

          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-yellow-500 text-white rounded mb-4"
            >
              Редактировать курс
            </button>
          )}

          {canEdit && (
            <div className="flex mb-4">
              <input
                value={newModuleTitle}
                onChange={e => setNewModuleTitle(e.target.value)}
                className="border p-2 flex-1 mr-2"
                placeholder="Новый модуль"
              />
              <button
                onClick={addModule}
                className="px-4 py-2 bg-purple-600 text-white rounded"
              >
                Добавить
              </button>
            </div>
          )}

          <ul className="space-y-2">
            {course.modules.map(mod => (
              <li
                key={mod.id}
                className="border p-3 rounded flex justify-between items-center"
              >
                {editingModuleId === mod.id ? (
                  <>
                    <input
                      value={editingModuleTitle}
                      onChange={e => setEditingModuleTitle(e.target.value)}
                      className="border p-1 flex-1 mr-2"
                    />
                    <button
                      onClick={() => saveModuleEdit(mod.id)}
                      className="px-2 py-1 bg-green-600 text-white rounded mr-1"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setEditingModuleId(null)}
                      className="px-2 py-1 bg-gray-400 text-white rounded"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/modules/${mod.id}`)}
                    >
                      {mod.title}
                    </span>

                    {canEdit && (
                      <div className="space-x-2">
                        <button
                          onClick={() => {
                            setEditingModuleId(mod.id)
                            setEditingModuleTitle(mod.title)
                          }}
                          className="px-2 py-1 bg-yellow-500 text-white rounded"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => deleteModule(mod.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default CourseDetail
