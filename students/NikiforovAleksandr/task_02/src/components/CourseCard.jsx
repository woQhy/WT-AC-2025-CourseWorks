import { Link } from 'react-router-dom'
import { BookOpen, Users, Star, Clock } from 'lucide-react'

const CourseCard = ({ course, onEnroll }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            course.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {course.status === 'published' ? 'Опубликован' : 'Черновик'}
          </span>
          <div className="flex items-center">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="ml-1 text-sm font-medium">{course.rating_avg?.toFixed(1) || '0.0'}</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">{course.title}</h3>
        <p className="text-gray-600 mb-4 line-clamp-2">{course.description}</p>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
          <div className="flex items-center">
            <BookOpen className="w-4 h-4 mr-1" />
            <span>{course.category || 'Общий'}</span>
          </div>
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            <span>{course.enrolled_count || 0} студентов</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link
            to={`/courses/${course.id}`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Подробнее
          </Link>
          
          {course.status === 'published' && onEnroll && (
            <button
              onClick={() => onEnroll(course.id)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              Записаться
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CourseCard