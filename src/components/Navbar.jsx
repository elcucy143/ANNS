import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ShoppingBag, Search, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './Navbar.css';
import logo from '../assets/logo.jpg';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { getCartCount } = useCart();
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
            {navLinks.map((link) => (
              <li key={link.name}>
                <Link to={link.path} onClick={() => setIsOpen(false)}>
                  {link.name}
                  {/* {link.name === 'Sale' && <img src="/src/assets/santa-hat.png" alt="Santa Hat" className="sparkle-icon" />} */}
                </Link>
              </li>
            ))}
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
          <User size={24} className="icon" />
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
