import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import api from "../services/api"
import toast from "react-hot-toast"
import { formatDate } from "../utils/formatDate"
import { useAuth } from "../contexts/AuthContext"

const AssignmentDetail = () => {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // teacher block
  const [submissions, setSubmissions] = useState([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [gradeInputs, setGradeInputs] = useState({}) // { submissionId: { points, feedback } }
  const [gradingId, setGradingId] = useState(null)

  const fetchAssignment = async () => {
    try {
      const res = await api.get(`/assignments/${assignmentId}`)
      setAssignment(res.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || "Не удалось загрузить задание")
      setAssignment(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubmissions = async () => {
    if (!isAdmin()) return
    setSubsLoading(true)
    try {
      const res = await api.get(`/assignments/${assignmentId}/submissions`)
      setSubmissions(res.data || [])

      // заполнить инпуты текущими значениями (если уже оценено)
      const initial = {}
      for (const s of res.data || []) {
        initial[s.id] = {
          points: s.points_earned ?? "",
          feedback: s.feedback ?? "",
        }
      }
      setGradeInputs(initial)
    } catch (e) {
      toast.error(e.response?.data?.detail || "Не удалось загрузить сдачи")
    } finally {
      setSubsLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  useEffect(() => {
    fetchSubmissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])
  

  const start = async () => {
    try {
      setStarting(true)
      await api.post(`/assignments/${assignmentId}/start`)
      toast.success("Задание начато")
      await fetchAssignment()
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка старта задания")
    } finally {
      setStarting(false)
    }
  }

  const submit = async () => {
    try {
      setSubmitting(true)
      await api.post(`/assignments/${assignmentId}/submit-simple`)
      toast.success("Задание сдано")
      await fetchAssignment()
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка сдачи задания")
    } finally {
      setSubmitting(false)
    }
  }

  const resetMySubmission = async () => {
  try {
    await api.delete(`/assignments/${assignmentId}/my-submission`)
    toast.success("Ваша сдача удалена")
    await fetchAssignment()   // обновим статус задания
    await fetchSubmissions()  // обновим список сдач студентов
  } catch (e) {
    toast.error(e.response?.data?.detail || "Ошибка удаления сдачи")
  }
}


  const setInput = (submissionId, key, value) => {
    setGradeInputs((prev) => ({
      ...prev,
      [submissionId]: {
        ...(prev[submissionId] || { points: "", feedback: "" }),
        [key]: value,
      },
    }))
  }

  const grade = async (submissionId) => {
    const pointsRaw = gradeInputs[submissionId]?.points
    const feedback = gradeInputs[submissionId]?.feedback || null

    const points = Number(pointsRaw)
    if (Number.isNaN(points) || points < 0 || points > 100) {
      toast.error("Баллы должны быть числом 0–100")
      return
    }

    try {
      setGradingId(submissionId)
      await api.post(`/submissions/${submissionId}/grade`, {
        points_earned: points,
        feedback,
      })
      toast.success("Оценка сохранена")
      await fetchSubmissions()
      // студент увидит это в /grades и в списке заданий как graded
    } catch (e) {
      toast.error(e.response?.data?.detail || "Ошибка выставления оценки")
    } finally {
      setGradingId(null)
    }
  }

  if (loading) return <div className="p-6">Загрузка...</div>
  if (!assignment) return <div className="p-6">Задание не найдено</div>

  const status = assignment.submission?.status || "pending"

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow rounded-xl mt-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">{assignment.title}</h1>

        <button
          onClick={() => navigate("/assignments")}
          className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
        >
          ← К заданиям
        </button>
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-6">
        <div>
          <span className="font-medium">Статус:</span>{" "}
          {status === "pending"
            ? "Ожидает сдачи"
            : status === "submitted"
            ? "Сдано"
            : status === "graded"
            ? "Оценено"
            : status}
        </div>

        {assignment.due_date && (
          <div>
            <span className="font-medium">Дедлайн:</span>{" "}
            {formatDate(assignment.due_date)}
          </div>
        )}

        {assignment.points_possible != null && (
          <div>
            <span className="font-medium">Баллы:</span> {assignment.points_possible}
          </div>
        )}

        {assignment.submission?.status === "graded" && (
          <div>
            <span className="font-medium">Результат:</span>{" "}
            {assignment.submission?.status === "graded" ? "Есть оценка (смотри вкладку «Оценки»)" : ""}
          </div>
        )}
      </div>

      <p className="text-gray-700 whitespace-pre-line mb-6">
        {assignment.description || "—"}
      </p>
      
      {isAdmin() && assignment.submission && (
  <div className="mb-8">
    <button
      onClick={resetMySubmission}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Удалить мою сдачу
    </button>
    <div className="text-sm text-gray-500 mt-2">
      Используйте, если вы случайно нажали «Начать/Сдать» под аккаунтом преподавателя
    </div>
  </div>
)}

      {/* Student actions */}
      {!isAdmin() && (
        <div className="flex flex-wrap gap-2 mb-10">
          {status === "pending" && (
            <>
              <button
                onClick={start}
                disabled={starting || submitting}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
              >
                {starting ? "Запускаю..." : "Начать"}
              </button>

              <button
                onClick={submit}
                disabled={starting || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
              >
                {submitting ? "Сдаю..." : "Сдать"}
              </button>
            </>
          )}

          {status === "submitted" && (
            <span className="px-3 py-2 bg-gray-100 rounded text-gray-700">
              Сдано ✅ (ждёт проверки)
            </span>
          )}

          {status === "graded" && (
            <span className="px-3 py-2 bg-green-100 rounded text-green-800">
              Оценено ✅ (см. вкладку «Оценки»)
            </span>
          )}
        </div>
      )}

      {/* Teacher grading block */}
      {isAdmin() && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Сдачи студентов</h2>
            <button
              onClick={fetchSubmissions}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
              disabled={subsLoading}
            >
              {subsLoading ? "Обновляю..." : "Обновить"}
            </button>
          </div>

          {subsLoading ? (
            <div>Загрузка сдач...</div>
          ) : submissions.length === 0 ? (
            <div className="text-gray-500">Сдач пока нет</div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="border rounded p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {s.user_name} <span className="text-gray-500">({s.user_email})</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Статус: <span className="font-medium">{s.status}</span>
                        {s.submitted_at ? ` • Сдано: ${s.submitted_at}` : ""}
                        {s.graded_at ? ` • Оценено: ${s.graded_at}` : ""}
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <input
                        value={gradeInputs[s.id]?.points ?? ""}
                        onChange={(e) => setInput(s.id, "points", e.target.value)}
                        className="border p-2 rounded w-24"
                        placeholder="0-100"
                      />
                      <button
                        onClick={() => grade(s.id)}
                        disabled={gradingId === s.id}
                        className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-60"
                      >
                        {gradingId === s.id ? "Сохраняю..." : "Оценить"}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={gradeInputs[s.id]?.feedback ?? ""}
                    onChange={(e) => setInput(s.id, "feedback", e.target.value)}
                    className="border p-2 rounded w-full mt-3"
                    rows={3}
                    placeholder="Комментарий (опционально)"
                  />
                  {s.percentage != null && (
                    <div className="text-sm text-gray-600 mt-2">
                      Текущая оценка: <span className="font-medium">{s.points_earned}/{s.points_possible}</span>{" "}
                      ({Number(s.percentage).toFixed(1)}%)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AssignmentDetail
