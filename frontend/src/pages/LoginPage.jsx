import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ShieldCheck, Briefcase } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'ADMIN') {
        navigate('/sales-orders');
      } else {
        navigate('/enquiries');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('Admin@123');
    } else {
      setUsername('sales');
      setPassword('Sales@123');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-icon">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="login-title">Fundsroom ERP</h1>
          <p className="login-subtitle">Industrial Manufacturing & Supply Chain</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to ERP'}
          </button>
        </form>

        <div className="quick-login-section">
          <div className="quick-login-divider">
            <span>Or Quick Fill Test Account</span>
          </div>
          <div className="quick-login-buttons">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="btn btn-outline quick-btn"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Admin (admin / Admin@123)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('sales')}
              className="btn btn-outline quick-btn"
            >
              <Briefcase className="w-4 h-4 text-teal-600" />
              <span>Sales User (sales / Sales@123)</span>
            </button>
          </div>
        </div>

        <div className="login-footer">
          <p>PERN Stack Technical Case Study • Bhargav Reddy</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
