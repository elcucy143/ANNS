import React, { useEffect } from 'react';
import './ReturnPolicy.css';

const ReturnPolicy = () => {
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="return-policy-page container">
            <h1 className="section-title">Refund & Returns Policy</h1>

            <div className="policy-intro">
                <p>This policy applies exclusively to orders placed on our website. At Annsonline we believe in keeping our customers happy...always. We offer hassle-free returns. If any product that you receive does not meet your expectations do write to us at <strong>sales@annsonline.shop</strong> and we’ll surely assist you.</p>
            </div>

            <div className="policy-content">
                <section className="policy-section">
                    <h2>Returns Policy</h2>
                    <p>At Annsonline, we believe in keeping our customers happy...always. We offer hassle-free returns. If any product that you receive does not meet your expectations, write to us at sales@annsonline.shop and we’ll surely assist you.</p>
                </section>

                <section className="policy-section">
                    <h2>Product Received in Damaged Condition or Wrong Item</h2>
                    <p>If the outer packing is damaged or tampered with, we advise the customer to check the quality/quantity of the product against the invoice, before accepting the package from the courier agency.</p>
                    <ul>
                        <li>In case of any discrepancy, please leave a suitable remark at the time of receipt.</li>
                        <li>In case the product is damaged or with a manufacturing defect or a wrong product has been sent, kindly contact us at <strong>sales@annsonline.shop</strong></li>
                        <li>Kindly retain all packaging materials and product/s until a set of instructions from us regarding the same is received.</li>
                        <li>In case of any other complaints regarding the delivered package, email us at <strong>sales@annsonline.shop</strong> within 24 hours of receiving the product.</li>
                        <li>Do not return any product(s) before receiving a confirmation email from Annsonline for the same. In case you wish to return a product, write to us within 24 hours of receiving the product.</li>
                        <li>Once we verify the damage or manufacturing defect, our customer care team will email you with details on how to return the said product.</li>
                        <li>All shipping costs of returning the defective products to Annsonline, over and above such amount paid by customers towards shipping charges while receiving the same from Annsonline are to be borne by the customer entirely.</li>
                        <li>All defective products are to be returned to Annsonline in its original condition, original packaging, with the invoice and sealed carefully. Please return your order as per the instructions given to you at the time of return confirmation.</li>
                        <li>Safe receipt of defective products by Annsonline is the sole responsibility of the customer.</li>
                        <li>Annsonline shall examine the products returned for such defects/variations and ensure remedial steps are taken immediately.</li>
                        <li>In case it is found that the error has occurred due to the customer, Annsonline shall make the necessary modifications/alternations at the cost of the customer.</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2>Accessories</h2>
                    <p>Items like jewelry, dupattas, safa, clutches are an accessory and returns are not acceptable unless received damaged in transit.</p>
                </section>

                <section className="policy-section">
                    <h2>Refund</h2>
                    <ul>
                        <li>Annsonline will refund the paid amount only if the order at delivery is damaged, faulty or if the order is wrong.</li>
                        <li>No refund will be given if the order has been delivered with the color and size as selected by the customer while placing the order.</li>
                        <li>In the event of an error on the part of Annsonline, the product can be replaced or the amount will be refunded through <strong>store credit only</strong>.</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2>Partial Refunds</h2>
                    <p>In the case of multiple products being ordered, if for any reason whatsoever, Annsonline is unable to deliver a certain product/s, the customer shall be allowed to select an alternate product. However, in case the customer does not wish to select any alternate product/s, Annsonline will either provide a store credit to be used for future purchases or refund the amount for that particular product.</p>
                </section>

                <section className="policy-section">
                    <h2>Cancellation</h2>
                    <ul>
                        <li>The customer can only cancel the order within 24 hours of placing the order. No cancellations will be entertained after 24 hours.</li>
                        <li>A maximum of 4 business days is required by us to initiate the refund once a cancellation request is received. You will be notified regularly of the refund status.</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2>Credit Issues</h2>
                    <p>The credits against the customer's credit card account normally take three (3) business days to be processed. After this, the corresponding bank may take up to two (2) business days from the date of processing to show the said credits in the customer's account.</p>
                </section>

                <section className="policy-section">
                    <h2>Product Disclaimer</h2>
                    <p>The details of the products or product specifications (weight, color, handwork details, size, etc.) as mentioned in Annsonline are only approximate values. Because products on Annsonline are designer made, handwoven, and intricately crafted and sourced from various parts of India, there may be variations in color and embellishment of the actual product against that as shown on the website. This is due to the nature of fabric dyes, weather at the time of dying, and differences in display outputs due to lighting, digital photography, color settings, and capabilities of computer monitors.</p>
                    <p>Apparel consisting of embellishments like beads and sequences usually has the tendency to come off. Even with perfect handling, care, and packaging this cannot be completely avoided.</p>
                    <p>In case you are unsatisfied with the product received from Annsonline, you may contact the customer care team at <strong>support@annsonline.shop</strong> with your complaints/feedback.</p>
                </section>
            </div>
        </div>
    );
};

export default ReturnPolicy;
