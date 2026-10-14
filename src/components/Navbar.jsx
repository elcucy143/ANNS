import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ShoppingBag, Search, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import logo from '../assets/logo-corrected.jpg';

import categoriesData from '../assets/json/categories.json';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { getCartCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: "Women's Wear", path: '/womens-wear' },
    { name: 'Gifts', path: '/gifts' },
    { name: 'Jewellery', path: '/jewellery' },
    { name: 'Sale', path: '/sale' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <img src={logo} alt="ANNS Logo" className="logo-image" />
          </Link>
        </div>

        <div className="navbar-icons mobile-only">
          <Link to="/account" className={`account-icon-link ${user ? 'signed-in' : ''}`} aria-label={user ? `Account: ${user.name}` : 'Sign in or register'}>
            <User size={24} />
            {user && <span className="signed-in-dot" />}
          </Link>
          <Link to="/cart" className="cart-icon-link">
            <ShoppingBag size={24} />
            {getCartCount() > 0 && <span className="cart-count">{getCartCount()}</span>}
          </Link>
          <button onClick={toggleMenu} className="menu-toggle">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div className={`navbar-links ${isOpen ? 'active' : ''}`}>
          <ul>
            {navLinks.map((link) => {
              const categoryData = categoriesData.categories.find(c => c.name === link.name);

              return (
                <li
                  key={link.name}
                  className="nav-item"
                  onMouseEnter={() => setActiveDropdown(link.name)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    to={link.path}
                    onClick={() => {
                      setIsOpen(false);
                      setActiveDropdown(null);
                    }}
                  >
                    {link.name}
                  </Link>

                  {categoryData && activeDropdown === link.name && (
                    <div className="dropdown-menu">
                      {categoryData.subCategories.map((sub) => (
                        <Link
                          key={sub}
                          to={`${link.path}?subcategory=${encodeURIComponent(sub)}`}
                          className="dropdown-item"
                          onClick={() => {
                            setIsOpen(false);
                            setActiveDropdown(null);
                          }}
                        >
                          {sub}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="navbar-icons desktop-only">
          {isSearchOpen ? (
            <form onSubmit={handleSearchSubmit} className="search-form">
              <input
                id="search-input"
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => !searchQuery && setIsSearchOpen(false)}
              />
              <button type="submit"><Search size={20} /></button>
            </form>
          ) : (
            <Search size={24} className="icon" onClick={toggleSearch} />
          )}
          <Link to="/account" className={`account-icon-link ${user ? 'signed-in' : ''}`} aria-label={user ? `Account: ${user.name}` : 'Sign in or register'} title={user ? `Account: ${user.name}` : 'Sign in or register'}>
            <User size={24} className="icon" />
            {user && <span className="signed-in-dot" />}
          </Link>
          <Link to="/cart" className="cart-icon-link">
            <ShoppingBag size={24} className="icon" />
            {getCartCount() > 0 && <span className="cart-count">{getCartCount()}</span>}
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
