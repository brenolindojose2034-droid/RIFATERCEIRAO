const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(cors()); 
app.use(express.json());

// CONFIGURAÇÃO DO MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

let rifaDB = {}; 
let config = { precoCota: 10 }; 
const SENHA_ADMIN = 'IRB2026'; 

app.get('/status-rifa', (req, res) => {
    res.json({ dados: rifaDB, preco: config.precoCota });
});

app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { numeros, comprador, zap, vendedor } = req.body;

        // VERIFICAÇÃO DE SEGURANÇA (Colchetes n)
        const ocupados = numeros.filter(n => rifaDB[n]);
        if (ocupados.length > 0) {
            return res.status(400).json({ erro: `Cotas ${ocupados.join(', ')} já ocupadas!` });
        }

        const valorTotal = numeros.length * config.precoCota;
        const preference = new Preference(client);
        
        const response = await preference.create({
            body: {
                // AQUI OS COLCHETES SÃO OBRIGATÓRIOS
                items: [
                    {
                        title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`,
                        quantity: 1,
                        unit_price: Number(valorTotal),
                        currency_id: 'BRL'
                    }
                ],
                back_urls: {
                    success: "https://rifaterceirao2026.netlify.app",
                    failure: "https://rifaterceirao2026.netlify.app",
                    pending: "https://rifaterceirao2026.netlify.app"
                },
                auto_return: "approved",
            }
        });

        // RESERVA OS NÚMEROS (Colchetes n)
        numeros.forEach(n => {
            rifaDB[n] = { nome: comprador, zap, vendedor, status: 'Pendente' };
        });

        res.json({ link: response.init_point });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro no Mercado Pago" });
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

app.post('/admin/config', (req, res) => {
    const { novoPreco, senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).json({ erro: "Senha incorreta" });
    config.precoCota = Number(novoPreco);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ON na porta ${PORT}`);
});