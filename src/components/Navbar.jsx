import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ShoppingBag, Search } from 'lucide-react';
import './Navbar.css';
import logo from '../assets/logo.jpg';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
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
          <ShoppingBag size={24} />
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
          <Search size={24} className="icon" />
          <ShoppingBag size={24} className="icon" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
