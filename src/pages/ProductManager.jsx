import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Boxes,
    CheckCircle2,
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
    deleteCustomersFromDatabase,
    deleteProductsFromDatabase,
    getCustomersFromDatabase,
    getOrdersFromDatabase,
    getProductsFromDatabase,
    hasAdminKey,
    saveProductsToDatabase,
    verifyAdminKey,
} from '../services/apiClient';
import './ProductManager.css';
import { normalizeList, normalizeSizeList, STANDARD_CLOTHING_SIZES } from '../utils/productOptions';

const ADMIN_SESSION_KEY = 'pm_auth';
const PRODUCT_DRAFT_KEY = 'anns-admin-products-draft';
const LOW_STOCK_LIMIT = 10;
const PRODUCT_CATEGORIES = ['Gifts', 'Jewellery', 'Womens Wear'];
const MAX_PRODUCT_IMAGES = 5;
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 450 * 1024;

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

const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

const compressImageFile = (file) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, 1400 / image.naturalWidth, 1600 / image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const encode = (quality) => canvas.toBlob(async (blob) => {
            if (!blob) return reject(new Error(`Could not prepare ${file.name}`));
            if (blob.size > MAX_STORED_IMAGE_BYTES && quality > 0.46) {
                encode(quality - 0.1);
                return;
            }
            try { resolve(await readBlobAsDataUrl(blob)); } catch (error) { reject(error); }
        }, 'image/jpeg', quality);
        encode(0.78);
    };
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`${file.name} is not a supported image`));
    };
    image.src = objectUrl;
});

