import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import Contact from './pages/Contact';
import ProductDetails from './pages/ProductDetails';
import ProductManager from './pages/ProductManager';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/womens-wear" element={<CategoryPage title="Women's Wear" />} />
          <Route path="/accessories" element={<CategoryPage title="Accessories" />} />
          <Route path="/mens-wear" element={<CategoryPage title="Men's Wear" />} />
          <Route path="/gifts" element={<CategoryPage title="Gifts" />} />
          <Route path="/jewellery" element={<CategoryPage title="Jewellery" />} />
          <Route path="/sale" element={<CategoryPage title="Sale" />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/admin" element={<ProductManager />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
