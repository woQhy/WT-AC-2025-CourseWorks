import { useQuery } from "@tanstack/react-query"
import {
  User,
  Mail,
  Calendar,
  Award,
  BookOpen,
  FileCheck2,
  BarChart3,
  TrendingUp,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import api from "../services/api"
import { formatDate } from "../utils/formatDate"

const safeErr = (error) => {
  const detail = error?.response?.data?.detail
  if (!detail) return error?.message || "Ошибка"
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join(", ") || "Ошибка"
  if (typeof detail === "string") return detail
  return JSON.stringify(detail)
}

const StatCard = ({ title, value, subtitle, Icon, colorClass }) => (
  <div className="bg-white rounded-xl shadow-sm border p-6 card-hover">
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      <div className={`${colorClass} p-3 rounded-lg shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
)

const Profile = () => {
  const { user, loading, isAdmin, isTeacher } = useAuth()
  const isStudent = !isAdmin() && !isTeacher()

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => {
      const res = await api.get("/profile/stats")
      return res.data
    },
    enabled: !!user && isStudent,
    retry: 1,
  })

  if (loading) {
    return (
      <div className="p-6 w-full">
        <div className="bg-white border rounded-xl p-6">Загрузка...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 w-full">
        <div className="bg-white border rounded-xl p-6 text-gray-700">
          Профиль не загружен. Перезайдите в аккаунт.
        </div>
      </div>
    )
  }

  const roleLabel = isAdmin()
    ? "Преподаватель/Админ"
    : isTeacher()
    ? "Преподаватель"
    : "Студент"

  const progressValue = stats ? `${stats.progress_percent ?? 0}%` : "0%"
  const avgGradeValue = stats ? `${stats.average_grade_percent ?? 0}%` : "0%"

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Профиль</h1>
          <p className="mt-2 text-gray-600">Ваши данные и статистика обучения</p>
        </div>

        {isStudent ? (
          <button
            onClick={() => refetchStats()}
            className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm"
            disabled={statsLoading}
          >
            {statsLoading ? "Обновляю..." : "Обновить статистику"}
          </button>
        ) : null}
      </div>

      {/* Статистика (как в Dashboard) */}
      {isStudent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Статистика обучения</h2>
          </div>

          {statsLoading ? (
            <div className="bg-white border rounded-xl p-6 text-gray-600">Загрузка статистики...</div>
          ) : statsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              Ошибка статистики: {safeErr(statsErr)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Активные курсы"
                value={stats?.active_courses ?? 0}
                subtitle="Курсы, где вы записаны"
                Icon={BookOpen}
                colorClass="bg-blue-500"
              />
              <StatCard
                title="Сданные работы"
                value={stats?.submitted_works ?? 0}
                subtitle="Submitted / graded / late"
                Icon={FileCheck2}
                colorClass="bg-green-500"
              />
              <StatCard
                title="Прогресс"
                value={progressValue}
                subtitle={`из ${stats?.total_assignments ?? 0} заданий`}
                Icon={BarChart3}
                colorClass="bg-purple-500"
              />
              <StatCard
                title="Средняя оценка"
                value={avgGradeValue}
                subtitle="По всем оценённым работам"
                Icon={TrendingUp}
                colorClass="bg-orange-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Основная информация */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Основная информация</h2>

        <div className="space-y-4">
          <div className="flex items-center p-2">
            <User className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm text-gray-500">Имя</div>
              <div className="text-gray-900 font-medium">{user.name || "—"}</div>
            </div>
          </div>

          <div className="flex items-center p-2">
            <Mail className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="text-gray-900 font-medium">{user.email || "—"}</div>
            </div>
          </div>

          <div className="flex items-center p-2">
            <Calendar className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm text-gray-500">Дата регистрации</div>
              <div className="text-gray-900 font-medium">
                {user.created_at ? formatDate(user.created_at) : "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center p-2">
            <Award className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <div className="text-sm text-gray-500">Роль</div>
              <span className="inline-block mt-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
