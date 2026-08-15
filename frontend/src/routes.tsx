import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSettings } from './hooks/useSettings';
import { useThemeEffect } from './hooks/useThemeEffect';
import { Base44Layout } from './components/layout/Base44Layout';
import { PublicLayout } from './components/layout/PublicLayout';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { LocalErrorBoundary } from './components/shared/LocalErrorBoundary';
import { AppProviders } from './Providers';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Body = lazy(() => import('./pages/Body').then((m) => ({ default: m.Body })));
const Energy = lazy(() => import('./pages/Energy').then((m) => ({ default: m.Energy })));
const Water = lazy(() => import('./pages/Water').then((m) => ({ default: m.Water })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));
const AdminSystemPage = lazy(() => import('./pages/admin/AdminSystemPage'));
const AdminImagesPage = lazy(() => import('./pages/admin/AdminImagesPage'));
const AdminFoodsPage = lazy(() => import('./pages/admin/AdminFoodsPage'));
const AdminUserDataPage = lazy(() => import('./pages/admin/AdminUserDataPage'));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })));
const Goals = lazy(() => import('./pages/Goals').then((m) => ({ default: m.Goals })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/Signup').then((m) => ({ default: m.Signup })));
const AuthCallback = lazy(() =>
  import('./pages/AuthCallback').then((m) => ({ default: m.AuthCallback }))
);
const ForgotPassword = lazy(() =>
  import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword }))
);
const Pricing = lazy(() =>
  import('./pages/Pricing').then((m) => ({ default: m.Pricing }))
);
// const Landing = lazy(() =>
//   import('./pages/Landing').then((m) => ({ default: m.Landing }))
// );
const About = lazy(() =>
  import('./pages/About').then((m) => ({ default: m.About }))
);
const PrivacyPolicy = lazy(() =>
  import('./pages/Privacy').then((m) => ({ default: m.Privacy }))
);
const TermsOfService = lazy(() =>
  import('./pages/Terms').then((m) => ({ default: m.Terms }))
);
const Contact = lazy(() =>
  import('./pages/Contact').then((m) => ({ default: m.Contact }))
);
const NotFound = lazy(() =>
  import('./pages/NotFound').then((m) => ({ default: m.NotFound }))
);

function ProtectedRoutes() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppProviders>
      <ProtectedAppRoutes />
    </AppProviders>
  );
}

function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function ProtectedAppRoutes() {
  const { settings } = useSettings();
  useThemeEffect(settings.theme, settings.balanceDisplayColor);

  return (
    <Routes>
      <Route path="/" element={<Base44Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<LoadingSpinner text="Loading dashboard..." />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="body"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading body page..." />}>
              <Body />
            </Suspense>
          }
        />
        <Route
          path="energy"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading energy page..." />}>
              <Energy />
            </Suspense>
          }
        />
        <Route
          path="water"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading water..." />}>
              <Water />
            </Suspense>
          }
        />
        <Route
          path="insights"
          element={
            <LocalErrorBoundary label="Insights">
              <Suspense fallback={<LoadingSpinner text="Loading insights..." />}>
                <Insights />
              </Suspense>
            </LocalErrorBoundary>
          }
        />
        <Route
          path="goals"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading goals..." />}>
              <Goals />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading settings..." />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="admin"
          element={
            <AdminRouteGuard>
              <Suspense fallback={<LoadingSpinner text="Loading admin..." />}>
                <Admin />
              </Suspense>
            </AdminRouteGuard>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<LoadingSpinner text="Loading overview..." />}>
                <AdminOverview />
              </Suspense>
            }
          />
          <Route
            path="users"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading users..." />}>
                <AdminUsersPage />
              </Suspense>
            }
          />
          <Route
            path="user-data"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading user data..." />}>
                <AdminUserDataPage />
              </Suspense>
            }
          />
          <Route
            path="activity"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading activity..." />}>
                <AdminActivityPage />
              </Suspense>
            }
          />
          <Route
            path="foods"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading foods..." />}>
                <AdminFoodsPage />
              </Suspense>
            }
          />
          <Route
            path="system"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading system..." />}>
                <AdminSystemPage />
              </Suspense>
            }
          />
          <Route
            path="images"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading images..." />}>
                <AdminImagesPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="*"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading..." />}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/login"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading..." />}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path="/signup"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading..." />}>
              <Signup />
            </Suspense>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading..." />}>
              <AuthCallback />
            </Suspense>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<LoadingSpinner text="Loading..." />}>
              <ForgotPassword />
            </Suspense>
          }
        />
        <Route element={<PublicLayout />}>
          {/*
          <Route
            path="/welcome"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading..." />}>
                <Landing />
              </Suspense>
            }
          />
          */}
          <Route
            path="/pricing"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading..." />}>
                <Pricing />
              </Suspense>
            }
          />
          <Route
            path="/about"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading..." />}>
                <About />
              </Suspense>
            }
          />
          <Route
            path="/privacy"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading..." />}>
                <PrivacyPolicy />
              </Suspense>
            }
          />
          <Route
            path="/terms"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading..." />}>
                <TermsOfService />
              </Suspense>
            }
          />
          <Route
            path="/contact"
            element={
              <Suspense fallback={<LoadingSpinner text="Loading..." />}>
                <Contact />
              </Suspense>
            }
          />
        </Route>
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
