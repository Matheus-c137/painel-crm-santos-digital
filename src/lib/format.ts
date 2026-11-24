export const brl = (v?: number | null) => {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
};

export const pct = (v?: number | null) => {
  if (v == null || !isFinite(v)) return '—';
  return Math.round(v * 100) + '%';
};

export const ini = (nome: string) => {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
};

export const fdata = (iso?: string | null) => {
  if (!iso) return '—';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}`;
};

export const digits = (s?: string | null) => {
  return String(s || '').replace(/\D/g, '');
};

export const diffDias = (isoDate: string) => {
  const agora = new Date();
  const d = new Date(isoDate + 'T12:00:00Z');
  return Math.round((agora.getTime() - d.getTime()) / 864e5);
};

export const contatoTexto = (ultimaInteracao: string) => {
  const d = diffDias(ultimaInteracao);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
};
