'use client';

import React, { useState, useEffect } from 'react';
import CategoryDropdown from '@/components/menu/CategoryDropdown';
import SearchBar from '@/components/menu/SearchBar';
import ProductCard from '@/components/menu/ProductCard';

interface Product {
  id: string;
  name: string;
  basePrice: string;
  imageUrl: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  display_order?: number;
  created_at?: string;
}

export default function MenuPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Các trạng thái quản lý Loading và Lỗi
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Gọi API lấy danh sách danh mục từ Backend
  const fetchCategories = () => {
    setIsLoadingCategories(true);
    fetch('http://localhost:4000/api/v1/categories')
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải danh mục');
        return res.json();
      })
      .then((resData) => {
        const catList = resData?.data || resData;
        if (Array.isArray(catList)) {
          setCategories(catList);
        }
        setIsLoadingCategories(false);
      })
      .catch((err) => {
        console.error('Lỗi tải danh mục:', err);
        setIsLoadingCategories(false);
      });
  };

  // Gọi API lấy danh sách sản phẩm
  const fetchProducts = (catId: string | null) => {
    setIsLoadingProducts(true);
    setProductError(null);

    let url = 'http://localhost:4000/api/v1/products';
    if (catId) {
      url += `?categoryId=${catId}`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Không thể kết nối đến máy chủ lấy sản phẩm');
        return res.json();
      })
      .then((response) => {
        if (response && response.data && Array.isArray(response.data.items)) {
          setProducts(response.data.items);
        } else if (Array.isArray(response)) {
          setProducts(response);
        } else {
          setProducts([]);
        }
        setIsLoadingProducts(false);
      })
      .catch((err) => {
        console.error('Lỗi khi gọi API sản phẩm:', err);
        setProductError(err.message);
        setIsLoadingProducts(false);
      });
  };

  // Gọi lần đầu khi load trang
  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts(selectedCategoryId);
  }, [selectedCategoryId]);

  // Lọc sản phẩm theo từ khóa tìm kiếm
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Thanh công cụ: Dropdown Danh mục + Tìm kiếm */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <CategoryDropdown 
          categories={categories} 
          onSelectCategory={(catId) => setSelectedCategoryId(catId)} 
        />
        <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      </div>

    

     
      {isLoadingProducts && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          <span className="ml-3 text-gray-500">Đang tải danh sách món ăn...</span>
        </div>
      )}

      
      {!isLoadingProducts && productError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-8 rounded-xl text-center my-6">
          <p className="font-semibold text-lg mb-2">Đã xảy ra lỗi khi tải dữ liệu!</p>
          <p className="text-sm text-red-500 mb-4">{productError}</p>
          <button 
            onClick={() => fetchProducts(selectedCategoryId)}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium transition shadow-sm"
          >
            Thử lại
          </button>
        </div>
      )}

      
      {!isLoadingProducts && !productError && filteredProducts.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 text-gray-600 px-6 py-12 rounded-xl text-center my-6">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="font-semibold text-lg text-gray-700 mb-1">Menu chưa có món nào</p>
          <p className="text-sm text-gray-500">Hiện tại chưa có sản phẩm nào trong danh mục này hoặc hệ thống đang trống dữ liệu.</p>
        </div>
      )}

      
      {!isLoadingProducts && !productError && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={{
                id: product.id,
                name: product.name,
                category: product.category?.name || 'Danh mục',
                price: Number(product.basePrice),
                image_url: product.imageUrl,
              }} 
            />
          ))}
        </div>
      )}
    </div>
  );
}