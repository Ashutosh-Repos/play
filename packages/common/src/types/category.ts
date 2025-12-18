// Category types aligned with Prisma schema

/**
 * Category summary
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
}

/**
 * Category with video count
 */
export interface CategoryWithCount extends Category {
  videoCount: number;
}
