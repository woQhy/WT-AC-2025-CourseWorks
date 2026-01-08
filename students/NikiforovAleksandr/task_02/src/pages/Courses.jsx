import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Search, BookOpen } from "lucide-react"
import api from "../services/api"
import { useAuth } from "../contexts/AuthContext"

const safeErr = (error) => {
  const detail = error?.response?.data?.detail
  if (!detail) return error?.message || "Ошибка"
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join(", ") || "Ошибка"
  if (typeof detail === "string") return detail
  return JSON.stringify(detail)
}

const prettyDifficulty = (val) => {
  if (!val) return null
  const v = String(val).toLowerCase()
  if (v === "beginner" || v === "easy" || v === "легкий") return "Начальный"
  if (v === "intermediate" || v === "medium" || v === "средний") return "Средний"
  if (v === "advanced" || v === "hard" || v === "сложный") return "Продвинутый"
  return val
}

const Courses = () => {
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState("")

  const {
    data: courses = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await api.get("/courses")
      return res.data || []
    },
    retry: 1,
  })

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return courses
    return courses.filter((c) => {
      const hay = [
        c.title,
        c.description,
        c.category,
        c.difficulty_level,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(s)
    })
  }, [courses, search])

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
          Ошибка загрузки курсов: {safeErr(error)}
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Курсы</h1>
          <p className="mt-2 text-gray-600">Список доступных курсов</p>
        </div>

        {isAdmin() && (
          <Link
            to="/courses/create"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            + Создать курс
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск курсов (название, категория, сложность)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="text-gray-600 text-sm md:text-right">
            Найдено: {filtered.length}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Курсы не найдены</h3>
          <p className="text-gray-600">
            {courses.length === 0 ? "Пока нет доступных курсов." : "Попробуйте изменить поиск."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((course) => {
            const difficulty = prettyDifficulty(course.difficulty_level)
            const category = course.category

            return (
              <div key={course.id} className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {category ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {category}
                        </span>
                      ) : null}

                      {difficulty ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          {difficulty}
                        </span>
                      ) : null}

                      {typeof course.is_published !== "undefined" ? (
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                          {course.is_published ? "Опубликован" : "Черновик"}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 break-words">
                      {course.title}
                    </h3>

                    {course.description ? (
                      <p className="text-gray-600 mt-2 whitespace-pre-line">
                        {course.description}
                      </p>
                    ) : (
                      <p className="text-gray-500 mt-2">—</p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <Link
                      to={`/courses/${course.id}`}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                    >
                      Открыть
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Courses
