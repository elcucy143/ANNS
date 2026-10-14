import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

import images from '../assets/images';

const ProductCard = ({ product }) => {
    const { addToCart } = useCart();
    const navigate = useNavigate();

    const handleAddToCart = (event) => {
        event.preventDefault();
        event.stopPropagation();
        addToCart(product);
        navigate('/cart');
    };

    const filename = product.image ? product.image.split('/').pop() : '';

    return (
        <div className="product-card">
            <Link to={`/product/${product.id}`} className="product-link">
                <div className="product-image">
                    <img src={images[filename] || product.image} alt={product.name} loading="lazy" decoding="async" />
                    <button className="add-to-cart-btn" onClick={handleAddToCart}>Add to Cart</button>
                </div>
                <div className="product-info">
                    <h3>{product.name}</h3>
                    <span className="price">₹{product.price}</span>
                </div>
            </Link>
        </div>
    );
};

export default ProductCard;
