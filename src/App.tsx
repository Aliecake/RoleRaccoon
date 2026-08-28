import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import ApplicationsDashboard from '@/pages/ApplicationsDashboard';
import ApplicationDetail from '@/pages/ApplicationDetail';
import ApplicationFormPage from '@/pages/ApplicationFormPage';
import StoriesDashboard from '@/pages/StoriesDashboard';
import StarStoryFormPage from '@/pages/StarStoryFormPage';
import StarStoryDetail from '@/pages/StarStoryDetail';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ApplicationsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/new"
            element={
              <ProtectedRoute>
                <ApplicationFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ProtectedRoute>
                <ApplicationDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stories"
            element={
              <ProtectedRoute>
                <StoriesDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stories/new"
            element={
              <ProtectedRoute>
                <StarStoryFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stories/:id"
            element={
              <ProtectedRoute>
                <StarStoryDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
