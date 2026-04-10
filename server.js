const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(cors()); 
app.use(express.json());

// ✅ SEU TOKEN JÁ CONFIGURADO
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

// Banco de dados temporário (fica na memória do Render)
let rifaDB = {}; 

// Rota para ver o status dos números
app.get('/status-rifa', (req, res) => {
    res.json(rifaDB);
});

// Rota para gerar o link de pagamento
app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { valor, numeros, comprador, zap, vendedor } = req.body;

        // Verifica se alguém já reservou esses números
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
                auto_return: "approved",
            }
        });

        // Marca como Pendente (Laranja no site)
        numeros.forEach(n => {
            rifaDB[n] = { nome: comprador, zap, vendedor, status: 'Pendente' };
        });

        res.json({ link: response.init_point });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao gerar pagamento no Mercado Pago" });
    }
});

// Rota Admin
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