import { useQuery } from "@tanstack/react-query"
import { Award, TrendingUp, BarChart3 } from "lucide-react"
import ProgressBar from "../components/ProgressBar"
import api from "../services/api"
import { useAuth } from "../contexts/AuthContext"

const safeErr = (error) => {
  const detail = error?.response?.data?.detail
  if (!detail) return error?.message || "Ошибка"
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join(", ") || "Ошибка"
  if (typeof detail === "string") return detail
  return JSON.stringify(detail)
}

const Grades = () => {
  const { isAdmin } = useAuth()

  // Вкладка оценок только для студентов
  if (isAdmin()) {
    return (
      <div className="p-6 w-full">
        <div className="bg-white border rounded-xl p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Оценки</h1>
          <p className="text-gray-600">
            Эта вкладка предназначена для студентов (история оценок).
            Преподаватель выставляет оценки на странице конкретного задания.
          </p>
        </div>
      </div>
    )
  }

  const { data: grades = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["grades-detailed"],
    queryFn: async () => {
      const response = await api.get("/grades/detailed")
      return response.data || []
    },
    retry: 1,
  })

  const calculateStats = () => {
    if (!grades || grades.length === 0) {
      return { average: 0, highest: 0, total: 0 }
    }

    const total = grades.reduce((sum, grade) => sum + (grade.percentage || 0), 0)
    const highest = Math.max(...grades.map((g) => g.percentage || 0))
    const average = total / grades.length

    return { average, highest, total: grades.length }
  }

  const stats = calculateStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Ошибка загрузки оценок: {safeErr(error)}
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
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Оценки</h1>
        <p className="mt-2 text-gray-600">Ваши оценки по всем курсам и заданиям</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Средний балл</p>
              <p className="text-2xl font-bold text-gray-900">{stats.average.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg mr-4">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Лучший результат</p>
              <p className="text-2xl font-bold text-gray-900">{stats.highest.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg mr-4">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Всего оценок</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Список оценок */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Детализация оценок</h2>
        </div>

        {grades.length === 0 ? (
          <div className="text-center py-12">
            <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Оценок пока нет</h3>
            <p className="text-gray-600">Выполняйте задания и получайте первые оценки!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Задание
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Курс
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Баллы
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Процент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Прогресс
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {grades.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50 align-top">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {g.assignment_title || `Задание #${g.assignment_id}`}
                      </div>
                      {g.feedback ? (
                        <div className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                          {g.feedback}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {g.course_title || `Курс #${g.course_id}`}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">
                        {g.points_earned}/{g.points_possible}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">
                        {(g.percentage ?? 0).toFixed(1)}%
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="w-32">
                        <ProgressBar percentage={g.percentage ?? 0} showPercentage={false} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Grades
