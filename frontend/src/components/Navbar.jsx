import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package, FileText, ShoppingCart, LogOut, ShieldCheck, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="erp-navbar">
      <div className="erp-navbar-container">
        <div className="erp-brand">
          <div className="brand-logo">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <span className="brand-title">Fundsroom ERP</span>
            <span className="brand-subtitle">Manufacturing & Supply</span>
          </div>
        </div>

        <nav className="erp-nav-links">
          <NavLink
            to="/enquiries"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <FileText className="w-4 h-4" />
            <span>Enquiries</span>
          </NavLink>

          <NavLink
            to="/quotations"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <FileText className="w-4 h-4" />
            <span>Quotations</span>
          </NavLink>

          <NavLink
            to="/sales-orders"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Sales Orders & Stock</span>
          </NavLink>
        </nav>

        <div className="erp-user-section">
          <div className="user-profile">
            <div className="user-avatar">
              {isAdmin ? <ShieldCheck className="w-4 h-4 text-purple-600" /> : <User className="w-4 h-4 text-teal-600" />}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.full_name || user?.username}</span>
              <span className={`user-role-badge ${isAdmin ? 'role-admin' : 'role-sales'}`}>
                {user?.role}
              </span>
            </div>
          </div>

          <button onClick={logout} className="logout-btn" title="Sign Out">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
