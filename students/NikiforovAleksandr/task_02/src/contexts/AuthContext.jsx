// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null) // создаём контекст

// Правильный named export
export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/profile')
      const userData = response.data
      setUser({
        ...userData,
        role: userData.role === 'teacher' ? 'admin' : userData.role,
        role_in_db: userData.role === 'teacher' ? 'teacher' : userData.role
      })
    } catch (error) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await api.post('/login', { email, password })
      let { token, role } = response.data
      localStorage.setItem('token', token)
      localStorage.setItem('role', role)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      await fetchUser()
      toast.success('Вход выполнен успешно!')
      navigate('/dashboard')
      return true
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка входа')
      return false
    }
  }

  const register = async (userData) => {
    try {
      const dataToSend = {
        ...userData,
        role: userData.role === 'teacher' ? 'teacher' : 'user'
      }
      await api.post('/register', dataToSend)
      toast.success('Регистрация успешна! Войдите в систему.')
      navigate('/login')
      return true
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка регистрации')
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    navigate('/login')
    toast.success('Выход выполнен')
  }

  const isAdmin = () => user?.role === 'admin'
  const isTeacher = () => user?.role_in_db === 'teacher'

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin, isTeacher, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
