// Estrutura em memória
const produtos = [];

// Função para carregar os produtos do banco
function carregarProdutos(listaDoBanco) {
  produtos.length = 0;         // Limpa array anterior
  produtos.push(...listaDoBanco); // Carrega os produtos
}

// Função de busca por nome 
function buscarPorNome(parcial) {
  const termo = parcial.toLowerCase();
  return produtos.filter(produto =>
    produto.nome.toLowerCase().includes(termo)
  );
}

// Exporta as funções
module.exports = {
  carregarProdutos,
  buscarPorNome
};
