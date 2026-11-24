import React, { useState } from 'react';
import { Icon } from './Icon';
import { diffDias } from '../lib/format';

export type TipoPeriodo = 'hoje' | 'semana' | 'mes' | 'todos' | 'personalizado';

export interface PeriodoState {
  tipo: TipoPeriodo;
  dataInicio?: string;
  dataFim?: string;
}

interface FiltroPeriodoProps {
  value: PeriodoState;
  onChange: (val: PeriodoState) => void;
  permitirTodos?: boolean;
  className?: string;
}

export const estaNoPeriodo = (
  dataStr: string | null | undefined,
  periodo: PeriodoState
): boolean => {
  if (!dataStr) return false;
  const iso = dataStr.slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);

  if (periodo.tipo === 'todos') return true;

  if (periodo.tipo === 'hoje') {
    return iso === hoje;
  }

  if (periodo.tipo === 'semana') {
    const d = diffDias(iso);
    return d >= 0 && d <= 7;
  }

  if (periodo.tipo === 'mes') {
    const d = diffDias(iso);
    return d >= 0 && d <= 30;
  }

  if (periodo.tipo === 'personalizado') {
    if (periodo.dataInicio && iso < periodo.dataInicio) return false;
    if (periodo.dataFim && iso > periodo.dataFim) return false;
    return true;
  }

  return true;
};

export const FiltroPeriodo: React.FC<FiltroPeriodoProps> = ({
  value,
  onChange,
  permitirTodos = true,
  className = '',
}) => {
  const hojeStr = new Date().toISOString().slice(0, 10);
  const [dataInicioLocal, setDataInicioLocal] = useState(
    value.dataInicio || hojeStr
  );
  const [dataFimLocal, setDataFimLocal] = useState(
    value.dataFim || hojeStr
  );

  const handleTipoClick = (tipo: TipoPeriodo) => {
    if (tipo === 'personalizado') {
      onChange({
        tipo,
        dataInicio: dataInicioLocal,
        dataFim: dataFimLocal,
      });
    } else {
      onChange({ tipo });
    }
  };

  const handleDataInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDataInicioLocal(v);
    if (value.tipo === 'personalizado') {
      onChange({
        tipo: 'personalizado',
        dataInicio: v,
        dataFim: dataFimLocal,
      });
    }
  };

  const handleDataFimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDataFimLocal(v);
    if (value.tipo === 'personalizado') {
      onChange({
        tipo: 'personalizado',
        dataInicio: dataInicioLocal,
        dataFim: v,
      });
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Botões rápidos de período */}
      <div className="flex items-center gap-1 p-1 bg-surface-hover rounded-[11px] border border-line">
        <button
          type="button"
          onClick={() => handleTipoClick('hoje')}
          className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
            value.tipo === 'hoje'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Hoje
        </button>

        <button
          type="button"
          onClick={() => handleTipoClick('semana')}
          className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
            value.tipo === 'semana'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Semana
        </button>

        <button
          type="button"
          onClick={() => handleTipoClick('mes')}
          className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
            value.tipo === 'mes'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Mês
        </button>

        <button
          type="button"
          onClick={() => handleTipoClick('personalizado')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] text-xs font-semibold transition-all ${
            value.tipo === 'personalizado'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Icon name="calendar" size={13} />
          <span>Personalizado</span>
        </button>

        {permitirTodos && (
          <button
            type="button"
            onClick={() => handleTipoClick('todos')}
            className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-all ${
              value.tipo === 'todos'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Todos
          </button>
        )}
      </div>

      {/* Date Pickers quando Personalizado estiver ativo */}
      {value.tipo === 'personalizado' && (
        <div className="flex items-center gap-1.5 bg-surface-hover border border-line rounded-[11px] px-2.5 py-1 text-xs">
          <span className="text-muted text-[11px]">De:</span>
          <input
            type="date"
            value={dataInicioLocal}
            onChange={handleDataInicioChange}
            className="bg-transparent text-ink text-xs focus:outline-none cursor-pointer"
          />
          <span className="text-muted text-[11px] ml-1">Até:</span>
          <input
            type="date"
            value={dataFimLocal}
            onChange={handleDataFimChange}
            className="bg-transparent text-ink text-xs focus:outline-none cursor-pointer"
          />
        </div>
      )}
    </div>
  );
};
