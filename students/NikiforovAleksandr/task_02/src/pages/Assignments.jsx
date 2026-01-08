import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Search, FileText, Clock } from "lucide-react"
import api from "../services/api"
import { formatDate } from "../utils/formatDate"
import { useAuth } from "../contexts/AuthContext"

const Assignments = () => {
  const { isAdmin } = useAuth()

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")

  const { data: assignments = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["assignments", search, status, isAdmin()],
    queryFn: async () => {
      // teacher/admin -> assignments in teaching courses
      if (isAdmin()) {
        const res = await api.get("/teaching/assignments")
        const list = res.data || []
        if (!search.trim()) return list
        const s = search.toLowerCase()
        return list.filter((a) =>
          (a.title || "").toLowerCase().includes(s) ||
          (a.course_title || "").toLowerCase().includes(s) ||
          (a.lesson_title || "").toLowerCase().includes(s)
        )
      }

      // student -> my assignments (by enrollment)
      const params = {}
      if (status !== "all") params.status = status

      const res = await api.get("/users/me/assignments", { params })
      const list = res.data || []

      if (!search.trim()) return list
      const s = search.toLowerCase()
      return list.filter((a) =>
        (a.title || "").toLowerCase().includes(s) ||
        (a.course_title || "").toLowerCase().includes(s) ||
        (a.lesson_title || "").toLowerCase().includes(s)
      )
    },
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const statusLabel = (st) => {
    if (st === "pending") return "Ожидает сдачи"
    if (st === "submitted") return "Сдано"
    if (st === "graded") return "Оценено"
    if (st === "late") return "Просрочено"
    return st
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Ошибка загрузки заданий: {error?.response?.data?.detail || error?.message || "—"}
        </div>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded"
        >
          Повторить
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isAdmin() ? "Задания моих курсов" : "Задания"}
        </h1>
        <p className="mt-2 text-gray-600">
          {isAdmin()
            ? "Откройте задание, чтобы посмотреть сдачи и поставить оценку"
            : "Все ваши задания в одном месте"}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск заданий..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {!isAdmin() ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Все статусы</option>
              <option value="pending">Ожидает сдачи</option>
              <option value="submitted">Сдано</option>
              <option value="graded">Оценено</option>
            </select>
          ) : (
            <div className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 flex items-center">
              Фильтр статуса: не нужен преподавателю
            </div>
          )}

          <div className="flex items-center text-gray-600">
            <span className="text-sm">Найдено: {assignments.length}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Задания не найдены
            </h3>
            <p className="text-gray-600">
              {isAdmin()
                ? "Создайте задания в уроках или выберите другой курс"
                : "Попробуйте изменить фильтры"}
            </p>
          </div>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {a.assignment_type}
                    </span>

                    {!isAdmin() && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        {statusLabel(a.status)}
                      </span>
                    )}

                    {a.due_date && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDate(a.due_date)}
                      </span>
                    )}

                    {isAdmin() && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Сдано на проверку: {a.submitted_count || 0}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {a.title}
                  </h3>
                  <p className="text-gray-600">
                    {a.course_title} • {a.lesson_title}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">
                    {a.points_possible}
                  </div>
                  <div className="text-sm text-gray-500">баллов</div>
                </div>
              </div>

              <div className="flex items-center justify-end mt-6">
                <Link
                  to={`/assignments/${a.id}`}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Открыть
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Assignments
