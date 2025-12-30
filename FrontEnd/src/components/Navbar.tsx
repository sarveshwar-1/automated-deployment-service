import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-2xl font-bold text-blue-600">Deploy</div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <span className="text-gray-700">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-700 hover:text-red-600 transition-colors"
            >
              <FiLogOut size={20} />
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200">
            <span className="block text-gray-700 py-2">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-700 hover:text-red-600 py-2"
            >
              <FiLogOut size={20} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
