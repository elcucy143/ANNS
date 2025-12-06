import React, { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import './Contact.css';

const Contact = () => {
    const form = useRef();
    const [status, setStatus] = useState('');

    const sendEmail = (e) => {
        e.preventDefault();
        setStatus('sending');

        emailjs.sendForm(
            import.meta.env.VITE_EMAILJS_SERVICE_ID,
            import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
            form.current,
            import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        )
            .then((result) => {
                console.log(result.text);
                setStatus('success');
                e.target.reset();
            }, (error) => {
                console.log(error.text);
                setStatus('error');
            });
    };

    return (
        <div className="contact-page container">
            <h1 className="section-title">Contact Us</h1>

            <div className="contact-content">
                <div className="contact-form-container">
                    <h2>Send us a message</h2>
                    <form className="contact-form" ref={form} onSubmit={sendEmail}>
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
                        {status === 'error' && <p className="error-msg">Failed to send message. Please try again.</p>}
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
