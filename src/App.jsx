import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import Contact from './pages/Contact';
import ProductDetails from './pages/ProductDetails';
import ProductManager from './pages/ProductManager';
import Cart from './pages/Cart';
import SearchResults from './pages/SearchResults';
import ReturnPolicy from './pages/ReturnPolicy';
import ShippingPolicy from './pages/ShippingPolicy';
import TermsConditions from './pages/TermsConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Account from './pages/Account';
import Checkout from './pages/Checkout';

import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ProductCatalogProvider } from './context/ProductCatalogContext';
import { ReviewProvider } from './context/ReviewContext';

function App() {
  return (
    <AuthProvider>
      <ProductCatalogProvider>
      <ReviewProvider>
      <CartProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/womens-wear" element={<CategoryPage title="Women's Wear" />} />
              <Route path="/gifts" element={<CategoryPage title="Gifts" />} />
              <Route path="/jewellery" element={<CategoryPage title="Jewellery" />} />
              <Route path="/sale" element={<CategoryPage title="Sale" />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/return-policy" element={<ReturnPolicy />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/terms-conditions" element={<TermsConditions />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/product-manager" element={<ProductManager />} />
              <Route path="/account" element={<Account />} />
            </Routes>
          </Layout>
        </Router>
      </CartProvider>
      </ReviewProvider>
      </ProductCatalogProvider>
    </AuthProvider>
  );
}

export default App;
