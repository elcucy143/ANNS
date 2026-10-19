import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Boxes,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit3,
    FileJson,
    FileSpreadsheet,
    LayoutDashboard,
    LogOut,
    Package,
    Plus,
    Save,
    Search,
    ShoppingBag,
    Sparkles,
    UserCheck,
    Users,
    Mail,
    MessageSquareQuote,
    BadgePercent,
    BookOpenCheck,
    ImagePlus,
    Star,
    Phone,
    ReceiptText,
    RefreshCw,
    UploadCloud,
    Trash2,
    XCircle,
} from 'lucide-react';
import categoriesData from '../assets/json/categories.json';
import { isCustomerActive, readCustomers, readOrders } from '../services/customerStore';
import {
    clearAdminKey,
    approveOrderCancellation,
    deleteCustomersFromDatabase,
    deleteProductsFromDatabase,
    deleteReviewsFromDatabase,
    deleteFlashSale,
    getAdminFlashSale,
    getAdminReviews,
    getCustomersFromDatabase,
    getOrdersFromDatabase,
    getProductsFromDatabase,
    hasAdminKey,
    saveProductsToDatabase,
    saveReviewToDatabase,
    saveFlashSale,
    updateOrderFulfillment,
    verifyAdminKey,
} from '../services/apiClient';
import './ProductManager.css';
import { normalizeList, normalizeSizeList, normalizeSubcategoryList, STANDARD_CLOTHING_SIZES } from '../utils/productOptions';
import { IMAGE_FILE_ACCEPT, isSupportedImageFile, MAX_SOURCE_IMAGE_BYTES, prepareImageFile } from '../utils/imageUpload';

const ADMIN_SESSION_KEY = 'pm_auth';
const PRODUCT_DRAFT_KEY = 'anns-admin-products-draft';
const LOW_STOCK_LIMIT = 10;
const PRODUCT_CATEGORIES = ['Gifts', 'Jewellery', 'Womens Wear'];
const MAX_PRODUCT_IMAGES = 5;
const PRODUCT_SAVE_BATCH_SIZE = 100;
const PRODUCT_SAVE_BATCH_BYTES = 2.5 * 1024 * 1024;
const INVENTORY_PAGE_SIZE = 20;
const FLASH_SALE_PAGE_SIZE = 10;
const ORDERS_PAGE_SIZE = 10;
const CUSTOMERS_PAGE_SIZE = 20;
const REVIEWS_PAGE_SIZE = 10;
const CUSTOMER_HISTORY_PAGE_SIZE = 5;
const getInitialReviewForm = () => ({
    id: '',
    reviewerName: '',
    rating: 5,
    title: '',
    comment: '',
    image: '',
    productId: '',
    reviewDate: new Date().toISOString().slice(0, 10),
    featured: true,
    published: true,
});
const getInitialFlashSaleForm = () => ({
    id: 'homepage',
    title: 'Festival Flash Sale',
    subtitle: 'Limited-time prices on selected favourites.',
    badge: 'LIMITED TIME',
    bannerImage: '',
    startsAt: '',
    endsAt: '',
    active: false,
    items: [],
});
const toLocalDateTimeInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getInitialFormData = () => ({
    id: '',
    name: '',
    description: '',
    available: 'In Stock',
    price: '',
    discount: '',
    image: '',
    otherImages: [],
    color: '',
    sizes: [],
    subcategory: [],
    stock: 0,
    sold: 0,
    similarProducts: [],
    reviews: [],
    shipping: [],
    featured: 'no',
    campaign: [],
    showOnCategory: true,
});

const createEmptyCatalog = () => Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category, []]));
const readProductDraft = () => createEmptyCatalog();

const toNumber = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getStock = (product) => {
    if (product.stock !== '' && product.stock !== undefined) return Math.max(0, toNumber(product.stock));
    return Math.max(0, toNumber(product.available));
};

const getSold = (product) => Math.max(0, toNumber(product.sold));
const getRemaining = (product) => Math.max(0, getStock(product) - getSold(product));

const normalizeName = (name = '') => name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseList = normalizeList;

const normalizeCategory = (value = '') => {
    const normalized = String(value).trim().toLowerCase().replace(/[’']/g, '');
    const match = PRODUCT_CATEGORIES.find((category) => (
        category.toLowerCase().replace(/[’']/g, '') === normalized
    ));
    if (match) return match;
    if (normalized === 'womens wear') return 'Womens Wear';
    return String(value).trim();
};

const normalizeHeaders = (row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
        key.toLowerCase().replace(/[^a-z0-9]/g, ''),
        value,
    ]),
);

const valueFrom = (row, ...aliases) => {
    for (const alias of aliases) {
        const value = row[alias.toLowerCase().replace(/[^a-z0-9]/g, '')];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
};

const flattenProducts = (products) => Object.entries(products).flatMap(([category, items]) => (
    items.map((product) => ({
        ...product,
        category,
        stockValue: getStock(product),
        soldValue: getSold(product),
        remainingValue: getRemaining(product),
    }))
));

const groupDatabaseProducts = (items) => {
    const grouped = Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category, []]));
    items.forEach(({ category, ...product }) => {
        const normalizedCategory = normalizeCategory(category);
        if (!grouped[normalizedCategory]) grouped[normalizedCategory] = [];
        grouped[normalizedCategory].push(product);
    });
    return grouped;
};

const productsForDatabase = (products) => Object.entries(products).flatMap(([category, items]) => (
    items.map((product) => ({ ...product, category }))
));

const formatCurrency = (value) => `₹${toNumber(value).toLocaleString('en-IN')}`;

const AdminPagination = ({ page, pageCount, onChange, total, noun }) => {
    if (pageCount <= 1) return null;
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    return <nav className="admin-pagination" aria-label={`${noun} pages`}>
        <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button>
        {start > 1 && <><button type="button" onClick={() => onChange(1)}>1</button>{start > 2 && <span>…</span>}</>}
        {pages.map((number) => <button type="button" key={number} className={number === page ? 'active' : ''} aria-current={number === page ? 'page' : undefined} onClick={() => onChange(number)}>{number}</button>)}
        {end < pageCount && <>{end < pageCount - 1 && <span>…</span>}<button type="button" onClick={() => onChange(pageCount)}>{pageCount}</button></>}
        <button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
        <span className="pagination-count">{total} {noun}</span>
    </nav>;
};

