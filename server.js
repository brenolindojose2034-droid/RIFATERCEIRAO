const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
app.use(cors()); 
app.use(express.json());

const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

let rifaDB = {}; 
let config = { precoCota: 10 }; 
const SENHA_ADMIN = 'IRB2026';

function limparReservasVencidas() {
    const agora = Date.now();
    Object.keys(rifaDB).forEach(n => {
        if (rifaDB[n].status === 'Pendente' && (agora - rifaDB[n].criadoEm) > 600000) {
            delete rifaDB[n];
        }
    });
}

app.get('/status-rifa', (req, res) => {
    limparReservasVencidas();
    res.json({ dados: rifaDB, preco: config.precoCota });
});

app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { numeros, comprador, zap, vendedor } = req.body;
        const valorTotal = numeros.length * config.precoCota;
        
        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{
                    title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`,
                    quantity: 1,
                    unit_price: Number(valorTotal),
                    currency_id: 'BRL'
                }],
                // 🚀 REFERÊNCIA EXTERNA: Salva os números para o Webhook saber quais são
                external_reference: numeros.join(','),
                notification_url: "https://rifa-backend-e44o.onrender.com/webhook",
                back_urls: { success: "https://rifaterceirao2026.netlify.app" },
                auto_return: "approved",
            }
        });

        const agora = Date.now();
        numeros.forEach(n => {
            rifaDB[n] = { nome: comprador, zap, vendedor, status: 'Pendente', criadoEm: agora };
        });

        res.json({ link: response.init_point });
    } catch (error) {
        res.status(500).json({ erro: "Erro ao gerar pagamento" });
    }
});

// 🔔 ROTA DO WEBHOOK (A MÁGICA ACONTECE AQUI)
app.post('/webhook', async (req, res) => {
    const { query } = req;
    const topic = query.topic || query.type;

    try {
        if (topic === 'payment') {
            const paymentId = query.id || req.body.data.id;
            const payment = new Payment(client);
            const resultado = await payment.get({ id: paymentId });

            if (resultado.status === 'approved') {
                const numerosPagos = resultado.external_reference.split(',');
                numerosPagos.forEach(n => {
                    if (rifaDB[n]) rifaDB[n].status = 'Pago';
                });
                console.log(`✅ Pagamento ${paymentId} aprovado para as cotas: ${resultado.external_reference}`);
            }
        }
        res.sendStatus(200); // Avisa o Mercado Pago que recebemos o aviso
    } catch (error) {
        console.error("Erro no Webhook:", error);
        res.sendStatus(500);
    }
});

app.post('/admin/acao', (req, res) => {
    const { numero, acao, senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).json({ erro: "Senha incorreta" });
    if (rifaDB[numero]) {
        if (acao === 'pagar') rifaDB[numero].status = 'Pago';
        if (acao === 'excluir') delete rifaDB[numero];
    }
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor com Webhook ON`));