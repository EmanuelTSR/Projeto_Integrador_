// Importações principais
const express = require('express');
const mysql = require('mysql2');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const { engine } = require('express-handlebars');
const produtosMemoria = require('./produtosMemoria');
const filaAcoes = require('./acoesfila');

// Inicializa app
const app = express();

// Configuração de diretórios estáticos
app.use('/bootstrap', express.static('./node_modules/bootstrap/dist'));
app.use('/css', express.static('./css'));
app.use('/imagens', express.static('./imagens'));

// Upload de arquivos
app.use(fileUpload());

// Configuração do handlebars com helper de data e helper eq
app.engine('handlebars', engine({
  helpers: {
    formatarData: function (data) {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(data);
    },
    eq: function (a, b) {
      return a === b; // Verifica se os dois valores são iguais
    }
  }
}));
app.set('view engine', 'handlebars');
app.set('views', './views'); // Certifique-se de que a pasta 'views' existe no seu projeto

// Manipulação de dados via rotas
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Conexão com banco MySQL
const conexao = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'IESBcomputacao',
  database: 'bancopi'
});

conexao.connect(function (erro) {
  if (erro) throw erro;
  console.log('Conexão efetiva');
});

// ROTA: Cadastro
app.get('/cadastro', (req, res) => {
  let sql = 'SELECT * FROM produtos';
  conexao.query(sql, function (erro, retorno) {
    if (erro) throw erro;
    res.render('formulario', { produtos: retorno });
  });
});

// ROTA: Cadastrar produto
app.post('/cadastro', function (req, res) {
  if (!req.files || !req.files.imagem) {
    return res.status(400).send("Imagem não enviada.");
  }

  let nome = req.body.nome;
  let valor = req.body.valor;
  let quantidade = req.body.quantidade;
  let imagem = req.files.imagem.name;

  let sql = 'INSERT INTO produtos (nome, valor, imagem, quantidade) VALUES (?, ?, ?, ?)';
  conexao.execute(sql, [nome, valor, imagem, quantidade], function (erro, retorno) {
    if (erro) {
      console.error("Erro no INSERT:", erro.sqlMessage);
      return res.status(500).send("Erro ao inserir produto.");
    }

    req.files.imagem.mv(__dirname + '/imagens/' + imagem, function (erro_mv) {
      if (erro_mv) {
        console.error("Erro ao salvar imagem:", erro_mv);
        return res.status(500).send("Erro ao salvar imagem.");
      }

      filaAcoes.enfileirar({
        tipo: 'cadastro',
        produto: nome,
        data: new Date()
      });

      res.redirect('/inicio');
    });
  });
});

// ROTA: Remover produto
app.get('/remover/:codigo&:imagem', function (req, res) {
  let sql = 'DELETE FROM produtos WHERE codigo = ?';
  conexao.query(sql, [req.params.codigo], function (erro, retorno) {
    if (erro) throw erro;

    fs.unlink(__dirname + '/imagens/' + req.params.imagem, (erro_imagem) => {
      if (erro_imagem) console.log('Falha ao remover a imagem');
    });

    filaAcoes.enfileirar({
      tipo: 'remocao',
      produto: req.params.codigo,
      data: new Date()
    });

    res.redirect('/inicio');
  });
});

// ROTA: Formulário de edição
app.get('/formulario_editar/:codigo', function (req, res) {
  let sql = 'SELECT * FROM produtos WHERE codigo = ?';
  conexao.query(sql, [req.params.codigo], function (erro, retorno) {
    if (erro) throw erro;
    res.render('formulario_editar', { produto: retorno[0] });
  });
});

// ROTA: Editar produto
app.post('/editar', function (req, res) {
  let codigo = req.body.codigo;
  let nome = req.body.nome;
  let valor = req.body.valor;
  let quantidade = req.body.quantidade;

  let sql = 'UPDATE produtos SET nome = ?, valor = ?, quantidade = ? WHERE codigo = ?';
  conexao.query(sql, [nome, valor, quantidade, codigo], function (erro, retorno) {
    if (erro) throw erro;

    filaAcoes.enfileirar({
      tipo: 'edicao',
      produto: nome,
      data: new Date()
    });

    res.redirect('/inicio');
  });
});

// ROTA: Histórico
app.get('/historico', (req, res) => {
  res.render('historico', { acoes: filaAcoes.listar() });
});

// ROTA: Início - exibe produtos e carrega na memória
app.get('/inicio', (req, res) => {
  let busca = req.query.busca || '';
  let filtro = req.query.filtro || '';
  let sql = 'SELECT * FROM produtos';
  let parametros = [];

  if (busca) {
    sql += ' WHERE nome LIKE ?';
    parametros.push(`%${busca}%`);
  }

  // Aplica o filtro, se necessário
  if (filtro === 'estoque_baixo') {
    sql += busca ? ' AND' : ' WHERE';
    sql += ' quantidade < 5';
  } else if (filtro === 'valor_maior') {
    sql += busca ? ' AND' : ' WHERE';
    sql += ' valor > 100';
  }

  conexao.query(sql, parametros, (erro, resultado) => {
    if (erro) throw erro;
    res.render('inicio', { produtos: resultado, busca });
  });
});

// Servidor
app.listen(3000, (error) => {
  if (error) {
    console.log("Deu ruim");
    return;
  }
  console.log("Servidor rodando na porta 3000");
});
