import React from 'react';
import './Contact.css';

const Contact = () => {
    return (
        <div className="contact-page container">
            <h1 className="section-title">Contact Us</h1>

            <div className="contact-content">
                <div className="contact-form-container">
                    <h2>Send us a message</h2>
                    <form className="contact-form">
                        <div className="form-group">
                            <label htmlFor="name">Name</label>
                            <input type="text" id="name" placeholder="Your Name" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" placeholder="Your Email" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="message">Message</label>
                            <textarea id="message" rows="5" placeholder="How can we help?"></textarea>
                        </div>
                        <button type="submit" className="btn">Send Message</button>
                    </form>
                </div>

                <div className="contact-info-container">
                    <h2>Get in Touch</h2>
                    <p>We'd love to hear from you. Visit our store or give us a call.</p>

                    <div className="info-item">
                        <h3>Address</h3>
                        <p>123 Gachibowli<br />Hyderabad, Telangana 500090</p>
                    </div>

                    <div className="info-item">
                        <h3>Email</h3>
                        <p>hello@anns.com</p>
                    </div>

                    <div className="info-item">
                        <h3>Phone</h3>
                        <p>+91 99XXXXXXX</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;
