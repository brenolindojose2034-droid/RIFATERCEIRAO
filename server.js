const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(cors()); 
app.use(express.json());

// ✅ SEU TOKEN QUE APARECE NO PRINT
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

let rifaDB = {}; 

app.get('/status-rifa', (req, res) => {
    res.json(rifaDB);
});

app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { valor, numeros, comprador, zap, vendedor } = req.body;

        const ocupados = numeros.filter(n => rifaDB[n]);
        if (ocupados.length > 0) {
            return res.status(400).json({ erro: `Os números ${ocupados.join(', ')} já estão ocupados!` });
        }

        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{
                    title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`,
                    quantity: 1,
                    unit_price: Number(valor),
                    currency_id: 'BRL',
                }],
                // 🚀 AQUI ESTÁ A CORREÇÃO:
                back_urls: {
                    success: "https://rifaterceirao2026.netlify.app",
                    failure: "https://rifaterceirao2026.netlify.app",
                    pending: "https://rifaterceirao2026.netlify.app"
                },
                auto_return: "approved",
            }
        });

        numeros.forEach(n => {
            rifaDB[n] = { nome: comprador, zap, vendedor, status: 'Pendente' };
        });

        res.json({ link: response.init_point });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao gerar pagamento no Mercado Pago" });
    }
});

app.post('/admin/acao', (req, res) => {
    const { numero, acao } = req.body;
    if (rifaDB[numero]) {
        if (acao === 'pagar') rifaDB[numero].status = 'Pago';
        if (acao === 'excluir') delete rifaDB[numero];
    }
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor da Rifa ON na porta ${PORT}!`);
});