const ProductManager = () => {
    const [products, setProducts] = useState(readProductDraft);
    const [isAuthenticated, setIsAuthenticated] = useState(() => (
        sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' && hasAdminKey()
    ));
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const initialParams = new URLSearchParams(window.location.search);
    const initialView = ['overview', 'inventory', 'orders', 'customers', 'reviews', 'flash-sale', 'import', 'instructions', 'editor'].includes(initialParams.get('view')) ? initialParams.get('view') : 'overview';
    const [activeView, setActiveView] = useState(initialView);
    const [notification, setNotification] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState(PRODUCT_CATEGORIES[0]);
    const [selectedProductId, setSelectedProductId] = useState('new');
    const [formData, setFormData] = useState(getInitialFormData);
    const [similarProductIdsInput, setSimilarProductIdsInput] = useState('');
    const [importRows, setImportRows] = useState([]);
    const [importFileName, setImportFileName] = useState('');
    const [importError, setImportError] = useState('');
    const [customers, setCustomers] = useState(readCustomers);
    const [orders, setOrders] = useState(readOrders);
    const [orderSearch, setOrderSearch] = useState('');
    const [orderUpdatingId, setOrderUpdatingId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [databaseStatus, setDatabaseStatus] = useState(hasAdminKey() ? 'connecting' : 'local');
    const [reviews, setReviews] = useState([]);
    const [reviewForm, setReviewForm] = useState(getInitialReviewForm);
    const [reviewSearch, setReviewSearch] = useState('');
    const [reviewSaving, setReviewSaving] = useState(false);
    const [flashSale, setFlashSale] = useState(getInitialFlashSaleForm);
    const [flashSaleProductId, setFlashSaleProductId] = useState('');
    const [flashSaleSaving, setFlashSaleSaving] = useState(false);
    const [bulkImageBusy, setBulkImageBusy] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [bulkStockValue, setBulkStockValue] = useState('');
    const [inventoryPage, setInventoryPage] = useState(1);
    const [flashSalePage, setFlashSalePage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [customersPage, setCustomersPage] = useState(1);
    const [reviewsPage, setReviewsPage] = useState(1);
    const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
    const fileInputRef = useRef(null);
    const bulkImageInputRef = useRef(null);
    const reviewImageInputRef = useRef(null);
    const flashSaleImageInputRef = useRef(null);
    const linkedOrderId = initialParams.get('order') || '';

    const allProducts = useMemo(() => flattenProducts(products), [products]);

    const duplicateGroups = useMemo(() => {
        const groups = new Map();
        allProducts.forEach((product) => {
            const key = normalizeName(product.name);
            if (!key) return;
            groups.set(key, [...(groups.get(key) || []), product]);
        });
        return [...groups.values()]
            .filter((group) => group.length > 1)
            .sort((first, second) => second.length - first.length);
    }, [allProducts]);

    const inventoryStats = useMemo(() => ({
        productCount: allProducts.length,
        stockUnits: allProducts.reduce((total, product) => total + product.stockValue, 0),
        soldUnits: allProducts.reduce((total, product) => total + product.soldValue, 0),
        remainingUnits: allProducts.reduce((total, product) => total + product.remainingValue, 0),
        lowStock: allProducts.filter((product) => product.remainingValue > 0 && product.remainingValue <= LOW_STOCK_LIMIT).length,
        outOfStock: allProducts.filter((product) => product.remainingValue === 0).length,
    }), [allProducts]);

    const customerInsights = useMemo(() => {
        // Never treat pending, cancelled, or failed checkout attempts as sales.
        // This also protects the UI from older API responses and local caches.
        const paidOrders = orders.filter((order) => order.paymentStatus === 'captured');
        const ordersByCustomer = new Map();
        paidOrders.forEach((order) => {
            ordersByCustomer.set(order.customerId, [...(ordersByCustomer.get(order.customerId) || []), order]);
        });
        const enrichedCustomers = customers.map((customer) => {
            const customerOrders = (ordersByCustomer.get(customer.id) || []).sort((first, second) => (
                new Date(second.paidAt || second.createdAt).getTime() - new Date(first.paidAt || first.createdAt).getTime()
            ));
            return {
                ...customer,
                active: isCustomerActive(customer),
                orders: customerOrders,
                totalSpent: customerOrders.filter((order) => !['pending', 'processed'].includes(order.refundStatus)).reduce((total, order) => total + toNumber(order.total), 0),
            };
        });
        return {
            customers: enrichedCustomers,
            activeCount: enrichedCustomers.filter((customer) => customer.active).length,
            orderCount: paidOrders.length,
            revenue: paidOrders.filter((order) => !['pending', 'processed'].includes(order.refundStatus)).reduce((total, order) => total + toNumber(order.total), 0),
        };
    }, [customers, orders]);

    const filteredCustomers = useMemo(() => {
        const query = customerSearch.trim().toLowerCase();
        return customerInsights.customers.filter((customer) => (
            !query || [customer.name, customer.email, customer.phone, customer.id]
                .join(' ').toLowerCase().includes(query)
        ));
    }, [customerInsights.customers, customerSearch]);

    const selectedCustomer = customerInsights.customers.find((customer) => customer.id === selectedCustomerId);

    const filteredOrders = useMemo(() => {
        const query = orderSearch.trim().toLowerCase();
        return orders.filter((order) => order.paymentStatus === 'captured' && (
            !query || [order.id, order.customer?.name, order.customer?.email, order.customer?.phone, order.razorpayPaymentId]
                .join(' ').toLowerCase().includes(query)
        ));
    }, [orders, orderSearch]);

    const filteredReviews = useMemo(() => {
        const query = reviewSearch.trim().toLowerCase();
        return reviews.filter((review) => !query || [review.reviewerName, review.title, review.comment, review.productId]
            .join(' ').toLowerCase().includes(query));
    }, [reviews, reviewSearch]);

    const ordersPageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
    const activeOrdersPage = Math.min(ordersPage, ordersPageCount);
    const pagedOrders = filteredOrders.slice((activeOrdersPage - 1) * ORDERS_PAGE_SIZE, activeOrdersPage * ORDERS_PAGE_SIZE);
    const customersPageCount = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMERS_PAGE_SIZE));
    const activeCustomersPage = Math.min(customersPage, customersPageCount);
    const pagedCustomers = filteredCustomers.slice((activeCustomersPage - 1) * CUSTOMERS_PAGE_SIZE, activeCustomersPage * CUSTOMERS_PAGE_SIZE);
    const reviewsPageCount = Math.max(1, Math.ceil(filteredReviews.length / REVIEWS_PAGE_SIZE));
    const activeReviewsPage = Math.min(reviewsPage, reviewsPageCount);
    const pagedReviews = filteredReviews.slice((activeReviewsPage - 1) * REVIEWS_PAGE_SIZE, activeReviewsPage * REVIEWS_PAGE_SIZE);
    const customerHistoryPageCount = Math.max(1, Math.ceil((selectedCustomer?.orders.length || 0) / CUSTOMER_HISTORY_PAGE_SIZE));
    const activeCustomerHistoryPage = Math.min(customerHistoryPage, customerHistoryPageCount);
    const pagedCustomerHistory = (selectedCustomer?.orders || []).slice((activeCustomerHistoryPage - 1) * CUSTOMER_HISTORY_PAGE_SIZE, activeCustomerHistoryPage * CUSTOMER_HISTORY_PAGE_SIZE);

    const refreshReviews = async () => {
        try {
            const databaseReviews = await getAdminReviews();
            setReviews(Array.isArray(databaseReviews) ? databaseReviews : []);
            setDatabaseStatus('connected');
        } catch (error) {
            setNotification(error.message || 'Reviews could not be loaded.');
        }
    };

    const refreshFlashSale = async () => {
        try {
            const sale = await getAdminFlashSale();
            setFlashSale({
                ...getInitialFlashSaleForm(),
                ...(sale || {}),
                startsAt: toLocalDateTimeInput(sale?.startsAt),
                endsAt: toLocalDateTimeInput(sale?.endsAt),
                items: Array.isArray(sale?.items) ? sale.items : [],
            });
            setDatabaseStatus('connected');
        } catch (error) {
            setNotification(error.message || 'Flash sale could not be loaded.');
        }
    };

    const refreshCustomerData = async () => {
        try {
            const [databaseCustomers, databaseOrders] = await Promise.all([
                getCustomersFromDatabase(),
                getOrdersFromDatabase(),
            ]);
            setCustomers(databaseCustomers);
            setOrders(databaseOrders);
            setDatabaseStatus('connected');
            setNotification('Customer activity loaded from MongoDB Atlas.');
        } catch {
            setCustomers(readCustomers());
            setOrders(readOrders());
            setDatabaseStatus('local');
            setNotification('Database unavailable—showing this browser’s local data.');
        }
        window.setTimeout(() => setNotification(''), 3000);
    };

    const submitFulfillmentUpdate = async (event, orderId) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        setOrderUpdatingId(orderId);
        setNotification('Updating order…');
        try {
            const result = await updateOrderFulfillment({
                id: orderId,
                fulfillmentStatus: fields.get('fulfillmentStatus'),
                courier: fields.get('courier'),
                trackingNumber: fields.get('trackingNumber'),
                trackingUrl: fields.get('trackingUrl'),
            });
            setOrders((current) => current.map((order) => (order.id === orderId ? result.order : order)));
            const emailState = result.order?.fulfillmentNotifications?.[result.order.fulfillmentStatus]?.status;
            setNotification(emailState === 'failed'
                ? 'Order updated, but the customer email could not be delivered.'
                : 'Order updated successfully. The customer was notified when required.');
        } catch (error) {
            setNotification(error.message || 'The order could not be updated.');
        } finally {
            setOrderUpdatingId('');
            window.setTimeout(() => setNotification(''), 4000);
        }
    };

    const approveCancellation = async (order) => {
        if (!window.confirm(`Approve cancellation and initiate a full Razorpay refund of ${formatCurrency(order.total)}?`)) return;
        setOrderUpdatingId(order.id);
        setNotification('Initiating Razorpay refund…');
        try {
            const result = await approveOrderCancellation(order.id);
            setOrders((current) => current.map((item) => item.id === order.id ? result.order : item));
            setNotification('Refund initiated. Razorpay will update the final refund status.');
        } catch (error) { setNotification(error.message || 'Refund could not be initiated.'); }
        finally { setOrderUpdatingId(''); window.setTimeout(() => setNotification(''), 5000); }
    };

    const removeCustomer = async (customer) => {
        const orderNote = customer.orders?.length
            ? ` Their ${customer.orders.length} paid order record${customer.orders.length === 1 ? '' : 's'} will be retained for accounting and fulfilment.`
            : '';
        if (!window.confirm(`Delete ${customer.name || customer.email || 'this customer'} from registered contacts?${orderNote}`)) return;

        setNotification('Removing customer…');
        try {
            await deleteCustomersFromDatabase([customer.id]);
            setCustomers((current) => current.filter((item) => item.id !== customer.id));
            if (selectedCustomerId === customer.id) setSelectedCustomerId('');
            setDatabaseStatus('connected');
            setNotification('Customer contact removed. Paid order history was preserved.');
        } catch (error) {
            setNotification(error.message || 'The customer could not be removed.');
        }
        window.setTimeout(() => setNotification(''), 3500);
    };

    const refreshProductsFromDatabase = async () => {
        try {
            const databaseProducts = await getProductsFromDatabase();
            const groupedProducts = groupDatabaseProducts(databaseProducts);
            setProducts(groupedProducts);
            localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(groupedProducts));
            setDatabaseStatus('connected');
        } catch {
            setDatabaseStatus('local');
        }
    };

    useEffect(() => {
        if (!isAuthenticated || !hasAdminKey()) return;
        void refreshProductsFromDatabase();
        void refreshCustomerData();
        void refreshReviews();
        void refreshFlashSale();
        const interval = window.setInterval(() => { void refreshProductsFromDatabase(); }, 30000);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') void refreshProductsFromDatabase();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
        // Refresh is intentionally performed when a stored admin session is restored.
    }, [isAuthenticated]);

    useEffect(() => {
        if (activeView !== 'orders' || !linkedOrderId || !orders.length) return;
        window.setTimeout(() => document.getElementById(`order-${linkedOrderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }, [activeView, linkedOrderId, orders.length]);

    const filteredProducts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return allProducts.filter((product) => {
            const matchesQuery = !query || [product.name, product.id, product.category, ...(product.subcategory || [])]
                .join(' ').toLowerCase().includes(query);
            const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
            const matchesStock = stockFilter === 'all'
                || (stockFilter === 'available' && product.remainingValue > LOW_STOCK_LIMIT)
                || (stockFilter === 'low' && product.remainingValue > 0 && product.remainingValue <= LOW_STOCK_LIMIT)
                || (stockFilter === 'out' && product.remainingValue === 0)
                || (stockFilter === 'sold' && product.soldValue > 0);
            return matchesQuery && matchesCategory && matchesStock;
        });
    }, [allProducts, searchQuery, categoryFilter, stockFilter]);
    const inventoryPageCount = Math.max(1, Math.ceil(filteredProducts.length / INVENTORY_PAGE_SIZE));
    const activeInventoryPage = Math.min(inventoryPage, inventoryPageCount);
    const pagedProducts = filteredProducts.slice((activeInventoryPage - 1) * INVENTORY_PAGE_SIZE, activeInventoryPage * INVENTORY_PAGE_SIZE);
    const flashSalePageCount = Math.max(1, Math.ceil(flashSale.items.length / FLASH_SALE_PAGE_SIZE));
    const activeFlashSalePage = Math.min(flashSalePage, flashSalePageCount);
    const pagedFlashSaleItems = flashSale.items.slice((activeFlashSalePage - 1) * FLASH_SALE_PAGE_SIZE, activeFlashSalePage * FLASH_SALE_PAGE_SIZE);

    const saveProducts = async (nextProducts, message, changedProducts = productsForDatabase(nextProducts)) => {
        setNotification(message);
        if (hasAdminKey()) {
            try {
                let saved = 0;
                const batches = changedProducts.reduce((groups, product) => {
                    const size = new Blob([JSON.stringify(product)]).size;
                    const current = groups.at(-1);
                    if (!current || current.items.length >= PRODUCT_SAVE_BATCH_SIZE || (current.bytes + size > PRODUCT_SAVE_BATCH_BYTES && current.items.length)) {
                        groups.push({ items: [product], bytes: size });
                    } else {
                        current.items.push(product);
                        current.bytes += size;
                    }
                    return groups;
                }, []);
                for (const [batchIndex, group] of batches.entries()) {
                    const batch = group.items;
                    setNotification(changedProducts.length > PRODUCT_SAVE_BATCH_SIZE
                        ? `Saving batch ${batchIndex + 1} of ${batches.length}…`
                        : message);
                    const result = await saveProductsToDatabase(batch);
                    if (result.saved !== batch.length) throw new Error(`MongoDB confirmed ${saved + result.saved} of ${changedProducts.length} products. Retry the import; existing product IDs will update safely without creating duplicates.`);
                    saved += result.saved;
                }
                setDatabaseStatus('connected');
                setNotification(`${message} ${saved} product${saved === 1 ? '' : 's'} verified in MongoDB Atlas.`);
            } catch (error) {
                setDatabaseStatus('local');
                setNotification(error.message || 'The product could not be saved to MongoDB Atlas.');
                throw error;
            }
        }
        setProducts(nextProducts);
        localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(nextProducts));
        window.setTimeout(() => setNotification(''), 3500);
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        try {
            await verifyAdminKey(passwordInput);
            sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
            setIsAuthenticated(true);
            setLoginError('');
            setDatabaseStatus('connected');
            await Promise.all([refreshProductsFromDatabase(), refreshCustomerData(), refreshReviews(), refreshFlashSale()]);
        } catch {
            setLoginError('Incorrect admin password.');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        clearAdminKey();
        setIsAuthenticated(false);
        setPasswordInput('');
    };

    const openNewProduct = () => {
        setSelectedProductId('new');
        setFormData(getInitialFormData());
        setSimilarProductIdsInput('');
        setActiveView('editor');
    };

    const resetReviewForm = () => setReviewForm(getInitialReviewForm());

    const editReview = (review) => {
        setReviewForm({ ...getInitialReviewForm(), ...review });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleReviewImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!isSupportedImageFile(file) || file.size > MAX_SOURCE_IMAGE_BYTES) {
            setNotification('Choose an image file smaller than 75 MB. Camera and WhatsApp formats are converted automatically.');
            return;
        }
        try {
            setNotification('Preparing review image…');
            const image = await prepareImageFile(file);
            setReviewForm((current) => ({ ...current, image }));
            setNotification('Review image is ready. Save the review to publish it.');
        } catch (error) {
            setNotification(error.message || 'The review image could not be prepared.');
        }
    };

    const submitReview = async (event) => {
        event.preventDefault();
        setReviewSaving(true);
        try {
            const result = await saveReviewToDatabase(reviewForm);
            setReviews((current) => [result.review, ...current.filter((item) => item.id !== result.review.id)]);
            resetReviewForm();
            setNotification('Review saved to MongoDB Atlas and updated on the storefront.');
        } catch (error) {
            setNotification(error.message || 'The review could not be saved.');
        } finally {
            setReviewSaving(false);
            window.setTimeout(() => setNotification(''), 3500);
        }
    };

    const removeReview = async (review) => {
        if (!window.confirm(`Delete the review from ${review.reviewerName}?`)) return;
        try {
            await deleteReviewsFromDatabase([review.id]);
            setReviews((current) => current.filter((item) => item.id !== review.id));
            if (reviewForm.id === review.id) resetReviewForm();
            setNotification('Review deleted.');
        } catch (error) {
            setNotification(error.message || 'The review could not be deleted.');
        }
        window.setTimeout(() => setNotification(''), 3000);
    };

    const handleFlashSaleImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!isSupportedImageFile(file) || file.size > MAX_SOURCE_IMAGE_BYTES) {
            setNotification('Choose an image file smaller than 75 MB. Camera and WhatsApp formats are converted automatically.');
            return;
        }
        try {
            setNotification('Preparing sale banner…');
            const bannerImage = await prepareImageFile(file);
            setFlashSale((current) => ({ ...current, bannerImage }));
            setNotification('Sale banner is ready. Save the sale to publish it.');
        } catch (error) { setNotification(error.message || 'The banner could not be prepared.'); }
    };

    const addFlashSaleProduct = () => {
        if (!flashSaleProductId || flashSale.items.some((item) => item.productId === flashSaleProductId)) return;
        const product = allProducts.find((item) => item.id === flashSaleProductId);
        if (!product) return;
        const regularPrice = toNumber(product.price);
        setFlashSale((current) => ({
            ...current,
            items: [...current.items, { productId: flashSaleProductId, salePrice: Math.max(1, Math.round(regularPrice * .9)) }],
        }));
        setFlashSaleProductId('');
    };

    const submitFlashSale = async (event) => {
        event.preventDefault();
        setFlashSaleSaving(true);
        try {
            const payload = {
                ...flashSale,
                startsAt: flashSale.startsAt ? new Date(flashSale.startsAt).toISOString() : '',
                endsAt: flashSale.endsAt ? new Date(flashSale.endsAt).toISOString() : '',
            };
            const result = await saveFlashSale(payload);
            setFlashSale((current) => ({ ...current, ...result.sale, startsAt: toLocalDateTimeInput(result.sale.startsAt), endsAt: toLocalDateTimeInput(result.sale.endsAt) }));
            setNotification(result.sale.active ? 'Flash sale saved and published on the homepage.' : 'Flash sale saved as inactive.');
        } catch (error) { setNotification(error.message || 'The flash sale could not be saved.'); }
        finally { setFlashSaleSaving(false); window.setTimeout(() => setNotification(''), 4000); }
    };

    const clearFlashSale = async () => {
        if (!window.confirm('Remove the flash sale configuration from the website?')) return;
        try {
            await deleteFlashSale();
            setFlashSale(getInitialFlashSaleForm());
            setNotification('Flash sale removed. Regular product prices remain unchanged.');
        } catch (error) { setNotification(error.message || 'The flash sale could not be removed.'); }
    };

    const openProduct = (product) => {
        setSelectedCategory(product.category);
        setSelectedProductId(product.id);
        setFormData({
            ...getInitialFormData(),
            ...product,
            stock: product.stockValue,
            sold: product.soldValue,
            sizes: normalizeSizeList(product.sizes),
            otherImages: parseList(product.otherImages),
            subcategory: normalizeSubcategoryList(product.subcategory),
            similarProducts: parseList(product.similarProducts),
            reviews: parseList(product.reviews),
            shipping: parseList(product.shipping),
            campaign: parseList(product.campaign),
        });
        setSimilarProductIdsInput(parseList(product.similarProducts).join(', '));
        setActiveView('editor');
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleArrayChange = (event, field) => {
        // Preserve the final empty token while typing so a comma does not
        // disappear before the administrator can enter the next value.
        const values = event.target.value.split(',').map((value) => value.trimStart());
        setFormData((current) => ({ ...current, [field]: values }));
    };

    const toggleSize = (size) => {
        setFormData((current) => ({
            ...current,
            sizes: current.sizes.includes(size)
                ? current.sizes.filter((item) => item !== size)
                : normalizeSizeList([...current.sizes, size]),
        }));
    };

    const handleImageFiles = async (event) => {
        const currentImageCount = [formData.image, ...formData.otherImages].filter(Boolean).length;
        const availableSlots = Math.max(0, MAX_PRODUCT_IMAGES - currentImageCount);
        const files = [...(event.target.files || [])].slice(0, availableSlots);
        if (!availableSlots) {
            setNotification('This product already has five images. Remove one before adding another.');
            event.target.value = '';
            window.setTimeout(() => setNotification(''), 3000);
            return;
        }
        if (!files.length) return;
        if (files.some((file) => !isSupportedImageFile(file) || file.size > MAX_SOURCE_IMAGE_BYTES)) {
            setNotification('Choose image files smaller than 75 MB each. Camera and WhatsApp formats are converted automatically.');
            window.setTimeout(() => setNotification(''), 3000);
            return;
        }
        try {
            setNotification('Preparing images…');
            const dataUrls = [];
            for (const file of files) {
                setNotification(`Preparing image ${dataUrls.length + 1} of ${files.length}: ${file.name}`);
                dataUrls.push(await prepareImageFile(file));
            }
            setFormData((current) => {
                const existingImages = [current.image, ...current.otherImages].filter(Boolean);
                const images = [...existingImages, ...dataUrls].slice(0, MAX_PRODUCT_IMAGES);
                return { ...current, image: images[0] || '', otherImages: images.slice(1) };
            });
            setNotification(`${dataUrls.length} image${dataUrls.length === 1 ? '' : 's'} prepared. Up to five will be saved with this product.`);
        } catch (error) {
            setNotification(error.message || 'The selected images could not be prepared.');
        }
        event.target.value = '';
        window.setTimeout(() => setNotification(''), 3500);
    };

    const removeProductImage = (index) => {
        setFormData((current) => {
            const images = [current.image, ...current.otherImages].filter(Boolean).filter((_, imageIndex) => imageIndex !== index);
            return { ...current, image: images[0] || '', otherImages: images.slice(1, MAX_PRODUCT_IMAGES) };
        });
    };

    const handleOtherImageUrls = (event) => {
        const uploadedImages = formData.otherImages.filter((image) => image.startsWith('data:image/'));
        const externalImages = event.target.value.split(/\n/).map((item) => item.trim()).filter(Boolean);
        setFormData((current) => ({ ...current, otherImages: [...uploadedImages, ...externalImages].slice(0, MAX_PRODUCT_IMAGES - 1) }));
    };

    const getSubcategories = () => {
        const displayName = selectedCategory === 'Womens Wear' ? "Women's Wear" : selectedCategory;
        return categoriesData.categories.find((category) => category.name === displayName)?.subCategories || [];
    };

    const editorSuggestions = useMemo(() => {
        const targetName = normalizeName(formData.name);
        const targetSubcategories = new Set(parseList(formData.subcategory));
        if (!targetName && targetSubcategories.size === 0) return [];
        return allProducts
            .filter((product) => product.id !== selectedProductId)
            .map((product) => {
                const sameName = targetName && normalizeName(product.name) === targetName;
                const sharedSubcategory = parseList(product.subcategory).some((subcategory) => targetSubcategories.has(subcategory));
                return { ...product, similarityScore: (sameName ? 2 : 0) + (sharedSubcategory ? 1 : 0) };
            })
            .filter((product) => product.similarityScore > 0)
            .sort((first, second) => second.similarityScore - first.similarityScore)
            .slice(0, 5);
    }, [allProducts, formData.name, formData.subcategory, selectedProductId]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const categoryProducts = [...(products[selectedCategory] || [])];
        const productId = String(formData.id || '').trim();
        if (!productId) {
            setNotification('Enter the exact product ID printed on your stock label. Product IDs are never generated automatically.');
            return;
        }
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/.test(productId)) {
            setNotification('Product ID can use letters, numbers, dots, hyphens and underscores only.');
            return;
        }
        const duplicate = allProducts.find((product) => product.id.toLowerCase() === productId.toLowerCase() && product.id !== selectedProductId);
        if (duplicate) {
            setNotification(`Product ID ${productId} is already used by ${duplicate.name}. Choose a unique code.`);
            return;
        }
        const similarProductIds = [...new Set(parseList(similarProductIdsInput))].filter((id) => id !== productId);
        const normalizedProduct = {
            ...getInitialFormData(),
            ...formData,
            id: productId,
            stock: Math.max(0, toNumber(formData.stock)),
            sold: Math.max(0, toNumber(formData.sold)),
            sizes: normalizeSizeList(formData.sizes),
            similarProducts: similarProductIds,
            shipping: parseList(formData.shipping),
            campaign: parseList(formData.campaign),
            available: getRemaining(formData) > 0 ? 'In Stock' : 'Out of Stock',
        };

        if (selectedProductId === 'new') {
            categoryProducts.push(normalizedProduct);
        } else {
            const index = categoryProducts.findIndex((product) => product.id === selectedProductId);
            if (index >= 0) categoryProducts[index] = normalizedProduct;
        }

        try {
            await saveProducts(
                { ...products, [selectedCategory]: categoryProducts },
                `${normalizedProduct.name} ${selectedProductId === 'new' ? 'created' : 'updated'}.`,
                [{ ...normalizedProduct, category: selectedCategory }],
            );
            setSelectedProductId(normalizedProduct.id);
        } catch {
            // saveProducts reports the actionable error in the dashboard notification.
        }
    };

    const removeProduct = async (product) => {
        if (!window.confirm(`Remove “${product.name}” from the public catalog? This cannot be undone from Product Studio.`)) return;
        try {
            await deleteProductsFromDatabase([product.id]);
            const nextProducts = {
                ...products,
                [product.category]: (products[product.category] || []).filter((item) => item.id !== product.id),
            };
            setProducts(nextProducts);
            localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(nextProducts));
            setNotification(`${product.name} was removed from MongoDB Atlas and the storefront.`);
            if (selectedProductId === product.id) openNewProduct();
        } catch (error) {
            setNotification(error.message || 'Could not remove the product. Please try again.');
        }
        window.setTimeout(() => setNotification(''), 3500);
    };

    const applyBulkStock = async () => {
        const stock = Number(bulkStockValue);
        if (!selectedProductIds.length || !Number.isFinite(stock) || stock < 0) return setNotification('Select products and enter a valid total stock value.');
        const selected = new Set(selectedProductIds);
        const changedProducts = [];
        const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [category, items.map((product) => {
            if (!selected.has(product.id)) return product;
            const updated = { ...product, stock, available: Math.max(0, stock - toNumber(product.sold)) > 0 ? 'In Stock' : 'Out of Stock' };
            changedProducts.push({ ...updated, category });
            return updated;
        })]));
        await saveProducts(nextProducts, `Stock updated for ${changedProducts.length} products.`, changedProducts);
        setSelectedProductIds([]);
        setBulkStockValue('');
    };

    const addSelectedToFlashSale = () => {
        if (!selectedProductIds.length) return;
        const selected = new Set(selectedProductIds);
        setFlashSale((current) => ({
            ...current,
            items: [...current.items, ...allProducts
                .filter((product) => selected.has(product.id) && !current.items.some((item) => item.productId === product.id))
                .map((product) => ({ productId: product.id, salePrice: Math.max(1, Math.round(toNumber(product.price) * .9)) }))],
        }));
        setSelectedProductIds([]);
        setFlashSalePage(1);
        setActiveView('flash-sale');
        setNotification('Selected products were added with a suggested 10% discount. Review prices and save the flash sale.');
    };

    const mapImportedRow = (rawRow, index) => {
        const row = normalizeHeaders(rawRow);
        const category = normalizeCategory(valueFrom(row, 'category'));
        const name = String(valueFrom(row, 'name', 'productname')).trim();
        const price = valueFrom(row, 'price', 'sellingprice');
        const id = String(valueFrom(row, 'id', 'sku', 'productid')).trim();
        const errors = [];
        if (!Object.keys(products).includes(category)) errors.push('Unknown category');
        if (!id) errors.push('Product ID is required');
        else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/.test(id)) errors.push('Product ID contains unsupported characters');
        if (!name) errors.push('Name is required');
        const numericPrice = toNumber(price, NaN);
        if (price === '' || !Number.isFinite(numericPrice) || numericPrice < 0) errors.push('Valid price is required');

        return {
            rowNumber: index + 2,
            valid: errors.length === 0,
            errors,
            category,
            product: {
                id,
                name,
                description: String(valueFrom(row, 'description')).trim(),
                price: String(price),
                discount: String(valueFrom(row, 'discount')).trim(),
                stock: Math.max(0, toNumber(valueFrom(row, 'stock', 'totalstock', 'quantity'))),
                sold: Math.max(0, toNumber(valueFrom(row, 'sold', 'soldquantity', 'unitssold'))),
                image: String(valueFrom(row, 'image', 'imageurl')).trim(),
                otherImages: parseList(valueFrom(row, 'otherimages', 'otherimageurls')),
                color: String(valueFrom(row, 'color')).trim(),
                sizes: parseList(valueFrom(row, 'sizes', 'size')),
                subcategory: parseList(valueFrom(row, 'subcategory', 'subcategories')),
                featured: String(valueFrom(row, 'featured')).trim().toLowerCase() === 'yes' ? 'yes' : 'no',
                similarProducts: parseList(valueFrom(row, 'similarproducts', 'similarproductids')),
                shipping: parseList(valueFrom(row, 'shipping', 'shippinginfo')),
                campaign: parseList(valueFrom(row, 'campaign')),
            },
        };
    };

    const handleImportFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImportError('');
        setImportRows([]);
        setImportFileName(file.name);

        try {
            let rows;
            if (file.name.toLowerCase().endsWith('.json')) {
                const parsed = JSON.parse(await file.text());
                rows = Array.isArray(parsed) ? parsed : flattenProducts(parsed);
            } else {
                const { read, utils } = await import('xlsx');
                const workbook = read(await file.arrayBuffer());
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = utils.sheet_to_json(firstSheet, { defval: '', raw: false });
            }
            if (!rows.length) throw new Error('The selected file does not contain product rows.');
            setImportRows(rows.map(mapImportedRow));
        } catch (error) {
            setImportError(error.message || 'The file could not be read.');
        }
    };

    const applyImport = async () => {
        const validRows = importRows.filter((row) => row.valid);
        const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [category, [...items]]));
        const changedProducts = [];

        validRows.forEach(({ category, product }) => {
            const exactProductId = product.id;
            const existingIndex = nextProducts[category].findIndex((item) => item.id === exactProductId);
            const existingProduct = existingIndex >= 0 ? nextProducts[category][existingIndex] : getInitialFormData();
            const importedProduct = {
                ...existingProduct,
                ...product,
                id: exactProductId,
                available: Math.max(0, product.stock - product.sold) > 0 ? 'In Stock' : 'Out of Stock',
            };
            changedProducts.push({ ...importedProduct, category });
            if (existingIndex >= 0) nextProducts[category][existingIndex] = importedProduct;
            else nextProducts[category].push(importedProduct);
        });

        try {
            await saveProducts(nextProducts, `${validRows.length} products imported.`, changedProducts);
        } catch {
            return;
        }
        setImportRows([]);
        setImportFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setActiveView('inventory');
    };

    const handleBulkImageZip = async (event) => {
        const zipFile = event.target.files?.[0];
        if (!zipFile) return;
        setBulkImageBusy(true);
        setImportError('');
        try {
            const { default: JSZip } = await import('jszip');
            const archive = await JSZip.loadAsync(zipFile);
            const productById = new Map(allProducts.map((product) => [product.id.toLowerCase(), product]));
            const productIds = [...productById.keys()].sort((first, second) => second.length - first.length);
            const groupedFiles = new Map();
            Object.values(archive.files)
                .filter((entry) => !entry.dir && isSupportedImageFile({ name: entry.name, type: '' }))
                .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }))
                .forEach((entry) => {
                    const filename = entry.name.split('/').pop() || '';
                    const stem = filename.replace(/\.[^.]+$/, '').toLowerCase();
                    const productId = productIds.find((id) => stem === id || stem.startsWith(`${id}-`) || stem.startsWith(`${id}_`) || stem.startsWith(`${id}.`));
                    if (productId) groupedFiles.set(productId, [...(groupedFiles.get(productId) || []), { entry, filename }]);
                });

            if (!groupedFiles.size) throw new Error('No images matched a product code. Name files like WW30111-1.jpg, WW30111-2.jpg.');
            const replacements = new Map();
            let preparedCount = 0;
            for (const [productId, files] of groupedFiles) {
                const prepared = [];
                for (const { entry, filename } of files.slice(0, MAX_PRODUCT_IMAGES)) {
                    const blob = await entry.async('blob');
                    const imageFile = new File([blob], filename, { type: blob.type });
                    prepared.push(await prepareImageFile(imageFile));
                    preparedCount += 1;
                    setNotification(`Preparing image ${preparedCount}…`);
                }
                if (prepared.length) replacements.set(productId, prepared);
            }

            const changedProducts = [];
            const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [category, items.map((product) => {
                const images = replacements.get(product.id.toLowerCase());
                if (!images) return product;
                const updated = { ...product, image: images[0], otherImages: images.slice(1) };
                changedProducts.push({ ...updated, category });
                return updated;
            })]));
            await saveProducts(nextProducts, `${preparedCount} images matched to ${changedProducts.length} products.`, changedProducts);
            setNotification(`${preparedCount} images uploaded and matched to ${changedProducts.length} products.`);
        } catch (error) {
            setImportError(error.message || 'The image ZIP could not be processed.');
        } finally {
            setBulkImageBusy(false);
            if (bulkImageInputRef.current) bulkImageInputRef.current.value = '';
        }
    };

    const downloadTemplate = async () => {
        const { utils, writeFileXLSX } = await import('xlsx');
        const templateRows = [{
            category: 'Jewellery',
            id: 'sample-001',
            name: 'Sample product',
            description: 'Product description',
            price: 499,
            discount: 0,
            stock: 25,
            sold: 5,
            image: '/src/assets/img/example.jpg',
            otherImages: 'image-2.jpg, image-3.jpg',
            color: 'Gold',
            sizes: 'S, M, L',
            subcategory: 'Black beads sets',
            featured: 'no',
            similarProducts: 'sample-002, sample-003',
            shipping: 'Pan India Shipping, Ships in 5 to 7 days',
            campaign: '',
        }];
        const worksheet = utils.json_to_sheet(templateRows);
        worksheet['!cols'] = Object.keys(templateRows[0]).map((key) => ({ wch: Math.max(key.length + 2, 15) }));
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Products');
        writeFileXLSX(workbook, 'ANNS-product-import-template.xlsx');
    };

    const downloadCsv = (filename, rows) => {
        if (!rows.length) return setNotification('There is no data to export.');
        const headings = Object.keys(rows[0]);
        const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
        const csv = [headings.map(quote).join(','), ...rows.map((row) => headings.map((heading) => quote(row[heading])).join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const exportInventoryCsv = () => downloadCsv('ANNS-stock.csv', allProducts.map((product) => ({
        category: product.category,
        productCode: product.id,
        productName: product.name,
        price: toNumber(product.price),
        totalStock: product.stockValue,
        unitsSold: product.soldValue,
        remainingStock: product.remainingValue,
        status: product.remainingValue === 0 ? 'Out of stock' : product.remainingValue <= LOW_STOCK_LIMIT ? 'Low stock' : 'Available',
        subcategories: parseList(product.subcategory).join(', '),
    })));

    const downloadImportErrorsCsv = () => downloadCsv('ANNS-import-errors.csv', importRows
        .filter((row) => !row.valid)
        .map((row) => ({
            row: row.rowNumber,
            errors: row.errors.join('; '),
            category: row.category,
            productCode: row.product.id,
            productName: row.product.name,
            price: row.product.price,
        })));

    const exportCustomersCsv = () => downloadCsv('ANNS-customers.csv', filteredCustomers.map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        mobile: customer.phone,
        provider: customer.provider,
        joinedAt: customer.createdAt,
        lastSeenAt: customer.lastSeenAt,
        paidOrders: customer.orders.length,
        totalSpent: customer.totalSpent,
    })));

    const exportOrdersCsv = () => downloadCsv('ANNS-paid-orders.csv', filteredOrders.flatMap((order) => (
        (order.items?.length ? order.items : [{}]).map((item) => ({
            orderId: order.id,
            paidAt: order.paidAt || order.createdAt,
            customerName: order.customer?.name,
            customerEmail: order.customer?.email,
            customerMobile: order.customer?.phone,
            paymentId: order.razorpayPaymentId,
            productCode: item.id,
            productName: item.name,
            quantity: toNumber(item.quantity, 1),
            lineTotal: toNumber(item.lineTotal),
            orderTotal: toNumber(order.total),
            fulfillmentStatus: order.fulfillmentStatus || 'processing',
            refundStatus: order.refundStatus || '',
            courier: order.courier || '',
            trackingNumber: order.trackingNumber || '',
        }))
    )));

    const customerHistoryRows = (customerList) => customerList.flatMap((customer) => (
        customer.orders.flatMap((order) => (order.items || []).map((item) => ({
            customerName: customer.name,
            email: customer.email,
            mobile: customer.phone,
            orderId: order.id,
            paidAt: order.paidAt || order.createdAt,
            paymentId: order.razorpayPaymentId,
            fulfillmentStatus: order.fulfillmentStatus || 'processing',
            refundStatus: order.refundStatus || '',
            productCode: item.id,
            productName: item.name,
            size: item.size || '',
            colour: item.color || '',
            quantity: toNumber(item.quantity, 1),
            lineTotal: toNumber(item.lineTotal),
            orderTotal: toNumber(order.total),
            courier: order.courier || '',
            trackingNumber: order.trackingNumber || '',
            trackingUrl: order.trackingUrl || '',
        })))
    ));

    const exportCustomerHistoryExcel = async (customerList = filteredCustomers) => {
        const rows = customerHistoryRows(customerList);
        if (!rows.length) return setNotification('There is no paid order history to export.');
        const { utils, writeFileXLSX } = await import('xlsx');
        const worksheet = utils.json_to_sheet(rows);
        worksheet['!cols'] = [24, 30, 16, 24, 22, 24, 16, 16, 18, 32, 10, 14, 10, 14, 14, 18, 22, 40].map((wch) => ({ wch }));
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Customer orders');
        writeFileXLSX(workbook, customerList.length === 1 ? `ANNS-${customerList[0].name || 'customer'}-orders.xlsx` : 'ANNS-customer-order-history.xlsx');
    };

    const exportCustomerHistoryPdf = (customerList = filteredCustomers) => {
        const rows = customerHistoryRows(customerList);
        if (!rows.length) return setNotification('There is no paid order history to export.');
        const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
        const popup = window.open('', '_blank');
        if (!popup) return setNotification('Allow pop-ups to download the PDF report.');
        popup.opener = null;
        const body = rows.map((row) => `<tr><td>${escape(row.customerName)}<br><small>${escape(row.email)}</small></td><td>${escape(row.orderId)}<br><small>${escape(new Date(row.paidAt).toLocaleDateString('en-IN'))}</small></td><td>${escape(row.productName)}<br><small>${escape(row.productCode)} · ${escape(row.size)}</small></td><td>${escape(row.quantity)}</td><td>₹${escape(row.lineTotal.toFixed(2))}</td><td>${escape(row.fulfillmentStatus)}${row.trackingNumber ? `<br><small>${escape(row.trackingNumber)}</small>` : ''}</td></tr>`).join('');
        popup.document.write(`<!doctype html><title>ANNS Customer Order History</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#29231f}h1{font:24px Georgia}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f1ece7}small{color:#6f6862}</style><h1>ANNS Customer Order History</h1><p>Generated ${new Date().toLocaleString('en-IN')} · Paid orders only</p><table><thead><tr><th>Customer</th><th>Order</th><th>Product / code</th><th>Qty</th><th>Amount</th><th>Status / tracking</th></tr></thead><tbody>${body}</tbody></table>`);
        popup.document.close();
        window.setTimeout(() => popup.print(), 100);
    };

    const downloadJson = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'products.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    if (!isAuthenticated) {
        return (
            <section className="admin-login-page">
                <div className="admin-login-card">
                    <div className="admin-login-mark"><Package size={26} /></div>
                    <p className="admin-kicker">ANNS ADMIN</p>
                    <h1>Inventory workspace</h1>
                    <p>Sign in to manage products, stock and bulk imports.</p>
                    <form onSubmit={handleLogin}>
                        <label htmlFor="admin-password">Admin password</label>
                        <input
                            id="admin-password"
                            type="password"
                            value={passwordInput}
                            onChange={(event) => setPasswordInput(event.target.value)}
                            placeholder="Enter password"
                            autoFocus
                        />
                        {loginError && <p className="admin-error" role="alert">{loginError}</p>}
                        <button type="submit">Open dashboard <ChevronRight size={18} /></button>
                    </form>
                </div>
            </section>
        );
    }

    const navigation = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'inventory', label: 'Inventory', icon: Boxes },
        { id: 'orders', label: 'Orders', icon: ReceiptText },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'reviews', label: 'Reviews', icon: MessageSquareQuote },
        { id: 'flash-sale', label: 'Flash sale', icon: BadgePercent },
        { id: 'import', label: 'Bulk import', icon: UploadCloud },
        { id: 'instructions', label: 'Instructions', icon: BookOpenCheck },
        { id: 'editor', label: selectedProductId === 'new' ? 'Add product' : 'Edit product', icon: Edit3 },
    ];

    const handleNavigation = (view) => {
        setActiveView(view);
        if (view === 'customers') refreshCustomerData();
        if (view === 'orders') refreshCustomerData();
        if (view === 'reviews') refreshReviews();
        if (view === 'flash-sale') refreshFlashSale();
        if ((view === 'overview' || view === 'inventory') && hasAdminKey()) refreshProductsFromDatabase();
    };

    const statCards = [
        { label: 'Products', value: inventoryStats.productCount.toLocaleString('en-IN'), note: 'Across all categories', icon: Package, tone: 'neutral' },
        { label: 'Total stock', value: inventoryStats.stockUnits.toLocaleString('en-IN'), note: 'Units entered', icon: Boxes, tone: 'blue' },
        { label: 'Units sold', value: inventoryStats.soldUnits.toLocaleString('en-IN'), note: inventoryStats.soldUnits ? 'Recorded sales' : 'Add sold values to begin', icon: ShoppingBag, tone: 'green' },
        { label: 'Remaining', value: inventoryStats.remainingUnits.toLocaleString('en-IN'), note: `${inventoryStats.lowStock} low · ${inventoryStats.outOfStock} out`, icon: AlertTriangle, tone: 'amber' },
        { label: 'Active users', value: customerInsights.activeCount.toLocaleString('en-IN'), note: `${customers.length} registered contacts`, icon: UserCheck, tone: 'purple' },
    ];

    return (
        <section className="admin-dashboard-page">
            <aside className="admin-sidebar">
                <div>
                    <p className="admin-kicker">ANNS ADMIN</p>
                    <h2>Product Studio</h2>
                </div>
                <nav aria-label="Admin navigation">
                    {navigation.map((item) => (
                        <button key={item.id} type="button" className={activeView === item.id ? 'active' : ''} onClick={() => handleNavigation(item.id)}>
                            {React.createElement(item.icon, { size: 19 })} {item.label}
                        </button>
                    ))}
                </nav>
                <div className="admin-sidebar-foot">
                    <button type="button" onClick={downloadJson}><FileJson size={18} /> Export JSON</button>
                    <button type="button" onClick={handleLogout}><LogOut size={18} /> Sign out</button>
                </div>
            </aside>

            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <p className="admin-kicker">CATALOG MANAGEMENT</p>
                        <h1>{navigation.find((item) => item.id === activeView)?.label}</h1>
                    </div>
                    <div className="admin-top-actions">
                        <span className={`database-status ${databaseStatus}`}><i /> {databaseStatus === 'connected' ? 'Atlas connected' : databaseStatus === 'connecting' ? 'Connecting' : 'Local mode'}</span>
                        <button type="button" className="admin-secondary-button" onClick={() => handleNavigation('import')}><UploadCloud size={18} /> Import</button>
                        <button type="button" className="admin-primary-button" onClick={openNewProduct}><Plus size={18} /> Add product</button>
                    </div>
                </header>

                {notification && <div className="admin-notification"><CheckCircle2 size={18} /> {notification}</div>}

                {activeView === 'overview' && (
                    <div className="admin-view-stack">
                        <section className="admin-stat-grid">
                            {statCards.map((card) => (
                                <article className={`admin-stat-card ${card.tone}`} key={card.label}>
                                    <div className="admin-stat-icon">{React.createElement(card.icon, { size: 21 })}</div>
                                    <p>{card.label}</p>
                                    <strong>{card.value}</strong>
                                    <span>{card.note}</span>
                                </article>
                            ))}
                        </section>

                        <section className="admin-overview-grid">
                            <article className="admin-panel">
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">INVENTORY HEALTH</p><h2>Needs attention</h2></div>
                                    <button type="button" onClick={() => { setStockFilter('low'); setActiveView('inventory'); }}>View inventory</button>
                                </div>
                                <div className="admin-health-list">
                                    <button type="button" onClick={() => { setStockFilter('out'); setActiveView('inventory'); }}>
                                        <span className="health-dot red" /><div><strong>{inventoryStats.outOfStock} out of stock</strong><small>Products with no remaining units</small></div><ChevronRight size={18} />
                                    </button>
                                    <button type="button" onClick={() => { setStockFilter('low'); setActiveView('inventory'); }}>
                                        <span className="health-dot amber" /><div><strong>{inventoryStats.lowStock} low stock</strong><small>Products with {LOW_STOCK_LIMIT} units or fewer</small></div><ChevronRight size={18} />
                                    </button>
                                    <button type="button" onClick={() => { setSearchQuery(duplicateGroups[0]?.[0]?.name || ''); setStockFilter('all'); setActiveView('inventory'); }}>
                                        <span className="health-dot blue" /><div><strong>{duplicateGroups.length} similar groups</strong><small>Repeated names that may need review</small></div><Sparkles size={18} />
                                    </button>
                                </div>
                            </article>

                            <article className="admin-panel">
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">CATEGORY MIX</p><h2>Catalog breakdown</h2></div>
                                </div>
                                <div className="category-breakdown">
                                    {Object.entries(products).map(([category, items]) => {
                                        const percentage = allProducts.length ? (items.length / allProducts.length) * 100 : 0;
                                        return (
                                            <div key={category}>
                                                <span><strong>{category}</strong><small>{items.length} products</small></span>
                                                <div className="category-bar"><i style={{ width: `${percentage}%` }} /></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </article>
                        </section>

                        <section className="admin-panel">
                            <div className="admin-panel-heading">
                                <div><p className="admin-kicker">SIMILARITY CHECK</p><h2>Repeated product names</h2></div>
                                <span className="admin-count-badge">{duplicateGroups.length} groups</span>
                            </div>
                            {duplicateGroups.length ? (
                                <div className="similar-group-grid">
                                    {duplicateGroups.slice(0, 6).map((group) => (
                                        <button type="button" key={normalizeName(group[0].name)} onClick={() => openProduct(group[0])}>
                                            <span>{group.length}</span>
                                            <div><strong>{group[0].name.trim()}</strong><small>{group.slice(0, 3).map((product) => product.id).join(' · ')}</small></div>
                                            <ChevronRight size={17} />
                                        </button>
                                    ))}
                                </div>
                            ) : <div className="admin-empty-state"><CheckCircle2 size={28} /><p>No duplicate product names found.</p></div>}
                        </section>
                    </div>
                )}

                {activeView === 'inventory' && (
                    <section className="admin-panel inventory-panel">
                        <div className="inventory-toolbar">
                            <div className="admin-search"><Search size={18} /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setInventoryPage(1); }} placeholder="Search by name, ID or subcategory" /></div>
                            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setInventoryPage(1); }} aria-label="Filter by category">
                                <option value="all">All categories</option>
                                {Object.keys(products).map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                            <select value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setInventoryPage(1); }} aria-label="Filter by stock status">
                                <option value="all">All stock</option>
                                <option value="available">Available</option>
                                <option value="low">Low stock</option>
                                <option value="out">Out of stock</option>
                                <option value="sold">Has sales</option>
                            </select>
                            <button type="button" className="admin-icon-button" onClick={exportInventoryCsv} title="Download complete stock CSV"><Download size={18} /></button>
                        </div>
                        <div className="inventory-summary-line"><strong>{filteredProducts.length}</strong> products shown <span>·</span> Remaining = total stock − sold</div>
                        {selectedProductIds.length > 0 && <div className="bulk-product-toolbar"><strong>{selectedProductIds.length} selected</strong><label>Total stock<input type="number" min="0" value={bulkStockValue} onChange={(event) => setBulkStockValue(event.target.value)} placeholder="Set stock" /></label><button type="button" className="admin-secondary-button" onClick={applyBulkStock}>Update stock</button><button type="button" className="admin-secondary-button" onClick={addSelectedToFlashSale}><BadgePercent size={16} /> Add to Flash Sale</button><button type="button" className="admin-secondary-button" onClick={() => setSelectedProductIds([])}>Clear</button></div>}
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th><input type="checkbox" aria-label="Select this page" checked={pagedProducts.length > 0 && pagedProducts.every((product) => selectedProductIds.includes(product.id))} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, ...pagedProducts.map((product) => product.id)])] : current.filter((id) => !pagedProducts.some((product) => product.id === id)))} /></th><th>Product</th><th>Category</th><th>Price</th><th>Total stock</th><th>Sold</th><th>Remaining</th><th>Status</th><th aria-label="Actions" /></tr></thead>
                                <tbody>
                                    {pagedProducts.map((product) => {
                                        const status = product.remainingValue === 0 ? 'out' : product.remainingValue <= LOW_STOCK_LIMIT ? 'low' : 'available';
                                        return (
                                            <tr key={`${product.category}-${product.id}`}>
                                                <td><input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))} /></td>
                                                <td><strong>{product.name}</strong><small>{product.id}</small></td>
                                                <td>{product.category}</td>
                                                <td>{formatCurrency(product.price)}</td>
                                                <td>{product.stockValue.toLocaleString('en-IN')}</td>
                                                <td>{product.soldValue.toLocaleString('en-IN')}</td>
                                                <td><strong>{product.remainingValue.toLocaleString('en-IN')}</strong></td>
                                                <td><span className={`stock-status ${status}`}>{status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'Available'}</span></td>
                                                <td><div className="table-actions"><button type="button" className="table-edit-button" onClick={() => openProduct(product)} aria-label={`Edit ${product.name}`}><Edit3 size={16} /></button><button type="button" className="table-delete-button" onClick={() => removeProduct(product)} aria-label={`Remove ${product.name}`}><Trash2 size={16} /></button></div></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <AdminPagination page={activeInventoryPage} pageCount={inventoryPageCount} onChange={setInventoryPage} total={filteredProducts.length} noun="products" />
                        {!filteredProducts.length && <div className="admin-empty-state"><Search size={27} /><p>No products match these filters.</p></div>}
                    </section>
                )}

                {activeView === 'orders' && (
                    <div className="admin-view-stack">
                        <section className="customer-stat-grid">
                            <article className="customer-stat"><ReceiptText size={21} /><div><span>Paid orders</span><strong>{customerInsights.orderCount}</strong><small>Captured by Razorpay</small></div></article>
                            <article className="customer-stat"><ShoppingBag size={21} /><div><span>Paid revenue</span><strong>{formatCurrency(customerInsights.revenue)}</strong><small>Verified payments only</small></div></article>
                            <article className="customer-stat"><Package size={21} /><div><span>To process</span><strong>{orders.filter((order) => order.paymentStatus === 'captured' && !order.refundStatus && order.cancellation?.status !== 'requested' && !['shipped', 'out_for_delivery', 'delivered'].includes(order.fulfillmentStatus)).length}</strong><small>Processing or packed</small></div></article>
                            <article className="customer-stat"><CheckCircle2 size={21} /><div><span>Delivered</span><strong>{orders.filter((order) => order.fulfillmentStatus === 'delivered').length}</strong><small>Completed orders</small></div></article>
                        </section>
                        <section className="admin-panel order-management-panel">
                            <div className="customer-toolbar">
                                <div className="admin-search"><Search size={18} /><input value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setOrdersPage(1); }} placeholder="Search order, customer, email or payment ID" /></div>
                                <button type="button" className="admin-secondary-button" onClick={exportOrdersCsv}><FileSpreadsheet size={17} /> Download CSV</button>
                                <button type="button" className="admin-secondary-button" onClick={refreshCustomerData}><RefreshCw size={17} /> Refresh orders</button>
                            </div>
                            <div className="fulfillment-order-list">
                                {pagedOrders.map((order) => {
                                    const address = order.shippingAddress || {};
                                    const currentStatus = order.fulfillmentStatus || 'processing';
                                    const statusOrder = ['processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
                                    const currentStatusIndex = statusOrder.indexOf(currentStatus);
                                    return (
                                        <article className={`fulfillment-order ${linkedOrderId === order.id ? 'linked-order' : ''}`} id={`order-${order.id}`} key={order.id}>
                                            <div className="fulfillment-order-head">
                                                <div><p className="admin-kicker">ORDER {order.id}</p><h3>{order.customer?.name || 'Customer'}</h3><small>{[order.customer?.email, order.customer?.phone].filter(Boolean).join(' · ')}</small></div>
                                                <div><span className={`fulfillment-badge ${currentStatus}`}>{currentStatus}</span><strong>{formatCurrency(order.total)}</strong><small>{new Date(order.paidAt || order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
                                            </div>
                                            <div className="fulfillment-products">
                                                {(order.items || []).map((item, index) => <span key={`${order.id}-${item.id || index}`}><strong>{toNumber(item.quantity, 1)}× {item.name}</strong><small>{[item.size, item.color].filter(Boolean).join(' · ')}</small></span>)}
                                            </div>
                                            <div className="fulfillment-meta"><span><strong>Delivery:</strong> {[address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode].filter(Boolean).join(', ')}</span><span><strong>Payment:</strong> {order.razorpayPaymentId || 'Captured'}</span></div>
                                            {order.cancellation?.status && <div className="admin-alert"><strong>Cancellation: {order.cancellation.status}</strong><span>{order.cancellation.reason}</span>{order.cancellation.status === 'requested' && <button type="button" className="admin-primary-button" disabled={orderUpdatingId === order.id} onClick={() => approveCancellation(order)}>Approve & refund</button>}{order.refundStatus && <span>Refund status: {order.refundStatus}</span>}</div>}
                                            <form key={order.updatedAt} className="fulfillment-form" onSubmit={(event) => submitFulfillmentUpdate(event, order.id)}>
                                                <label>Status<select name="fulfillmentStatus" defaultValue={currentStatus}>{statusOrder.map((status, index) => <option key={status} value={status} disabled={index < currentStatusIndex}>{status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')}</option>)}</select></label>
                                                <label>Courier<input name="courier" defaultValue={order.courier || ''} maxLength="100" placeholder="For example: Delhivery" /></label>
                                                <label>Tracking number<input name="trackingNumber" defaultValue={order.trackingNumber || ''} maxLength="120" placeholder="Courier tracking ID" /></label>
                                                <label>Tracking link<input name="trackingUrl" type="url" defaultValue={order.trackingUrl || ''} maxLength="1000" placeholder="https://…" /></label>
                                                <button type="submit" className="admin-primary-button" disabled={orderUpdatingId === order.id}>{orderUpdatingId === order.id ? 'Saving…' : 'Update order'}</button>
                                            </form>
                                            {order.fulfillmentNotifications?.[currentStatus] && <p className={`fulfillment-email-state ${order.fulfillmentNotifications[currentStatus].status}`}>Customer email: {order.fulfillmentNotifications[currentStatus].status}</p>}
                                        </article>
                                    );
                                })}
                                {!filteredOrders.length && <div className="admin-empty-state"><ReceiptText size={28} /><p>No paid orders match this search.</p></div>}
                            </div>
                            <AdminPagination page={activeOrdersPage} pageCount={ordersPageCount} onChange={setOrdersPage} total={filteredOrders.length} noun="paid orders" />
                        </section>
                    </div>
                )}

                {activeView === 'customers' && (
                    <div className="admin-view-stack">
                        <section className="customer-stat-grid">
                            <article className="customer-stat"><UserCheck size={21} /><div><span>Active users</span><strong>{customerInsights.activeCount}</strong><small>Signed in within 30 minutes</small></div></article>
                            <article className="customer-stat"><Users size={21} /><div><span>Registered contacts</span><strong>{customers.length}</strong><small>Email and mobile registrations</small></div></article>
                            <article className="customer-stat"><ReceiptText size={21} /><div><span>Paid orders</span><strong>{customerInsights.orderCount}</strong><small>Verified payments only</small></div></article>
                            <article className="customer-stat"><ShoppingBag size={21} /><div><span>Paid revenue</span><strong>{formatCurrency(customerInsights.revenue)}</strong><small>From captured payments</small></div></article>
                        </section>

                        <section className="admin-panel customer-panel">
                            <div className="customer-toolbar">
                                <div className="admin-search"><Search size={18} /><input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomersPage(1); }} placeholder="Search name, email or mobile" /></div>
                                <button type="button" className="admin-secondary-button" onClick={exportCustomersCsv}><FileSpreadsheet size={17} /> Customers CSV</button>
                                <button type="button" className="admin-secondary-button" onClick={() => exportCustomerHistoryExcel()}><Download size={17} /> Order history</button>
                                <button type="button" className="admin-secondary-button" onClick={refreshCustomerData}><RefreshCw size={17} /> Refresh activity</button>
                            </div>
                            <div className="admin-table-wrap">
                                <table className="admin-table customer-table">
                                    <thead><tr><th>Customer</th><th>Contact</th><th>Sign-in</th><th>Activity</th><th>Orders</th><th>Total spent</th><th aria-label="Customer actions" /></tr></thead>
                                    <tbody>
                                        {pagedCustomers.map((customer) => (
                                            <tr key={customer.id}>
                                                <td><div className="customer-name-cell">{customer.picture ? <img src={customer.picture} alt="" /> : <span>{customer.name?.charAt(0)?.toUpperCase() || 'A'}</span>}<div><strong>{customer.name}</strong><small>Joined {new Date(customer.createdAt).toLocaleDateString('en-IN')}</small></div></div></td>
                                                <td><div className="customer-contact">{customer.email && <span><Mail size={14} /> {customer.email}</span>}{customer.phone && <span><Phone size={14} /> +91 {customer.phone}</span>}{!customer.email && !customer.phone && <small>No contact recorded</small>}</div></td>
                                                <td><span className="provider-badge">{customer.provider}</span></td>
                                                <td><span className={`activity-badge ${customer.active ? 'active' : 'inactive'}`}><i /> {customer.active ? 'Active now' : 'Inactive'}</span><small>{customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No activity'}</small></td>
                                                <td>{customer.orders.length}</td>
                                                <td><strong>{formatCurrency(customer.totalSpent)}</strong></td>
                                                <td><div className="customer-actions"><button type="button" className={`history-button ${selectedCustomerId === customer.id ? 'selected' : ''}`} onClick={() => { setSelectedCustomerId(selectedCustomerId === customer.id ? '' : customer.id); setCustomerHistoryPage(1); }}><ReceiptText size={15} /> {selectedCustomerId === customer.id ? 'Close' : 'View history'}</button><button type="button" className="customer-delete-button" onClick={() => removeCustomer(customer)} aria-label={`Delete ${customer.name || 'customer'}`} title="Delete customer contact"><Trash2 size={15} /></button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <AdminPagination page={activeCustomersPage} pageCount={customersPageCount} onChange={setCustomersPage} total={filteredCustomers.length} noun="customers" />
                            {!filteredCustomers.length && <div className="admin-empty-state"><Users size={28} /><p>No registered customers yet. New Google, email and mobile sign-ins will appear here.</p></div>}
                        </section>

                        {selectedCustomer && (
                            <section className="admin-panel purchase-history-panel">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">COMPLETE PURCHASE HISTORY</p><h2>{selectedCustomer.name}</h2><p className="history-customer-contact">{[selectedCustomer.email, selectedCustomer.phone && `+91 ${selectedCustomer.phone}`].filter(Boolean).join(' · ')}</p></div><div className="history-heading-actions"><span className="admin-count-badge">{selectedCustomer.orders.length} paid order{selectedCustomer.orders.length === 1 ? '' : 's'} · {formatCurrency(selectedCustomer.totalSpent)}</span><button type="button" className="admin-secondary-button" onClick={() => exportCustomerHistoryExcel([selectedCustomer])}><FileSpreadsheet size={16} /> Excel</button><button type="button" className="admin-secondary-button" onClick={() => exportCustomerHistoryPdf([selectedCustomer])}><Download size={16} /> PDF</button><button type="button" className="history-close-button" onClick={() => setSelectedCustomerId('')} aria-label="Close purchase history"><XCircle size={20} /></button></div></div>
                                {selectedCustomer.orders.length ? (
                                    <div className="order-history-list">{pagedCustomerHistory.map((order) => {
                                        const address = order.shippingAddress || {};
                                        const addressText = [address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(', ');
                                        const paidDate = order.paidAt || order.createdAt;
                                        return (
                                            <article className="order-history-card" key={order.id}>
                                                <header className="order-history-summary">
                                                    <div><span>Order ID</span><strong>{order.id}</strong></div>
                                                    <div><span>Payment</span><strong className="order-status">Paid</strong></div>
                                                    <div><span>Paid on</span><strong>{paidDate ? new Date(paidDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'}</strong></div>
                                                    <div><span>Order total</span><strong>{formatCurrency(order.total)}</strong></div>
                                                </header>
                                                <div className="history-item-list">
                                                    {(order.items || []).map((item, index) => (
                                                        <div className="history-line-item" key={`${order.id}-${item.id || item.name}-${index}`}>
                                                            {item.image ? <img src={item.image} alt="" /> : <div className="history-item-placeholder"><Package size={18} /></div>}
                                                            <div><strong>{item.name || item.id || 'Product'}</strong><small>{[item.size && `Size: ${item.size}`, item.color && `Colour: ${item.color}`, item.id && `ID: ${item.id}`].filter(Boolean).join(' · ') || 'Standard option'}</small></div>
                                                            <span>Qty {toNumber(item.quantity, 1)}</span>
                                                            <strong>{formatCurrency(item.lineTotal ?? (toNumber(item.price) * toNumber(item.quantity, 1)))}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                                <footer className="order-history-details">
                                                    <div><span>Delivery address</span><strong>{addressText || 'Not recorded'}</strong></div>
                                                    <div><span>Razorpay payment ID</span><strong>{order.razorpayPaymentId || 'Captured by Razorpay'}</strong></div>
                                                    <div><span>Estimated delivery</span><strong>{order.deliveryEstimate?.end ? new Date(order.deliveryEstimate.end).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Not recorded'}</strong></div>
                                                </footer>
                                            </article>
                                        );
                                    })}</div>
                                ) : <div className="admin-empty-state"><ReceiptText size={28} /><p>No purchases recorded for this customer.</p></div>}
                                <AdminPagination page={activeCustomerHistoryPage} pageCount={customerHistoryPageCount} onChange={setCustomerHistoryPage} total={selectedCustomer.orders.length} noun="orders" />
                            </section>
                        )}

                        <section className="admin-panel customer-data-note"><AlertTriangle size={21} /><div><strong>{databaseStatus === 'connected' ? 'MongoDB analytics' : 'Offline fallback'}</strong><p>{databaseStatus === 'connected' ? 'Customer sessions, contacts and paid-order history are loaded from the shared MongoDB database.' : 'The database is unavailable, so this browser’s cached data is shown until the connection recovers.'}</p></div></section>
                    </div>
                )}

                {activeView === 'reviews' && (
                    <div className="admin-view-stack">
                        <section className="review-admin-grid">
                            <form className="admin-panel review-editor" onSubmit={submitReview}>
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">CUSTOMER TESTIMONIAL</p><h2>{reviewForm.id ? 'Edit review' : 'Add a review'}</h2></div>
                                    {reviewForm.id && <button type="button" className="admin-secondary-button" onClick={resetReviewForm}>New review</button>}
                                </div>
                                <p className="review-editor-intro">Add testimonials received through WhatsApp or business groups. Only published entries appear on the website.</p>
                                <div className="editor-form-grid">
                                    <label>Customer name<input value={reviewForm.reviewerName} maxLength="120" required onChange={(event) => setReviewForm((current) => ({ ...current, reviewerName: event.target.value }))} placeholder="Customer name" /></label>
                                    <label>Review date<input type="date" value={reviewForm.reviewDate} onChange={(event) => setReviewForm((current) => ({ ...current, reviewDate: event.target.value }))} /></label>
                                    <fieldset className="review-rating-field full-width"><legend>Rating</legend><div>{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={rating <= reviewForm.rating ? 'selected' : ''} onClick={() => setReviewForm((current) => ({ ...current, rating }))} aria-label={`${rating} stars`}><Star size={21} fill={rating <= reviewForm.rating ? 'currentColor' : 'none'} /></button>)}</div></fieldset>
                                    <label className="full-width">Short heading<input value={reviewForm.title} maxLength="160" onChange={(event) => setReviewForm((current) => ({ ...current, title: event.target.value }))} placeholder="For example: Beautiful quality and quick delivery" /></label>
                                    <label className="full-width">Review text<textarea rows="5" value={reviewForm.comment} maxLength="1500" required onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} placeholder="Paste the customer’s testimonial here" /><small>{reviewForm.comment.length}/1500 characters</small></label>
                                    <label className="full-width">Related product (optional)<select value={reviewForm.productId} onChange={(event) => setReviewForm((current) => ({ ...current, productId: event.target.value }))}><option value="">General store review</option>{allProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.id}</option>)}</select><small>Product-linked reviews also appear on that product page.</small></label>
                                </div>
                                <div className="review-image-uploader">
                                    <input ref={reviewImageInputRef} className="visually-hidden" type="file" accept={IMAGE_FILE_ACCEPT} onChange={handleReviewImage} />
                                    {reviewForm.image ? <div className="review-image-preview"><img src={reviewForm.image} alt="Review preview" /><button type="button" onClick={() => setReviewForm((current) => ({ ...current, image: '' }))}><Trash2 size={16} /> Remove image</button></div> : <button type="button" className="review-upload-button" onClick={() => reviewImageInputRef.current?.click()}><ImagePlus size={24} /><strong>Add screenshot or customer photo</strong><small>Optional · WhatsApp screenshots are optimized automatically</small></button>}
                                </div>
                                <div className="review-publish-options">
                                    <label><input type="checkbox" checked={reviewForm.featured} onChange={(event) => setReviewForm((current) => ({ ...current, featured: event.target.checked }))} /> Feature on homepage</label>
                                    <label><input type="checkbox" checked={reviewForm.published} onChange={(event) => setReviewForm((current) => ({ ...current, published: event.target.checked }))} /> Published</label>
                                </div>
                                <button className="admin-primary-button review-save-button" type="submit" disabled={reviewSaving}><Save size={18} /> {reviewSaving ? 'Saving…' : 'Save review'}</button>
                            </form>

                            <section className="admin-panel review-library">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">REVIEW LIBRARY</p><h2>{reviews.length} testimonials</h2></div><button type="button" className="admin-icon-button" onClick={refreshReviews} title="Refresh reviews"><RefreshCw size={17} /></button></div>
                                <div className="admin-search review-search"><Search size={18} /><input value={reviewSearch} onChange={(event) => { setReviewSearch(event.target.value); setReviewsPage(1); }} placeholder="Search reviews" /></div>
                                <div className="review-admin-list">
                                    {pagedReviews.map((review) => (
                                        <article key={review.id}>
                                            {review.image ? <img src={review.image} alt="" /> : <span className="review-list-avatar">{review.reviewerName?.charAt(0)?.toUpperCase() || 'A'}</span>}
                                            <div className="review-list-copy">
                                                <div><strong>{review.reviewerName}</strong><span className="review-list-stars">{[1, 2, 3, 4, 5].map((rating) => <Star key={rating} size={13} fill={rating <= review.rating ? 'currentColor' : 'none'} />)}</span></div>
                                                {review.title && <h3>{review.title}</h3>}
                                                <p>{review.comment}</p>
                                                <small>{review.reviewDate} · {review.productId ? `Product ${review.productId}` : 'General review'} · {review.featured ? 'Homepage featured' : 'Not featured'} · {review.published ? 'Published' : 'Hidden'}</small>
                                            </div>
                                            <div className="review-list-actions"><button type="button" onClick={() => editReview(review)} title="Edit review"><Edit3 size={16} /></button><button type="button" className="delete" onClick={() => removeReview(review)} title="Delete review"><Trash2 size={16} /></button></div>
                                        </article>
                                    ))}
                                </div>
                                <AdminPagination page={activeReviewsPage} pageCount={reviewsPageCount} onChange={setReviewsPage} total={filteredReviews.length} noun="reviews" />
                                {!filteredReviews.length && <div className="admin-empty-state"><MessageSquareQuote size={28} /><p>No reviews yet. Add the first customer testimonial using the form.</p></div>}
                            </section>
                        </section>
                    </div>
                )}

                {activeView === 'flash-sale' && (
                    <form className="admin-view-stack" onSubmit={submitFlashSale}>
                        <section className="admin-panel flash-sale-editor">
                            <div className="admin-panel-heading">
                                <div><p className="admin-kicker">HOMEPAGE CAMPAIGN</p><h2>Festival flash sale</h2></div>
                                <label className="flash-sale-active"><input type="checkbox" checked={flashSale.active} onChange={(event) => setFlashSale((current) => ({ ...current, active: event.target.checked }))} /><span>{flashSale.active ? 'Active' : 'Inactive'}</span></label>
                            </div>
                            <p className="review-editor-intro">Choose existing products and set a lower sale price. Checkout verifies the active discount on the server before creating the Razorpay order.</p>
                            <div className="editor-form-grid">
                                <label>Sale title<input value={flashSale.title} maxLength="120" required onChange={(event) => setFlashSale((current) => ({ ...current, title: event.target.value }))} placeholder="Diwali Flash Sale" /></label>
                                <label>Badge text<input value={flashSale.badge} maxLength="40" onChange={(event) => setFlashSale((current) => ({ ...current, badge: event.target.value }))} placeholder="DIWALI DEALS" /></label>
                                <label className="full-width">Short message<input value={flashSale.subtitle} maxLength="240" onChange={(event) => setFlashSale((current) => ({ ...current, subtitle: event.target.value }))} placeholder="Celebrate with limited-time festive prices" /></label>
                                <label>Starts<input type="datetime-local" value={flashSale.startsAt} onChange={(event) => setFlashSale((current) => ({ ...current, startsAt: event.target.value }))} /></label>
                                <label>Ends<input type="datetime-local" value={flashSale.endsAt} onChange={(event) => setFlashSale((current) => ({ ...current, endsAt: event.target.value }))} /></label>
                            </div>
                            <div className="flash-sale-banner-uploader">
                                <input ref={flashSaleImageInputRef} className="visually-hidden" type="file" accept={IMAGE_FILE_ACCEPT} onChange={handleFlashSaleImage} />
                                {flashSale.bannerImage ? <div className="flash-sale-banner-preview"><img src={flashSale.bannerImage} alt="Flash sale banner preview" /><button type="button" onClick={() => setFlashSale((current) => ({ ...current, bannerImage: '' }))}><Trash2 size={16} /> Remove banner</button></div> : <button type="button" className="review-upload-button" onClick={() => flashSaleImageInputRef.current?.click()}><ImagePlus size={24} /><strong>Add festival banner image</strong><small>Optional · the layout also works without an image</small></button>}
                            </div>
                        </section>

                        <section className="admin-panel flash-sale-products-editor">
                            <div className="admin-panel-heading"><div><p className="admin-kicker">DISCOUNTED PRODUCTS</p><h2>{flashSale.items.length} sale item{flashSale.items.length === 1 ? '' : 's'}</h2></div></div>
                            <div className="flash-sale-product-picker">
                                <select value={flashSaleProductId} onChange={(event) => setFlashSaleProductId(event.target.value)}>
                                    <option value="">Select a product</option>
                                    {allProducts.filter((product) => !flashSale.items.some((item) => item.productId === product.id)).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.id} · {formatCurrency(product.price)}</option>)}
                                </select>
                                <button type="button" className="admin-secondary-button" onClick={addFlashSaleProduct} disabled={!flashSaleProductId}><Plus size={17} /> Add product</button>
                            </div>
                            <div className="flash-sale-admin-list">
                                {pagedFlashSaleItems.map((item) => {
                                    const product = allProducts.find((entry) => entry.id === item.productId);
                                    const regularPrice = toNumber(product?.price);
                                    const salePrice = toNumber(item.salePrice);
                                    const percent = regularPrice > salePrice && regularPrice ? Math.round((1 - salePrice / regularPrice) * 100) : 0;
                                    return <article key={item.productId}>
                                        {product?.image && <img src={product.image} alt="" />}
                                        <div><strong>{product?.name || item.productId}</strong><small>{item.productId} · Regular {formatCurrency(regularPrice)}</small></div>
                                        <label>Sale price (₹)<input type="number" min="1" max={Math.max(1, regularPrice - 1)} step="0.01" value={item.salePrice} required onChange={(event) => setFlashSale((current) => ({ ...current, items: current.items.map((entry) => entry.productId === item.productId ? { ...entry, salePrice: event.target.value } : entry) }))} /></label>
                                        <span className={percent > 0 ? 'valid' : 'invalid'}>{percent > 0 ? `${percent}% off` : 'Must be lower'}</span>
                                        <button type="button" className="delete" title="Remove from sale" onClick={() => setFlashSale((current) => ({ ...current, items: current.items.filter((entry) => entry.productId !== item.productId) }))}><Trash2 size={17} /></button>
                                    </article>;
                                })}
                            </div>
                            <AdminPagination page={activeFlashSalePage} pageCount={flashSalePageCount} onChange={setFlashSalePage} total={flashSale.items.length} noun="sale products" />
                            {!flashSale.items.length && <div className="admin-empty-state"><BadgePercent size={29} /><p>Add products and enter their sale prices. Original catalog prices remain unchanged.</p></div>}
                        </section>

                        <div className="editor-save-bar"><p>Only an active sale within its scheduled dates appears on the homepage.</p><div className="editor-save-actions"><button type="button" className="admin-danger-button" onClick={clearFlashSale}><Trash2 size={18} /> Clear sale</button><button type="submit" className="admin-primary-button" disabled={flashSaleSaving}><Save size={18} /> {flashSaleSaving ? 'Saving…' : 'Save flash sale'}</button></div></div>
                    </form>
                )}

                {activeView === 'instructions' && (
                    <div className="admin-view-stack admin-instructions">
                        <section className="admin-panel instructions-hero"><BookOpenCheck size={30} /><div><p className="admin-kicker">ADMIN HANDBOOK</p><h2>How to manage ANNS safely</h2><p>Follow these rules so products, images, stock, orders and sale prices remain accurate on the live website.</p></div></section>
                        <section className="instructions-grid">
                            <article className="admin-panel"><span>1</span><h3>Product codes</h3><p>Give every colour or design its own unique ID. Never reuse or change an existing ID because orders, emails and Flash Sale entries use it.</p><small>Example: WW30111, WW30112</small></article>
                            <article className="admin-panel"><span>2</span><h3>Excel or JSON import</h3><p>Download the Excel template first. Required fields are category, ID, name and price. Review every warning before clicking Import.</p><button type="button" onClick={() => handleNavigation('import')}>Open Bulk Import</button></article>
                            <article className="admin-panel"><span>3</span><h3>Bulk images</h3><p>Create a ZIP and name images using the exact product code. The first numbered image becomes the main image; up to five are saved.</p><small>WW30111-1.jpg, WW30111-2.jpg</small></article>
                            <article className="admin-panel"><span>4</span><h3>Stock</h3><p>Total stock means all units received. Sold units are recorded from paid orders. Remaining stock is calculated automatically.</p><small>Never count cancelled or failed payments as sold.</small></article>
                            <article className="admin-panel"><span>5</span><h3>Flash Sale</h3><p>Add existing products, enter a price lower than the regular price, check start/end times and click Save Flash Sale. Unsaved changes are not live.</p><button type="button" onClick={() => handleNavigation('flash-sale')}>Open Flash Sale</button></article>
                            <article className="admin-panel"><span>6</span><h3>Orders and tracking</h3><p>Update status in order: Processing, Packed, Shipped, Out for delivery, Delivered. Add courier, tracking number and link before marking shipped.</p><button type="button" onClick={() => handleNavigation('orders')}>Open Orders</button></article>
                            <article className="admin-panel"><span>7</span><h3>Customer data</h3><p>Use CSV exports for backup and reporting. Delete a customer only when the record is genuinely unnecessary and purchase history has been checked.</p></article>
                            <article className="admin-panel"><span>8</span><h3>Before finishing</h3><p>Confirm “Atlas connected”, refresh the inventory, search the product code, and open the live category page to verify the product and images.</p><small>Do not close the tab while an upload is processing.</small></article>
                        </section>
                    </div>
                )}

                {activeView === 'import' && (
                    <div className="admin-view-stack">
                        <section className="admin-panel import-intro">
                            <div>
                                <p className="admin-kicker">BULK PRODUCT UPLOAD</p>
                                <h2>Import a spreadsheet</h2>
                                <p>Upload Excel, CSV or JSON. The file is checked before anything is added to your local catalog draft.</p>
                            </div>
                            <button type="button" className="admin-secondary-button" onClick={downloadTemplate}><FileSpreadsheet size={18} /> Download Excel template</button>
                        </section>
                        <section className="admin-panel">
                            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleImportFile} />
                            <button type="button" className="import-dropzone" onClick={() => fileInputRef.current?.click()}>
                                <span><UploadCloud size={27} /></span>
                                <strong>{importFileName || 'Choose an Excel, CSV or JSON file'}</strong>
                                <small>Required columns: category, name and price · Maximum quality comes from using the template</small>
                            </button>
                            {importError && <div className="import-error"><XCircle size={18} /> {importError}</div>}
                        </section>
                        <section className="admin-panel import-intro">
                            <div>
                                <p className="admin-kicker">BULK PRODUCT IMAGES</p>
                                <h2>Match images from a ZIP</h2>
                                <p>Name files with the product code: <strong>WW30111-1.jpg</strong>, <strong>WW30111-2.png</strong>. Up to five naturally sorted images are attached to each matching product.</p>
                            </div>
                            <input ref={bulkImageInputRef} className="visually-hidden" type="file" accept=".zip,application/zip" onChange={handleBulkImageZip} />
                            <button type="button" className="admin-secondary-button" disabled={bulkImageBusy} onClick={() => bulkImageInputRef.current?.click()}><ImagePlus size={18} /> {bulkImageBusy ? 'Processing ZIP…' : 'Upload image ZIP'}</button>
                        </section>
                        {importRows.length > 0 && (
                            <section className="admin-panel">
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">IMPORT PREVIEW</p><h2>{importRows.length} rows detected</h2></div>
                                    <div className="import-validation-summary"><span className="valid"><CheckCircle2 size={16} /> {importRows.filter((row) => row.valid).length} ready</span><span className="invalid"><XCircle size={16} /> {importRows.filter((row) => !row.valid).length} issues</span>{importRows.some((row) => !row.valid) && <button type="button" className="admin-secondary-button" onClick={downloadImportErrorsCsv}><Download size={15} /> Error CSV</button>}</div>
                                </div>
                                <div className="admin-table-wrap import-preview-table">
                                    <table className="admin-table">
                                        <thead><tr><th>Row</th><th>Status</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Sold</th></tr></thead>
                                        <tbody>{importRows.slice(0, 50).map((row) => (
                                            <tr key={row.rowNumber}>
                                                <td>{row.rowNumber}</td>
                                                <td>{row.valid ? <span className="import-row-valid"><CheckCircle2 size={15} /> Ready</span> : <span className="import-row-invalid" title={row.errors.join(', ')}><XCircle size={15} /> {row.errors.join(', ')}</span>}</td>
                                                <td><strong>{row.product.name || 'Missing name'}</strong><small>{row.product.id || 'ID will be generated'}</small></td>
                                                <td>{row.category || '—'}</td>
                                                <td>{row.product.price === '' ? '—' : formatCurrency(row.product.price)}</td>
                                                <td>{row.product.stock}</td><td>{row.product.sold}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                                <div className="import-actions">
                                    <p>Existing IDs will be updated; new IDs will be added.</p>
                                    <button type="button" className="admin-primary-button" disabled={!importRows.some((row) => row.valid)} onClick={applyImport}><CheckCircle2 size={18} /> Import {importRows.filter((row) => row.valid).length} valid rows</button>
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {activeView === 'editor' && (
                    <form onSubmit={handleSubmit} className="admin-editor-grid">
                        <div className="admin-view-stack">
                            <section className="admin-panel editor-section">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">BASIC DETAILS</p><h2>{selectedProductId === 'new' ? 'New product' : formData.name}</h2></div></div>
                                <div className="editor-form-grid">
                                    <label>Category<select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value); setSelectedProductId('new'); }} disabled={selectedProductId !== 'new'}>{Object.keys(products).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                                    <label>Product ID<input name="id" value={formData.id} onChange={handleInputChange} placeholder="Example: WW300125" required autoCapitalize="characters" spellCheck="false" disabled={selectedProductId !== 'new'} /><small>This exact code is used on the storefront, orders and emails. It cannot change after creation.</small></label>
                                    <label className="full-width">Product name<input name="name" value={formData.name} onChange={handleInputChange} required /></label>
                                    <label className="full-width">Description<textarea name="description" value={formData.description} onChange={handleInputChange} rows="4" /></label>
                                    <label>Price (₹)<input name="price" type="number" min="0" value={formData.price} onChange={handleInputChange} required /></label>
                                    <label>Discount<input name="discount" value={formData.discount} onChange={handleInputChange} placeholder="Optional" /></label>
                                </div>
                            </section>
                            <section className="admin-panel editor-section">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">INVENTORY</p><h2>Stock and sales</h2></div></div>
                                <div className="editor-form-grid">
                                    <label>Total stock<input name="stock" type="number" min="0" value={formData.stock} onChange={handleInputChange} /></label>
                                    <label>Units sold<input name="sold" type="number" min="0" value={formData.sold} onChange={handleInputChange} /></label>
                                    <div className="editor-inventory-result full-width"><span>Remaining stock</span><strong>{Math.max(0, toNumber(formData.stock) - toNumber(formData.sold)).toLocaleString('en-IN')}</strong><small>Calculated automatically</small></div>
                                    <label>Featured<select name="featured" value={formData.featured} onChange={handleInputChange}><option value="no">No</option><option value="yes">Yes</option></select></label>
                                    <div className="editor-inventory-result"><span>Storefront visibility</span><strong>Visible</strong><small>Every saved product appears in its category automatically.</small></div>
                                    <label>Color<input name="color" value={formData.color} onChange={handleInputChange} /></label>
                                </div>
                            </section>
                            <section className="admin-panel editor-section">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">PRODUCT INFORMATION</p><h2>Images and options</h2></div></div>
                                <div className="editor-form-grid">
                                    <label className="full-width">Main image URL<input name="image" value={formData.image} onChange={handleInputChange} placeholder="Paste an image URL or choose image files below" /></label>
                                    <label className="full-width image-upload-control">Upload images<input type="file" accept={IMAGE_FILE_ACCEPT} multiple onChange={handleImageFiles} /><small>Select up to five common image files. JPEG, PNG, WebP, GIF, BMP, AVIF, SVG and iPhone/HEIC images up to 75 MB each are converted into safe, optimized web images automatically.</small></label>
                                    {[formData.image, ...formData.otherImages].filter(Boolean).length > 0 && <div className="editor-image-preview full-width">{[formData.image, ...formData.otherImages].filter(Boolean).map((image, index) => <figure key={`${image.slice(0, 40)}-${index}`}><img src={image} alt={`${formData.name || 'Product'} ${index + 1}`} /><figcaption>{index === 0 ? 'Main image' : `Gallery ${index}`}</figcaption><button type="button" onClick={() => removeProductImage(index)} aria-label={`Remove ${index === 0 ? 'main image' : `gallery image ${index}`}`}><XCircle size={17} /></button></figure>)}</div>}
                                    <label className="full-width">Additional image URLs<textarea value={formData.otherImages.filter((image) => !image.startsWith('data:image/')).join('\n')} onChange={handleOtherImageUrls} rows="3" placeholder="One public image URL per line (optional)" /></label>
                                    <fieldset className="size-selector-control full-width">
                                        <legend>Available sizes</legend>
                                        <p>Choose every size you will sell for this product.</p>
                                        <div className="size-selector-buttons">
                                            {STANDARD_CLOTHING_SIZES.map((size) => <button key={size} type="button" className={formData.sizes.includes(size) ? 'selected' : ''} onClick={() => toggleSize(size)} aria-pressed={formData.sizes.includes(size)}>{size}</button>)}
                                        </div>
                                        <small>{formData.sizes.length ? `Selected: ${formData.sizes.join(', ')}` : 'Select at least one size for clothing, or leave empty for non-sized products.'}</small>
                                    </fieldset>
                                    <label>Subcategories<select multiple value={formData.subcategory} onChange={(event) => setFormData((current) => ({ ...current, subcategory: [...event.target.selectedOptions].map((option) => option.value) }))}>{getSubcategories().map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}</select><small>Use Cmd/Ctrl for multiple</small></label>
                                    <label className="full-width">Shipping information<input value={formData.shipping.join(', ')} onChange={(event) => handleArrayChange(event, 'shipping')} placeholder="Comma separated" /></label>
                                    <label className="full-width">Campaign labels<input value={formData.campaign.join(', ')} onChange={(event) => handleArrayChange(event, 'campaign')} placeholder="Comma separated" /></label>
                                    <label className="full-width">Similar product IDs<input value={similarProductIdsInput} onChange={(event) => setSimilarProductIdsInput(event.target.value)} placeholder="For example: ww30001, ww30002, ww30003" /><small>Enter each colour variant’s unique product ID separated by commas. Related products: {parseList(similarProductIdsInput).length || 0}</small></label>
                                </div>
                            </section>
                            <div className="editor-save-bar"><p>Changes sync to MongoDB Atlas and appear on the storefront.</p><div className="editor-save-actions">{selectedProductId !== 'new' && <button type="button" className="admin-danger-button" onClick={() => removeProduct({ ...formData, category: selectedCategory })}><Trash2 size={18} /> Remove product</button>}<button type="submit" className="admin-primary-button"><Save size={18} /> Save product</button></div></div>
                        </div>
                        <aside className="editor-aside">
                            <section className="admin-panel">
                                <p className="admin-kicker">SIMILAR PRODUCTS</p>
                                <h3>Automatic suggestions</h3>
                                <p>Based on matching names and subcategories.</p>
                                {editorSuggestions.length ? <div className="editor-suggestion-list">{editorSuggestions.map((product) => <button type="button" key={product.id} onClick={() => openProduct(product)}><div><strong>{product.name}</strong><small>{product.id} · {product.category}</small></div><ChevronRight size={16} /></button>)}</div> : <div className="admin-empty-state compact"><Sparkles size={23} /><p>Add a name or subcategory to see matches.</p></div>}
                            </section>
                            <section className="admin-panel admin-draft-note"><FileJson size={22} /><div><strong>Live catalog</strong><p>Product changes are stored in the shared MongoDB catalog. The public website reads the same catalog.</p></div></section>
                        </aside>
                    </form>
                )}
            </main>
        </section>
    );
};

export default ProductManager;
