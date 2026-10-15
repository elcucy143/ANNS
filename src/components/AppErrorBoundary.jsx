import { Component } from 'react';
import { CART_STORAGE_KEY } from '../context/CartContext';

class AppErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() { return { hasError: true }; }

    resetStorefront = () => {
        try {
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem('cartItems');
        } finally {
            window.location.assign('/');
        }
    };

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
                <section>
                    <h1>Let’s refresh your shopping session</h1>
                    <p>Your account and products are safe. Refresh the storefront to continue.</p>
                    <button type="button" onClick={this.resetStorefront}>Refresh storefront</button>
                </section>
            </main>
        );
    }
}

export default AppErrorBoundary;
