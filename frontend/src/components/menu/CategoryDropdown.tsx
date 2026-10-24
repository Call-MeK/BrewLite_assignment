'use client';

import React, { useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  display_order?: number;
  created_at?: string;
}

interface CategoryDropdownProps {
  categories: Category[];
  onSelectCategory: (categoryId: string | null) => void;
}

export default function CategoryDropdown({ categories, onSelectCategory }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sortedCategories = [...categories].sort((a, b) => {
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg font-medium text-gray-700 transition">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Danh mục sản phẩm
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white shadow-lg rounded-lg border border-gray-100 py-2 z-50 max-h-60 overflow-y-auto">
          {}
          <button
            onClick={() => {
              onSelectCategory(null);
              setIsOpen(false);
            }}
            className="w-full text-left block px-4 py-2 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition font-medium border-b border-gray-50"
          >
            Tất cả sản phẩm
          </button>

          {}
          {sortedCategories.length > 0 ? (
            sortedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  setIsOpen(false);
                }}
                className="w-full text-left block px-4 py-2 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition"
              >
                {cat.name}
              </button>
            ))
          ) : (
            <span className="block px-4 py-2 text-gray-400 text-sm">Đang tải danh mục...</span>
          )}
        </div>
      )}
    </div>
  );
}