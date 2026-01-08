import { useAuth } from '../contexts/AuthContext'
import { Bell, LogOut, User } from 'lucide-react'
import { Link } from 'react-router-dom'

const Header = () => {
  const { user, logout } = useAuth()

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="text-2xl font-bold text-primary-600">
            Учись, не болей 🎓
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Bell className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-gray-500"> {user?.role === 'admin' || user?.role === 'teacher' ? 'Преподаватель' : 'Студент'}</p>
            </div>
            
            <Link
              to="/profile"
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <User className="w-5 h-5 text-gray-600" />
            </Link>
            
            <button
              onClick={logout}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Выйти"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header