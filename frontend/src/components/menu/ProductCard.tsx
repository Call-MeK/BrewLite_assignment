'use client';

import React from 'react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
      <div className="relative h-56 w-full bg-orange-50 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <span className="text-sm text-gray-400">Không có hình ảnh</span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{product.category}</p>
          <h3 className="font-semibold text-gray-800 text-base mb-2">{product.name}</h3>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <span className="text-red-600 font-bold text-lg">
            {product.price.toLocaleString('vi-VN')}đ
          </span>
          <button className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xl transition shadow-sm">
            +
          </button>
        </div>
      </div>
    </div>
  );
}