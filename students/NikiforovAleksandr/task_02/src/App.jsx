import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import ModuleDetail from './pages/ModuleDetail'
import LessonDetail from './pages/LessonDetail'
import Assignments from './pages/Assignments'
import Submissions from './pages/Submissions'
import Grades from './pages/Grades'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import CreateCourse from './pages/CreateCourse' 
import AssignmentDetail from './pages/AssignmentDetail'


function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:courseId" element={<CourseDetail />} />
            <Route path="courses/:courseId/modules/:moduleId" element={<ModuleDetail />} />
            <Route path="lessons/:lessonId" element={<LessonDetail />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="assignments/:assignmentId" element={<AssignmentDetail />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="grades" element={<Grades />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<Admin />} />
            <Route path="courses/new" element={<PrivateRoute><CreateCourse /></PrivateRoute>} />
            <Route path="modules/:moduleId" element={<ModuleDetail />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
