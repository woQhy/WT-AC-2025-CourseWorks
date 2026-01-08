import api from './api'

export const courseService = {
  getAllCourses(params) {
    return api.get('/courses', { params })
  },
  
  getCourse(id) {
    return api.get(`/courses/${id}`)
  },
  
  createCourse(data) {
    return api.post('/courses', data)
  },
  
  enrollCourse(courseId) {
    return api.post(`/courses/${courseId}/enroll`)
  },
  
  getCourseProgress(courseId) {
    return api.get(`/progress/${courseId}`)
  },
  
  publishCourse(courseId) {
    return api.put(`/courses/${courseId}/publish`)
  }
}

export const moduleService = {
  createModule(courseId, data) {
    return api.post(`/courses/${courseId}/modules`, data)
  }
}

export const lessonService = {
  createLesson(moduleId, data) {
    return api.post(`/modules/${moduleId}/lessons`, data)
  },
  
  completeLesson(lessonId) {
    return api.post(`/lessons/${lessonId}/complete`)
  },
  
  getLesson(lessonId) {
    return api.get(`/lessons/${lessonId}`) // Нужно добавить эндпоинт в бэкенд
  }
}

export const assignmentService = {
  createAssignment(lessonId, data) {
    return api.post(`/lessons/${lessonId}/assignments`, data)
  },
  
  submitAssignment(assignmentId, data) {
    return api.post(`/assignments/${assignmentId}/submit`, data)
  },
  
  addQuizQuestions(assignmentId, data) {
    return api.post(`/assignments/${assignmentId}/quiz-questions`, data)
  }
}

export const submissionService = {
  getSubmissions(params) {
    return api.get('/submissions', { params }) // Нужно добавить эндпоинт в бэкенд
  }
}

export const gradeService = {
  getGrades(params) {
    return api.get('/grades', { params })
  },
  
  createGrade(data) {
    return api.post('/grades', data) // Нужно добавить эндпоинт в бэкенд
  }
}