import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import {
  Users,
  BookOpen,
  TrendingUp,
  BarChart3,
  Activity,
  Download
} from 'lucide-react'
import api from '../services/api'

const Admin = () => {
  const { isAdmin } = useAuth()

  // Получаем статистику с сервера
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      try {
        const response = await api.get('/admin/stats')
        return response.data
      } catch (error) {
        console.error('Error fetching admin stats:', error)
        return {
          total_users: 0,
          total_courses: 0,
          total_enrollments: 0,
          total_submissions: 0,
          avg_progress: 0,
          courses: [],
          progressRanges: []
        }
      }
    }
  })

  if (!isAdmin()) {
    return <Navigate to="/dashboard" />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Пользователи',
      value: stats.total_users,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Курсы',
      value: stats.total_courses,
      icon: BookOpen,
      color: 'bg-green-500'
    },
    {
      title: 'Записи',
      value: stats.total_enrollments,
      icon: TrendingUp,
      color: 'bg-purple-500'
    },
    {
      title: 'Сдачи',
      value: stats.total_submissions,
      icon: BarChart3,
      color: 'bg-orange-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Административная панель</h1>
        <p className="mt-2 text-gray-600">
          Управление платформой и мониторинг статистики
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Последняя активность */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Последняя активность</h2>
          <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            <Download className="w-4 h-4 inline mr-1" />
            Экспорт
          </button>
        </div>
        <div className="space-y-4">
          {stats.recentActivities?.map((activity, index) => (
            <div key={index} className="flex items-center p-3 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                <Activity className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.user}</span> {activity.action}
                </p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Графики */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Статистика платформы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Прогресс пользователей */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Прогресс пользователей</h3>
            <div className="space-y-3">
              {stats.progressRanges?.map((range, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">{range.label}</span>
                    <span className="text-sm font-medium">{range.percentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${range.color} rounded-full`}
                      style={{ width: `${range.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Распределение по курсам */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Распределение по курсам</h3>
            <div className="space-y-3">
              {stats.courses?.map((course) => (
                <div key={course.title} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{course.title}</span>
                  <span className="text-sm font-medium">{course.students} чел.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin
