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
    BarChart3,
    BookOpenCheck,
    ImagePlus,
    Star,
    Phone,
    ReceiptText,
    RefreshCw,
    Globe2,
    Clock3,
    Eye,
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
    getAdminAnalytics,
    getAdminReviews,
    getAdminStorageCapacity,
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
import { displaySubcategoryLabel, normalizeList, normalizeSizeList, normalizeSubcategoryList, subcategoryMatchKey, STANDARD_CLOTHING_SIZES } from '../utils/productOptions';
import { IMAGE_FILE_ACCEPT, isSupportedImageFile, MAX_SOURCE_IMAGE_BYTES, prepareImageFile } from '../utils/imageUpload';

const ADMIN_SESSION_KEY = 'pm_auth';
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
    hasShippingCharge: 'no',
    shippingCharge: 0,
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
    buyOneGetOne: 'no',
    campaign: [],
    showOnCategory: true,
});

const createEmptyCatalog = () => Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category, []]));
const readProductDraft = () => createEmptyCatalog();

const toNumber = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSearchText = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeProductCode = (value) => normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
const productMatchesSearch = (product, value) => {
    const query = normalizeSearchText(value);
    if (!query) return true;
    const compactQuery = normalizeProductCode(query);
    const productCode = normalizeProductCode(product?.id);
    const subcategories = Array.isArray(product?.subcategory) ? product.subcategory : [product?.subcategory];
    const searchableText = [product?.id, product?.name, product?.category, ...subcategories]
        .filter(Boolean)
        .map(normalizeSearchText)
        .join(' ');
    return searchableText.includes(query) || Boolean(compactQuery && productCode.includes(compactQuery));
};
const getCurrentCatalogPrice = (product) => {
    const originalPrice = toNumber(product?.price);
    const discountedPrice = toNumber(product?.discount);
    return discountedPrice > 0 && discountedPrice < originalPrice ? discountedPrice : originalPrice;
};
const mergeCatalogDiscountsIntoSale = (items = [], catalogProducts = []) => {
    const manualItems = items.filter((item) => item.source !== 'catalog');
    const manualIds = new Set(manualItems.map((item) => String(item.productId)));
    const catalogItems = catalogProducts.filter((product) => {
        const mrp = toNumber(product.price);
        const discount = toNumber(product.discount);
        return !manualIds.has(String(product.id)) && mrp > 0 && discount > 0 && discount < mrp;
    }).map((product) => ({ productId: product.id, salePrice: toNumber(product.discount), source: 'catalog' }));
    return [...manualItems, ...catalogItems];
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

const categoryDisplayName = (category) => category === 'Womens Wear' ? "Women's Wear" : category;

const allowedSubcategoriesFor = (category) => (
    categoriesData.categories.find((item) => item.name === categoryDisplayName(category))?.subCategories || []
);

const normalizeImportedSubcategories = (value, category) => {
    const allowed = allowedSubcategoriesFor(category);
    const unknown = [];
    const normalized = normalizeSubcategoryList(value).map((subcategory) => {
        const match = allowed.find((option) => subcategoryMatchKey(option) === subcategoryMatchKey(subcategory));
        if (!match) unknown.push(subcategory);
        return match || subcategory;
    });
    return { normalized: [...new Set(normalized)], unknown: [...new Set(unknown)] };
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
    const initialView = ['overview', 'analytics', 'inventory', 'orders', 'customers', 'reviews', 'flash-sale', 'import', 'instructions', 'editor'].includes(initialParams.get('view')) ? initialParams.get('view') : 'overview';
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
    const [flashSaleProductSearch, setFlashSaleProductSearch] = useState('');
    const [flashSaleSaving, setFlashSaleSaving] = useState(false);
    const [bulkImageBusy, setBulkImageBusy] = useState(false);
    const [bulkImageReport, setBulkImageReport] = useState(null);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [bulkStockValue, setBulkStockValue] = useState('');
    const [bulkShippingValue, setBulkShippingValue] = useState('');
    const [inventoryPage, setInventoryPage] = useState(1);
    const [flashSalePage, setFlashSalePage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [customersPage, setCustomersPage] = useState(1);
    const [reviewsPage, setReviewsPage] = useState(1);
    const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
    const [analytics, setAnalytics] = useState(null);
    const [analyticsDays, setAnalyticsDays] = useState(30);
    const [analyticsPage, setAnalyticsPage] = useState(1);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [storageCapacity, setStorageCapacity] = useState(null);
    const fileInputRef = useRef(null);
    const bulkImageInputRef = useRef(null);
    const reviewImageInputRef = useRef(null);
    const flashSaleImageInputRef = useRef(null);
    const linkedOrderId = initialParams.get('order') || '';

    useEffect(() => {
        // Older builds cached complete base64 product images in localStorage.
        // Remove that obsolete draft so large ZIP imports can never exhaust the
        // browser quota; MongoDB is the catalog source of truth.
        try { localStorage.removeItem('anns-admin-products-draft'); } catch { /* storage may be disabled */ }
    }, []);

    const allProducts = useMemo(() => flattenProducts(products), [products]);
    const flashSaleProductIds = useMemo(() => new Set(flashSale.items.map((item) => normalizeProductCode(item.productId))), [flashSale.items]);
    const matchingFlashSaleProducts = useMemo(() => (
        allProducts.filter((product) => productMatchesSearch(product, flashSaleProductSearch))
    ), [allProducts, flashSaleProductSearch]);
    const availableFlashSaleProducts = useMemo(() => {
        return matchingFlashSaleProducts
            .filter((product) => !flashSaleProductIds.has(normalizeProductCode(product.id)));
    }, [matchingFlashSaleProducts, flashSaleProductIds]);
    const exactFlashSaleSearchProduct = useMemo(() => {
        const queryCode = normalizeProductCode(flashSaleProductSearch);
        if (!queryCode) return null;
        return allProducts.find((product) => normalizeProductCode(product.id) === queryCode) || null;
    }, [allProducts, flashSaleProductSearch]);
    const exactSearchIsInFlashSale = Boolean(exactFlashSaleSearchProduct
        && flashSaleProductIds.has(normalizeProductCode(exactFlashSaleSearchProduct.id)));

    // A valid product-level discounted price is automatically represented in
    // the Flash Sale manager. Manual campaign entries remain independently editable.
    useEffect(() => {
        setFlashSale((current) => {
            const nextItems = mergeCatalogDiscountsIntoSale(current.items, allProducts);
            const unchanged = nextItems.length === current.items.length
                && nextItems.every((item, index) => item.productId === current.items[index]?.productId
                    && toNumber(item.salePrice) === toNumber(current.items[index]?.salePrice)
                    && item.source === current.items[index]?.source);
            return unchanged ? current : { ...current, items: nextItems };
        });
    }, [allProducts]);

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
            const [sale, databaseProducts] = await Promise.all([getAdminFlashSale(), getProductsFromDatabase()]);
            const catalogProducts = flattenProducts(groupDatabaseProducts(databaseProducts));
            setFlashSale({
                ...getInitialFlashSaleForm(),
                ...(sale || {}),
                startsAt: toLocalDateTimeInput(sale?.startsAt),
                endsAt: toLocalDateTimeInput(sale?.endsAt),
                items: mergeCatalogDiscountsIntoSale(Array.isArray(sale?.items) ? sale.items : [], catalogProducts),
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

    const refreshAnalytics = async (days = analyticsDays, page = analyticsPage) => {
        setAnalyticsLoading(true);
        try {
            const result = await getAdminAnalytics(days, page, 50);
            setAnalytics(result);
            setAnalyticsPage(result.recentPage || page);
            setDatabaseStatus('connected');
        } catch (error) {
            setNotification(error.message || 'Visitor analytics could not be loaded.');
        } finally {
            setAnalyticsLoading(false);
        }
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
                ? 'Order updated, but the customer email failed and was queued for retry.'
                : emailState === 'sent'
                    ? 'Order updated successfully. The customer notification was sent.'
                    : 'No order details changed, so no duplicate customer email was sent.');
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
            setDatabaseStatus('connected');
        } catch {
            setDatabaseStatus('local');
        }
    };

    const refreshStorageCapacity = async () => {
        try {
            setStorageCapacity(await getAdminStorageCapacity());
        } catch {
            // Product management stays available if capacity telemetry is temporarily unavailable.
        }
    };

    useEffect(() => {
        if (!isAuthenticated || !hasAdminKey()) return;
        void refreshProductsFromDatabase();
        void refreshCustomerData();
        void refreshReviews();
        void refreshFlashSale();
        void refreshStorageCapacity();
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
                let capacityWarning = '';
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
                    setNotification(batches.length > 1
                        ? `Saving batch ${batchIndex + 1} of ${batches.length}…`
                        : message);
                    const result = await saveProductsToDatabase(batch);
                    if (result.saved !== batch.length) throw new Error(`MongoDB confirmed ${saved + result.saved} of ${changedProducts.length} products. Retry the import; existing product IDs will update safely without creating duplicates.`);
                    saved += result.saved;
                    if (result.warning) capacityWarning = result.warning;
                }
                setDatabaseStatus('connected');
                setNotification(`${message} ${saved} product${saved === 1 ? '' : 's'} verified in MongoDB Atlas.${capacityWarning ? ` Storage warning: ${capacityWarning}` : ''}`);
                void refreshStorageCapacity();
            } catch (error) {
                setDatabaseStatus('local');
                setNotification(error.message || 'The product could not be saved to MongoDB Atlas.');
                throw error;
            }
        }
        setProducts(nextProducts);
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
            await Promise.all([refreshProductsFromDatabase(), refreshCustomerData(), refreshReviews(), refreshFlashSale(), refreshStorageCapacity()]);
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
        const regularPrice = getCurrentCatalogPrice(product);
        setFlashSale((current) => ({
            ...current,
            items: [...current.items, { productId: flashSaleProductId, salePrice: Math.max(1, Math.round(regularPrice * .9)) }],
        }));
        setFlashSaleProductId('');
        setFlashSaleProductSearch('');
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
            hasShippingCharge: toNumber(product.shippingCharge) > 0 ? 'yes' : 'no',
            buyOneGetOne: product.buyOneGetOne === true || String(product.buyOneGetOne).toLowerCase() === 'yes' ? 'yes' : 'no',
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
        return allowedSubcategoriesFor(selectedCategory);
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
        let originalPrice = toNumber(formData.price, NaN);
        let discountedPrice = toNumber(formData.discount, NaN);
        if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
            setNotification('Enter a valid original price above ₹0.');
            return;
        }
        if (formData.discount !== '' && Number.isFinite(discountedPrice) && discountedPrice > originalPrice) {
            const shouldSwap = window.confirm(
                `The discounted price (${formatCurrency(discountedPrice)}) is higher than the original price (${formatCurrency(originalPrice)}). Swap these prices automatically?`,
            );
            if (!shouldSwap) {
                setNotification('Correct the two prices, then save again. The original price must be higher.');
                return;
            }
            [originalPrice, discountedPrice] = [discountedPrice, originalPrice];
        }
        if (formData.discount !== '' && (!Number.isFinite(discountedPrice) || discountedPrice <= 0 || discountedPrice >= originalPrice)) {
            setNotification('The discounted price must be above ₹0 and lower than the original price.');
            return;
        }
        const similarProductIds = [...new Set(parseList(similarProductIdsInput))].filter((id) => id !== productId);
        const selectedSubcategories = normalizeImportedSubcategories(formData.subcategory, selectedCategory);
        if (!selectedSubcategories.normalized.length) {
            setNotification(`Choose at least one ${categoryDisplayName(selectedCategory)} subcategory so customers can find this product.`);
            return;
        }
        if (selectedSubcategories.unknown.length) {
            setNotification(`Unknown subcategory: ${selectedSubcategories.unknown.join(', ')}. Choose a valid ${categoryDisplayName(selectedCategory)} subcategory.`);
            return;
        }
        const normalizedProduct = {
            ...getInitialFormData(),
            ...formData,
            id: productId,
            price: String(originalPrice),
            discount: formData.discount === '' ? '' : String(discountedPrice),
            shippingCharge: formData.hasShippingCharge === 'yes' ? Math.max(0, toNumber(formData.shippingCharge)) : 0,
            buyOneGetOne: formData.buyOneGetOne === 'yes',
            stock: Math.max(0, toNumber(formData.stock)),
            sold: Math.max(0, toNumber(formData.sold)),
            sizes: normalizeSizeList(formData.sizes),
            subcategory: selectedSubcategories.normalized,
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

    const applyBulkShipping = async () => {
        const shippingCharge = Number(bulkShippingValue);
        if (!selectedProductIds.length || !Number.isFinite(shippingCharge) || shippingCharge < 0) {
            setNotification('Select products and enter a shipping charge of ₹0 or more.');
            return;
        }
        const selected = new Set(selectedProductIds);
        const changedProducts = [];
        const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [category, items.map((product) => {
            if (!selected.has(product.id)) return product;
            const updated = { ...product, shippingCharge };
            changedProducts.push({ ...updated, category });
            return updated;
        })]));
        await saveProducts(nextProducts, `Shipping updated for ${changedProducts.length} products.`, changedProducts);
        setSelectedProductIds([]);
        setBulkShippingValue('');
    };

    const applyBulkBogo = async (enabled) => {
        if (!selectedProductIds.length) return;
        const selected = new Set(selectedProductIds);
        const changedProducts = [];
        const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [category, items.map((product) => {
            if (!selected.has(product.id)) return product;
            const updated = { ...product, buyOneGetOne: enabled };
            changedProducts.push({ ...updated, category });
            return updated;
        })]));
        await saveProducts(nextProducts, `Buy 1 Get 1 ${enabled ? 'enabled' : 'removed'} for ${changedProducts.length} products.`, changedProducts);
        setSelectedProductIds([]);
    };

    const removeSelectedProducts = async () => {
        if (!selectedProductIds.length) return;
        const selected = new Set(selectedProductIds);
        const preview = selectedProductIds.slice(0, 8).join(', ');
        const remainder = selectedProductIds.length > 8 ? ` and ${selectedProductIds.length - 8} more` : '';
        if (!window.confirm(`Permanently remove ${selectedProductIds.length} selected product${selectedProductIds.length === 1 ? '' : 's'} and their uploaded images?\n\n${preview}${remainder}\n\nThis cannot be undone from Product Studio.`)) return;
        try {
            const result = await deleteProductsFromDatabase(selectedProductIds);
            const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [
                category,
                items.filter((product) => !selected.has(product.id)),
            ]));
            setProducts(nextProducts);
            setFlashSale((current) => ({ ...current, items: current.items.filter((item) => !selected.has(item.productId)) }));
            setSelectedProductIds([]);
            setNotification(`${result.deleted} product${result.deleted === 1 ? '' : 's'} and ${result.deletedImages || 0} stored image${result.deletedImages === 1 ? '' : 's'} were permanently removed.`);
            void refreshStorageCapacity();
        } catch (error) {
            setNotification(error.message || 'The selected products could not be removed. Please try again.');
        }
        window.setTimeout(() => setNotification(''), 5000);
    };

    const addSelectedToFlashSale = () => {
        if (!selectedProductIds.length) return;
        const selected = new Set(selectedProductIds);
        setFlashSale((current) => ({
            ...current,
            items: [...current.items, ...allProducts
                .filter((product) => selected.has(product.id) && !current.items.some((item) => item.productId === product.id))
                .map((product) => ({ productId: product.id, salePrice: Math.max(1, Math.round(getCurrentCatalogPrice(product) * .9)) }))],
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
        const price = valueFrom(row, 'originalprice', 'regularprice', 'mrp', 'listprice', 'price', 'sellingprice');
        const discountedPrice = valueFrom(row, 'discountedprice', 'discountprice', 'saleprice', 'offerprice', 'discount');
        const id = String(valueFrom(row, 'id', 'sku', 'productid')).trim();
        const importedSubcategories = normalizeImportedSubcategories(valueFrom(row, 'subcategory', 'subcategories'), category);
        const errors = [];
        if (!Object.keys(products).includes(category)) errors.push('Unknown category');
        if (!id) errors.push('Product ID is required');
        else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/.test(id)) errors.push('Product ID contains unsupported characters');
        if (!name) errors.push('Name is required');
        if (!importedSubcategories.normalized.length) errors.push('Subcategory is required');
        if (importedSubcategories.unknown.length) {
            errors.push(`Unknown ${categoryDisplayName(category)} subcategory: ${importedSubcategories.unknown.join(', ')}`);
        }
        const numericPrice = toNumber(price, NaN);
        if (price === '' || !Number.isFinite(numericPrice) || numericPrice <= 0) errors.push('Valid original price above ₹0 is required');
        const numericDiscountedPrice = toNumber(discountedPrice, NaN);
        const shippingChoice = String(valueFrom(row, 'hasshippingcharge', 'shippingchargeyesno', 'chargeshhipping', 'paidshipping')).trim().toLowerCase();
        const legacyShippingCharge = valueFrom(row, 'shippingcharge', 'deliverycharge', 'shippingfee', 'deliveryfee');
        const shippingAmount = valueFrom(row, 'shippingchargeamount', 'shippingamount', 'deliverychargeamount', 'deliveryamount') || legacyShippingCharge;
        const numericShippingCharge = toNumber(shippingAmount, NaN);
        const bogoChoice = String(valueFrom(row, 'buyonegetone', 'bogo', 'buy1get1')).trim().toLowerCase();
        const hasShippingCharge = shippingChoice
            ? ['yes', 'y', 'true', '1', 'paid'].includes(shippingChoice)
            : shippingAmount !== '' && numericShippingCharge > 0;
        const reversedPrices = discountedPrice !== ''
            && Number.isFinite(numericDiscountedPrice)
            && numericDiscountedPrice > numericPrice;
        if (discountedPrice !== '' && numericDiscountedPrice !== 0 && (!Number.isFinite(numericDiscountedPrice) || numericDiscountedPrice <= 0 || numericDiscountedPrice === numericPrice)) {
            errors.push('Discounted price must be lower than original price');
        }
        if (shippingChoice && !['yes', 'y', 'true', '1', 'paid', 'no', 'n', 'false', '0', 'free'].includes(shippingChoice)) {
            errors.push('Has shipping charge must be Yes or No');
        }
        if (hasShippingCharge && (!Number.isFinite(numericShippingCharge) || numericShippingCharge <= 0)) {
            errors.push('Enter a shipping amount above ₹0 when shipping charge is Yes');
        }
        if (!hasShippingCharge && shippingAmount !== '' && (!Number.isFinite(numericShippingCharge) || numericShippingCharge < 0)) {
            errors.push('Shipping charge must be ₹0 or more');
        }
        if (bogoChoice && !['yes', 'y', 'true', '1', 'no', 'n', 'false', '0'].includes(bogoChoice)) errors.push('Buy One Get One must be Yes or No');

        return {
            rowNumber: index + 2,
            valid: errors.length === 0,
            errors,
            reversedPrices,
            category,
            product: {
                id,
                name,
                description: String(valueFrom(row, 'description')).trim(),
                price: String(price),
                discount: discountedPrice === '' || numericDiscountedPrice === 0 ? '' : String(discountedPrice).trim(),
                hasShippingCharge: hasShippingCharge ? 'yes' : 'no',
                shippingCharge: hasShippingCharge ? numericShippingCharge : 0,
                buyOneGetOne: ['yes', 'y', 'true', '1'].includes(bogoChoice),
                stock: Math.max(0, toNumber(valueFrom(row, 'stock', 'totalstock', 'quantity'))),
                sold: Math.max(0, toNumber(valueFrom(row, 'sold', 'soldquantity', 'unitssold'))),
                image: String(valueFrom(row, 'image', 'imageurl')).trim(),
                otherImages: parseList(valueFrom(row, 'otherimages', 'otherimageurls')),
                color: String(valueFrom(row, 'color')).trim(),
                sizes: parseList(valueFrom(row, 'sizes', 'size')),
                subcategory: importedSubcategories.normalized,
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
        setBulkImageReport(null);

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
            const mappedRows = rows.map(mapImportedRow);
            const reversedRows = mappedRows.filter((row) => row.reversedPrices);
            if (reversedRows.length) {
                const examples = reversedRows.slice(0, 5).map((row) => row.product.id || `row ${row.rowNumber}`).join(', ');
                const shouldSwap = window.confirm(
                    `${reversedRows.length} product${reversedRows.length === 1 ? '' : 's'} (${examples}${reversedRows.length > 5 ? ', …' : ''}) have a discounted price higher than the original price. Swap those two columns automatically?`,
                );
                if (shouldSwap) {
                    reversedRows.forEach((row) => {
                        [row.product.price, row.product.discount] = [row.product.discount, row.product.price];
                        row.reversedPrices = false;
                    });
                } else {
                    reversedRows.forEach((row) => {
                        row.valid = false;
                        row.errors.push('Original and discounted prices appear reversed');
                    });
                }
            }
            setImportRows(mappedRows);
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
        setBulkImageReport(null);
        try {
            const { default: JSZip } = await import('jszip');
            const archive = await JSZip.loadAsync(zipFile);
            const normalizeMatchKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const stagedRows = importRows.filter((row) => row.valid && row.product.id);
            const candidates = [
                ...allProducts.map((product) => ({ id: product.id, source: 'catalog' })),
                ...stagedRows.map((row) => ({ id: row.product.id, source: 'spreadsheet' })),
            ];
            const productsByMatchKey = new Map();
            candidates.forEach((candidate) => {
                const key = normalizeMatchKey(candidate.id);
                if (key) productsByMatchKey.set(key, candidate);
            });
            const productKeys = [...productsByMatchKey.keys()].sort((first, second) => second.length - first.length);
            const groupedFiles = new Map();
            const imageEntries = Object.values(archive.files)
                .filter((entry) => !entry.dir && isSupportedImageFile({ name: entry.name, type: '' }))
                .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }))
            const unmatchedFiles = [];
            imageEntries.forEach((entry) => {
                const filename = entry.name.split('/').pop() || '';
                const stemKey = normalizeMatchKey(filename.replace(/\.[^.]+$/, ''));
                const matchedKey = productKeys.find((key) => stemKey === key || stemKey.startsWith(key) || (key.length >= 4 && stemKey.includes(key)));
                const candidate = productsByMatchKey.get(matchedKey);
                if (candidate) groupedFiles.set(candidate.id, [...(groupedFiles.get(candidate.id) || []), { entry, filename }]);
                else unmatchedFiles.push(filename);
            });

            if (!imageEntries.length) throw new Error('The ZIP contains no JPG, JPEG, PNG or other supported image files.');
            if (!groupedFiles.size) {
                const expected = candidates.slice(0, 8).map((item) => item.id).join(', ');
                throw new Error(`No image filename contains a known product code. ${expected ? `Codes currently available: ${expected}${candidates.length > 8 ? '…' : ''}. ` : ''}Example: PRODUCTCODE-1.jpg.`);
            }
            const replacements = new Map();
            const failedFiles = [];
            const ignoredFiles = [];
            let preparedCount = 0;
            for (const [productId, files] of groupedFiles) {
                const prepared = [];
                ignoredFiles.push(...files.slice(MAX_PRODUCT_IMAGES).map(({ filename }) => `${filename} (maximum ${MAX_PRODUCT_IMAGES} per product)`));
                for (const { entry, filename } of files.slice(0, MAX_PRODUCT_IMAGES)) {
                    try {
                        const blob = await entry.async('blob');
                        const imageFile = new File([blob], filename, { type: blob.type });
                        prepared.push(await prepareImageFile(imageFile));
                        preparedCount += 1;
                        setNotification(`Preparing image ${preparedCount}…`);
                    } catch (error) {
                        failedFiles.push(`${filename}: ${error.message || 'could not be processed'}`);
                    }
                }
                if (prepared.length) replacements.set(productId, prepared);
            }

            setImportRows((current) => current.map((row) => {
                const images = replacements.get(row.product.id);
                return images ? { ...row, product: { ...row.product, image: images[0], otherImages: images.slice(1) } } : row;
            }));
            const changedProducts = [];
            const nextProducts = Object.fromEntries(Object.entries(products).map(([category, items]) => [category, items.map((product) => {
                const images = replacements.get(product.id);
                if (!images) return product;
                const updated = { ...product, image: images[0], otherImages: images.slice(1) };
                changedProducts.push({ ...updated, category });
                return updated;
            })]));
            if (changedProducts.length) {
                await saveProducts(nextProducts, `${preparedCount} images prepared for ${replacements.size} products.`, changedProducts);
                await refreshProductsFromDatabase();
            }
            const stagedMatchedIds = new Set(stagedRows.filter((row) => replacements.has(row.product.id)).map((row) => row.product.id));
            const missingStagedCodes = stagedRows.map((row) => row.product.id).filter((id) => !stagedMatchedIds.has(id));
            setBulkImageReport({
                zipName: zipFile.name,
                imageCount: imageEntries.length,
                preparedCount,
                matchedProductIds: [...replacements.keys()],
                unmatchedFiles,
                failedFiles,
                ignoredFiles,
                missingStagedCodes,
                stagedCount: stagedMatchedIds.size,
                catalogCount: changedProducts.length,
            });
            setNotification(`${preparedCount} images matched to ${replacements.size} products.${stagedMatchedIds.size ? ' Spreadsheet rows are ready—click Import valid rows to finish.' : ''}`);
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
            originalPrice: 499,
            discountedPrice: 449,
            hasShippingCharge: 'Yes',
            shippingChargeAmount: 60,
            buyOneGetOne: 'No',
            stock: 25,
            sold: 5,
            image: '/src/assets/img/example.jpg',
            otherImages: 'image-2.jpg, image-3.jpg',
            color: 'Gold',
            sizes: 'S, M, L',
            subcategory: 'Black beads sets',
            featured: 'no',
            similarProducts: 'sample-002, sample-003',
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

    const exportAnalyticsCsv = async () => {
        setAnalyticsLoading(true);
        setNotification('Preparing the complete visitor CSV…');
        try {
            const rows = [];
            let page = 1;
            let pageCount = 1;
            do {
                const result = await getAdminAnalytics(analyticsDays, page, 500);
                rows.push(...(result.recent || []));
                pageCount = result.recentPageCount || 1;
                page += 1;
            } while (page <= pageCount);
            downloadCsv(`ANNS-visitors-${analyticsDays}-days.csv`, rows.map((visit) => ({
                visitedAt: visit.createdAt,
                page: visit.path,
                customerStatus: visit.customerId ? 'Signed in' : 'Anonymous',
                customerId: visit.customerId || '',
                customerName: visit.customerName || '',
                customerEmail: visit.customerEmail || '',
                customerMobile: visit.customerPhone || '',
                city: visit.city || '',
                region: visit.region || '',
                country: visit.country || '',
                timezone: visit.timezone || '',
                visitorId: visit.visitorId,
                sessionId: visit.sessionId,
            })));
            setNotification(`${rows.length.toLocaleString('en-IN')} visitor records downloaded.`);
        } catch (error) {
            setNotification(error.message || 'Visitor data could not be downloaded.');
        } finally {
            setAnalyticsLoading(false);
            window.setTimeout(() => setNotification(''), 4000);
        }
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
        { id: 'analytics', label: 'Visitor analytics', icon: BarChart3 },
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
        if (view === 'analytics') refreshAnalytics();
        if ((view === 'overview' || view === 'inventory') && hasAdminKey()) {
            refreshProductsFromDatabase();
            if (view === 'overview') refreshStorageCapacity();
        }
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

                        <section className="admin-panel capacity-panel">
                            <div className="admin-panel-heading">
                                <div><p className="admin-kicker">UPLOAD CAPACITY</p><h2>Product and image limits</h2></div>
                                <button type="button" onClick={refreshStorageCapacity}><RefreshCw size={16} /> Refresh</button>
                            </div>
                            {storageCapacity ? <>
                                <div className="capacity-summary">
                                    <article><span>Products live</span><strong>{storageCapacity.productCount.toLocaleString('en-IN')}</strong><small>{storageCapacity.imageCount.toLocaleString('en-IN')} stored images</small></article>
                                    <article><span>Database content</span><strong>{storageCapacity.databaseDataMB} MB</strong><small>{storageCapacity.imageDataMB} MB is product imagery</small></article>
                                    <article><span>Early warning at</span><strong>{storageCapacity.warningThresholdMB} MB</strong><small>{storageCapacity.usagePercent}% of warning level used</small></article>
                                    <article><span>Estimated remaining</span><strong>≈ {storageCapacity.estimatedRemainingProducts.toLocaleString('en-IN')}</strong><small>products at the current {storageCapacity.averageImagesPerProduct} images/product average</small></article>
                                </div>
                                <div className="capacity-meter" aria-label={`${storageCapacity.usagePercent}% of storage warning level used`}><i style={{ width: `${storageCapacity.usagePercent}%` }} /></div>
                                <div className="capacity-limits">
                                    <div><strong>{storageCapacity.limits.maximumSourceImageMB} MB</strong><span>maximum source image</span></div>
                                    <div><strong>{storageCapacity.limits.maximumImagesPerProduct}</strong><span>maximum images per product</span></div>
                                    <div><strong>{storageCapacity.limits.recommendedProductsPerBatch}</strong><span>recommended products per bulk batch</span></div>
                                    <div><strong>{storageCapacity.limits.zoomDimensions}</strong><span>optimized zoom size</span></div>
                                </div>
                                <p className="capacity-guidance"><AlertTriangle size={17} /><span><strong>Admin guidance:</strong> Prefer one or two clear images per product. Upload 20 products at a time. Accepted formats: {storageCapacity.limits.acceptedFormats.join(', ')}. The remaining-product figure is an estimate based on current image sizes and updates automatically.</span></p>
                            </> : <div className="admin-empty-state"><RefreshCw size={26} /><p>Loading current database capacity…</p></div>}
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

                {activeView === 'analytics' && (
                    <div className="admin-view-stack">
                        <section className="admin-panel analytics-toolbar">
                            <div><p className="admin-kicker">STORE TRAFFIC</p><h2>Visitor activity</h2><small>Signed-in visits show verified customer details. Anonymous visitors show only approximate city/region—no raw IP address is stored.</small></div>
                            <div><label>Period<select value={analyticsDays} onChange={(event) => { const days = Number(event.target.value); setAnalyticsDays(days); setAnalyticsPage(1); void refreshAnalytics(days, 1); }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option></select></label><button type="button" className="admin-secondary-button" disabled={analyticsLoading} onClick={() => refreshAnalytics(analyticsDays, analyticsPage)}><RefreshCw size={17} /> {analyticsLoading ? 'Loading…' : 'Refresh'}</button><button type="button" className="admin-secondary-button" disabled={analyticsLoading || !analytics?.recentTotal} onClick={exportAnalyticsCsv}><FileSpreadsheet size={17} /> Download CSV</button></div>
                        </section>
                        <section className="customer-stat-grid">
                            <article className="customer-stat"><Users size={21} /><div><span>Unique visitors</span><strong>{(analytics?.uniqueVisitors || 0).toLocaleString('en-IN')}</strong><small>Different browsers/devices</small></div></article>
                            <article className="customer-stat"><Eye size={21} /><div><span>Page views</span><strong>{(analytics?.pageViews || 0).toLocaleString('en-IN')}</strong><small>All storefront pages opened</small></div></article>
                            <article className="customer-stat"><BarChart3 size={21} /><div><span>Visits</span><strong>{(analytics?.sessions || 0).toLocaleString('en-IN')}</strong><small>Browser sessions</small></div></article>
                            <article className="customer-stat"><Globe2 size={21} /><div><span>Locations</span><strong>{(analytics?.locations || []).length.toLocaleString('en-IN')}</strong><small>City and region groups</small></div></article>
                        </section>
                        <section className="customer-stat-grid analytics-commerce-grid">
                            <article className="customer-stat"><ShoppingBag size={21} /><div><span>Total paid revenue</span><strong>{formatCurrency(customerInsights.revenue)}</strong><small>Lifetime captured payments · refunds excluded</small></div></article>
                            <article className="customer-stat"><ReceiptText size={21} /><div><span>Total paid orders</span><strong>{customerInsights.orderCount.toLocaleString('en-IN')}</strong><small>Lifetime Razorpay-verified purchases</small></div></article>
                            <article className="customer-stat"><CheckCircle2 size={21} /><div><span>Delivered orders</span><strong>{orders.filter((order) => order.paymentStatus === 'captured' && order.fulfillmentStatus === 'delivered').length.toLocaleString('en-IN')}</strong><small>Marked delivered by the admin</small></div></article>
                            <article className="customer-stat"><Package size={21} /><div><span>Average order</span><strong>{formatCurrency(customerInsights.orderCount ? customerInsights.revenue / customerInsights.orderCount : 0)}</strong><small>Lifetime verified order value</small></div></article>
                        </section>
                        {!analytics && !analyticsLoading && <section className="admin-panel admin-empty-state"><BarChart3 size={28} /><p>Open this page after visitors browse the live storefront to see traffic here.</p></section>}
                        {analytics && <>
                            <section className="admin-panel">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">DAILY TRAFFIC</p><h2>Visitors and page views</h2></div></div>
                                <div className="analytics-bars">{analytics.daily.map((day) => { const maximum = Math.max(1, ...analytics.daily.map((item) => item.views)); return <div key={day.date} title={`${day.date}: ${day.views} views, ${day.visitors} visitors`}><span><strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</strong><small>{day.visitors} visitors · {day.views} views</small></span><i><b style={{ width: `${Math.max(2, (day.views / maximum) * 100)}%` }} /></i></div>; })}</div>
                            </section>
                            <section className="admin-overview-grid analytics-grid">
                                <article className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">FROM WHERE</p><h2>Top visitor locations</h2></div></div><div className="analytics-ranking">{analytics.locations.map((location, index) => <div key={`${location.country}-${location.region}-${location.city}-${index}`}><span><strong>{[location.city, location.region, location.country].filter(Boolean).join(', ') || 'Unknown location'}</strong><small>{location.visitors} visitors</small></span><b>{location.views} views</b></div>)}{!analytics.locations.length && <p>No location data yet.</p>}</div></article>
                                <article className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">POPULAR CONTENT</p><h2>Top pages</h2></div></div><div className="analytics-ranking">{analytics.pages.map((page) => <div key={page.path}><span><strong>{page.path}</strong><small>{page.visitors} visitors</small></span><b>{page.views} views</b></div>)}{!analytics.pages.length && <p>No page views yet.</p>}</div></article>
                            </section>
                            <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">VISIT HISTORY</p><h2>{(analytics.recentTotal || 0).toLocaleString('en-IN')} recorded page views</h2><small>50 records per page · retained for 180 days</small></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Page</th><th>Approximate location</th><th>Customer</th><th>Visitor ID</th></tr></thead><tbody>{analytics.recent.map((visit, index) => <tr key={`${visit.sessionId}-${visit.createdAt}-${index}`}><td><Clock3 size={14} /> {new Date(visit.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{visit.path}</td><td>{[visit.city, visit.region, visit.country].filter(Boolean).join(', ') || 'Unknown'}</td><td>{visit.customerId ? <><strong>{visit.customerName || 'Signed-in customer'}</strong><small>{[visit.customerEmail, visit.customerPhone].filter(Boolean).join(' · ') || visit.customerId}</small></> : <><strong>Anonymous visitor</strong><small>No verified account details</small></>}</td><td>{visit.visitorId.slice(0, 8)}…</td></tr>)}</tbody></table></div><AdminPagination page={analytics.recentPage || analyticsPage} pageCount={analytics.recentPageCount || 1} onChange={(page) => { setAnalyticsPage(page); void refreshAnalytics(analyticsDays, page); }} total={analytics.recentTotal || 0} noun="visitor records" />{!analytics.recent.length && <div className="admin-empty-state"><Eye size={28} /><p>No visits recorded in this period.</p></div>}</section>
                        </>}
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
                        {selectedProductIds.length > 0 && <div className="bulk-product-toolbar"><strong>{selectedProductIds.length} selected</strong><label>Total stock<input type="number" min="0" value={bulkStockValue} onChange={(event) => setBulkStockValue(event.target.value)} placeholder="Set stock" /></label><button type="button" className="admin-secondary-button" onClick={applyBulkStock}>Update stock</button><label>Shipping/item ₹<input type="number" min="0" step="0.01" value={bulkShippingValue} onChange={(event) => setBulkShippingValue(event.target.value)} placeholder="0 = free" /></label><button type="button" className="admin-secondary-button" onClick={applyBulkShipping}>Apply shipping</button><button type="button" className="admin-secondary-button" onClick={addSelectedToFlashSale}><BadgePercent size={16} /> Add to Flash Sale</button><button type="button" className="admin-secondary-button" onClick={() => applyBulkBogo(true)}>Enable BOGO</button><button type="button" className="admin-secondary-button" onClick={() => applyBulkBogo(false)}>Remove BOGO</button><button type="button" className="admin-danger-button" onClick={removeSelectedProducts}><Trash2 size={16} /> Delete selected</button><button type="button" className="admin-secondary-button" onClick={() => setSelectedProductIds([])}>Clear</button></div>}
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th><input type="checkbox" aria-label="Select this page" checked={pagedProducts.length > 0 && pagedProducts.every((product) => selectedProductIds.includes(product.id))} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, ...pagedProducts.map((product) => product.id)])] : current.filter((id) => !pagedProducts.some((product) => product.id === id)))} /></th><th>Product</th><th>Category</th><th>Price</th><th>Total stock</th><th>Sold</th><th>Remaining</th><th>Status</th><th aria-label="Actions" /></tr></thead>
                                <tbody>
                                    {pagedProducts.map((product) => {
                                        const status = product.remainingValue === 0 ? 'out' : product.remainingValue <= LOW_STOCK_LIMIT ? 'low' : 'available';
                                        return (
                                            <tr key={`${product.category}-${product.id}`}>
                                                <td><input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))} /></td>
                                                <td><strong>{product.name}</strong><small>{product.id}{product.buyOneGetOne ? ' · BUY 1 GET 1' : ''}</small></td>
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

                        <section className="admin-panel capacity-panel">
                            <div className="admin-panel-heading"><div><p className="admin-kicker">AUTOMATIC CHECKOUT OFFERS</p><h2>Offers customers receive</h2></div></div>
                            <div className="capacity-summary">
                                <article><span>First paid order</span><strong>10% off</strong><small>Customer enters coupon FIRST10</small></article>
                                <article><span>Cart from ₹2,000</span><strong>Free shipping</strong><small>Applied automatically at checkout</small></article>
                                <article><span>Cart from ₹2,999</span><strong>₹150 off</strong><small>Applied automatically at checkout</small></article>
                                <article><span>Selected products</span><strong>Buy 1 Get 1</strong><small>Enable on the product or in Excel</small></article>
                            </div>
                            <p className="capacity-guidance"><BadgePercent size={17} /><span><strong>How pricing works:</strong> Flash Sale and BOGO are calculated first. Cart offers then use the payable merchandise subtotal. Razorpay receives only the final server-verified amount.</span></p>
                        </section>

                        <section className="admin-panel flash-sale-products-editor">
                            <div className="admin-panel-heading"><div><p className="admin-kicker">DISCOUNTED PRODUCTS</p><h2>{flashSale.items.length} sale item{flashSale.items.length === 1 ? '' : 's'}</h2></div></div>
                            <div className="flash-sale-product-picker">
                                <div className="admin-search flash-sale-product-search"><Search size={18} /><input
                                    value={flashSaleProductSearch}
                                    onChange={(event) => {
                                        const query = event.target.value;
                                        setFlashSaleProductSearch(query);
                                        setFlashSalePage(1);
                                        const queryCode = normalizeProductCode(query);
                                        const exactProduct = queryCode
                                            ? allProducts.find((product) => normalizeProductCode(product.id) === queryCode)
                                            : null;
                                        const existingSaleIndex = exactProduct
                                            ? flashSale.items.findIndex((item) => normalizeProductCode(item.productId) === normalizeProductCode(exactProduct.id))
                                            : -1;
                                        if (existingSaleIndex >= 0) setFlashSalePage(Math.floor(existingSaleIndex / FLASH_SALE_PAGE_SIZE) + 1);
                                        setFlashSaleProductId(exactProduct && existingSaleIndex < 0 ? exactProduct.id : '');
                                    }}
                                    placeholder={`Search all ${allProducts.length.toLocaleString('en-IN')} inventory products by code, name or category`}
                                    autoComplete="off"
                                /></div>
                                <select value={flashSaleProductId} onChange={(event) => setFlashSaleProductId(event.target.value)}>
                                    <option value="">{exactSearchIsInFlashSale
                                        ? `${exactFlashSaleSearchProduct.id} is already in Flash Sale — shown below`
                                        : flashSaleProductSearch
                                            ? `${matchingFlashSaleProducts.length} matching product${matchingFlashSaleProducts.length === 1 ? '' : 's'} · ${availableFlashSaleProducts.length} available to add`
                                            : 'Search or select a product'}</option>
                                    {availableFlashSaleProducts.map((product) => <option key={product.id} value={product.id}>{product.id} · {product.name} · {categoryDisplayName(product.category)} · {formatCurrency(getCurrentCatalogPrice(product))}</option>)}
                                </select>
                                <button type="button" className="admin-secondary-button" onClick={addFlashSaleProduct} disabled={!flashSaleProductId}><Plus size={17} /> Add product</button>
                            </div>
                            <div className="inventory-summary-line"><strong>{matchingFlashSaleProducts.length.toLocaleString('en-IN')}</strong> inventory product{matchingFlashSaleProducts.length === 1 ? '' : 's'} match <span>·</span> <strong>{availableFlashSaleProducts.length.toLocaleString('en-IN')}</strong> available to add{exactSearchIsInFlashSale ? ` · ${exactFlashSaleSearchProduct.id} is already in Flash Sale and highlighted below` : ''}</div>
                            <div className="flash-sale-admin-list">
                                {pagedFlashSaleItems.map((item) => {
                                    const product = allProducts.find((entry) => entry.id === item.productId);
                                    const originalPrice = toNumber(product?.price);
                                    const regularPrice = originalPrice;
                                    const salePrice = toNumber(item.salePrice);
                                    const percent = regularPrice > salePrice && regularPrice ? Math.round((1 - salePrice / regularPrice) * 100) : 0;
                                    const isSearchedProduct = exactFlashSaleSearchProduct
                                        && normalizeProductCode(exactFlashSaleSearchProduct.id) === normalizeProductCode(item.productId);
                                    return <article key={item.productId} className={isSearchedProduct ? 'flash-sale-search-match' : ''}>
                                        {product?.image && <img src={product.image} alt="" />}
                                        <div><strong>{product?.name || item.productId}</strong><small>{item.productId} · MRP {formatCurrency(originalPrice)}{item.source === 'catalog' ? ' · Synced from discounted price' : ''}</small></div>
                                        <label>Sale price (₹)<input type="number" min="1" max={Math.max(1, regularPrice - 1)} step="0.01" value={item.salePrice} required onChange={(event) => setFlashSale((current) => ({ ...current, items: current.items.map((entry) => entry.productId === item.productId ? { ...entry, salePrice: event.target.value, source: 'manual' } : entry) }))} /></label>
                                        <span className={percent > 0 ? 'valid' : 'invalid'}>{percent > 0 ? `${percent}% off` : 'Must be lower'}</span>
                                        {item.source === 'catalog'
                                            ? <button type="button" title="Edit the product discounted price" onClick={() => product && openProduct(product)}><Edit3 size={17} /></button>
                                            : <button type="button" className="delete" title="Remove from sale" onClick={() => setFlashSale((current) => ({ ...current, items: current.items.filter((entry) => entry.productId !== item.productId) }))}><Trash2 size={17} /></button>}
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
                            <article className="admin-panel"><span>9</span><h3>Buy 1 Get 1</h3><p>Set “Buy 1 Get 1?” to Yes on each eligible product, or use the same column in the Excel template. Customers may mix eligible products; the lower-MRP product in every pair becomes free automatically.</p><small>BOGO uses MRP and does not stack with Flash Sale pricing. An odd unpaired item is charged normally. Shipping applies to every physical item.</small></article>
                            <article className="admin-panel"><span>10</span><h3>Automatic checkout offers</h3><p>FIRST10 gives a signed-in customer 10% off only on their first paid order. Orders from ₹2,000 receive free shipping, and orders from ₹2,999 receive ₹150 off automatically.</p><small>These offers are calculated and verified by the server before Razorpay opens. Flash Sale and BOGO products continue to appear in their normal subcategories.</small></article>
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
                                <small>Required columns: category, product code (ID), name and original price · Maximum quality comes from using the template</small>
                            </button>
                            {importError && <div className="import-error"><XCircle size={18} /> {importError}</div>}
                        </section>
                        <section className="admin-panel import-intro">
                            <div>
                                <p className="admin-kicker">BULK PRODUCT IMAGES</p>
                                <h2>Match images from a ZIP</h2>
                                <p>Include the product code anywhere in each filename. JPG, JPEG, PNG and other common image formats are accepted—for example <strong>WW30111-1.jpg</strong>, <strong>Photo WW30111 2.jpeg</strong> or <strong>WW30111_front.png</strong>. Up to five images are attached to each product.</p>
                            </div>
                            <input ref={bulkImageInputRef} className="visually-hidden" type="file" accept=".zip,application/zip" onChange={handleBulkImageZip} />
                            <button type="button" className="admin-secondary-button" disabled={bulkImageBusy} onClick={() => bulkImageInputRef.current?.click()}><ImagePlus size={18} /> {bulkImageBusy ? 'Processing ZIP…' : 'Upload image ZIP'}</button>
                        </section>
                        {bulkImageReport && (
                            <section className="admin-panel bulk-image-report" aria-live="polite">
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">IMAGE MATCH REPORT</p><h2>{bulkImageReport.preparedCount} of {bulkImageReport.imageCount} images prepared</h2><small>{bulkImageReport.zipName}</small></div>
                                    <span className="bulk-match-total"><CheckCircle2 size={17} /> {bulkImageReport.matchedProductIds.length} products matched</span>
                                </div>
                                <div className="bulk-report-grid">
                                    <article className="success"><strong>Matched product codes</strong><p>{bulkImageReport.matchedProductIds.join(', ') || 'None'}</p></article>
                                    {bulkImageReport.missingStagedCodes.length > 0 && <article className="warning"><strong>Spreadsheet products with no matching ZIP image</strong><p>{bulkImageReport.missingStagedCodes.join(', ')}</p></article>}
                                    {bulkImageReport.unmatchedFiles.length > 0 && <article className="warning"><strong>Image filenames with no matching product code</strong><p>{bulkImageReport.unmatchedFiles.join(', ')}</p></article>}
                                    {bulkImageReport.failedFiles.length > 0 && <article className="error"><strong>Images that could not be processed</strong><p>{bulkImageReport.failedFiles.join(' · ')}</p></article>}
                                    {bulkImageReport.ignoredFiles.length > 0 && <article className="warning"><strong>Extra images not used</strong><p>{bulkImageReport.ignoredFiles.join(', ')}</p></article>}
                                </div>
                                {bulkImageReport.stagedCount > 0 && <p className="bulk-report-next"><strong>Next:</strong> review the spreadsheet preview below, then click <strong>Import valid rows</strong>. Their matched images are already attached.</p>}
                            </section>
                        )}
                        {importRows.length > 0 && (
                            <section className="admin-panel">
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">IMPORT PREVIEW</p><h2>{importRows.length} rows detected</h2></div>
                                    <div className="import-validation-summary"><span className="valid"><CheckCircle2 size={16} /> {importRows.filter((row) => row.valid).length} ready</span><span className="invalid"><XCircle size={16} /> {importRows.filter((row) => !row.valid).length} issues</span>{importRows.some((row) => !row.valid) && <button type="button" className="admin-secondary-button" onClick={downloadImportErrorsCsv}><Download size={15} /> Error CSV</button>}</div>
                                </div>
                                <div className="admin-table-wrap import-preview-table">
                                    <table className="admin-table">
                                        <thead><tr><th>Row</th><th>Status</th><th>Product</th><th>Category</th><th>Original price</th><th>Discounted price</th><th>Shipping</th><th>Stock</th><th>Sold</th></tr></thead>
                                        <tbody>{importRows.slice(0, 50).map((row) => (
                                            <tr key={row.rowNumber}>
                                                <td>{row.rowNumber}</td>
                                                <td>{row.valid ? <span className="import-row-valid"><CheckCircle2 size={15} /> Ready</span> : <span className="import-row-invalid" title={row.errors.join(', ')}><XCircle size={15} /> {row.errors.join(', ')}</span>}</td>
                                                <td><strong>{row.product.name || 'Missing name'}</strong><small>{row.product.id || 'Missing required product code'}</small></td>
                                                <td>{row.category || '—'}</td>
                                                <td>{row.product.price === '' ? '—' : formatCurrency(row.product.price)}</td>
                                                <td>{row.product.discount === '' ? '—' : formatCurrency(row.product.discount)}</td>
                                                <td>{row.product.shippingCharge > 0 ? formatCurrency(row.product.shippingCharge) : 'Free'}</td>
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
                                    <label>Product code / ID (required)<input name="id" value={formData.id} onChange={handleInputChange} placeholder="Example: WW300125" required autoCapitalize="characters" spellCheck="false" disabled={selectedProductId !== 'new'} /><small>Enter the exact unique stock code. It is used in Flash Sale, orders and emails and cannot change after creation.</small></label>
                                    <label className="full-width">Product name<input name="name" value={formData.name} onChange={handleInputChange} required /></label>
                                    <label className="full-width">Description<textarea name="description" value={formData.description} onChange={handleInputChange} rows="4" /></label>
                                    <label>Original price (₹)<input name="price" type="number" min="1" value={formData.price} onChange={handleInputChange} required /></label>
                                    <label>Discounted price (₹)<input name="discount" type="number" min="1" value={formData.discount} onChange={handleInputChange} placeholder="Optional" /><small>Leave blank if this product is not discounted.</small></label>
                                    <label>Shipping charge?<select name="hasShippingCharge" value={formData.hasShippingCharge} onChange={handleInputChange}><option value="no">No — free shipping</option><option value="yes">Yes</option></select></label>
                                    {formData.hasShippingCharge === 'yes' && <label>Shipping amount per item (₹)<input name="shippingCharge" type="number" min="0.01" step="0.01" value={formData.shippingCharge} onChange={handleInputChange} required /><small>Added to the cart and Razorpay total.</small></label>}
                                    <label>Buy 1 Get 1?<select name="buyOneGetOne" value={formData.buyOneGetOne} onChange={handleInputChange}><option value="no">No</option><option value="yes">Yes — eligible</option></select><small>Eligible products can be mixed. For each pair, the lower-priced product is free.</small></label>
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
                                    <label>Subcategories<select multiple value={formData.subcategory} onChange={(event) => setFormData((current) => ({ ...current, subcategory: [...event.target.selectedOptions].map((option) => option.value) }))}>{getSubcategories().map((subcategory) => <option key={subcategory} value={subcategory}>{displaySubcategoryLabel(subcategory)}</option>)}</select><small>Use Cmd/Ctrl for multiple</small></label>
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
