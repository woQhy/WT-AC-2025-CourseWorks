import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import toast from "react-hot-toast"
import { useAuth } from "../contexts/AuthContext"
import { formatDate } from "../utils/formatDate"

const statusLabel = (s) => {
  if (s === "submitted") return "Сдано"
  if (s === "graded") return "Оценено"
  if (s === "late") return "Сдано с опозданием"
  if (s === "pending") return "Ожидает сдачи"
  return s
}

const safeErr = (error) => {
  const detail = error?.response?.data?.detail
  if (!detail) return error?.message || "Ошибка"
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join(", ") || "Ошибка"
  if (typeof detail === "string") return detail
  return JSON.stringify(detail)
}

const Submissions = () => {
  const { isAdmin, user } = useAuth()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all") // all | submitted | graded | late

  const fetchData = async () => {
    setLoading(true)
    try {
      if (isAdmin()) {
        // teacher/admin
        const params = {}
        if (filter !== "all") params.status = filter
        const res = await api.get("/teaching/submissions", { params })
        setItems(res.data || [])
      } else {
        // student
        const res = await api.get("/my/submissions")
        const list = res.data || []
        setItems(filter === "all" ? list : list.filter((x) => x.submission_status === filter))
      }
    } catch (e) {
      toast.error(safeErr(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const filtered = useMemo(() => items, [items])

  return (
    <div className="p-6 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Сдачи</h1>
          <p className="text-gray-600 mt-1">
            {isAdmin()
              ? "Сдачи студентов по вашим курсам"
              : "Ваши реальные сданные работы и оценки"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Все</option>
            <option value="submitted">Сдано</option>
            <option value="graded">Оценено</option>
            <option value="late">С опозданием</option>
          </select>

          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={loading}
          >
            {loading ? "Обновляю..." : "Обновить"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl p-6">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-6 text-gray-600">
          Пока нет сдач по выбранному фильтру.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Студент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Задание
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Курс
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Оценка
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Даты
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((x) => {
                  const studentName = isAdmin() ? x.student_name : (user?.name || "—")
                  const studentEmail = isAdmin() ? x.student_email : (user?.email || "")
                  return (
                    <tr key={x.submission_id} className="hover:bg-gray-50 align-top">
                      {/* Student */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{studentName || "—"}</div>
                        <div className="text-sm text-gray-500">{studentEmail || ""}</div>
                      </td>

                      {/* Assignment */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{x.assignment_title}</div>
                        <div className="text-sm text-gray-500">
                          {x.lesson_title ? `Урок: ${x.lesson_title}` : ""}
                        </div>
                      </td>

                      {/* Course */}
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{x.course_title}</div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-sm rounded bg-gray-100 text-gray-800">
                          {statusLabel(x.submission_status)}
                        </span>
                      </td>

                      {/* Grade */}
                      <td className="px-6 py-4">
                        {x.submission_status === "graded" ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {x.points_earned}/{x.points_possible}{" "}
                              {x.percentage != null ? `(${Number(x.percentage).toFixed(1)}%)` : ""}
                            </div>
                            {x.feedback ? (
                              <div className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                                {x.feedback}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-gray-500">—</div>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{x.submitted_at ? `Сдано: ${formatDate(x.submitted_at)}` : "—"}</div>
                        <div>{x.graded_at ? `Оценено: ${formatDate(x.graded_at)}` : ""}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Submissions
