import React from 'react';
import { StatusNegociacao, TipoCliente } from '../types';

export const PillStatus: React.FC<{ status: StatusNegociacao }> = ({ status }) => {
  const styles: Record<StatusNegociacao, string> = {
    Novo: 'pill-info',
    Orçamento: 'pill-warn',
    Negociando: 'pill-acc',
    Fechou: 'pill-good',
    'Não fechou': 'pill-bad',
  };

  return <span className={`pill ${styles[status]}`}>{status}</span>;
};

export const PillTipo: React.FC<{ tipo: TipoCliente }> = ({ tipo }) => {
  const labels: Record<TipoCliente, string> = {
    Novo: 'Cliente novo',
    Recorrente: 'Recorrente',
    Reativação: 'Reativado',
  };

  const styles: Record<TipoCliente, string> = {
    Novo: 'pill-info',
    Recorrente: 'pill-acc',
    Reativação: 'pill-warn',
  };

  return <span className={`pill ${styles[tipo]}`}>{labels[tipo]}</span>;
};
