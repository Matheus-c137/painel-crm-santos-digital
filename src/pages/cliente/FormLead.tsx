import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { useSalvarNegociacao, useNegociacoes, useUsuarios } from '../../queries';
import { StatusNegociacao, Origem, MotivoPerda } from '../../types';
import { STATUS_LISTA, ORIGENS_LISTA, MOTIVOS_LISTA } from '../../lib/constantes';
import { useToast } from '../../components/Toast';

interface FormLeadProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  servicos: string[];
  leadId?: string | null;
}

export const FormLead: React.FC<FormLeadProps> = ({
  isOpen,
  onClose,
  clienteId,
  servicos,
  leadId,
}) => {
  const { data: negociacoes = [] } = useNegociacoes(clienteId);
  const { data: usuarios = [] } = useUsuarios(clienteId);
  const salvarNegociacao = useSalvarNegociacao();
  const { showToast } = useToast();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [bairro, setBairro] = useState('');
  const [servico, setServico] = useState('');
  const [origem, setOrigem] = useState<Origem>('Google Ads');
  const [responsavelId, setResponsavelId] = useState('');
  const [status, setStatus] = useState<StatusNegociacao>('Novo');
  const [valorOrcamento, setValorOrcamento] = useState('');
  const [valorFechado, setValorFechado] = useState('');
  const [dataFechamento, setDataFechamento] = useState(new Date().toISOString().slice(0, 10));
  const [motivoPerda, setMotivoPerda] = useState<MotivoPerda>('Preço');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (leadId) {
      const n = negociacoes.find((item) => item.id === leadId);
      if (n) {
        setNome(n.contatos?.nome || '');
        setTelefone(n.contatos?.telefone || '');
        setBairro(n.contatos?.bairro || '');
        setServico(n.servico);
        setOrigem(n.origem);
        setResponsavelId(n.responsavel_id || '');
        setStatus(n.status);
        setValorOrcamento(n.valor_orcamento ? String(n.valor_orcamento) : '');
        setValorFechado(n.valor_fechado ? String(n.valor_fechado) : '');
        setDataFechamento(n.data_fechamento || new Date().toISOString().slice(0, 10));
        setMotivoPerda(n.motivo_perda || 'Preço');
        setObservacoes(n.observacoes || '');
      }
    } else {
      setNome('');
      setTelefone('');
      setBairro('');
      setServico(servicos[0] || '');
      setOrigem('Google Ads');
      setResponsavelId('');
      setStatus('Novo');
      setValorOrcamento('');
      setValorFechado('');
      setDataFechamento(new Date().toISOString().slice(0, 10));
      setMotivoPerda('Preço');
      setObservacoes('');
    }
  }, [leadId, isOpen, negociacoes, servicos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim() || !servico) {
      showToast('Preencha os campos obrigatórios (*).');
      return;
    }

    if (status === 'Fechou' && (!Number(valorFechado) || Number(valorFechado) <= 0)) {
      showToast('Venda com status Fechou exige valor fechado.');
      return;
    }

    setSaving(true);
    try {
      await salvarNegociacao.mutateAsync({
        id: leadId || undefined,
        cliente_id: clienteId,
        nome,
        telefone,
        bairro,
        servico,
        origem,
        responsavel_id: responsavelId || null,
        status,
        valor_orcamento: Number(valorOrcamento) || 0,
        valor_fechado: status === 'Fechou' ? Number(valorFechado) || 0 : 0,
        data_fechamento: status === 'Fechou' ? dataFechamento : null,
        motivo_perda: status === 'Não fechou' ? motivoPerda : null,
        observacoes,
      });

      showToast(leadId ? 'Negociação atualizada' : 'Lead cadastrado');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={leadId ? 'Editar negociação' : 'Novo lead'}
      subtitle="Digite o telefone com DDD. Campos com * são obrigatórios."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-tel">
              Telefone *
            </label>
            <input
              id="lead-tel"
              type="text"
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="input-field text-sm"
              placeholder="(85) 99999-9999"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-nome">
              Nome *
            </label>
            <input
              id="lead-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-field text-sm"
              placeholder="Nome do contato"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-bairro">
              Bairro
            </label>
            <input
              id="lead-bairro"
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Aldeota"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-servico">
              Serviço *
            </label>
            <select
              id="lead-servico"
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              className="input-field text-sm"
            >
              {servicos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-origem">
              Origem *
            </label>
            <select
              id="lead-origem"
              value={origem}
              onChange={(e) => setOrigem(e.target.value as Origem)}
              className="input-field text-sm"
            >
              {ORIGENS_LISTA.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-resp">
              Responsável
            </label>
            <select
              id="lead-resp"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Sem responsável</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-status">
              Status *
            </label>
            <select
              id="lead-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusNegociacao)}
              className="input-field text-sm"
            >
              {STATUS_LISTA.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-orc">
              Valor do orçamento (R$)
            </label>
            <input
              id="lead-orc"
              type="number"
              min="0"
              step="10"
              value={valorOrcamento}
              onChange={(e) => setValorOrcamento(e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>

        {status === 'Fechou' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-good-soft/30 rounded-lg border border-good/20">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-fech">
                Valor fechado (R$) *
              </label>
              <input
                id="lead-fech"
                type="number"
                min="1"
                step="10"
                required
                value={valorFechado}
                onChange={(e) => setValorFechado(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-dtfech">
                Data do fechamento *
              </label>
              <input
                id="lead-dtfech"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={dataFechamento}
                onChange={(e) => setDataFechamento(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>
        )}

        {status === 'Não fechou' && (
          <div className="p-3 bg-bad-soft/30 rounded-lg border border-bad/20">
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-motivo">
              Motivo de não ter fechado *
            </label>
            <select
              id="lead-motivo"
              value={motivoPerda}
              onChange={(e) => setMotivoPerda(e.target.value as MotivoPerda)}
              className="input-field text-sm"
            >
              {MOTIVOS_LISTA.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-muted mb-1" htmlFor="lead-obs">
            Observações
          </label>
          <textarea
            id="lead-obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="input-field text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button type="button" onClick={onClose} className="btn btn-sm">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-sm btn-primary">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
