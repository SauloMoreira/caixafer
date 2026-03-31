import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MovementCategoryType = 'income' | 'expense';

export interface MovementCategory {
  id: string;
  name: string;
  movement_type: MovementCategoryType;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UseMovementCategoriesOptions {
  includeInactive?: boolean;
}

export function useMovementCategories({ includeInactive = false }: UseMovementCategoriesOptions = {}) {
  const [categories, setCategories] = useState<MovementCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);

    let query = (supabase as any)
      .from('movement_categories')
      .select('*')
      .order('movement_type')
      .order('sort_order')
      .order('name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data } = await query;
    setCategories((data || []) as MovementCategory[]);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const categoriesByType = useMemo(() => ({
    income: categories.filter(category => category.movement_type === 'income'),
    expense: categories.filter(category => category.movement_type === 'expense'),
  }), [categories]);

  const getCategoriesForType = useCallback((movementType: MovementCategoryType) => {
    return categoriesByType[movementType];
  }, [categoriesByType]);

  const getDefaultCategoryName = useCallback((movementType: MovementCategoryType) => {
    return categoriesByType[movementType][0]?.name || '';
  }, [categoriesByType]);

  return {
    categories,
    categoriesByType,
    loading,
    refresh: fetchCategories,
    getCategoriesForType,
    getDefaultCategoryName,
  };
}