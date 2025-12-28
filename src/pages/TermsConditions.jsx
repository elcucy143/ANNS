import React, { useEffect } from 'react';
import './TermsConditions.css';

const TermsConditions = () => {
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="terms-conditions-page container">
            <h1 className="section-title">Terms of Service</h1>

            <div className="policy-content">
                <section className="policy-section">
                    <p>Please read all the information on products and services as provided in relevant sections and also in "FAQ" and get a clear idea of how to order. Even though Annsonline.shop (Hyderabad) shall try to deliver the products as per the details/specifications given on the order form by the customer. All Jurisdiction and matters of arbitration in Hyderabad, India only.</p>
                </section>

                <section className="policy-section">
                    <p>It reserves a right to deliver a similar/alternate product for reasons beyond its control and any such action shall not be deemed as bad-delivery.</p>
                </section>

                <section className="policy-section">
                    <p>Even though Annsonline.shop (Hyderabad) shall try to meet the date and time of delivery schedule as given by the user in the order form, any delayed or early delivery for whatever reason shall not entitle the user to any damages or compensation from Annsonline.shop (Hyderabad). Our normal delivery schedule is specifically given with the product description.</p>
                </section>

                <section className="policy-section">
                    <p>Annsonline.shop (Hyderabad) shall take due care at the time of delivery to deliver the product to the correct person at the address on the order form, but disclaims any responsibility for claims, damages, and/or compensation.</p>
                </section>

                <section className="policy-section">
                    <p>If the user has any question, doubts or confusion in regard to any of the terms & conditions set out herein, he/she should seek clarifications from us through email and should wait for a written clarification before using the service.</p>
                </section>

                <section className="policy-section">
                    <p>This site is owned by Annsonline.shop (Hyderabad) Mumbai, Maharashtra, India. No material from this site or any other website owned, operated, controlled or licensed by Annsonline.shop (Hyderabad) Mumbai, Maharashtra, India and/or associates or sister concerns may be copied, reproduced, republished, transmitted, downloaded, uploaded or in any other manner for commercial use or otherwise without written permission of Annsonline.shop (Hyderabad) Mumbai, Maharashtra, India. Violation of this condition is a violation of copyright and other proprietary rights of Annsonline.shop (Hyderabad) and or their associates or sister concerns or affiliates.</p>
                </section>

                <section className="policy-section">
                    <p>The product/services provided on this site are without warranties of any kind either expressed or implied and Annsonline.shop (Hyderabad) disclaims all or any of them to the fullest extent.</p>
                </section>

                <section className="policy-section">
                    <p>Annsonline.shop (Hyderabad) does not warrant that the products/services offered will be error-free, or that the defects will be corrected, or that this site or the server that makes it available are or will be free of viruses or other harmful components.</p>
                </section>

                <section className="policy-section">
                    <p>Under no circumstances whatsoever shall Annsonline.shop (Hyderabad) be liable for any loss of data, lost profits or any damages whatsoever including, without limiting, any indirect, special, incidental, consequential or other damages that result from the use of or inability to use the products/services offered on the site. Notwithstanding the foregoing, in no event shall Annsonline.shop (Hyderabad) be liable to the user for any or all damages, losses, and causes of action (including but not limited to, negligence) or otherwise exceeding the amount paid by the user to Annsonline.shop (Hyderabad) for that specific service/product.</p>
                </section>

                <section className="policy-section">
                    <p>Normally an order once placed cannot be cancelled by the buyer. However, in a rare case of we accepting the cancellation request from the customer, he/she will have to bear the money transaction charges like bank charges, Exchange rate fluctuation etc.</p>
                </section>
            </div>
        </div>
    );
};

export default TermsConditions;
