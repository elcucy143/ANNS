import { Link } from 'react-router-dom';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    return (
        <div className="product-card">
            <Link to={`/product/${product.id}`} className="product-link">
                <div className="product-image">
                    <img src={product.image} alt={product.name} />
                    <button className="add-to-cart-btn" onClick={(e) => e.preventDefault()}>Add to Cart</button>
                </div>
                <div className="product-info">
                    <h3>{product.name}</h3>
                    <span className="price">{product.price}</span>
                </div>
            </Link>
        </div>
    );
};

export default ProductCard;
