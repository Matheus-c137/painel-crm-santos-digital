import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Cliente, Negociacao, Perfil, StatusNegociacao, Origem, MotivoPerda } from '../types';

export const useClientes = () => {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (error) throw error;

      // Buscar comissão separada se for superadmin (se não tiver permissão o RLS bloqueia e retorna vazio)
      const { data: comissoes } = await supabase
        .from('comissao_config')
        .select('cliente_id, percentual');

      const comissaoMap = new Map((comissoes || []).map((c) => [c.cliente_id, c.percentual]));

      return (data || []).map((cli) => ({
        ...cli,
        percentual_comissao: comissaoMap.get(cli.id),
      })) as Cliente[];
    },
  });
};

export const useNegociacoes = (clienteId?: string) => {
  return useQuery({
    queryKey: ['negociacoes', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negociacoes')
        .select(`
          *,
          contatos (*),
          perfis (*)
        `)
        .eq('cliente_id', clienteId!)
        .order('data_abertura', { ascending: false })
        .limit(10000);

      if (error) throw error;
      return (data || []) as Negociacao[];
    },
  });
};

export const useUsuarios = (clienteId?: string | null) => {
  return useQuery({
    queryKey: ['usuarios', clienteId],
    queryFn: async () => {
      let query = supabase.from('perfis').select('*').order('nome');
      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Perfil[];
    },
  });
};

export const useSalvarNegociacao = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      cliente_id: string;
      nome: string;
      telefone: string;
      bairro?: string;
      servico: string;
      origem: Origem;
      responsavel_id?: string | null;
      status: StatusNegociacao;
      valor_orcamento?: number;
      valor_fechado?: number;
      data_fechamento?: string | null;
      motivo_perda?: MotivoPerda | null;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase.rpc('salvar_negociacao', {
        p_id: payload.id || null,
        p_cliente_id: payload.cliente_id,
        p_nome: payload.nome,
        p_telefone: payload.telefone,
        p_bairro: payload.bairro || '',
        p_servico: payload.servico,
        p_origem: payload.origem,
        p_responsavel_id: payload.responsavel_id || null,
        p_status: payload.status,
        p_valor_orcamento: payload.valor_orcamento || 0,
        p_valor_fechado: payload.valor_fechado || 0,
        p_data_fechamento: payload.data_fechamento || null,
        p_motivo_perda: payload.motivo_perda || null,
        p_observacoes: payload.observacoes || '',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['negociacoes', vars.cliente_id] });
    },
  });
};

export const useRegistrarVendaDireta = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      cliente_id: string;
      nome: string;
      telefone: string;
      bairro?: string;
      servico: string;
      origem: Origem;
      responsavel_id?: string | null;
      valor: number;
      data: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase.rpc('registrar_venda_direta', {
        p_cliente_id: payload.cliente_id,
        p_nome: payload.nome,
        p_telefone: payload.telefone,
        p_bairro: payload.bairro || '',
        p_servico: payload.servico,
        p_origem: payload.origem,
        p_responsavel_id: payload.responsavel_id || null,
        p_valor: payload.valor,
        p_data: payload.data,
        p_observacoes: payload.observacoes || '',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['negociacoes', vars.cliente_id] });
    },
  });
};

export const useMoverNegociacao = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      cliente_id: string;
      novo_status: StatusNegociacao;
      valor_fechado?: number;
      data_fechamento?: string;
      motivo_perda?: MotivoPerda;
    }) => {
      const { data, error } = await supabase.rpc('mover_negociacao', {
        p_id: payload.id,
        p_novo_status: payload.novo_status,
        p_valor_fechado: payload.valor_fechado ?? null,
        p_data_fechamento: payload.data_fechamento ?? null,
        p_motivo_perda: payload.motivo_perda ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['negociacoes', vars.cliente_id] });
    },
  });
};

export const useRegistrarInteracao = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; cliente_id: string; data?: string }) => {
      const hoje = payload.data || new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('negociacoes')
        .update({ ultima_interacao: hoje })
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['negociacoes', vars.cliente_id] });
    },
  });
};

