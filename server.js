const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 CONEXÃO SUPABASE (Suas chaves reais)
const supabaseUrl = 'https://frhgxnelijofoztlfqdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaGd4bmVsaWpvZm96dGxmYWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMTA0MTMsImV4cCI6MjA1OTg4NjQxM30.X4L6H1-6-p6yY6F_X-P6yY6F_X-P6yY6F_X-P6yY6F8'; // Usei a anon key do print
const supabase = createClient(supabaseUrl, supabaseKey);

// 💰 MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

const SENHA_ADMIN = 'IRB2026';
let precoCota = 10;

// 🔄 ROTA: Pegar todos os números do Banco
app.get('/status-rifa', async (req, res) => {
    // Limpa reservas com mais de 10 min direto no banco
    const dezMinAtras = new Date(Date.now() - 10 * 60000).toISOString();
    await supabase.from('rifas').delete().eq('status', 'Pendente').lt('criado_em', dezMinAtras);

    const { data, error } = await supabase.from('rifas').select('*');
    
    // Converte o formato do banco para o formato que o site entende
    const dbFormatado = {};
    if (data) {
        data.forEach(item => {
            dbFormatado[item.id] = { nome: item.nome, zap: item.zap, vendedor: item.vendedor, status: item.status, criadoEm: item.criado_em };
        });
    }
    res.json({ dados: dbFormatado, preco: precoCota });
});

// 💳 ROTA: Gerar Pagamento e Salvar no Banco
app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { numeros, comprador, zap, vendedor } = req.body;
        const valorTotal = numeros.length * precoCota;

        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{ title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`, quantity: 1, unit_price: Number(valorTotal), currency_id: 'BRL' }],
                external_reference: numeros.join(','),
                notification_url: "https://rifa-backend-e44o.onrender.com/webhook",
                back_urls: { success: "https://rifaterceirao2026.netlify.app" },
                auto_return: "approved",
            }
        });

        // Salva cada número no Supabase
        for (const n of numeros) {
            await supabase.from('rifas').insert([{ id: n, nome: comprador, zap, vendedor, status: 'Pendente' }]);
        }

        res.json({ link: response.init_point });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao processar" });
    }
});

// 🔔 ROTA: Webhook do Mercado Pago (Automático)
app.post('/webhook', async (req, res) => {
    const { query } = req;
    if ((query.topic || query.type) === 'payment') {
        try {
            const paymentId = query.id || req.body.data.id;
            const payment = new Payment(client);
            const resultado = await payment.get({ id: paymentId });

            if (resultado.status === 'approved') {
                const numeros = resultado.external_reference.split(',');
                for (const n of numeros) {
                    await supabase.from('rifas').update({ status: 'Pago' }).eq('id', n);
                }
            }
        } catch (e) { console.error("Erro Webhook", e); }
    }
    res.sendStatus(200);
});

// ⚙️ ROTA: Ações do Admin no Banco
app.post('/admin/acao', async (req, res) => {
    const { numero, acao, senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).send();

    if (acao === 'pagar') {
        await supabase.from('rifas').update({ status: 'Pago' }).eq('id', numero);
    } else if (acao === 'excluir') {
        await supabase.from('rifas').delete().eq('id', numero);
    }
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Sistema Blindado Online!"));