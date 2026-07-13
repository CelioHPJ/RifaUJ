export async function gerarCobrancaPix(valorTotal: number, cliente: { nome: string, telefone: string, endereco: string }) {
  const token = import.meta.env.VITE_ABACATEPAY_TOKEN;

  if (!token || token === 'seu_token_de_producao_aqui') {
    console.warn('Variável VITE_ABACATEPAY_TOKEN não configurada corretamente. Retornando PIX simulado.');
    // Retorna dados simulados para testes caso a chave não esteja configurada
    return {
      pixCopiaECola: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913AbacatePay6008BRASILIA62070503***63041D3D'
    };
  }

  try {
    const response = await fetch('https://api.abacatepay.com/v1/billing/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        products: [
          {
            externalId: 'rifa_numero',
            name: 'Rifa Solidária ENEJ',
            quantity: 1,
            price: Math.round(valorTotal * 100), // AbacatePay espera o valor em centavos
            description: `Compra de rifa pelo cliente: ${cliente.nome} (${cliente.telefone})`
          }
        ],
        returnUrl: window.location.origin,
        cancelUrl: window.location.origin,
        customer: {
          name: cliente.nome,
          cellphone: cliente.telefone
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do AbacatePay: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Mapeamento do retorno oficial do AbacatePay
    // O retorno costuma incluir uma URL para a tela de checkout ou os dados do PIX
    // Estamos retornando a string do PIX para renderizar o QRCode no frontend
    return {
      idCobranca: data?.data?.id || data?.id || 'mock-id-123',
      pixCopiaECola: data?.data?.paymentMethods?.pix?.copyAndPaste || data?.data?.pix?.copyAndPaste || 'ERRO_AO_GERAR_PIX'
    };
  } catch (error) {
    console.error('Falha ao gerar cobrança AbacatePay:', error);
    throw error;
  }
}

export async function verificarStatusPagamento(idCobranca: string) {
  const token = import.meta.env.VITE_ABACATEPAY_TOKEN;

  if (!token || token === 'seu_token_de_producao_aqui') {
    console.warn('Variável VITE_ABACATEPAY_TOKEN não configurada. Simulando status PAGO.');
    return { status: 'PAID' };
  }

  try {
    const response = await fetch(`https://api.abacatepay.com/v1/billing/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao verificar status da cobrança: ${response.statusText}`);
    }

    const data = await response.json();
    
    // A API de listagem do AbacatePay costuma retornar um array "data" ou um objeto de pagamentos.
    // Vamos procurar a cobrança específica ou retornar o objeto retornado se a chamada for direta.
    const cobranca = data?.data?.find((c: any) => c.id === idCobranca) || data;
    
    return cobranca;
  } catch (error) {
    console.error('Falha ao verificar status AbacatePay:', error);
    throw error;
  }
}
