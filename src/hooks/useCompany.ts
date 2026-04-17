import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
  slug: string | null;
  timezone: string | null;
  currency: string | null;
  receipt_footer: string | null;
  theme_color: string | null;
  printer_ip: string | null;
  created_at: string;
  updated_at: string;
}

export function useCompany() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const updateCompany = useMutation({
    mutationFn: async (updates: Partial<Company>) => {
      if (!company?.id) throw new Error('Empresa não encontrada');
      const { data, error } = await (supabase as any)
        .from('companies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', company.id)
        .select()
        .single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['company'], data);
      toast.success('Dados da empresa atualizados com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar dados da empresa: ' + error.message);
    },
  });

  return {
    company,
    isLoading,
    updateCompany: updateCompany.mutate,
    isUpdating: updateCompany.isPending,
  };
}
