import React, { useEffect } from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="privacy-policy-page container">
            <h1 className="section-title">Privacy Policy</h1>

            <div className="policy-content">
                <section className="policy-section">
                    <h2>Use of Personal Information</h2>
                    <p>Annsonline collects the information needed to provide our services. This may include your name, email address, delivery and billing address, postal code and contact number. Customers may sign in using an ANNS account or Google. ANNS account passwords are stored only as salted security hashes, and Annsonline never receives or stores Google passwords. We collect order and contact information when you register, request information or place an order, and do not sell customer information.</p>
                    <p>We also collect first-party visit information such as pages viewed, time, referring domain, browser session identifier and an approximate city, region and country supplied by our hosting provider. We do not store the visitor’s raw IP address in our analytics database. When a customer is signed in, page visits may be linked to that verified ANNS customer account so we can provide support and understand the customer journey. Visits made without a verified account remain anonymous.</p>
                    <p>We require these details only to provide you the services we offer. We use your address to deliver the order. We may use your phone number to help you resolve your queries while shopping. We notify you about our updates and promotional schemes through SMS or email on your mobile number/ email ID provided to us during the time of registration. You can inform us if you wish to stop receiving these mailers. We share your personal information with specific employees who are involved in the execution of your transaction and any employee who violates our privacy and/or security policies is subject to disciplinary action.</p>
                </section>

                <section className="policy-section">
                    <h2>Non-Personal Information</h2>
                    <p>Anonymous visit information is used to analyze trends, administer the site and understand popular products and pages. First-party visit records are retained for up to 180 days for internal review. Approximate location may be inaccurate and does not reveal a visitor’s home or street address.</p>
                </section>

                <section className="policy-section">
                    <h2>Advertising Analytics and Meta Pixel</h2>
                    <p>With your optional consent, Annsonline uses Meta Pixel to understand how visitors arriving from Facebook and Instagram advertisements use the website. This may record page visits, searches, product views, wishlist and cart activity, checkout starts and verified purchases. Failed or cancelled payments are not reported as purchases.</p>
                    <p>Meta may use this information to measure advertising performance, create advertising audiences and show more relevant advertisements. You can choose “Only necessary” when the preference notice appears and continue using shopping, account and payment features without Meta advertising analytics.</p>
                </section>

                <section className="policy-section">
                    <h2>Customer Reviews and Testimonials</h2>
                    <p>We will use all the testimonials and reviews given by customers on our web site which may contain personally identifiable information. If you would like to have your testimonial or review removed from our site, you have to mail us at <strong>astrendsandgifts@gmail.com</strong></p>
                </section>

                <section className="policy-section">
                    <h2>Card Information</h2>
                    <p>For all online transactions, information is securely collected by relevant payment gateways. Our payment gateways are dedicated to keeping your account safe and secure. With industry-advanced encryption, fraud prevention and protection policies, once your information reaches our payment gateways it resides on a server that is heavily guarded both physically and electronically.</p>
                </section>

                <section className="policy-section">
                    <h2>Announcements regarding services of Annsonline</h2>
                    <p>We will mail / SMS for site updates to our customers using our database. We ask for a user’s email address for the purposes of providing this information. If personally identifiable information changes or If you don’t want to receive any updates from us, you can email us at <strong>astrendsandgifts@gmail.com</strong>. Alternatively, you can deactivate your account.</p>
                </section>

                <section className="policy-section">
                    <h2>Service Providers</h2>
                    <p>We use other third parties such as a shipping company and a payment gateway company to bill you for goods and services. We use a live chat option to assist you with customer queries while using our site or regarding your order. When you sign up at Annsonline, we will share your provided personal information as essential for the third party to provide that service.</p>
                </section>

                <section className="policy-section">
                    <h2>Legal Disclaimer</h2>
                    <p>We reserve the right to disclose your personally recognizable information as required by law and when we believe that disclosure is necessary to protect our rights and/or to comply with a judicial proceeding, court order, or legal process served on our Web site. Annsonline reserves the right to make changes in this privacy policy.</p>
                </section>

                <div className="legal-agreement">
                    <h3>Agreeing to Terms</h3>
                    <p>If you do not agree to the Annsonline Privacy Policy as posted here on this website, please do not use this site or any services offered by this site. Your use of this site indicates acceptance of this privacy policy.</p>
                    <p>We encourage you to be aware when you leave our site and to read the privacy statements of each and every Web site that collects personally identifiable information. This privacy statement applies only to information collected by this Web site.</p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
