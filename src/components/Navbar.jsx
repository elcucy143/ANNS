import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, Menu, X, ShoppingBag, Search, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import logo from '../assets/logo-corrected.jpg';

import categoriesData from '../assets/json/categories.json';
import { displaySubcategoryLabel } from '../utils/productOptions';
import { useShoppingHistory } from '../context/ShoppingHistoryContext';
import { useProductCatalog } from '../context/ProductCatalogContext';
import { searchProducts } from '../utils/productSearch';
import { productImageVariant, recoverProductImage } from '../utils/imageUrl';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { getCartCount } = useCart();
  const { user } = useAuth();
  const { wishlistIds } = useShoppingHistory();
  const { products } = useProductCatalog();
  const navigate = useNavigate();
  const suggestions = useMemo(() => searchQuery.trim().length >= 2
    ? searchProducts(products, searchQuery, 6)
    : [], [products, searchQuery]);

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
      setIsOpen(false);
    }
  };

  const openSuggestion = (product) => {
    navigate(`/product/${product.id}`);
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsOpen(false);
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: "Women's Wear", path: '/womens-wear' },
    { name: 'Gifts', path: '/gifts' },
    { name: 'Jewellery', path: '/jewellery' },
    { name: 'Flash Sale', path: '/flash-sale' },
    { name: 'Contact', path: '/contact' },
  ];
  const offers = [
    'FIRST ORDER: USE FIRST10 FOR 10% OFF',
    'FREE SHIPPING ABOVE ₹2,000',
    'SHOP ₹2,999 & GET ₹150 OFF',
    'FLASH SALE PRICES LIVE',
    'BUY 1 GET 1 ON SELECTED PRODUCTS',
  ];

  return (
    <nav className="navbar">
      <div className="offer-ticker" aria-label="Current store offers">
        <div className="offer-ticker-track">
          {[...offers, ...offers].map((offer, index) => <span key={`${offer}-${index}`}>{offer}</span>)}
        </div>
      </div>
      <div className="container navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <img src={logo} alt="ANNS Logo" className="logo-image" />
          </Link>
        </div>

        <div className="navbar-icons mobile-only">
          <button type="button" className="nav-icon-button" onClick={toggleSearch} aria-label="Search products"><Search size={24} /></button>
          <Link to="/wishlist" className="wishlist-icon-link" aria-label={`Wishlist with ${wishlistIds.length} items`}><Heart size={24} />{wishlistIds.length > 0 && <span className="wishlist-count">{wishlistIds.length}</span>}</Link>
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
                    onClick={(event) => {
                      if (categoryData && window.matchMedia('(max-width: 768px)').matches) {
                        event.preventDefault();
                        setActiveDropdown((current) => current === link.name ? null : link.name);
                        return;
                      }
                      setIsOpen(false);
                      setActiveDropdown(null);
                    }}
                    aria-expanded={categoryData ? activeDropdown === link.name : undefined}
                  >
                    {link.name}
                  </Link>

                  {categoryData && <button
                    type="button"
                    className="submenu-toggle"
                    onClick={() => setActiveDropdown((current) => current === link.name ? null : link.name)}
                    aria-label={`${activeDropdown === link.name ? 'Close' : 'Open'} ${link.name} subcategories`}
                    aria-expanded={activeDropdown === link.name}
                  ><ChevronDown size={18} /></button>}

                  {categoryData && activeDropdown === link.name && (
                    <div className="dropdown-menu">
                      <Link
                        to={link.path}
                        className="dropdown-item dropdown-view-all"
                        onClick={() => { setIsOpen(false); setActiveDropdown(null); }}
                      >
                        View all {link.name}
                      </Link>
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
                          {displaySubcategoryLabel(sub)}
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
          <button type="button" className="nav-icon-button" onClick={toggleSearch} aria-label="Search products"><Search size={24} className="icon" /></button>
          <Link to="/wishlist" className="wishlist-icon-link" aria-label={`Wishlist with ${wishlistIds.length} items`} title="Wishlist"><Heart size={24} className="icon" />{wishlistIds.length > 0 && <span className="wishlist-count">{wishlistIds.length}</span>}</Link>
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
      {isSearchOpen && <div className="smart-search-panel">
        <form onSubmit={handleSearchSubmit} className="search-form smart-search-form">
          <Search size={20} aria-hidden="true" />
          <input
            id="search-input"
            type="search"
            placeholder="Search products, categories, colours or product codes"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            autoComplete="off"
            aria-label="Search products"
          />
          {searchQuery && <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search"><X size={18} /></button>}
          <button type="submit" className="search-submit">Search</button>
        </form>
        {searchQuery.trim().length >= 2 && <div className="search-suggestions" role="listbox" aria-label="Product suggestions">
          {suggestions.map((product) => <button type="button" role="option" aria-selected="false" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => openSuggestion(product)}>
            <img src={productImageVariant(product.image, 'thumb')} alt="" loading="lazy" onError={recoverProductImage} />
            <span><strong>{product.name}</strong><small>{product.category}{product.color ? ` · ${product.color}` : ''} · {product.id}</small></span>
            <b>₹{Number(product.price).toLocaleString('en-IN')}</b>
          </button>)}
          <button type="button" className="search-view-all" onClick={handleSearchSubmit}>View all results for “{searchQuery.trim()}”</button>
        </div>}
      </div>}
    </nav>
  );
};

export default Navbar;