const ProductManager = () => {
    const [products, setProducts] = useState(readProductDraft);
    const [isAuthenticated, setIsAuthenticated] = useState(() => (
        sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' && hasAdminKey()
    ));
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [activeView, setActiveView] = useState('overview');
    const [notification, setNotification] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState(PRODUCT_CATEGORIES[0]);
    const [selectedProductId, setSelectedProductId] = useState('new');
    const [formData, setFormData] = useState(getInitialFormData);
    const [importRows, setImportRows] = useState([]);
    const [importFileName, setImportFileName] = useState('');
    const [importError, setImportError] = useState('');
    const [customers, setCustomers] = useState(readCustomers);
    const [orders, setOrders] = useState(readOrders);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [databaseStatus, setDatabaseStatus] = useState(hasAdminKey() ? 'connecting' : 'local');
    const fileInputRef = useRef(null);

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
        const ordersByCustomer = new Map();
        orders.forEach((order) => {
            ordersByCustomer.set(order.customerId, [...(ordersByCustomer.get(order.customerId) || []), order]);
        });
        const enrichedCustomers = customers.map((customer) => {
            const customerOrders = ordersByCustomer.get(customer.id) || [];
            return {
                ...customer,
                active: isCustomerActive(customer),
                orders: customerOrders,
                totalSpent: customerOrders.reduce((total, order) => total + toNumber(order.total), 0),
            };
        });
        return {
            customers: enrichedCustomers,
            activeCount: enrichedCustomers.filter((customer) => customer.active).length,
            orderCount: orders.length,
            revenue: orders.reduce((total, order) => total + toNumber(order.total), 0),
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
        // Refresh is intentionally performed when a stored admin session is restored.
    }, [isAuthenticated]);

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

    const saveProducts = async (nextProducts, message, changedProducts = productsForDatabase(nextProducts)) => {
        setNotification(message);
        if (hasAdminKey()) {
            try {
                await saveProductsToDatabase(changedProducts);
                setDatabaseStatus('connected');
                setNotification(`${message} Synced to MongoDB Atlas.`);
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
            await Promise.all([refreshProductsFromDatabase(), refreshCustomerData()]);
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
        setActiveView('editor');
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
            subcategory: parseList(product.subcategory),
            similarProducts: parseList(product.similarProducts),
            reviews: parseList(product.reviews),
            shipping: parseList(product.shipping),
            campaign: parseList(product.campaign),
        });
        setActiveView('editor');
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleArrayChange = (event, field) => {
        setFormData((current) => ({ ...current, [field]: parseList(event.target.value) }));
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
        if (files.some((file) => !file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_BYTES)) {
            setNotification('Choose JPG, PNG or WebP images smaller than 12 MB each.');
            window.setTimeout(() => setNotification(''), 3000);
            return;
        }
        try {
            setNotification('Preparing images…');
            const dataUrls = await Promise.all(files.map(compressImageFile));
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
        const normalizedProduct = {
            ...getInitialFormData(),
            ...formData,
            id: formData.id || `${selectedCategory.substring(0, 2).toLowerCase()}${Date.now()}`,
            stock: Math.max(0, toNumber(formData.stock)),
            sold: Math.max(0, toNumber(formData.sold)),
            sizes: normalizeSizeList(formData.sizes),
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

    const mapImportedRow = (rawRow, index) => {
        const row = normalizeHeaders(rawRow);
        const category = normalizeCategory(valueFrom(row, 'category'));
        const name = String(valueFrom(row, 'name', 'productname')).trim();
        const price = valueFrom(row, 'price', 'sellingprice');
        const id = String(valueFrom(row, 'id', 'sku', 'productid')).trim();
        const errors = [];
        if (!Object.keys(products).includes(category)) errors.push('Unknown category');
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

        validRows.forEach(({ category, product }, index) => {
            const generatedId = product.id || `${category.substring(0, 2).toLowerCase()}${Date.now()}${index}`;
            const existingIndex = nextProducts[category].findIndex((item) => item.id === generatedId);
            const existingProduct = existingIndex >= 0 ? nextProducts[category][existingIndex] : getInitialFormData();
            const importedProduct = {
                ...existingProduct,
                ...product,
                id: generatedId,
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

    const exportInventory = async () => {
        const { utils, writeFileXLSX } = await import('xlsx');
        const exportRows = allProducts.map((product) => ({
            category: product.category,
            id: product.id,
            name: product.name,
            price: toNumber(product.price),
            stock: product.stockValue,
            sold: product.soldValue,
            remaining: product.remainingValue,
            status: product.remainingValue === 0 ? 'Out of stock' : product.remainingValue <= LOW_STOCK_LIMIT ? 'Low stock' : 'Available',
            subcategory: parseList(product.subcategory).join(', '),
            featured: product.featured,
        }));
        const worksheet = utils.json_to_sheet(exportRows);
        worksheet['!cols'] = [16, 15, 34, 12, 12, 12, 12, 16, 28, 12].map((wch) => ({ wch }));
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Inventory');
        writeFileXLSX(workbook, 'ANNS-inventory.xlsx');
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
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'import', label: 'Bulk import', icon: UploadCloud },
        { id: 'editor', label: selectedProductId === 'new' ? 'Add product' : 'Edit product', icon: Edit3 },
    ];

    const handleNavigation = (view) => {
        setActiveView(view);
        if (view === 'customers') refreshCustomerData();
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
                            <div className="admin-search"><Search size={18} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name, ID or subcategory" /></div>
                            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                                <option value="all">All categories</option>
                                {Object.keys(products).map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} aria-label="Filter by stock status">
                                <option value="all">All stock</option>
                                <option value="available">Available</option>
                                <option value="low">Low stock</option>
                                <option value="out">Out of stock</option>
                                <option value="sold">Has sales</option>
                            </select>
                            <button type="button" className="admin-icon-button" onClick={exportInventory} title="Export inventory to Excel"><Download size={18} /></button>
                        </div>
                        <div className="inventory-summary-line"><strong>{filteredProducts.length}</strong> products shown <span>·</span> Remaining = total stock − sold</div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Total stock</th><th>Sold</th><th>Remaining</th><th>Status</th><th aria-label="Actions" /></tr></thead>
                                <tbody>
                                    {filteredProducts.map((product) => {
                                        const status = product.remainingValue === 0 ? 'out' : product.remainingValue <= LOW_STOCK_LIMIT ? 'low' : 'available';
                                        return (
                                            <tr key={`${product.category}-${product.id}`}>
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
                        {!filteredProducts.length && <div className="admin-empty-state"><Search size={27} /><p>No products match these filters.</p></div>}
                    </section>
                )}

                {activeView === 'customers' && (
                    <div className="admin-view-stack">
                        <section className="customer-stat-grid">
                            <article className="customer-stat"><UserCheck size={21} /><div><span>Active users</span><strong>{customerInsights.activeCount}</strong><small>Signed in within 30 minutes</small></div></article>
                            <article className="customer-stat"><Users size={21} /><div><span>Registered contacts</span><strong>{customers.length}</strong><small>Email and mobile registrations</small></div></article>
                            <article className="customer-stat"><ReceiptText size={21} /><div><span>Orders recorded</span><strong>{customerInsights.orderCount}</strong><small>Across all customers</small></div></article>
                            <article className="customer-stat"><ShoppingBag size={21} /><div><span>Customer revenue</span><strong>{formatCurrency(customerInsights.revenue)}</strong><small>From recorded orders</small></div></article>
                        </section>

                        <section className="admin-panel customer-panel">
                            <div className="customer-toolbar">
                                <div className="admin-search"><Search size={18} /><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name, email or mobile" /></div>
                                <button type="button" className="admin-secondary-button" onClick={refreshCustomerData}><RefreshCw size={17} /> Refresh activity</button>
                            </div>
                            <div className="admin-table-wrap">
                                <table className="admin-table customer-table">
                                    <thead><tr><th>Customer</th><th>Contact</th><th>Sign-in</th><th>Activity</th><th>Orders</th><th>Total spent</th><th aria-label="Customer actions" /></tr></thead>
                                    <tbody>
                                        {filteredCustomers.map((customer) => (
                                            <tr key={customer.id}>
                                                <td><div className="customer-name-cell">{customer.picture ? <img src={customer.picture} alt="" /> : <span>{customer.name?.charAt(0)?.toUpperCase() || 'A'}</span>}<div><strong>{customer.name}</strong><small>Joined {new Date(customer.createdAt).toLocaleDateString('en-IN')}</small></div></div></td>
                                                <td><div className="customer-contact">{customer.email && <span><Mail size={14} /> {customer.email}</span>}{customer.phone && <span><Phone size={14} /> +91 {customer.phone}</span>}{!customer.email && !customer.phone && <small>No contact recorded</small>}</div></td>
                                                <td><span className="provider-badge">{customer.provider}</span></td>
                                                <td><span className={`activity-badge ${customer.active ? 'active' : 'inactive'}`}><i /> {customer.active ? 'Active now' : 'Inactive'}</span><small>{customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No activity'}</small></td>
                                                <td>{customer.orders.length}</td>
                                                <td><strong>{formatCurrency(customer.totalSpent)}</strong></td>
                                                <td><div className="customer-actions"><button type="button" className="history-button" onClick={() => setSelectedCustomerId(selectedCustomerId === customer.id ? '' : customer.id)}><ReceiptText size={15} /> History</button><button type="button" className="customer-delete-button" onClick={() => removeCustomer(customer)} aria-label={`Delete ${customer.name || 'customer'}`} title="Delete customer contact"><Trash2 size={15} /></button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {!filteredCustomers.length && <div className="admin-empty-state"><Users size={28} /><p>No registered customers yet. New Google, email and mobile sign-ins will appear here.</p></div>}
                        </section>

                        {selectedCustomer && (
                            <section className="admin-panel purchase-history-panel">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">PURCHASE HISTORY</p><h2>{selectedCustomer.name}</h2></div><span className="admin-count-badge">{selectedCustomer.orders.length} orders</span></div>
                                {selectedCustomer.orders.length ? (
                                    <div className="order-history-list">{selectedCustomer.orders.map((order) => (
                                        <article key={order.id}>
                                            <div><strong>Order {order.id}</strong><small>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
                                            <span className="order-status">{order.status || 'Placed'}</span>
                                            <div><strong>{order.items?.reduce((total, item) => total + toNumber(item.quantity, 1), 0) || 0} items</strong><small>{(order.items || []).map((item) => item.name).join(', ')}</small></div>
                                            <strong>{formatCurrency(order.total)}</strong>
                                        </article>
                                    ))}</div>
                                ) : <div className="admin-empty-state"><ReceiptText size={28} /><p>No purchases recorded for this customer.</p></div>}
                            </section>
                        )}

                        <section className="admin-panel customer-data-note"><AlertTriangle size={21} /><div><strong>{databaseStatus === 'connected' ? 'MongoDB analytics' : 'Offline fallback'}</strong><p>{databaseStatus === 'connected' ? 'Customer sessions, contacts and paid-order history are loaded from the shared MongoDB database.' : 'The database is unavailable, so this browser’s cached data is shown until the connection recovers.'}</p></div></section>
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
                        {importRows.length > 0 && (
                            <section className="admin-panel">
                                <div className="admin-panel-heading">
                                    <div><p className="admin-kicker">IMPORT PREVIEW</p><h2>{importRows.length} rows detected</h2></div>
                                    <div className="import-validation-summary"><span className="valid"><CheckCircle2 size={16} /> {importRows.filter((row) => row.valid).length} ready</span><span className="invalid"><XCircle size={16} /> {importRows.filter((row) => !row.valid).length} issues</span></div>
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
                                    <label>Product ID<input name="id" value={formData.id} onChange={handleInputChange} placeholder="Generated if empty" disabled={selectedProductId !== 'new'} /></label>
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
                                    <label className="editor-checkbox"><input type="checkbox" checked={formData.showOnCategory !== false} onChange={(event) => setFormData((current) => ({ ...current, showOnCategory: event.target.checked }))} /> Show in category page</label>
                                    <label>Color<input name="color" value={formData.color} onChange={handleInputChange} /></label>
                                </div>
                            </section>
                            <section className="admin-panel editor-section">
                                <div className="admin-panel-heading"><div><p className="admin-kicker">PRODUCT INFORMATION</p><h2>Images and options</h2></div></div>
                                <div className="editor-form-grid">
                                    <label className="full-width">Main image URL<input name="image" value={formData.image} onChange={handleInputChange} placeholder="Paste an image URL or choose image files below" /></label>
                                    <label className="full-width image-upload-control">Upload images<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageFiles} /><small>Select up to five images at once. The first is the main image and the other four appear in the product gallery. Large images are optimized automatically.</small></label>
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
                                    <label className="full-width">Similar product IDs<input value={formData.similarProducts.join(', ')} onChange={(event) => handleArrayChange(event, 'similarProducts')} placeholder="Comma separated IDs" /></label>
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
