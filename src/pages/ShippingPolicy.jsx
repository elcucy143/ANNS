import React, { useEffect } from 'react';
import './ShippingPolicy.css';

const ShippingPolicy = () => {
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="shipping-policy-page container">
            <h1 className="section-title">Shipping & Delivery Policy</h1>

            <div className="policy-content">
                <section className="policy-section">
                    <h2>Shipping & Delivery</h2>

                    <div className="qa-item">
                        <h3>Do you ship outside India?</h3>
                        <p>No as of now, we will start very soon.</p>
                    </div>

                    <div className="qa-item">
                        <h3>How much does shipping cost?</h3>
                        <p>Shipments within India are shipped at moderate or no cost depending on the product you purchase.</p>
                    </div>

                    <div className="qa-item">
                        <h3>Are there any duties and taxes?</h3>
                        <p><strong>For customers within India:</strong> All prices specified on the website are inclusive of Indian taxes and GST.</p>
                        <p><strong>For customers outside India:</strong> Duties are not included in the price. Customers are responsible for paying any import duties, customs fees, or local taxes. Annsonline will not reimburse these expenses. It is necessary to pay these in order to release your order from customs.</p>
                    </div>

                    <div className="qa-item">
                        <h3>How do I know my order has been placed?</h3>
                        <p>You will see an order confirmation number on your screen upon placing your order. You will also receive an email confirmation from us. In case there are any issues with processing your order, you will be notified with an email.</p>
                    </div>

                    <div className="qa-item">
                        <h3>How do I track my order?</h3>
                        <p>Once you have placed an order, we will email you a tracking number/AWB. You will be able to view the date your item is in process the date of shipment to the date of your item being in the process of delivery.</p>
                    </div>

                    <div className="qa-item">
                        <h3>When will I receive my order?</h3>
                        <p>The estimated delivery time of each product is mentioned on the product page. Please take note of the dates given before you proceed to checkout. Most garments will be shipped within 3-4 weeks of receiving the order and depending on the designer and product style. However, this is subject to availability.</p>
                        <p>Orders within India should reach the customer within 3-4 days after the date of dispatch. Orders outside India should reach the customer within 4-6 days after the date of dispatch.</p>
                    </div>

                    <div className="qa-item">
                        <h3>Can I change my shipping address after my order has been placed?</h3>
                        <p>If there is an error in the shipping address you specified at the time of checkout, please email us at <strong>sales@annsonline.shop</strong> or call us immediately. We are unable to change a shipping address or redirect orders once items have been dispatched.</p>
                    </div>

                    <div className="qa-item">
                        <h3>Are my items insured?</h3>
                        <p>Yes, all our products are insured from when they leave Annsonline to when they reach your delivery address. Once a package has been signed for at the delivery address, it is no longer insured. If a product is damaged upon arrival, either refuse to accept it or notify us via email or phone within 24 hours of receipt.</p>
                    </div>
                </section>

                <div className="contact-note">
                    <p>*If you have any additional shipping relating queries, feel free to email us at <strong>sales@annsonline.shop</strong> or call customer care at <strong>+91 9849792562</strong> or WhatsApp for outside India from Monday-Saturday (11 am-07 pm IST)*.</p>
                </div>
            </div>
        </div>
    );
};

export default ShippingPolicy;
