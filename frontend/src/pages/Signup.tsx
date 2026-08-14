import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { subscriptionApi } from '@/core/api/subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';

export function Signup() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to app once authenticated (handles state timing with startTransition)
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one digit');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      if (plan === 'monthly' || plan === 'yearly') {
        const { url } = await subscriptionApi.createCheckout(plan, true);
        if (url) {
          window.location.href = url;
          return;
        }
      }
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
          <CardTitle className="text-2xl font-extrabold">{plan ? 'Start your trial' : 'Create account'}</CardTitle>
          <CardDescription className="text-white/55">{plan ? 'Sign up and start your 7-day free Pro trial.' : 'Body, energy, and goals in one place.'}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/75">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="rounded-lg h-[50px] border-white/10 bg-[#1d2123] px-4 text-[14px] text-white placeholder:text-white/30"
              />
            </div>
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="rounded-lg h-[50px] border-white/10 bg-[#1d2123] px-4 text-[14px] text-white placeholder:text-white/30"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-[50px] rounded-lg bg-[#9cf25b] text-[15px] font-extrabold text-[#0b0d0c] shadow-[0_0_24px_rgba(156,242,91,0.28),0_8px_20px_rgba(0,0,0,0.35)] hover:bg-[#a8f76b]" disabled={loading}>
              {loading ? (plan ? 'Setting up your trial...' : 'Creating account...') : (plan ? 'Sign up & Start Trial' : 'Sign up')}
            </Button>
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
              Already have an account?{' '}
              <Link to="/login" className="text-[#9cf25b] underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
