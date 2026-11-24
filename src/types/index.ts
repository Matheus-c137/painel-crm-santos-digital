export type Papel = 'superadmin' | 'agencia' | 'admin_cliente' | 'comercial' | 'visualizador';
export type StatusPerfil = 'ativo' | 'suspenso' | 'convite_pendente';
export type StatusNegociacao = 'Novo' | 'Orçamento' | 'Negociando' | 'Fechou' | 'Não fechou';
export type Origem = 'Google Ads' | 'Google Maps' | 'Site' | 'Meta Ads' | 'Instagram' | 'Indicação' | 'Ligação' | 'Cliente antigo';
export type MotivoPerda = 'Preço' | 'Só pesquisando' | 'Sem resposta' | 'Fechou com outro' | 'Serviço que não fazemos' | 'Adiou a decisão';
export type TipoCliente = 'Novo' | 'Recorrente' | 'Reativação';

export interface Cliente {
  id: string;
  nome: string;
  segmento: string;
  ativo: boolean;
  servicos: string[];
  investimento_mensal: number;
  meta_mensal: number;
  criado_em: string;
  atualizado_em: string;
  // comissao_config vem separada apenas para superadmin
  percentual_comissao?: number;
}

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  cliente_id: string | null;
  status: StatusPerfil;
  ultimo_acesso: string | null;
  criado_em: string;
}

export interface Contato {
  id: string;
  cliente_id: string;
  nome: string;
  telefone: string;
  telefone_digitos: string;
  bairro?: string;
  criado_em: string;
}

export interface Negociacao {
  id: string;
  cliente_id: string;
  contato_id: string;
  data_abertura: string;
  ultima_interacao: string;
  servico: string;
  origem: Origem;
  responsavel_id: string | null;
  status: StatusNegociacao;
  valor_orcamento: number;
  valor_fechado: number;
  data_fechamento: string | null;
  motivo_perda: MotivoPerda | null;
  observacoes: string;
  tipo_cliente: TipoCliente;
  criado_em: string;
  contatos?: Contato;
  perfis?: Perfil | null;
}

export interface HistoricoItem {
  id: string;
  negociacao_id: string;
  data: string;
  texto: string;
  criado_por: string | null;
  criado_em: string;
}

export interface LogAtividade {
  id: string;
  cliente_id: string | null;
  usuario_id: string | null;
  texto: string;
  criado_em: string;
  clientes?: { nome: string } | null;
  perfis?: { nome: string } | null;
}
