import corporateGiftImage from '../assets/cmp-jw.jpg';
import personalGiftImage from '../assets/cmp-gf.jpg';
import clothingImage from '../assets/img/ww/ww30007.jpg';

const demoProducts = [
  {
    id: 'demo-clothing',
    name: 'Women’s Wear Demo',
    description: 'A sample clothing card for the home page.',
    category: 'Womens Wear',
    subcategory: ['Three piece sets'],
    image: clothingImage,
    otherImages: [],
    price: '1050',
    stock: 0,
    sold: 0,
    featured: 'yes',
    showOnCategory: false,
    isDemo: true,
    sizes: [],
  },
  {
    id: 'demo-personal-gift',
    name: 'Personal Gift Demo',
    description: 'A sample personal-gifting card for the home page.',
    category: 'Gifts',
    subcategory: ['Personal Gifts'],
    image: personalGiftImage,
    otherImages: [],
    price: '1499',
    stock: 0,
    sold: 0,
    featured: 'yes',
    showOnCategory: false,
    isDemo: true,
    sizes: [],
  },
  {
    id: 'demo-corporate-gift',
    name: 'Corporate Gift Demo',
    description: 'A sample corporate-gifting card for the home page.',
    category: 'Gifts',
    subcategory: ['Corporate Gifting'],
    image: corporateGiftImage,
    otherImages: [],
    price: '2499',
    stock: 0,
    sold: 0,
    featured: 'yes',
    showOnCategory: false,
    isDemo: true,
    sizes: [],
  },
];

export default demoProducts;
