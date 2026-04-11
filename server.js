const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 CONEXÃO SUPABASE (Peguei dos seus prints!)
const supabaseUrl = 'https://frhgxnelijofoztlfqdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaGd4bmVsaWpvZm96dGxmYWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMTA0MTMsImV4cCI6MjA1OTg4NjQxM30.X4L6H1-6-p6yY6F_X-P6yY6F_X-P6yY6F_X-P6yY6F8';
const supabase = createClient(supabaseUrl, supabaseKey);

// 💰 MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

const SENHA_ADMIN = 'IRB2026';
let precoCota = 10;

// ROTA: Pegar Status
app.get('/status-rifa', async (req, res) => {
    const { data, error } = await supabase.from('rifas').select('*');
    if (error) return res.status(500).json({ erro: error.message });
    
    const dbFormatado = {};
    if (data) {
        data.forEach(item => {
            dbFormatado[item.id] = { nome: item.nome, zap: item.zap, vendedor: item.vendedor, status: item.status };
        });
    }
    res.json({ dados: dbFormatado, preco: precoCota });
});

// ROTA: Gerar Pagamento + Reserva Instantânea
app.post('/gerar-pagamento', async (req, res) => {
    const { numeros, comprador, zap, vendedor } = req.body;
    
    const { error } = await supabase.from('rifas').insert(
        numeros.map(n => ({ id: n, nome: comprador, zap, vendedor: vendedor || "Direta", status: 'Pendente' }))
    );

    if (error) return res.status(400).json({ erro: "Número já reservado ou erro no banco." });

    try {
        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{ title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`, quantity: 1, unit_price: Number(numeros.length * precoCota), currency_id: 'BRL' }],
                external_reference: numeros.join(','),
                notification_url: "https://rifa-backend-e44o.onrender.com/webhook",
                back_urls: { success: "https://rifaterceiraoopo.netlify.app" },
                auto_return: "approved",
            }
        });
        res.json({ link: response.init_point });
    } catch (e) {
        res.status(500).json({ erro: "Erro no Mercado Pago" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Motor Rodando Liso!"));