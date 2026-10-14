import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Mail, MapPin, MessageCircle } from 'lucide-react';
import './Footer.css';
import logo from '../assets/logo-corrected.jpg';
import { businessContact } from '../config/contact';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container footer-container">
                <div className="footer-section">
                    <img src={logo} alt="ANNS Logo" className="footer-logo" />
                    <p>Your destination for premium fashion and lifestyle products. Curated with love and style.</p>
                </div>

                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><Link to="/womens-wear">Women's Wear</Link></li>
                        <li><Link to="/gifts">Gifts</Link></li>
                        <li><Link to="/jewellery">Jewellery</Link></li>
                        <li><Link to="/sale">Sale</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Policies</h4>
                    <ul>
                        <li><Link to="/return-policy">Return & Cancellation policy</Link></li>
                        <li><Link to="/shipping-policy">Shipping & Delivery policy</Link></li>
                        <li><Link to="/privacy-policy">Privacy policy</Link></li>
                        <li><Link to="/terms-conditions">Terms & Conditions</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Contact Us</h4>
                    <ul className="contact-info">
                        <li><MapPin size={16} /> <span>{businessContact.addressLines[0]}<br />{businessContact.addressLines[1]}</span></li>
                        <li><MessageCircle size={16} /> <a href={`https://wa.me/${businessContact.whatsappNumber}`} target="_blank" rel="noreferrer">WhatsApp {businessContact.whatsappDisplay}</a></li>
                        <li><Mail size={16} /> <a href={`mailto:${businessContact.email}`}>{businessContact.email}</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Follow Us</h4>
                    <div className="social-icons">
                        <a target="_blank" rel="noreferrer" href={businessContact.instagram} aria-label="Instagram"><Instagram size={20} /></a>
                        <a target="_blank" rel="noreferrer" href="https://www.facebook.com/share/1DtVBiVhwX/"><Facebook size={20} /></a>
                        <a target="_blank" rel="noreferrer" href="https://www.youtube.com/@a.s.trendsgifts"><Youtube size={20} /></a>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <p>
                    &copy; {new Date().getFullYear()} ANNS. All rights reserved. | Secure Payments: UPI · Visa · Mastercard · Razorpay
                </p>
            </div>
        </footer>
    );
};

export default Footer;
