import { StatusNegociacao, Origem, MotivoPerda, Papel } from '../types';

export const STATUS_LISTA: StatusNegociacao[] = [
  'Novo',
  'Orçamento',
  'Negociando',
  'Fechou',
  'Não fechou',
];

export const ORIGENS_LISTA: Origem[] = [
  'Google Ads',
  'Google Maps',
  'Site',
  'Meta Ads',
  'Instagram',
  'Indicação',
  'Ligação',
  'Cliente antigo',
];

export const MOTIVOS_LISTA: MotivoPerda[] = [
  'Preço',
  'Só pesquisando',
  'Sem resposta',
  'Fechou com outro',
  'Serviço que não fazemos',
  'Adiou a decisão',
];

export const PAPEIS_LISTA: Papel[] = [
  'superadmin',
  'agencia',
  'admin_cliente',
  'comercial',
  'visualizador',
];

export const PAPEL_LABELS: Record<Papel, string> = {
  superadmin: 'Superadmin',
  agencia: 'Agência',
  admin_cliente: 'Admin do cliente',
  comercial: 'Comercial',
  visualizador: 'Visualizador',
};
