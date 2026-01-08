import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import api from "../services/api"
import { formatDate } from "../utils/formatDate"
import { BookOpen, Award, BarChart3, Clock, Calendar } from "lucide-react"

const Dashboard = () => {
  const { user, isAdmin } = useAuth()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-data", isAdmin()],
    queryFn: async () => {
      const [coursesRes, gradesRes, assignmentsRes] = await Promise.all([
        api.get("/courses"),
        api.get("/grades"),
        isAdmin() ? api.get("/teaching/assignments") : api.get("/users/me/assignments"),
      ])

      return {
        courses: coursesRes.data || [],
        grades: gradesRes.data || [],
        assignments: assignmentsRes.data || [],
      }
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

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-white border rounded-xl p-6 text-gray-700">
          Не удалось загрузить данные Dashboard. Проверь backend.
        </div>
      </div>
    )
  }

  const courses = data?.courses || []
  const grades = data?.grades || []
  const assignments = data?.assignments || []

  const avgGrade =
    grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / grades.length
      : 0

  const gradedCount = grades.length

  // Берём ближайшие задания: сначала с дедлайном, сортируем по due_date
  const withDue = assignments
    .filter((a) => a.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))

  const withoutDue = assignments.filter((a) => !a.due_date)

  // Для студента показываем те, что ещё не оценены (pending/submitted)
  const filteredForStudent = isAdmin()
    ? assignments
    : assignments.filter((a) => a.status !== "graded")

  const upcomingAssignments = [
    ...withDue.filter((a) => filteredForStudent.some((x) => x.id === a.id)),
    ...withoutDue.filter((a) => filteredForStudent.some((x) => x.id === a.id)),
  ].slice(0, 6)

  const statCards = [
    {
      title: "Курсы",
      value: courses.length,
      icon: BookOpen,
      color: "bg-blue-500",
      subtitle: isAdmin() ? "Все доступные курсы" : "Доступные курсы",
    },
    {
      title: "Средний процент",
      value: `${avgGrade.toFixed(1)}%`,
      icon: Award,
      color: "bg-green-500",
      subtitle: "По полученным оценкам",
    },
    {
      title: "Оценок получено",
      value: gradedCount,
      icon: BarChart3,
      color: "bg-purple-500",
      subtitle: "Всего оценок",
    },
    {
      title: "Заданий",
      value: assignments.length,
      icon: Clock,
      color: "bg-orange-500",
      subtitle: isAdmin() ? "В моих курсах" : "Мои задания",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Добро пожаловать, {user?.name}! 👋
        </h1>
        <p className="mt-2 text-gray-600">
          {isAdmin()
            ? "Проверяйте сдачи и оценивайте студентов"
            : "Продолжайте обучение и выполняйте задания"}
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className="bg-white rounded-xl shadow-sm border p-6 card-hover"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.subtitle}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ближайшие задания */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isAdmin() ? "Задания в моих курсах" : "Ближайшие задания"}
          </h2>

          <Link
            to="/assignments"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Посмотреть все →
          </Link>
        </div>

        {upcomingAssignments.length === 0 ? (
          <div className="text-gray-600">
            {isAdmin()
              ? "Пока нет заданий в ваших курсах."
              : "Пока нет заданий для выполнения."}
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{a.title}</h3>
                  <p className="text-sm text-gray-600">
                    {a.course_title ? a.course_title : ""}
                    {a.lesson_title ? ` • ${a.lesson_title}` : ""}
                    {isAdmin() && typeof a.submitted_count !== "undefined"
                      ? ` • Сдано на проверку: ${a.submitted_count}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span className="text-sm">
                      {a.due_date ? formatDate(a.due_date) : "без дедлайна"}
                    </span>
                  </div>

                  <Link
                    to={`/assignments/${a.id}`}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    Открыть
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
