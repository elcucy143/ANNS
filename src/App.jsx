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
import ProtectedRoute from './components/ProtectedRoute';

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
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/womens-wear" element={<ProtectedRoute><CategoryPage title="Women's Wear" /></ProtectedRoute>} />
              <Route path="/gifts" element={<ProtectedRoute><CategoryPage title="Gifts" /></ProtectedRoute>} />
              <Route path="/jewellery" element={<ProtectedRoute><CategoryPage title="Jewellery" /></ProtectedRoute>} />
              <Route path="/sale" element={<ProtectedRoute><CategoryPage title="Sale" /></ProtectedRoute>} />
              <Route path="/contact" element={<ProtectedRoute><Contact /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
              <Route path="/product/:id" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
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
