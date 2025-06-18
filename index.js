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
app.post('/cadastrar', function (req,res){
        //obter os dados que serao usados para o cadastro
        let nome = req.body.nome;
        let valor = req.body.valor;
        let imagem = req.files.imagem.name;
        let quantidade = req.body.quantidade;

        //SQL
        let sql = `INSERT INTO produtos (nome, valor, imagem, quantidade) VALUES (?, ?, ?, ?)`;
conexao.query(sql, [nome, valor, imagem, quantidade], function(erro, retorno) {
    if (erro) throw erro;

    req.files.imagem.mv(__dirname + '/imagens/' + imagem);
    res.redirect('/');
});


        // executar comando SQL
        conexao.query(sql, function(erro, retorno){
            //caso de erro
            if(erro) throw erro;

            //caso de certo o cadastro
            req.files.imagem.mv(__dirname+'/imagens/'+req.files.imagem.name);
            console.log(retorno);
            
            //retornar para a rota principal
            res.redirect('/');


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
});





// Servidor
app.listen(3000, (error) => {
    if (error){
        console.log("deu ruim")
        return;
    } 
    console.log("deu tudo certo")

});
