import { apiClient } from '../client';
import { Category } from '../../types';
import { MOCK_CATEGORIES } from '../../mocks/categories';

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    try {
      const data = await apiClient.get<unknown, Category[]>('/categories');
      if (Array.isArray(data) && data.length > 0) return data;
      throw new Error('API offline');
    } catch {
      return MOCK_CATEGORIES;
    }
  }
};
