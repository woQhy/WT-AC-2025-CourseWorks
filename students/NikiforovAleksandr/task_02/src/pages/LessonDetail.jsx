import { useParams } from 'react-router-dom'

const LessonDetail = () => {
  const { lessonId } = useParams()
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Урок #{lessonId}</h1>
      <p className="mt-2 text-gray-600">Страница урока в разработке...</p>
    </div>
  )
}

export default LessonDetail