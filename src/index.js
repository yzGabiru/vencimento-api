const dotenv = require("dotenv");
const path = require('path');
const cors = require('cors');
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer"); // Nodemailer para enviar e-mails
const schedule = require("node-schedule"); // Para agendamento de tarefas

dotenv.config({ path: path.resolve(__dirname, '../.env') });
console.log("MongoDB URI:", process.env.MONGODB_URI);

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("Conectado ao MongoDB"))
.catch((err) => console.log(err));

// Modelo de Produto no MongoDB
const Produto = mongoose.model('produto', {
    codigo_barra: String,
    nome_produto: String,
    quantidade_produto: String,
    validade_produto: Date
});

// Configuração de transporte de e-mail
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true para 465, false para outras portas
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Função para enviar e-mail
function enviarEmail(produto, diasRestantes) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: `Aviso: Produto ${produto.nome_produto} vence em ${diasRestantes} dias`,
        text: `O produto ${produto.nome_produto} (Código de Barras: ${produto.codigo_barra}) está a ${diasRestantes} dias de vencer.`,
        html: `<p>O produto <b>${produto.nome_produto}</b> (Código de Barras: ${produto.codigo_barra}) está a <b>${diasRestantes}</b> dias de vencer.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log("Erro ao enviar e-mail: ", error);
        }
        console.log("E-mail enviado: %s", info.messageId);
    });
}

// Função para verificar a validade e enviar e-mails
async function verificarProdutos() {
    const hoje = new Date();
    const quarentaECincoDias = new Date(hoje);
    const quinzeDias = new Date(hoje);

    quarentaECincoDias.setDate(hoje.getDate() + 45);
    quinzeDias.setDate(hoje.getDate() + 15);

    try {
        const produtos = await Produto.find({
            validade_produto: { 
                $gte: hoje, 
                $lte: quarentaECincoDias 
            }
        });

        produtos.forEach(produto => {
            const diasRestantes = Math.ceil((new Date(produto.validade_produto) - hoje) / (1000 * 60 * 60 * 24));

            if (diasRestantes === 45 || diasRestantes === 15) {
                enviarEmail(produto, diasRestantes);
            }
        });
    } catch (error) {
        console.error("Erro ao verificar os produtos: ", error);
    }
}

// Agendar a verificação para rodar diariamente às 00:00
schedule.scheduleJob('0 0 * * *', verificarProdutos);

// Endpoints da API
app.get('/', (req, res) => {
    res.send('Server is Running');
});

// Pega todos os produtos
app.get('/users', async (req, res) => {
    try {
        const produtos = await Produto.find();
        res.json(produtos); 
    } catch {
        res.status(500).json({ message: "Erro ao buscar produtos" });
    }
});

// Pega um produto específico pelo código de barras
app.get('/users/:codigo_barra', async (req, res) => {
    try {
        const produto = await Produto.findOne({ codigo_barra: req.params.codigo_barra });
        if (produto) {
            res.json(produto);
        } else {
            res.status(404).json({ error: "Produto não encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar o produto" });
    }
});

// Salvar novo produto
app.post('/users', async (req, res) => {
    const { codigo_barra, nome_produto, quantidade_produto, validade_produto } = req.body;
    if (!codigo_barra || !quantidade_produto || !validade_produto) {
        return res.status(400).json({ error: "Código de barra, quantidade e validade são obrigatórios" });
    }
    try {
        const produto = new Produto({
            codigo_barra,
            nome_produto,
            quantidade_produto,
            validade_produto
        });
        await produto.save();
        res.status(201).json({ message: "Produto cadastrado com sucesso" });
    } catch {
        res.status(500).json({ error: "Erro ao salvar o produto" });
    }
});

// Deletar produto
app.delete("/users", async (req, res) => {
    const { codigo_barra, validade_produto } = req.body;
    if (!codigo_barra || !validade_produto) {
        return res.status(400).json({ message: "Código de barras e validade são obrigatórios" });
    }
    try {
        const validade = new Date(validade_produto);
        const produto = await Produto.findOneAndDelete({ codigo_barra, validade_produto: validade });
        if (produto) {
            res.json({ message: "Produto deletado com sucesso" });
        } else {
            res.status(404).json({ error: "Produto não encontrado" });
        }
    } catch {
        res.status(500).json({ error: "Erro ao deletar o produto" });
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});