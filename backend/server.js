import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Força a leitura do .env na raiz do projeto (uma pasta para trás)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Credenciais do Supabase ausentes no .env (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/gerar-pix', async (req, res) => {
  try {
    console.log('✅ Recebido no backend:', req.body);
    const { valor, email, formData, numerosSelecionados } = req.body;

    if (!valor || !email || !formData || !numerosSelecionados || numerosSelecionados.length === 0) {
      return res.status(400).json({ error: 'Dados incompletos para gerar PIX' });
    }

    const token = process.env.VITE_MERCADOPAGO_TOKEN;
    if (!token) {
      console.error('❌ ERRO: Token do Mercado Pago não encontrado no .env');
      return res.status(500).json({ error: 'Token ausente no backend' });
    }

    // 1. Gerar o pedido_id (que será usado como external_reference)
    const pedido_id = crypto.randomUUID();

    // 2. Inserir no Supabase como 'pendente'
    const recordsToInsert = numerosSelecionados.map((num) => ({
      numero: num,
      nome: formData.nome,
      telefone: formData.telefone,
      email: formData.email,
      endereco: formData.endereco,
      cidade: formData.cidade,
      vendedor: formData.vendedor,
      status: 'pendente',
      pedido_id: pedido_id
    }));

    const { error: supabaseError } = await supabase
      .from('ingressos_rifa')
      .insert(recordsToInsert);

    if (supabaseError) {
      console.error('❌ ERRO ao inserir no Supabase:', supabaseError);
      return res.status(500).json({ error: 'Erro ao registrar pedido no banco de dados' });
    }

    // 3. Criar a cobrança no Mercado Pago com external_reference
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        transaction_amount: Number(valor),
        description: `Rifa ENEJ - ${numerosSelecionados.length} número(s)`,
        payment_method_id: 'pix',
        payer: { email },
        external_reference: pedido_id
      })
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('❌ ERRO da API do Mercado Pago:', JSON.stringify(data, null, 2));
      return res.status(mpResponse.status).json(data);
    }

    console.log(`✅ PIX gerado com sucesso no Mercado Pago! Pedido: ${pedido_id}`);
    res.json({
      id: data.id,
      pedido_id: pedido_id,
      qr_code: data.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64
    });

  } catch (error) {
    console.error('❌ Erro interno no servidor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para webhook do Mercado Pago
app.post('/api/webhook/mercadopago', async (req, res) => {
  console.log('🔔 Webhook recebido:', req.body, req.query);
  
  // O Mercado Pago espera um 200 OK ou 201 Created logo para não ficar reenviando.
  // Vamos processar de forma assíncrona ou rápida aqui.
  res.status(200).send('OK');

  try {
    const action = req.body?.action || req.query?.topic;
    const type = req.body?.type;
    
    // O webhook do MP pode enviar o ID em lugares diferentes dependendo do evento
    const paymentId = req.body?.data?.id || req.query?.id;

    // Apenas verificamos se for sobre pagamento
    if (!paymentId) return;
    if (action !== 'payment.updated' && action !== 'payment.created' && type !== 'payment') {
      return; 
    }

    console.log(`🔍 Verificando pagamento ${paymentId} na API do MP...`);

    const token = process.env.VITE_MERCADOPAGO_TOKEN;
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const paymentData = await mpResponse.json();

    if (mpResponse.ok && paymentData.status === 'approved') {
      const external_reference = paymentData.external_reference;

      if (external_reference) {
        console.log(`✅ Pagamento aprovado! Atualizando pedido ${external_reference} no Supabase...`);
        
        const { error: updateError } = await supabase
          .from('ingressos_rifa')
          .update({ status: 'aprovado' })
          .eq('pedido_id', external_reference);
          
        if (updateError) {
          console.error('❌ Erro ao atualizar status no Supabase:', updateError);
        } else {
          console.log(`✅ Pedido ${external_reference} atualizado para 'aprovado'.`);
        }
      } else {
        console.warn('⚠️ Pagamento aprovado, mas sem external_reference no MP.');
      }
    }
  } catch (error) {
    console.error('❌ Erro no processamento do webhook:', error);
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