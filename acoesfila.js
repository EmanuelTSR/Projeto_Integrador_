class Fila {
    constructor(tamanhoMaximo = 10) {
        this.itens = [];
        this.tamanhoMaximo = tamanhoMaximo;
    }

    enfileirar(acao) {
        if (this.itens.length >= this.tamanhoMaximo) {
            this.itens.shift(); // Remove o mais antigo
        }
        this.itens.push(acao);
    }

    listar() {
        return this.itens.slice().reverse(); // Mostra da ação mais recente para a mais antiga
    }
}

module.exports = new Fila();
