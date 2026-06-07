import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/Login';
import OnboardingScreen from './screens/Onboarding';
import HomeScreen from './screens/Home';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, profile, initError } = useAuth();

  if (initError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#FFF8F0] p-6 text-center">
        <div className="text-secondary font-nunito text-lg font-semibold mb-2">
          ¡Ay maje! Algo salió mal al iniciar:
        </div>
        <div className="bg-white border border-secondary/20 p-4 rounded-xl font-mono text-xs text-red-600 max-w-md break-all">
          {initError}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FFF8F0]">
        <div className="text-[#F25C8A] font-nunito text-lg font-semibold animate-pulse">
          Cargando, maje...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if display name is still 'Maje'
  if (profile && profile.display_name === 'Maje' && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

// Public Route Guard (prevents logged in users from seeing login screen)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, initError } = useAuth();

  if (initError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#FFF8F0] p-6 text-center">
        <div className="text-secondary font-nunito text-lg font-semibold mb-2">
          ¡Ay maje! Algo salió mal al iniciar:
        </div>
        <div className="bg-white border border-secondary/20 p-4 rounded-xl font-mono text-xs text-red-600 max-w-md break-all">
          {initError}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FFF8F0]">
        <div className="text-[#F25C8A] font-nunito text-lg font-semibold animate-pulse">
          Cargando, maje...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { profile } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {profile && profile.display_name === 'Maje' ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <HomeScreen />
            )}
          </ProtectedRoute>
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
