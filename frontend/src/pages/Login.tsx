import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to app once authenticated (handles state timing with startTransition)
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d0c] p-4 text-[#f4f7f4]">
      <Card className="w-full max-w-md rounded-[24px] border-white/10 bg-[#15181a] text-[#f4f7f4] shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <img src="/logo.png" alt="TrackVibe" className="mx-auto h-14 w-auto max-w-[150px] rounded-xl object-contain" />
          <CardTitle className="text-2xl font-extrabold">TrackVibe</CardTitle>
          <CardDescription className="text-white/55">Body, energy, and goals in one place.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/75">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="rounded-lg h-[50px] border-white/10 bg-[#1d2123] px-4 text-[14px] text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/75">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-lg h-[50px] border-white/10 bg-[#1d2123] px-4 text-[14px] text-white"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-[50px] rounded-lg bg-[#9cf25b] text-[15px] font-extrabold text-[#0b0d0c] shadow-[0_0_24px_rgba(156,242,91,0.28),0_8px_20px_rgba(0,0,0,0.35)] hover:bg-[#a8f76b]" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <Link to="/forgot-password" className="text-sm text-white/55 hover:text-[#9cf25b] transition-colors">
              Forgot your password?
            </Link>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#15181a] px-2 text-white/45">Or continue with</span>
              </div>
            </div>
            <SocialLoginButtons />
            <p className="text-sm text-white/55">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="text-[#9cf25b] underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
