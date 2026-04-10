const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 CONEXÃO SUPABASE
const supabase = createClient('https://frhgxnelijofoztlfqdo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaGd4bmVsaWpvZm96dGxmYWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMTA0MTMsImV4cCI6MjA1OTg4NjQxM30.X4L6H1-6-p6yY6F_X-P6yY6F_X-P6yY6F_X-P6yY6F8');

// 💰 MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

const SENHA_ADMIN = 'IRB2026';
let precoCota = 10; 

app.get('/status-rifa', async (req, res) => {
    // Limpeza automática: Deleta pendentes com mais de 10 minutos
    const dezMinAtras = new Date(Date.now() - 10 * 60000).toISOString();
    await supabase.from('rifas').delete().eq('status', 'Pendente').lt('criado_em', dezMinAtras);
    
    const { data } = await supabase.from('rifas').select('*');
    const dbFormatado = {};
    if (data) data.forEach(i => dbFormatado[i.id] = i);
    res.json({ dados: dbFormatado, preco: precoCota });
});

app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { numeros, comprador, zap, vendedor } = req.body;
        
        // 1. SALVA LOGO NO BANCO COMO PENDENTE (Garante a cor laranja)
        for (const n of numeros) {
            await supabase.from('rifas').insert([{ 
                id: n, 
                nome: comprador, 
                zap: zap, 
                vendedor: vendedor || "Venda Direta", 
                status: 'Pendente' 
            }]);
        }

        // 2. GERA PREFERÊNCIA NO MERCADO PAGO
        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{ 
                    title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`, 
                    quantity: 1, 
                    unit_price: Number(numeros.length * precoCota), 
                    currency_id: 'BRL' 
                }],
                external_reference: numeros.join(','),
                notification_url: "https://rifa-backend-e44o.onrender.com/webhook",
                back_urls: { success: "https://rifaterceirao2026.netlify.app" },
                auto_return: "approved",
            }
        });

        res.json({ link: response.init_point });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ erro: "Erro ao processar reserva" }); 
    }
});

app.post('/webhook', async (req, res) => {
    const { query } = req;
    if ((query.topic || query.type) === 'payment') {
        try {
            const paymentId = query.id || req.body.data.id;
            const payment = new Payment(client);
            const resultado = await payment.get({ id: paymentId });
            if (resultado.status === 'approved') {
                const nms = resultado.external_reference.split(',');
                for (const n of nms) await supabase.from('rifas').update({ status: 'Pago' }).eq('id', n);
            }
        } catch (e) { console.error(e); }
    }
    res.sendStatus(200);
});

app.post('/admin/acao', async (req, res) => {
    const { numero, acao, senha, novoPreco } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).send();
    if (acao === 'pagar') await supabase.from('rifas').update({ status: 'Pago' }).eq('id', numero);
    if (acao === 'excluir') await supabase.from('rifas').delete().eq('id', numero);
    if (acao === 'limpar') await supabase.from('rifas').delete().neq('id', 0);
    if (acao === 'preco') precoCota = Number(novoPreco);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Motor Blue Blindado Online!"));