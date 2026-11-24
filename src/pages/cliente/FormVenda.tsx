import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useRegistrarVendaDireta, useUsuarios } from '../../queries';
import { Origem } from '../../types';
import { ORIGENS_LISTA } from '../../lib/constantes';
import { useToast } from '../../components/Toast';

interface FormVendaProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  servicos: string[];
}

export const FormVenda: React.FC<FormVendaProps> = ({
  isOpen,
  onClose,
  clienteId,
  servicos,
}) => {
  const { data: usuarios = [] } = useUsuarios(clienteId);
  const registrarVenda = useRegistrarVendaDireta();
  const { showToast } = useToast();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [bairro, setBairro] = useState('');
  const [servico, setServico] = useState(servicos[0] || '');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [origem, setOrigem] = useState<Origem>('Cliente antigo');
  const [responsavelId, setResponsavelId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(valor);
    if (!nome.trim() || !telefone.trim() || !servico || !val || val <= 0) {
      showToast('Preencha os campos obrigatórios (*).');
      return;
    }

    setSaving(true);
    try {
      await registrarVenda.mutateAsync({
        cliente_id: clienteId,
        nome,
        telefone,
        bairro,
        servico,
        origem,
        responsavel_id: responsavelId || null,
        valor: val,
        data,
        observacoes,
      });

      showToast('Venda direta registrada com sucesso!');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar venda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar venda direta"
      subtitle="Para quem compra sem passar por orçamento (balcão ou retorno)."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-nome">
              Cliente *
            </label>
            <input
              id="venda-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-field text-sm"
              placeholder="Nome do cliente"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-tel">
              Telefone *
            </label>
            <input
              id="venda-tel"
              type="text"
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="input-field text-sm"
              placeholder="(85) 99999-9999"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-bairro">
              Bairro
            </label>
            <input
              id="venda-bairro"
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Aldeota"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-servico">
              Serviço *
            </label>
            <select
              id="venda-servico"
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
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-valor">
              Valor da venda (R$) *
            </label>
            <input
              id="venda-valor"
              type="number"
              min="1"
              step="10"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: 950"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-data">
              Data da venda *
            </label>
            <input
              id="venda-data"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-origem">
              Origem *
            </label>
            <select
              id="venda-origem"
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
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-resp">
              Responsável
            </label>
            <select
              id="venda-resp"
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

        <div>
          <label className="block text-xs font-semibold text-muted mb-1" htmlFor="venda-obs">
            Observações
          </label>
          <textarea
            id="venda-obs"
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
            {saving ? 'Registrando...' : 'Registrar venda'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
