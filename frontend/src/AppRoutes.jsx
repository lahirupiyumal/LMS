import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Materials from './pages/materials/Materials';
import ProtectedRoute from './components/layout/ProtectedRoute';
import useAuth from './hooks/useAuth';
import QuizAttempt from './components/quizzes/QuizAttempt';
import QuizCard from './components/quizzes/QuizCard';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/quiz/:id/quits"
        element={
          <ProtectedRoute>
            <QuizCard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-summary"
        element={
          <ProtectedRoute>
            <QuizAttempt />
          </ProtectedRoute>
        }
      />
      <Route path="/quizes" element={<Navigate to="/add-summary" replace />} />
      <Route path="/quizzes" element={<Navigate to="/add-summary" replace />} />
      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <Materials />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
