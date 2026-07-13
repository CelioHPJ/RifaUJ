import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { gerarPixMercadoPago, verificarStatusPagamento } from './lib/mercadopago';
import { Check, Copy, Loader2, CheckCircle } from 'lucide-react';

const PRECO_RIFA = 2.00; // R$ 2,00 por número

function App() {
  const [numerosVendidos, setNumerosVendidos] = useState<number[]>([]);
  const [numerosSelecionados, setNumerosSelecionados] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', endereco: '' });

  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [dadosPix, setDadosPix] = useState({ id: 0, qrCode: '', qrCodeBase64: '' });

  useEffect(() => {
    buscarNumerosVendidos();
  }, []);

  // Polling para verificar status do pagamento
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (modalStep === 2 && dadosPix.id) {
      interval = setInterval(async () => {
        try {
          const status = await verificarStatusPagamento(dadosPix.id);

          if (status === 'approved') {
            clearInterval(interval);

            // Insere os tickets no banco após aprovação
            const recordsToInsert = numerosSelecionados.map(num => ({
              numero: num,
              nome: formData.nome,
              telefone: formData.telefone,
              email: formData.email,
              endereco: formData.endereco,
              status: 'pago'
            }));

            const { error } = await supabase
              .from('ingressos_rifa')
              .insert(recordsToInsert);

            if (error) {
              console.error('❌ ERRO DETALHADO DO SUPABASE:', error);
              alert('Erro no banco: ' + error.message);
              // NOTA: Se o erro for de "RLS" ou "policy", será necessário habilitar permissão pública de escrita na tabela "ingressos_rifa" no painel do Supabase.
              return;
            }

            setModalStep(3); // Vai para a tela de Sucesso
          }
        } catch (err) {
          console.error('Erro no polling de pagamento:', err);
        }
      }, 3000); // 3 segundos
    }

    // Cleanup
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [modalStep, dadosPix.id, numerosSelecionados, formData]);

  const buscarNumerosVendidos = async () => {
    const { data, error } = await supabase
      .from('ingressos_rifa')
      .select('numero');

    if (error) {
      console.error('Erro ao buscar números vendidos:', error);
      return;
    }

    if (data) {
      setNumerosVendidos(data.map((item) => item.numero));
    }
  };

  const handleSelectNumero = (num: number) => {
    if (numerosVendidos.includes(num)) return;

    setNumerosSelecionados(prev => {
      if (prev.includes(num)) {
        return prev.filter(n => n !== num);
      } else {
        return [...prev, num].sort((a, b) => a - b);
      }
    });
  };

  const openModal = () => {
    if (numerosSelecionados.length > 0) {
      setModalStep(1);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ nome: '', email: '', telefone: '', endereco: '' });
    setModalStep(1);
    setDadosPix({ id: 0, qrCode: '', qrCodeBase64: '' });
    if (modalStep === 3) {
      setNumerosSelecionados([]);
      buscarNumerosVendidos();
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numerosSelecionados.length === 0) return;

    setModalStep(2);
    setIsGeneratingPayment(true);
    const valorTotal = numerosSelecionados.length * PRECO_RIFA;

    try {
      const result = await gerarPixMercadoPago(valorTotal, formData.email);
      setDadosPix({
        id: result.id,
        qrCode: result.qr_code,
        qrCodeBase64: result.qr_code_base64
      });
    } catch (error) {
      alert('Erro ao gerar a cobrança PIX. Tente novamente mais tarde.');
      closeModal();
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const gridNumbers = Array.from({ length: 1000 }, (_, i) => i + 1);
  const valorTotal = numerosSelecionados.length * PRECO_RIFA;

  return (
    <div className="min-h-screen bg-blue-950 font-sans pb-32">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-4 text-white font-['Montserrat']">
            Ação Solidária <span className="text-orange-500">ENEJ</span>
          </h1>
          <p className="text-blue-200 text-lg text-center mb-10">
            Escolha seus números e participe da nossa ação solidária.
          </p>
        </div>

        {/* Foto da Equipe UJ */}
        <div className="w-full flex justify-center mb-12">
          <img
            src="/EquipeUJ.png"
            alt="Equipe UJ"
            className="w-10/12 sm:w-3/4 md:w-2/3 max-w-lg h-auto object-cover rounded-3xl shadow-lg shadow-blue-500/20 border border-blue-800/40"
          />
        </div>

        {/* Patrocinadores e Apoiadores */}
        <div className="mb-12">
          <h3 className="text-blue-300 text-sm font-bold uppercase tracking-widest text-center mb-4">
            Apoio:
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8">
            <img
              src="/patrocinador1.png"
              alt="Patrocinador 1"
              className="h-24 w-24 md:h-28 md:w-28 object-contain rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer"
            />
            <img
              src="/patrocinador2.png"
              alt="Patrocinador 2"
              className="h-24 w-24 md:h-28 md:w-28 object-contain rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer"
            />
            <img
              src="/patrocinador3.png"
              alt="Patrocinador 3"
              className="h-24 w-24 md:h-28 md:w-28 object-contain rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer"
            />
          </div>
        </div>

        <div className="bg-blue-900/40 p-6 md:p-8 rounded-2xl shadow-sm border border-blue-800">
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2 md:gap-3">
            {gridNumbers.map((num) => {
              const isVendido = numerosVendidos.includes(num);
              const isSelecionado = numerosSelecionados.includes(num);

              let buttonClasses = "aspect-square rounded-xl font-bold text-lg md:text-xl flex items-center justify-center transition-all duration-200 ease-in-out shadow-sm ";

              if (isVendido) {
                buttonClasses += "bg-blue-950/80 text-blue-300/50 border border-blue-800/40 cursor-not-allowed";
              } else if (isSelecionado) {
                buttonClasses += "bg-orange-500 text-white border-2 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-105";
              } else {
                buttonClasses += "bg-blue-900/50 text-white border border-blue-700 hover:bg-blue-800 hover:border-orange-500 hover:text-orange-400 cursor-pointer";
              }

              return (
                <button
                  key={num}
                  disabled={isVendido}
                  onClick={() => handleSelectNumero(num)}
                  className={buttonClasses}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Bar */}
      {numerosSelecionados.length > 0 && !isModalOpen && (
        <div className="fixed bottom-0 left-0 w-full p-4 md:p-6 pointer-events-none z-10 animate-in slide-in-from-bottom-full duration-300">
          <div className="max-w-3xl mx-auto bg-blue-950/80 backdrop-blur-md border border-blue-800 p-4 md:px-6 md:py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4 pointer-events-auto">
            <div className="text-center sm:text-left">
              <span className="block text-sm text-blue-200">Selecionados</span>
              <span className="font-semibold text-white text-lg">
                {numerosSelecionados.length} número(s): {numerosSelecionados.join(', ')}
              </span>
            </div>
            <button
              onClick={openModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-orange-200/50 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:scale-100"
            >
              <Check size={20} />
              Reservar Números
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-blue-900 rounded-2xl shadow-xl w-full max-w-md p-6 md:p-8 animate-in fade-in zoom-in duration-200">

            {modalStep === 1 && (
              <>
                <h2 className="text-2xl font-bold text-white mb-6">
                  Identificação
                </h2>

                <div className="mb-6 bg-blue-950 p-4 rounded-xl border border-blue-800">
                  <p className="text-sm text-blue-200 mb-1">
                    Você selecionou <span className="font-bold text-white">{numerosSelecionados.length} número(s)</span>
                  </p>
                  <p className="text-lg font-bold text-orange-600">
                    Total: R$ {valorTotal.toFixed(2).replace('.', ',')}
                  </p>
                </div>

                <form onSubmit={handleFormSubmit}>
                  <div className="mb-4">
                    <label htmlFor="nome" className="block text-sm font-medium text-blue-200 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      id="nome"
                      name="nome"
                      required
                      value={formData.nome}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-blue-700 bg-blue-950 text-white placeholder-blue-300/50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium text-blue-200 mb-1">E-mail</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-blue-700 bg-blue-950 text-white placeholder-blue-300/50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Seu e-mail"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="telefone" className="block text-sm font-medium text-blue-200 mb-1">Telefone</label>
                    <input
                      type="tel"
                      id="telefone"
                      name="telefone"
                      required
                      value={formData.telefone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-blue-700 bg-blue-950 text-white placeholder-blue-300/50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="endereco" className="block text-sm font-medium text-blue-200 mb-1">Endereço</label>
                    <input
                      type="text"
                      id="endereco"
                      name="endereco"
                      required
                      value={formData.endereco}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-blue-700 bg-blue-950 text-white placeholder-blue-300/50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Seu endereço"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="text-blue-200 bg-blue-950 hover:bg-blue-800 border border-blue-800 px-4 py-2 rounded-lg font-semibold flex-1 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex-1 shadow-md transition-colors"
                    >
                      Continuar para Pagamento
                    </button>
                  </div>
                </form>
              </>
            )}

            {modalStep === 2 && (
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Pagamento PIX
                </h2>
                <p className="text-blue-200 text-center mb-6 text-sm">
                  Escaneie o QR Code ou copie a chave abaixo para realizar o pagamento.
                </p>

                <p className="text-xl font-bold text-orange-500 mb-6 bg-orange-500/10 px-6 py-3 rounded-xl border border-orange-500/20">
                  Valor total: R$ {valorTotal.toFixed(2).replace('.', ',')}
                </p>

                {isGeneratingPayment ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                    <p className="text-blue-200 font-medium">Gerando cobrança...</p>
                  </div>
                ) : (
                  <>
                    <img
                      src={`data:image/jpeg;base64,${dadosPix.qrCodeBase64}`}
                      alt="QR Code PIX Mercado Pago"
                      className="w-48 h-48 mx-auto rounded-xl shadow-sm mb-6 border-2 border-blue-800 bg-white p-2"
                    />

                    <div className="w-full mb-8">
                      <p className="text-sm font-semibold text-blue-200 mb-2 text-center">PIX Copia e Cola</p>
                      <div className="flex relative">
                        <input
                          readOnly
                          value={dadosPix.qrCode}
                          className="w-full pl-4 pr-12 py-3 bg-blue-950 border border-blue-800 rounded-lg text-blue-200 text-sm focus:outline-none"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(dadosPix.qrCode); alert('PIX copiado!'); }}
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-200 hover:text-orange-500 transition-colors bg-blue-900 rounded-md shadow-sm border border-blue-700"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="w-full flex gap-3">
                      <button
                        onClick={closeModal}
                        type="button"
                        className="w-full bg-blue-950 hover:bg-blue-800 border border-blue-800 text-blue-200 py-3 rounded-xl font-bold shadow-sm hover:shadow transition-all"
                      >
                        Cancelar / Fechar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {modalStep === 3 && (
              <div className="flex flex-col justify-center animate-in fade-in zoom-in duration-300 py-8">
                <CheckCircle className="text-green-500 w-24 h-24 mx-auto animate-bounce" />
                <h2 className="text-2xl font-bold text-white text-center mt-4">
                  Pagamento Confirmado!
                </h2>
                <p className="text-blue-200 text-center mt-2 mb-8">
                  Seus números foram garantidos com sucesso.
                </p>

                <button
                  onClick={closeModal}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                >
                  Fechar e Voltar
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
