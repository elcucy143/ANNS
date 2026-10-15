import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPublishedReviews } from '../services/apiClient';

const ReviewContext = createContext({ reviews: [], loading: true, refreshReviews: async () => {} });

export const ReviewProvider = ({ children }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    const refreshReviews = async () => {
        try {
            const data = await getPublishedReviews();
            setReviews(Array.isArray(data) ? data : []);
        } catch {
            setReviews([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void refreshReviews(); }, []);

    const value = useMemo(() => ({ reviews, loading, refreshReviews }), [reviews, loading]);
    return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
};

// Provider and hook intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export const useReviews = () => useContext(ReviewContext);
