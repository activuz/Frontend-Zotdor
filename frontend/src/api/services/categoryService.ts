import { Category } from '../../types';
import { MOCK_CATEGORIES } from '../../mocks/categories';

/**
 * DEMO DATA — no backend call. Replaced by GET /reference/taxonomy in phase 3–4
 * (docs/IMPLEMENTATION_PLAN.md). The UI labels these screens as sample data (DemoNotice).
 */
export const categoryService = {
  async getCategories(): Promise<Category[]> {
    return MOCK_CATEGORIES;
  },
};
