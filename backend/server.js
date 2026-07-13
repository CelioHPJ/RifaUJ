const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// Força a leitura do .env na raiz do projeto (uma pasta para trás)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/gerar-pix', async (req, res) => {
  try {
    console.log('✅ Recebido no backend:', req.body);
    const { valor, email } = req.body;

    if (!valor || !email) {
      return res.status(400).json({ error: 'Valor e email são obrigatórios' });
    }

    const token = process.env.VITE_MERCADOPAGO_TOKEN;
    if (!token) {
      console.error('❌ ERRO: Token do Mercado Pago não encontrado no .env');
      return res.status(500).json({ error: 'Token ausente no backend' });
    }

    // O Node.js 18+ já tem fetch nativo!
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        transaction_amount: Number(valor),
        description: 'Rifa ENEJ',
        payment_method_id: 'pix',
        payer: { email }
      })
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('❌ ERRO da API do Mercado Pago:', JSON.stringify(data, null, 2));
      return res.status(mpResponse.status).json(data);
    }

    console.log('✅ PIX gerado com sucesso no Mercado Pago!');
    res.json({
      id: data.id,
      qr_code: data.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64
    });

  } catch (error) {
    console.error('❌ Erro interno no servidor:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status-pix/:id', async (req, res) => {
  try {
    const token = process.env.VITE_MERCADOPAGO_TOKEN;
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments/' + req.params.id, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const data = await mpResponse.json();
    res.json({ status: data.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('🚀 Servidor rodando na porta 3001! (Pressione Ctrl+C para parar)');
});