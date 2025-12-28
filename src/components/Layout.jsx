import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import BackToTop from './BackToTop';
import CartPopup from './CartPopup';

const Layout = ({ children }) => {
    return (
        <div className="app-layout">
            <Navbar />
            <CartPopup />
            <main className="main-content">
                {children}
            </main>
            <Footer />
            <BackToTop />
        </div>
    );
};

export default Layout;
