const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const gerarPixMercadoPago = async (valor: number, email: string) => {
  const response = await fetch(`${API_URL}/api/gerar-pix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ valor, email })
  });

  if (!response.ok) {
    throw new Error('Falha ao gerar o PIX via backend.');
  }

  const data = await response.json();
  return {
    id: data.id,
    qr_code: data.qr_code,
    qr_code_base64: data.qr_code_base64
  };
};

export const verificarStatusPagamento = async (idPagamento: number) => {
  const response = await fetch(`${API_URL}/api/status-pix/${idPagamento}`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error('Falha ao verificar status do pagamento via backend.');
  }

  const data = await response.json();
  return data.status; // Ex: 'pending', 'approved', 'rejected'
};
