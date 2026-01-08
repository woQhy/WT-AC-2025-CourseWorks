import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Home,
  BookOpen,
  FileText,
  Upload,
  Award,
  User,
  Settings,
  GraduationCap
} from 'lucide-react'

const Sidebar = () => {
  const { isAdmin } = useAuth()

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Дашборд' },
    { to: '/courses', icon: BookOpen, label: 'Курсы' },
    { to: '/assignments', icon: FileText, label: 'Задания' },
    { to: '/submissions', icon: Upload, label: 'Сдачи' },
    { to: '/grades', icon: Award, label: 'Оценки' },
    { to: '/profile', icon: User, label: 'Профиль' },
  ]

  if (isAdmin()) {
    navItems.push({ to: '/admin', icon: Settings, label: 'Админка' })
  }

  return (
    <aside className="w-64 bg-white border-r min-h-[calc(100vh-73px)]">
      <div className="p-4">
        <div className="mb-8">
          <div className="flex items-center space-x-3 p-3 bg-primary-50 rounded-lg">
            <GraduationCap className="w-8 h-8 text-primary-600" />
            <div>
              <h3 className="font-semibold">Прогресс</h3>
              <p className="text-sm text-gray-600">Продолжайте учиться!</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar