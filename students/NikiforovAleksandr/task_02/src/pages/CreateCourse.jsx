import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import api from "../services/api"
import toast from "react-hot-toast"

const CreateCourse = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    difficulty_level: "beginner",
    is_public: false,
    status: "draft", // курс создается как черновик
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      toast.error("Только преподаватели могут создавать курсы")
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) throw new Error("Нет токена авторизации")

      // Создание курса
      const response = await api.post("/courses", formData, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Редирект на страницу редактирования / просмотра курса
      navigate(`/courses/${response.data.id}`)
      toast.success("Курс создан! Он пока в черновике.")
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.detail || "Ошибка при создании курса")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-lg rounded-xl mt-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Создать новый курс</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block mb-2 font-medium text-gray-700">Название курса</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Введите название курса"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-700">Описание</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Кратко опишите курс"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-700">Категория</label>
          <input
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="Программирование, Дизайн, ..."
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-700">Сложность</label>
          <select
            name="difficulty_level"
            value={formData.difficulty_level}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="beginner">Начальный</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            name="is_public"
            checked={formData.is_public}
            onChange={handleChange}
            className="w-5 h-5 text-blue-600 rounded"
          />
          <label className="text-gray-700 font-medium">Сделать курс публичным</label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? "Создание..." : "Создать курс"}
        </button>
      </form>
    </div>
  )
}

export default CreateCourse
