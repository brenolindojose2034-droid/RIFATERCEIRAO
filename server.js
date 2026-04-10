const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(cors()); 
app.use(express.json());

// 🔴 SEU TOKEN AQUI
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

// Banco de dados temporário (em memória)
let rifaDB = {}; 

// Rota para ver quais números já foram vendidos/reservados
app.get('/status-rifa', (req, res) => {
    res.json(rifaDB);
});

// Rota para reservar e gerar pagamento
app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { valor, numeros, comprador, zap, vendedor } = req.body;

        // Segurança: Verifica se algum número já foi vendido nesse meio tempo
        const ocupados = numeros.filter(n => rifaDB[n]);
        if (ocupados.length > 0) {
            return res.status(400).json({ erro: `Os números ${ocupados.join(', ')} já foram reservados!` });
        }

        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{
                    title: `Rifa Mães - Cotas: ${numeros.join(', ')}`,
                    quantity: 1,
                    unit_price: Number(valor),
                    currency_id: 'BRL',
                }],
                auto_return: "approved",
            }
        });

        // Reserva os números como "Pendente" (Laranja)
        numeros.forEach(n => {
            rifaDB[n] = { nome: comprador, zap, vendedor, status: 'Pendente' };
        });

        res.json({ link: response.init_point });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao processar" });
    }
});

// Rota Admin para mudar status ou excluir (chamada pelo site)
app.post('/admin/acao', (req, res) => {
    const { numero, acao } = req.body;
    if (acao === 'pagar') rifaDB[numero].status = 'Pago';
    if (acao === 'excluir') delete rifaDB[numero];
    res.json({ ok: true });
});

app.listen(3000, () => {
    console.log("🚀 Servidor da Rifa ON na porta 3000!");
});