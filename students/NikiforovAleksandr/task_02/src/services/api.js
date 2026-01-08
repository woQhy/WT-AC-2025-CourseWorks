import axios from "axios"

// Базовый экземпляр axios
const api = axios.create({
  baseURL: "http://localhost:8000", // твой бэкенд
  headers: {
    "Content-Type": "application/json",
  },
})

// Интерцептор для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Интерцептор для глобальной обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("role")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export const addLesson = (moduleId, title) =>
  api.post(`/modules/${moduleId}/lessons`, { title })


export default api
