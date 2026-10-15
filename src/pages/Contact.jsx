import React, { useState } from 'react';
import './Contact.css';
import { businessContact } from '../config/contact';
import { sendContactMessage } from '../services/apiClient';

const Contact = () => {
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    const sendEmail = async (e) => {
        e.preventDefault();
        const formElement = e.currentTarget;
        setStatus('sending');
        setError('');
        const form = new FormData(formElement);
        try {
            await sendContactMessage({
                name: form.get('user_name'),
                email: form.get('user_email'),
                message: form.get('message'),
                website: form.get('website'),
            });
            setStatus('success');
            formElement.reset();
        } catch (requestError) {
            setError(requestError.message || 'Failed to send message. Please try again.');
            setStatus('error');
        }
    };

    return (
        <div className="contact-page container">
            <h1 className="section-title">Contact Us</h1>

            <div className="contact-content">
                <div className="contact-form-container">
                    <h2>Send us a message</h2>
                    <form className="contact-form" onSubmit={sendEmail}>
                        <input type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                        <div className="form-group">
                            <label htmlFor="name">Name</label>
                            <input type="text" id="name" name="user_name" placeholder="Your Name" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" name="user_email" placeholder="Your Email" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="message">Message</label>
                            <textarea id="message" name="message" rows="5" placeholder="How can we help?" required></textarea>
                        </div>
                        <button type="submit" className="btn" disabled={status === 'sending'}>
                            {status === 'sending' ? 'Sending...' : 'Send Message'}
                        </button>
                        {status === 'success' && <p className="success-msg">Message sent successfully!</p>}
                        {status === 'error' && <p className="error-msg">{error}</p>}
                    </form>
                </div>

                <div className="contact-info-container">
                    <h2>Get in Touch</h2>
                    <p>We'd love to hear from you. Visit our store or message us on WhatsApp.</p>

                    <div className="info-item">
                        <h3>{businessContact.name}</h3>
                        <p>{businessContact.addressLines[0]}<br />{businessContact.addressLines[1]}</p>
                    </div>

                    <div className="info-item">
                        <h3>Email</h3>
                        <p><a href={`mailto:${businessContact.email}`}>{businessContact.email}</a></p>
                    </div>

                    <div className="info-item">
                        <h3>WhatsApp</h3>
                        <p><a href={`https://wa.me/${businessContact.whatsappNumber}`} target="_blank" rel="noreferrer">{businessContact.whatsappDisplay}</a></p>
                    </div>

                    <div className="info-item">
                        <h3>Instagram</h3>
                        <p><a href={businessContact.instagram} target="_blank" rel="noreferrer">@a.s.trends_gifts</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;
