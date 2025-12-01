import React from 'react';
import { Facebook, Instagram, Twitter, Mail, MapPin, Phone } from 'lucide-react';
import './Footer.css';
import logo from '../assets/logo-f.jpg';

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
                        <li><a href="/womens-wear">Women's Wear</a></li>
                        <li><a href="/sale">Sale</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Policies</h4>
                    <ul>
                        <li><a href="/return-policy">Return & Cancellation policy</a></li>
                        <li><a href="/shopping-policy">Shopping policy</a></li>
                        <li><a href="/privacy-policy">Privacy policy</a></li>
                        <li><a href="/terms-conditions">Terms & Conditions</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Contact Us</h4>
                    <ul className="contact-info">
                        <li><MapPin size={16} /> 123 Gachibowli, Hyderabad, TG, INDIA</li>
                        <li><Phone size={16} /> +91 9981234567</li>
                        <li><Mail size={16} /> hello@anns.com</li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Follow Us</h4>
                    <div className="social-icons">
                        <a href="#"><Instagram size={20} /></a>
                        <a href="#"><Facebook size={20} /></a>
                        <a href="#"><Twitter size={20} /></a>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} ANNS. All rights reserved.</p>
                <div className="payment-methods">
                    <span>Secure Payments: </span>
                    <span>Visa</span>
                    <span>Mastercard</span>
                    <span>PayPal</span>
                    <span>Stripe</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
