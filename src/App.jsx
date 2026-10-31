import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import Contact from './pages/Contact';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import SearchResults from './pages/SearchResults';
import ReturnPolicy from './pages/ReturnPolicy';
import ShippingPolicy from './pages/ShippingPolicy';
import TermsConditions from './pages/TermsConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Account from './pages/Account';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import ProtectedRoute from './components/ProtectedRoute';
import RouteScrollManager from './components/RouteScrollManager';
import AnalyticsTracker from './components/AnalyticsTracker';
import MarketingConsent from './components/MarketingConsent';

import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ProductCatalogProvider } from './context/ProductCatalogContext';
import { ReviewProvider } from './context/ReviewContext';
import { ShoppingHistoryProvider } from './context/ShoppingHistoryContext';

const ProductManager = lazy(() => import('./pages/ProductManager'));

function App() {
  return (
    <AuthProvider>
      <ProductCatalogProvider>
      <ReviewProvider>
      <ShoppingHistoryProvider>
      <CartProvider>
        <Router>
          <RouteScrollManager />
          <AnalyticsTracker />
          <MarketingConsent />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/womens-wear" element={<CategoryPage title="Women's Wear" />} />
              <Route path="/gifts" element={<CategoryPage title="Gifts" />} />
              <Route path="/jewellery" element={<CategoryPage title="Jewellery" />} />
              <Route path="/flash-sale" element={<CategoryPage title="Flash Sale" />} />
              <Route path="/sale" element={<CategoryPage title="Flash Sale" />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/return-policy" element={<ReturnPolicy />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/terms-conditions" element={<TermsConditions />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/product-manager" element={<Suspense fallback={<div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>Loading admin workspace…</div>}><ProductManager /></Suspense>} />
              <Route path="/account" element={<Account />} />
              <Route path="/wishlist" element={<Wishlist />} />
            </Routes>
          </Layout>
        </Router>
      </CartProvider>
      </ShoppingHistoryProvider>
      </ReviewProvider>
      </ProductCatalogProvider>
    </AuthProvider>
  );
}

export default App;
