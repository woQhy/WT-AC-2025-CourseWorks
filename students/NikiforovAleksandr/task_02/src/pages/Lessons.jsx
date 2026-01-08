import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import api from "../services/api"
import { useAuth } from "../contexts/AuthContext"
import toast from "react-hot-toast"

const Lessons = () => {
  const { lessonId } = useParams()
  const { isAdmin } = useAuth()

  const [lesson, setLesson] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLesson()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchLesson = async () => {
    setLoading(true)
    try {
      const resLesson = await api.get(`/lessons/${lessonId}`)
      setLesson(resLesson.data)

      const resAssignments = await api.get(`/lessons/${lessonId}/assignments`)
      setAssignments(resAssignments.data)
    } catch (err) {
      console.error(err)
      toast.error("Ошибка загрузки урока или заданий")
    } finally {
      setLoading(false)
    }
  }

  const startAssignment = async (assignmentId) => {
    try {
      await api.post(`/assignments/${assignmentId}/start`)
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId ? { ...a, status: "started" } : a
        )
      )
      toast.success("Задание начато")
    } catch {
      toast.error("Ошибка старта задания")
    }
  }

  const completeAssignment = async (assignmentId) => {
    try {
      await api.post(`/assignments/${assignmentId}/complete`)
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId ? { ...a, status: "completed" } : a
        )
      )
      toast.success("Задание завершено")
    } catch {
      toast.error("Ошибка завершения задания")
    }
  }

  if (loading) return <div>Загрузка...</div>
  if (!lesson) return <div>Урок не найден</div>

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow rounded-xl mt-8">
      <h2 className="text-2xl font-bold mb-4">{lesson.title}</h2>
      {lesson.content && (
        <p className="text-gray-600 mb-6 whitespace-pre-line">{lesson.content}</p>
      )}

      <h3 className="text-xl font-semibold mb-2">Задания</h3>
      {assignments.length > 0 ? (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex justify-between items-center border p-3 rounded"
            >
              <span>{a.title}</span>
              <div className="flex space-x-2">
                {a.status !== "started" && a.status !== "completed" && (
                  <button
                    onClick={() => startAssignment(a.id)}
                    className="px-3 py-1 bg-green-500 text-white rounded"
                  >
                    Начать
                  </button>
                )}
                {a.status === "started" && (
                  <button
                    onClick={() => completeAssignment(a.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                  >
                    Завершить
                  </button>
                )}
                {a.status === "completed" && (
                  <span className="text-gray-500">Готово</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">Заданий пока нет</p>
      )}
    </div>
  )
}

export default Lessons
