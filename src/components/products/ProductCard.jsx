import React from 'react';

const formatPrice = (price) => {
  const numPrice = parseInt(price, 10) || 0;
  if (numPrice === 0) return 'FREE';
  return `₹ ${numPrice}`;
};

const getFirstImage = (imageUrls) => {
  if (imageUrls && imageUrls.length > 0) return imageUrls[0];
  return 'https://via.placeholder.com/400x300?text=No+Image';
};

export default function ProductCard({ product, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="relative h-48 w-full bg-gray-200">
        <img
          src={getFirstImage(product.image_urls)}
          alt={product.title}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => { 
            e.target.src = 'https://via.placeholder.com/400x300?text=No+Image'; 
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3rem]">
          {product.title}
        </h3>
        <p className={`text-2xl font-bold ${
          parseInt(product.price, 10) === 0 ? 'text-green-600' : 'text-indigo-600'
        }`}>
          {formatPrice(product.price)}
        </p>
      </div>
    </div>
  );
}