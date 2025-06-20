// Importações principais
const express = require('express');
const mysql = require('mysql2');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const { engine } = require('express-handlebars');
const produtosMemoria = require('./produtosMemoria');
const filaAcoes = require('./acoesfila');
const bcrypt = require('bcryptjs');  // Para o hash das senhas
const session = require('express-session');  // Para gerenciar as sessões de usuário
const ExcelJS = require('exceljs'); // Para gerar o relatório em Excel

// Inicializa app
const app = express();

// Configuração de sessão
app.use(session({
  secret: 'meuSegredo',
  resave: false,
  saveUninitialized: true
}));

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

// Middleware para proteger as rotas que precisam de autenticação
function verificarAutenticacao(req, res, next) {
  if (req.session.usuario) {
    return next();
  } else {
    res.redirect('/login');
  }
}

// ROTA: Login (formulário de login)
app.get('/login', (req, res) => {
  res.render('login');
});

// ROTA: Autenticar Usuário (verificar login e senha)
app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;

  let sql = 'SELECT * FROM usuarios WHERE usuario = ?';
  conexao.query(sql, [usuario], function (erro, resultado) {
    if (erro) throw erro;

    // Se o usuário não for encontrado
    if (resultado.length === 0) {
      return res.status(400).send('Usuário ou senha inválidos');
    }

    // Verifica a senha com bcrypt
    bcrypt.compare(senha, resultado[0].senha, function (erroBcrypt, resultadoBcrypt) {
      if (erroBcrypt) throw erroBcrypt;

      // Se a senha for válida
      if (resultadoBcrypt) {
        // Armazena o usuário na sessão
        req.session.usuario = resultado[0].usuario;

        // Redireciona para a página inicial após o login
        res.redirect('/inicio');
      } else {
        return res.status(400).send('Usuário ou senha inválidos');
      }
    });
  });
});

// ROTA: Logout
app.get('/logout', (req, res) => {
  req.session.destroy((erro) => {
    if (erro) {
      return res.status(500).send('Erro ao sair');
    }

    res.redirect('/login');
  });
});

// ROTA: Cadastro
app.get('/cadastro', verificarAutenticacao, (req, res) => {
  let sql = 'SELECT * FROM produtos';
  conexao.query(sql, function (erro, retorno) {
    if (erro) throw erro;
    res.render('formulario', { produtos: retorno });
  });
});

// ROTA: Cadastrar produto
app.post('/cadastro', verificarAutenticacao, function (req, res) {
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
app.get('/remover/:codigo&:imagem', verificarAutenticacao, function (req, res) {
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
app.get('/formulario_editar/:codigo', verificarAutenticacao, function (req, res) {
  let sql = 'SELECT * FROM produtos WHERE codigo = ?';
  conexao.query(sql, [req.params.codigo], function (erro, retorno) {
    if (erro) throw erro;
    res.render('formulario_editar', { produto: retorno[0] });
  });
});

// ROTA: Editar produto
app.post('/editar', verificarAutenticacao, function (req, res) {
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

// ROTA: Historico
app.get('/historico', verificarAutenticacao, (req, res) => {
  res.render('historico', { acoes: filaAcoes.listar() });
});

// ROTA: Inicio - exibe produtos e carrega na memória
app.get('/inicio', (req, res) => {
  let busca = req.query.busca || '';
  let filtro = req.query.filtro || '';
  let ordenacao = req.query.ordenacao || ''; // Obter a opção de ordenação
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

  // Adiciona a ordenação, se necessário
  if (ordenacao === 'preco_desc') {
    sql += ' ORDER BY valor DESC';  // Do mais caro para o mais barato
  } else if (ordenacao === 'preco_asc') {
    sql += ' ORDER BY valor ASC';   // Do mais barato para o mais caro
  } else if (ordenacao === 'quantidade_desc') {
    sql += ' ORDER BY quantidade DESC';  // Da maior para a menor quantidade
  } else if (ordenacao === 'quantidade_asc') {
    sql += ' ORDER BY quantidade ASC';   // Da menor para a maior quantidade
  }

  conexao.query(sql, parametros, (erro, resultado) => {
    if (erro) throw erro;
    res.render('inicio', { produtos: resultado, busca, filtro, ordenacao });
  });
});

// ROTA: Página de Baixa
app.get('/baixa', (req, res) => {
  let sql = 'SELECT * FROM produtos';
  conexao.query(sql, function (erro, retorno) {
    if (erro) throw erro;
    res.render('baixa', { produtos: retorno });
  });
});

// ROTA: Registrar Baixa no Estoque
app.post('/baixa', (req, res) => {
  let produtoCodigo = req.body.produto; // Código do produto selecionado
  let quantidadeBaixa = parseInt(req.body.quantidade); // Quantidade da baixa
  let motivo = req.body.motivo; // Motivo da baixa

  // Consultar o estoque atual do produto
  let sql = 'SELECT * FROM produtos WHERE codigo = ?';
  conexao.query(sql, [produtoCodigo], function (erro, produto) {
    if (erro) throw erro;

    // Verificar se o estoque é suficiente
    if (produto[0].quantidade < quantidadeBaixa) {
      return res.status(400).send("Estoque insuficiente para a baixa.");
    }

    // Calcular nova quantidade
    let novaQuantidade = produto[0].quantidade - quantidadeBaixa;

    // Atualizar a quantidade no banco de dados
    let sqlUpdate = 'UPDATE produtos SET quantidade = ? WHERE codigo = ?';
    conexao.query(sqlUpdate, [novaQuantidade, produtoCodigo], function (erroUpdate) {
      if (erroUpdate) throw erroUpdate;

      // Registrar a ação de baixa na fila de ações (opcional)
      filaAcoes.enfileirar({
        tipo: 'baixa',
        produto: produto[0].nome,
        motivo: motivo,
        quantidade: quantidadeBaixa,
        data: new Date()
      });

      res.redirect('/inicio'); // Redirecionar para a página de listagem de produtos
    });
  });
});

// ROTA: Página de Relatório
app.get('/relatorio', (req, res) => {
  let sql = 'SELECT * FROM produtos';
  conexao.query(sql, function (erro, retorno) {
    if (erro) throw erro;
    res.render('relatorio', { produtos: retorno });
  });
});


// ROTA: Gerar Relatório em Excel
app.get('/gerar-relatorio', verificarAutenticacao, (req, res) => {
  let sql = 'SELECT * FROM produtos';
  conexao.query(sql, function (erro, produtos) {
    if (erro) throw erro;

    // Criar uma nova planilha Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Produtos');

    // Definir os cabeçalhos da planilha
    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'Valor', key: 'valor', width: 15 },
      { header: 'Quantidade', key: 'quantidade', width: 15 }
    ];

    // Adicionar os dados dos produtos à planilha
    produtos.forEach((produto) => {
      worksheet.addRow({
        nome: produto.nome,
        valor: produto.valor,
        quantidade: produto.quantidade
      });
    });


    
    // Definir o tipo de resposta como 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_produtos.xlsx');

    // Escrever o arquivo Excel na resposta
    workbook.xlsx.write(res)
      .then(() => {
        res.end(); // Finaliza a resposta após o envio do arquivo
      })
      .catch((erro) => {
        console.log('Erro ao gerar o Excel:', erro);
        res.status(500).send('Erro ao gerar o relatório.');
      });
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
