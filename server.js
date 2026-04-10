const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(cors()); 
app.use(express.json());

// ✅ SEU TOKEN DO MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-4694355899531295-041011-0bf7821dc292c43d8132bfc72e773da6-2411883020' });

// 🛡️ SISTEMA DE SEGURANÇA E BANCO DE DADOS
let rifaDB = {}; 
let config = { precoCota: 10 }; // Preço base protegido
const SENHA_ADMIN = 'IRB2026'; // A senha agora fica escondida no servidor

// Rota para o site ler os dados
app.get('/status-rifa', (req, res) => {
    res.json({ dados: rifaDB, preco: config.precoCota });
});

// Rota para gerar pagamento (COM PROTEÇÃO ANTI-HACKER)
app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { numeros, comprador, zap, vendedor } = req.body;

        const ocupados = numeros.filter(n => rifaDB);
        if (ocupados.length > 0) {
            return res.status(400).json({ erro: `Os números ${ocupados.join(', ')} já estão ocupados!` });
        }

        // 🛡️ O servidor calcula o preço. É impossível fraudar pelo navegador.
        const valorRealSeguro = numeros.length * config.precoCota;

        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [{
                    title: `Rifa Terceirão - Cotas: ${numeros.join(', ')}`,
                    quantity: 1,
                    unit_price: Number(valorRealSeguro),
                    currency_id: 'BRL',
                }],
                back_urls: {
                    success: "https://rifaterceirao2026.netlify.app",
                    failure: "https://rifaterceirao2026.netlify.app",
                    pending: "https://rifaterceirao2026.netlify.app"
                },
                auto_return: "approved",
            }
        });

        numeros.forEach(n => {
            rifaDB = { nome: comprador, zap, vendedor, status: 'Pendente' };
        });

        res.json({ link: response.init_point });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao gerar pagamento no Mercado Pago" });
    }
});

// 🛡️ Rota Admin: Confirmar ou Excluir (EXIGE SENHA)
app.post('/admin/acao', (req, res) => {
    const { numero, acao, senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).json({ erro: "Acesso Negado: Senha Incorreta!" });

    if (rifaDB) {
        if (acao === 'pagar') rifaDB.status = 'Pago';
        if (acao === 'excluir') delete rifaDB;
    }
    res.json({ ok: true });
});

// 🛡️ Rota Admin: Alterar Preço da Cota (EXIGE SENHA)
app.post('/admin/config', (req, res) => {
    const { novoPreco, senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).json({ erro: "Acesso Negado: Senha Incorreta!" });
    
    config.precoCota = Number(novoPreco);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor da Rifa ON na porta ${PORT}!`);
});