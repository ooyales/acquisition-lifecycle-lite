import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      setAuth(data.access_token, data.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { email: 'admin@acq.local', label: 'Admin' },
    { email: 'requestor@acq.local', label: 'Requestor' },
    { email: 'chief@acq.local', label: 'Branch Chief' },
    { email: 'cto@acq.local', label: 'CTO' },
    { email: 'ko@acq.local', label: 'KO' },
    { email: 'scrm@acq.local', label: 'SCRM' },
    { email: 'budget@acq.local', label: 'Budget/FM' },
    { email: 'legal@acq.local', label: 'Legal' },
    { email: 'sb@acq.local', label: 'Small Business' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <span className="bg-eaw-primary text-white rounded-lg px-3 py-1.5 text-xl font-bold">AL</span>
            <h1 className="text-2xl font-bold text-gray-900">Acquisition Lifecycle</h1>
          </div>
          <p className="text-gray-500 text-sm">Federal IT Acquisition Lifecycle Management</p>
        </div>

        <div className="bg-white rounded-lg shadow-eaw p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@acq.local"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-4 bg-white rounded-lg shadow-eaw p-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">Demo Accounts (password: demo123)</p>
          <div className="flex flex-wrap gap-1.5">
            {demoAccounts.map(acct => (
              <button
                key={acct.email}
                onClick={() => { setEmail(acct.email); setPassword('demo123'); }}
                className="text-xs bg-gray-100 hover:bg-eaw-primary/10 text-gray-600 hover:text-eaw-primary
                           rounded px-2 py-1 transition-colors"
              >
                {acct.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
