//importar express
const express = require('express');
//importar sql
const mysql = require('mysql2');
//importar modulo express-handlebars
const {engine} = require('express-handlebars');
//importar modulo file upload
const fileUpload = require('express-fileupload');
//importar File System
const fs = require('fs');

//fazer o express funfar
const app = express ();

//adicionar bosstrap
app.use('/bootstrap', express.static('./node_modules/bootstrap/dist'));

// adicionar o CSS
app.use('/css', express.static('./css'))

//refenciar a pasta de imagens
app.use('/imagens', express.static('./imagens'))

//habilitando o upload de arquivos
app.use(fileUpload());

//configuração do express handle-bars
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

//manipulação de dados via rotas
app.use(express.json());
app.use(express.urlencoded({extended:false}));

//Ligação com o historico de açoes
const filaAcoes = require('./acoesfila');


//conexao
const conexao = mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'IESBcomputacao',
    database:"bancopi"

});
//teste de conexao
conexao.connect(function(erro){
if (erro) throw erro;
console.log('Conexao efetiva')

});

//rota principal
app.get('/', (req,res) =>{

  //SQL
  let sql = 'SELECT * FROM produtos';

  //EXECUTAR SQL 

  conexao.query(sql, function(erro, retorno){
    res.render('formulario', {produtos:retorno});
  })
})

//rota de cadastro
app.post('/cadastrar', function (req, res) {
  if (!req.files || !req.files.imagem) {
    return res.status(400).send("Imagem não enviada.");
  }

  let nome = req.body.nome;
  let valor = req.body.valor;
  let quantidade = req.body.quantidade;
  let imagem = req.files.imagem.name;

  let sql = 'INSERT INTO produtos (nome, valor, imagem, quantidade) VALUES (?, ?, ?, ?)';

  // Use .execute para evitar SQL injection
  conexao.execute(sql, [nome, valor, imagem, quantidade], function (erro, retorno) {
    if (erro) {
      console.error("Erro no INSERT:", erro.sqlMessage);
      return res.status(500).send("Erro ao inserir produto.");
    }

    // Agora sim, salvar a imagem com verificação de erro
    req.files.imagem.mv(__dirname + '/imagens/' + imagem, function (erro_mv) {
      if (erro_mv) {
        console.error("Erro ao salvar imagem:", erro_mv);
        return res.status(500).send("Erro ao salvar imagem.");
      }

      // Adiciona ao histórico
      filaAcoes.enfileirar({
        tipo: 'cadastro',
        produto: nome,
        data: new Date()
      });

      // Redireciona só depois de salvar a imagem com sucesso
      res.redirect('/');
    });
  });
});


//rota para remover produtos
app.get('/remover/:codigo&:imagem', function(req, res){
    //SQL
    let sql = `DELETE FROM produtos WHERE codigo = ${req.params.codigo}`

    //EXECUTAR o comando SQL
    conexao.query(sql, function(erro, retorno){
      //caso falhe o comando SQL
      if(erro) throw erro;

      //caso funcione
      fs.unlink(__dirname+'/imagens/'+req.params.imagem, (erro_imagem)=>{console.log('Falha ao remover a imagem')});

    });
    //redirecionamento 
    res.redirect('/');
});

//rota para redirecionar para o formulario de edição
app.get('/formulario_editar/:codigo', function(req, res){
  let sql = `SELECT * FROM produtos WHERE codigo = ${req.params.codigo}`;

  //executar comando SQL
  conexao.query(sql, function(erro,retorno){
    if(erro) throw erro;

    //caso conssiga executar
    res.render('formulario_editar', {produto:retorno[0]});


  })
   //enfileirando o historico de açoes 
    filaAcoes.enfileirar({
    tipo: 'remocao',
    produto: req.params.codigo,
    data: new Date()
});

  
});

app.post('/editar', function(req, res){
  let codigo = req.body.codigo;
  let nome = req.body.nome;
  let valor = req.body.valor;
  let quantidade = req.body.quantidade;

  // Atualiza o banco
  let sql = `UPDATE produtos SET nome = ?, valor = ?, quantidade = ? WHERE codigo = ?`;

  conexao.query(sql, [nome, valor, quantidade, codigo], function(erro, retorno){
    if(erro) throw erro;
    res.redirect('/');
  });

     //enfileirando o historico de açoes 
    filaAcoes.enfileirar({
    tipo: 'remocao',
    produto: req.params.codigo,
    data: new Date()
});
});


//rota historico
    app.get('/historico', (req, res) => {
    res.render('historico', { acoes: filaAcoes.listar() });
});



// Servidor
app.listen(3000, (error) => {
    if (error){
        console.log("deu ruim")
        return;
    } 
    console.log("deu tudo certo")

});
