let dadosCartas = [];
let dadosRespostas = [];
let dadosTaticos = []; 
let jogoIniciadoPelaPrimeiraVez = false;

const infoPecas = [
    { cor: 'bg-cyan-400', nome: 'Jogador 1' },
    { cor: 'bg-pink-500', nome: 'Jogador 2' },
    { cor: 'bg-emerald-400', nome: 'Jogador 3' },
    { cor: 'bg-yellow-400', nome: 'Jogador 4' },
    { cor: 'bg-purple-500', nome: 'Jogador 5' },
    { cor: 'bg-orange-500', nome: 'Jogador 6' }
];

let totalJogadores = 2;
let indexJogadorAtual = 0; 
let jogadores = [];        
let idsCartasUsadas = new Set(); 

let ultimoDadoRolado = 0;
let dadosRoladosNesseTurno = false;
let cartaSorteadaNesseTurno = false;
let cartaAtualAtiva = null; 

// ESTRUTURA DE CONTROLE DE EFEITOS DA RODADA
let estadoEfeitos = {
    apoioAtivo: false,
    tipoApoio: "",
    maldadePressaoDupla: false,
    maldadesAtivas: [], // Guarda objetos { idCarta: X, idDono: Y, alvoRefletido: false }
    alvoDaResposta: null // Índice de quem está respondendo de fato
};

function carregarArquivoCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            delimiter: ";",
            skipEmptyLines: true,
            complete: (res) => resolve(res.data),
            error: (err) => reject(err)
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    Promise.all([
        carregarArquivoCSV("./cartas.csv"),
        carregarArquivoCSV("./respostas.csv"),
        carregarArquivoCSV("./cartas_acao.csv")
    ])
    .then(([resCartas, resRespostas, resTaticos]) => {
        dadosCartas = resCartas;
        dadosRespostas = resRespostas;
        dadosTaticos = resTaticos;
        console.log("Todos os arquivos CSV carregados com sucesso!");
    })
    .catch(erro => {
        console.error("Erro ao carregar arquivos CSV:", erro);
        alert("Erro crítico ao carregar os arquivos .csv. Use o VS Code Live Server.");
    });
});

function iniciarJogoComConfig() {
    let qtdInput = parseInt(document.getElementById('qtd-jogadores').value) || 2;
    if (qtdInput < 2) qtdInput = 2;
    if (qtdInput > 6) qtdInput = 6;
    
    totalJogadores = qtdInput;
    jogadores = [];
    idsCartasUsadas.clear();
    indexJogadorAtual = 0;
    resetarVariaveisTurno();

    for (let i = 0; i < totalJogadores; i++) {
        jogadores.push({
            id: i,
            nome: infoPecas[i].nome,
            cor: infoPecas[i].cor,
            casa: 1,
            progressoSeções: {
                "Lógica": 1,
                "Prova Direta": 1,
                "Indução": 1,
                "Contrapositiva": 1
            },
            cartaTatica: null
        });
    }

    document.getElementById('modal-inicio').classList.add('hidden');
    jogoIniciadoPelaPrimeiraVez = true;
    document.getElementById('deck-tatico-container').classList.remove('hidden');
    montarTabuleiro();
    distribuirCartasTaticasRodada();
    atualizarInterfaceGeral();
}

function resetarVariaveisTurno() {
    dadosRoladosNesseTurno = false;
    cartaSorteadaNesseTurno = false;
    cartaAtualAtiva = null;
    
    estadoEfeitos = {
        apoioAtivo: false,
        tipoApoio: "",
        maldadePressaoDupla: false,
        maldadesAtivas: [],
        alvoDaResposta: indexJogadorAtual // Por padrão, o jogador da vez responde
    };
}

function distribuirCartasTaticasRodada() {
    if (!dadosTaticos.length) return;
    jogadores.forEach(jog => {
        const indiceSorteado = Math.floor(Math.random() * dadosTaticos.length);
        jog.cartaTatica = { ...dadosTaticos[indiceSorteado], visivel: false };
    });
}

function montarTabuleiro() {
    const tabuleiroElement = document.getElementById('tabuleiro');
    tabuleiroElement.innerHTML = '';
    for (let i = 1; i <= 100; i++) {
        const casa = document.createElement('div');
        casa.id = `casa-${i}`;
        casa.className = `relative flex flex-col items-center justify-center rounded text-xxs font-bold select-none border border-slate-800 transition-all`;
        
        if (i <= 25) casa.classList.add('bg-blue-950/40', 'text-blue-300');
        else if (i <= 50) casa.classList.add('bg-yellow-950/30', 'text-yellow-400');
        else if (i <= 75) casa.classList.add('bg-green-950/40', 'text-green-300');
        else casa.classList.add('bg-red-950/40', 'text-red-300');
        
        casa.innerHTML = `<span>${i}</span><div class="peoes flex flex-wrap gap-0.5 absolute bottom-0.5 justify-center w-full px-1"></div>`;
        tabuleiroElement.appendChild(casa);
    }
}

function obterDadosRegiao(casa) {
    if (casa <= 25) return { nome: "Lógica", minId: 1, maxId: 9 };
    if (casa <= 50) return { nome: "Prova Direta", minId: 10, maxId: 18 };
    if (casa <= 75) return { nome: "Indução", minId: 19, maxId: 27 };
    return { nome: "Contrapositiva", minId: 28, maxId: 100 };
}

function atualizarInterfaceGeral() {
    if (!jogoIniciadoPelaPrimeiraVez) return;

    for (let i = 1; i <= 100; i++) {
        const pContainer = document.querySelector(`#casa-${i} .peoes`);
        if (pContainer) pContainer.innerHTML = '';
        document.getElementById(`casa-${i}`).classList.remove('ring-2', 'ring-white');
    }

    jogadores.forEach(jog => {
        const pContainer = document.querySelector(`#casa-${jog.casa} .peoes`);
        if (pContainer) {
            pContainer.innerHTML += `<span class="w-2.5 h-2.5 rounded-full ${jog.cor} shadow-md" title="${jog.nome}"></span>`;
        }
    });

    const jAtual = jogadores[indexJogadorAtual];
    document.getElementById(`casa-${jAtual.casa}`).classList.add('ring-2', 'ring-white');

    const painel = document.getElementById('paineis-jogadores');
    painel.innerHTML = '';
    jogadores.forEach((jog, idx) => {
        const isTurnoDeste = idx === indexJogadorAtual;
        const regiaoAlvo = obterDadosRegiao(jog.casa).nome;
        const ordemNaRegiao = jog.progressoSeções[regiaoAlvo];

        painel.innerHTML += `
            <div class="p-2 rounded-lg border ${isTurnoDeste ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950/50 border-slate-800'}">
                <div class="flex items-center gap-1.5 font-bold mb-0.5">
                    <span class="inline-block w-2.5 h-2.5 rounded-full ${jog.cor}"></span>
                    <span class="${isTurnoDeste ? 'text-indigo-400' : 'text-slate-300'}">${jog.nome}</span>
                </div>
                <p class="text-slate-400">Casa: <strong class="text-white">${jog.casa}</strong></p>
                <p class="text-slate-400">Nível na Seção: <strong class="text-white">Ordem ${ordemNaRegiao}</strong></p>
            </div>
        `;
    });

    const btnDados = document.getElementById('btn-dados');
    const btnSortear = document.getElementById('btn-sortear');

    if (!dadosRoladosNesseTurno) {
        btnDados.disabled = false;
        btnDados.className = "bg-amber-600 hover:bg-amber-500 border-b-4 border-amber-800 font-bold p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer text-xs uppercase text-white";
        btnSortear.disabled = true;
        btnSortear.className = "bg-slate-600 opacity-50 border-b-4 border-slate-800 font-bold p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition text-xs uppercase text-white";
        document.getElementById('regiao-atual-txt').innerText = "Aguardando Dados";
    } else if (!cartaSorteadaNesseTurno) {
        btnDados.disabled = true;
        btnDados.className = "bg-slate-600 opacity-50 border-b-4 border-slate-800 font-bold p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition text-xs uppercase text-white";
        btnSortear.disabled = false;
        btnSortear.className = "bg-indigo-600 hover:bg-indigo-500 border-b-4 border-indigo-800 font-bold p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer text-xs uppercase text-white";
        
        let regNome = obterDadosRegiao(jAtual.casa).nome;
        document.getElementById('regiao-atual-txt').innerText = `${regNome} (Ord: ${jAtual.progressoSeções[regNome]})`;
    } else {
        btnDados.disabled = true;
        btnSortear.disabled = true;
        btnDados.className = "bg-slate-600 opacity-50 border-b-4 border-slate-800 font-bold p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition text-xs uppercase text-white";
        btnSortear.className = "bg-slate-600 opacity-50 border-b-4 border-slate-800 font-bold p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition text-xs uppercase text-white";
    }

    atualizarPainelCartasTaticas();
}

function atualizarPainelCartasTaticas() {
    const container = document.getElementById('lista-cartas-taticas');
    if (!container) return;
    container.innerHTML = '';

    jogadores.forEach((jog, idx) => {
        const cTatica = jog.cartaTatica;
        if (!cTatica) return;

        const isJogadorDoTurno = idx === indexJogadorAtual;
        let htmlBotoes = '';

        if (!cTatica.visivel) {
            htmlBotoes = `<button onclick="revelarCartaTaticaDoJogador(${idx})" class="bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded font-bold text-xxs text-white cursor-pointer transition">👁️ Revelar</button>`;
        } else {
            htmlBotoes += `<button onclick="ocultarCartaTaticaDoJogador(${idx})" class="bg-slate-700 hover:bg-slate-600 px-1.5 py-1 rounded text-xxs text-slate-300 mr-2 cursor-pointer transition">🙈 Ocultar</button>`;
            
            if (cartaSorteadaNesseTurno) {
                if (isJogadorDoTurno) {
                    htmlBotoes += `<button onclick="executarEfeitoApoio(${idx})" ${ estadoEfeitos.apoioAtivo ? 'disabled class="bg-slate-600 text-xxs px-2 py-1 rounded opacity-50"' : 'class="bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded font-bold text-xxs text-white cursor-pointer transition"'} >⭐ Apoio</button>`;
                }
                htmlBotoes += `<button onclick="executarEfeitoMaldade(${idx})" class="bg-rose-600 hover:bg-rose-500 px-2 py-1 rounded font-bold text-xxs text-white ml-1 cursor-pointer transition">👿 Maldade</button>`;
            }
        }

        container.innerHTML += `
            <div class="p-2 rounded-lg bg-slate-900 border ${isJogadorDoTurno ? 'border-indigo-500/40' : 'border-slate-800'} flex flex-col gap-1.5 text-xs">
                <div class="flex justify-between items-center">
                    <span class="font-bold flex items-center gap-1"><span class="w-2 h-2 rounded-full ${jog.cor}"></span> ${jog.nome} ${isJogadorDoTurno ? '(Vez)' : ''}</span>
                    <div>${htmlBotoes}</div>
                </div>
                
                <div class="${cTatica.visivel ? 'block' : 'hidden'} grid grid-cols-2 gap-2 mt-1 bg-slate-950/60 p-2 rounded border border-purple-950/40">
                    <div class="border-r border-slate-800 pr-1 text-xxs">
                        <span class="text-emerald-400 font-bold block uppercase tracking-wide">🟢 Apoio: ${cTatica.titApoio}</span>
                        <p class="text-slate-300 mt-0.5">${cTatica.efeApoio}</p>
                    </div>
                    <div class="pl-1 text-xxs">
                        <span class="text-rose-400 font-bold block uppercase tracking-wide">🔴 Maldade: ${cTatica.titMaldade}</span>
                        <p class="text-slate-300 mt-0.5">${cTatica.efeMaldade}</p>
                    </div>
                </div>
            </div>
        `;
    });
}

function revelarCartaTaticaDoJogador(idx) {
    jogadores[idx].cartaTatica.visivel = true;
    atualizarPainelCartasTaticas();
}

function ocultarCartaTaticaDoJogador(idx) {
    jogadores[idx].cartaTatica.visivel = false;
    atualizarPainelCartasTaticas();
}

// =========================================================================
//                  MÓDULO DE PROCESSAMENTO DE AÇÕES
// =========================================================================

function executarEfeitoApoio(idx) {
    if (!cartaSorteadaNesseTurno || estadoEfeitos.apoioAtivo) return;
    
    const tática = jogadores[idx].cartaTatica;
    const idApoio = String(tática.id);
    
    if (idApoio === "7" || idApoio === "13") {
        if (estadoEfeitos.maldadesAtivas.length === 0) {
            alert("Não há nenhuma maldade na mesa para anular!");
            return;
        }
        estadoEfeitos.maldadesAtivas.pop();
        alert(`🛡️ CONTRA ATIVADO! Uma carta de maldade da mesa foi completamente anulada.`);
        atualizarInterfaceGeral();
        return;
    }

    if (idApoio === "14" || idApoio === "8") {
        if (estadoEfeitos.maldadesAtivas.length === 0) {
            alert("Não há maldades na mesa para agir!");
            return;
        }
        if (idApoio === "14") {
            alert(`🔮 REFLEXÃO ATIVADA! Todas as maldades da mesa voltaram para os seus donos originais!`);
            estadoEfeitos.maldadesAtivas.forEach(m => { m.alvoRefletido = true; });
            processarAplicacaoImediataMaldadesRefletidas();
        } else {
            estadoEfeitos.maldadesAtivas = [];
            alert(`🛡️ REFLEXÃO (ID 8): Todas as ameaças da mesa foram limpas.`);
        }
        atualizarInterfaceGeral();
        return;
    }

    estadoEfeitos.apoioAtivo = true;
    estadoEfeitos.tipoApoio = idApoio;
    alert(`⭐ APOIO ATIVADO: [${tática.titApoio}]\n⚠️ Nova Regra: Acerto anda +2, Erro recua -4.`);
    
    if (idApoio === "15") {
        const jAtual = jogadores[indexJogadorAtual];
        const regiaoAlvo = obterDadosRegiao(jAtual.casa);
        let todasDaSecao = dadosCartas.filter(c => parseInt(c.id) >= regiaoAlvo.minId && parseInt(c.id) <= regiaoAlvo.maxId && String(c.id) !== String(cartaAtualAtiva.carta.id));
        
        if (todasDaSecao.length > 0) {
            let c2 = todasDaSecao[Math.floor(Math.random() * todasDaSecao.length)];
            let r2 = dadosRespostas.find(r => String(r.id) === String(c2.id));
            cartaAtualAtiva.modoEscolhaApoio = true;
            cartaAtualAtiva.cartaA = cartaAtualAtiva.carta;
            cartaAtualAtiva.respostaA = cartaAtualAtiva.resposta;
            cartaAtualAtiva.cartaB = c2;
            cartaAtualAtiva.respostaB = r2;
            renderizarCardJogoEscolhaApoio();
        }
    } else {
        renderizarCardJogo(cartaAtualAtiva.carta, cartaAtualAtiva.resposta);
    }
    atualizarInterfaceGeral();
}

function executarEfeitoMaldade(idx) {
    if (!cartaSorteadaNesseTurno) return;
    
    const tática = jogadores[idx].cartaTatica;
    const idMaldade = String(tática.id);
    const tipoMaldade = tática.tipoMaldade;

    // RETROCESSO GERAL: Aplica na hora e sai
    if (tipoMaldade === "retrocesso_geral") {
        jogadores.forEach(j => {
            if (j.id !== idx) {
                j.casa = Math.max(j.casa - 1, 1);
            }
        });
        alert(`🔻 RETROCESSO GERAL! ${jogadores[idx].nome} fez todos os outros jogadores voltarem 1 casa!`);
        atualizarInterfaceGeral();
        return; 
    }

    estadoEfeitos.maldadesAtivas.push({
        idCarta: idMaldade,
        idDono: idx,
        alvoRefletido: false
    });

    alert(`👿 MALDADE LANÇADA por ${jogadores[idx].nome}!\nEfeito: [${tática.titMaldade}]`);
    
    // TROCA JOGADOR: Quem lançou a carta escolhe a vítima
    if (tipoMaldade === "forçar_outro") {
        let listaNomes = jogadores
            .filter(j => j.id !== idx)
            .map(j => `${j.id} - ${j.nome}`).join("\n");
            
        let escolha = prompt(`${jogadores[idx].nome}, escolha o ID do jogador que será FORÇADO a responder esta pergunta:\n${listaNomes}`);
        if (escolha !== null && escolha !== "") {
            estadoEfeitos.alvoDaResposta = parseInt(escolha);
            alert(`⚠️ Alvo definido! Quem responde agora é o jogador: ${jogadores[estadoEfeitos.alvoDaResposta].nome}`);
        }
    }
    
    // PRESSÃO DUPLA
    if (tipoMaldade === "pressao_dupla") {
        estadoEfeitos.maldadePressaoDupla = true;
        const jAlvo = jogadores[indexJogadorAtual];
        const regiaoAlvo = obterDadosRegiao(jAlvo.casa);
        let listaDisponivel = dadosCartas.filter(c => parseInt(c.id) >= regiaoAlvo.minId && parseInt(c.id) <= regiaoAlvo.maxId && !idsCartasUsadas.has(String(c.id)));
        
        if (listaDisponivel.length > 0) {
            let segundaCarta = listaDisponivel[Math.floor(Math.random() * listaDisponivel.length)];
            let segundaResp = dadosRespostas.find(r => String(r.id) === String(segundaCarta.id));
            
            idsCartasUsadas.add(String(segundaCarta.id));
            cartaAtualAtiva.modoDuploMaldade = true;
            cartaAtualAtiva.segundaCarta = segundaCarta;
            cartaAtualAtiva.segundaResposta = segundaResp;
            cartaAtualAtiva.passoMaldadeAtual = 1;
        }
    }

    renderizarCardJogo(cartaAtualAtiva.carta, cartaAtualAtiva.resposta);
    atualizarInterfaceGeral();
}

function processarAplicacaoImediataMaldadesRefletidas() {
    estadoEfeitos.maldadesAtivas.forEach(m => {
        if (m.alvoRefletido) {
            const donoOriginal = jogadores[m.idDono];
            if (m.idCarta === "3" || m.idCarta === "10") {
                alert(`💥 Punição Invertida! ${donoOriginal.nome} sofre o próprio retrocesso geral e volta 1 casa!`);
                donoOriginal.casa = Math.max(donoOriginal.casa - 1, 1);
            }
        }
    });
}

// =========================================================================
//                          FLUXO CORE DO TABULEIRO
// =========================================================================

function rolarDados() {
    if (dadosRoladosNesseTurno) return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    ultimoDadoRolado = d1 + d2;

    document.getElementById('resultado-dados').innerText = `${d1} + ${d2} = ${ultimoDadoRolado}`;
    dadosRoladosNesseTurno = true;

    const jog = jogadores[indexJogadorAtual];
    jog.casa = Math.min(jog.casa + ultimoDadoRolado, 100);

    atualizarInterfaceGeral();
}

function sortearCartaTabuleiro() {
    if (!dadosRoladosNesseTurno || cartaSorteadaNesseTurno) return;

    const jog = jogadores[indexJogadorAtual];
    const regiaoAlvo = obterDadosRegiao(jog.casa);
    const ordemRequerida = jog.progressoSeções[regiaoAlvo.nome]; 

    let todasDaSecao = dadosCartas.filter(c => {
        let idNum = parseInt(c.id);
        return idNum >= regiaoAlvo.minId && idNum <= regiaoAlvo.maxId && !idsCartasUsadas.has(String(c.id));
    });

    if (todasDaSecao.length === 0) {
        avancarTurno();
        return;
    }

    let listaDeIdsDisponiveis = [...new Set(todasDaSecao.map(c => String(c.id)))];
    const idEscolhido = listaDeIdsDisponiveis[Math.floor(Math.random() * listaDeIdsDisponiveis.length)];
    let linhaCartaSorteada = dadosCartas.find(c => String(c.id) === idEscolhido && String(c.ordem) === String(ordemRequerida)) || dadosCartas.find(c => String(c.id) === idEscolhido);
    const respostaSorteada = dadosRespostas.find(r => String(r.id) === String(linhaCartaSorteada.id) && String(r.ordem) === String(linhaCartaSorteada.ordem));

    idsCartasUsadas.add(idEscolhido);

    cartaAtualAtiva = { carta: linhaCartaSorteada, resposta: respostaSorteada, secaoNome: regiaoAlvo.nome };
    cartaSorteadaNesseTurno = true;

    renderizarCardJogo(linhaCartaSorteada, respostaSorteada);
    atualizarInterfaceGeral();
}

function renderizarCardJogoEscolhaApoio() {
    const container = document.getElementById('jogo-card-container');
    container.innerHTML = `
        <div class="w-full h-full bg-slate-800 rounded-2xl p-4 border-2 border-purple-500 shadow-2xl flex flex-col justify-between text-xs">
            <div class="text-center font-bold text-emerald-400 uppercase tracking-wider mb-2">⭐ Apoio 15: Escolha uma das perguntas</div>
            <div class="space-y-3 flex-1 flex flex-col justify-center">
                <div class="p-3 bg-slate-900 border border-slate-700 rounded-xl">
                    <span class="text-xxs font-bold text-indigo-400 block mb-1">OPÇÃO A (ID: ${cartaAtualAtiva.cartaA.id}):</span>
                    <p class="text-slate-200 font-medium">${cartaAtualAtiva.cartaA.pergunta}</p>
                    <button onclick="selecionarPerguntaApoio('A')" class="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 py-1 rounded font-bold text-white uppercase text-xxs">Selecionar Opção A ↩️</button>
                </div>
                <div class="p-3 bg-slate-900 border border-slate-700 rounded-xl">
                    <span class="text-xxs font-bold text-indigo-400 block mb-1">OPÇÃO B (ID: ${cartaAtualAtiva.cartaB.id}):</span>
                    <p class="text-slate-200 font-medium">${cartaAtualAtiva.cartaB.pergunta}</p>
                    <button onclick="selecionarPerguntaApoio('B')" class="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 py-1 rounded font-bold text-white uppercase text-xxs">Selecionar Opção B ↩️</button>
                </div>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

function selecionarPerguntaApoio(opcao) {
    cartaAtualAtiva.modoEscolhaApoio = false;
    if (opcao === 'A') {
        cartaAtualAtiva.carta = cartaAtualAtiva.cartaA;
        cartaAtualAtiva.resposta = cartaAtualAtiva.respostaA;
    } else {
        cartaAtualAtiva.carta = cartaAtualAtiva.cartaB;
        cartaAtualAtiva.resposta = cartaAtualAtiva.respostaB;
    }
    renderizarCardJogo(cartaAtualAtiva.carta, cartaAtualAtiva.resposta);
}

function renderizarCardJogo(carta, resposta) {
    const container = document.getElementById('jogo-card-container');
    const secaoNome = cartaAtualAtiva.secaoNome;
    
    let corBorda = "border-indigo-500";
    if (secaoNome.includes("Direta")) corBorda = "border-yellow-500";
    if (secaoNome.includes("Indução")) corBorda = "border-emerald-500";
    if (secaoNome.includes("Contrapositiva")) corBorda = "border-red-500";

    let tagHeaderExtra = "";
    if (estadoEfeitos.maldadePressaoDupla && cartaAtualAtiva.modoDuploMaldade) {
        tagHeaderExtra = `<span class="bg-rose-600 text-white px-2 py-0.5 rounded animate-pulse font-black text-xxs">⚠️ DUPLA DA MALDADE [${cartaAtualAtiva.passoMaldadeAtual}/2]</span>`;
    }

    let apoioLiberaDefinicao = estadoEfeitos.apoioAtivo && ["1", "2", "9"].includes(estadoEfeitos.tipoApoio);
    let apoyoLiberaExemplo = estadoEfeitos.apoioAtivo && ["3", "4", "10"].includes(estadoEfeitos.tipoApoio);

    container.innerHTML = `
        <div id="jogo-card-inner" class="card-inner w-full h-full relative">
            <div onclick="girarCarta('jogo-card-inner')" class="card-front absolute w-full h-full bg-slate-800 rounded-2xl p-5 flex flex-col justify-between border-2 ${corBorda} shadow-2xl cursor-pointer">
                <div class="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    <span>Seção: ${secaoNome}</span>
                    ${tagHeaderExtra}
                    <span>ID: ${carta.id} • Ord: ${carta.ordem}</span>
                </div>
                <div class="my-auto text-center">
                    <p class="text-xs text-slate-500 mb-1 font-mono tracking-widest">PERGUNTA</p>
                    <p class="text-sm font-semibold text-slate-100 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 shadow-inner">${carta.pergunta}</p>
                </div>
                <div class="text-xs text-indigo-400 font-semibold animate-pulse text-center bg-slate-900/30 py-2 rounded-lg">
                    Ver gabarito, dicas e opções 🔄
                </div>
            </div>

            <div class="card-back absolute w-full h-full bg-indigo-950 rounded-2xl p-4 flex flex-col justify-between border-2 border-emerald-500 shadow-2xl text-left">
                <div class="space-y-2 overflow-y-auto pr-1 text-xs">
                    <div class="border-b border-indigo-900/40 pb-1">
                        <div class="flex justify-between items-center mb-0.5">
                            <h3 class="font-bold text-emerald-400 uppercase tracking-wider">Definição:</h3>
                            <button onclick="revelarSecaoDoCard(this)" class="text-xxs bg-indigo-800 text-white py-0.5 px-2 rounded font-bold">Revelar</button>
                        </div>
                        <p class="text-slate-200 ${apoioLiberaDefinicao ? 'conteudo-visivel' : 'conteudo-oculto'} leading-relaxed">${resposta ? resposta.dica_definicao : 'Sem definição disponível.'}</p>
                    </div>

                    <div class="border-b border-indigo-900/40 pb-1">
                        <div class="flex justify-between items-center mb-0.5">
                            <h3 class="font-bold text-amber-400 uppercase tracking-wider">Exemplo:</h3>
                            <button onclick="revelarSecaoDoCard(this)" class="text-xxs bg-indigo-800 text-white py-0.5 px-2 rounded font-bold">Revelar</button>
                        </div>
                        <p class="text-slate-300 font-mono bg-slate-900/50 p-1.5 rounded mt-0.5 ${apoyoLiberaExemplo ? 'conteudo-visivel' : 'conteudo-oculto'}">${resposta ? resposta.exemplo : 'Sem exemplo.'}</p>
                    </div>
                </div>

                <button onclick="girarCarta('jogo-card-inner')" class="w-full bg-slate-900 hover:bg-slate-800 text-indigo-400 text-xxs font-bold py-1.5 rounded-lg transition uppercase tracking-wider text-center border border-indigo-900/60 my-1 cursor-pointer">
                    📖 Ler pergunta de novo 🔄
                </button>

                <div class="bg-slate-900/50 p-1.5 rounded-xl border border-indigo-900/40 my-0.5">
                    <div class="flex justify-between items-center mb-1 px-1">
                        <span class="text-xxs uppercase font-bold text-slate-400 tracking-wider">Gabarito:</span>
                        <button onclick="revelarSecaoDoCard(this, true)" class="text-xxs bg-emerald-700 text-white py-0.5 px-2 rounded font-bold shadow-md">Revelar Resposta</button>
                    </div>
                    <div class="bg-emerald-500 text-slate-950 font-bold rounded-lg p-1.5 text-center min-h-[35px] flex items-center justify-center shadow-inner">
                        <span class="text-xs conteudo-oculto">${resposta ? resposta.resposta : 'Sem resposta.'}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-900/50">
                    <button onclick="processarRespostaJogador(true)" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg transition shadow cursor-pointer text-center uppercase">
                        👍 Acertei
                    </button>
                    <button onclick="processarRespostaJogador(false)" class="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2 rounded-lg transition shadow cursor-pointer text-center uppercase">
                        👎 Errei
                    </button>
                </div>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

function processarRespostaJogador(acertou) {
    const jogAlvo = jogadores[estadoEfeitos.alvoDaResposta]; 
    const jogDoTurno = jogadores[indexJogadorAtual];        
    const regiaoAtual = cartaAtualAtiva.secaoNome;

    let maldadeTroca = estadoEfeitos.maldadesAtivas.find(m => ["2", "8", "9"].includes(m.idCarta));
    let maldadePenalidadeDupla = estadoEfeitos.maldadesAtivas.find(m => ["4", "5", "11", "13"].includes(m.idCarta));

    // RESOLUÇÃO: TROCA JOGADOR
    if (maldadeTroca) {
        if (acertou) {
            alert(`🎉 ${jogAlvo.nome} acertou! Como recompensa, o dono do turno (${jogDoTurno.nome}) avança +3 casas!`);
            jogDoTurno.casa = Math.min(jogDoTurno.casa + 3, 100);
            if (jogDoTurno.progressoSeções[regiaoAtual] < 4) jogDoTurno.progressoSeções[regiaoAtual]++;
        } else {
            alert(`❌ ${jogAlvo.nome} errou! Punição aplicada ao respondente: recua -2 casas.`);
            jogAlvo.casa = Math.max(jogAlvo.casa - 2, 1);
        }
        document.getElementById('jogo-card-container').classList.add('hidden');
        avancarTurno(); 
        return;
    }

    // RESOLUÇÃO: PRESSÃO DUPLA
    if (estadoEfeitos.maldadePressaoDupla && cartaAtualAtiva.modoDuploMaldade) {
        if (cartaAtualAtiva.passoMaldadeAtual === 1) {
            if (!acertou) {
                alert(`❌ Errou a primeira pergunta da pressão dupla! Penalidade de -3 casas.`);
                jogAlvo.casa = Math.max(jogAlvo.casa - 3, 1);
                document.getElementById('jogo-card-container').classList.add('hidden');
                avancarTurno();
            } else {
                alert(`🔥 Acertou a primeira! Preparando a segunda pergunta obrigatória.`);
                cartaAtualAtiva.passoMaldadeAtual = 2;
                renderizarCardJogo(cartaAtualAtiva.segundaCarta, cartaAtualAtiva.segundaResposta);
            }
            return;
        } else if (cartaAtualAtiva.passoMaldadeAtual === 2) {
            if (acertou) {
                alert(`👑 GABARITOU! Passou ileso pelas duas perguntas. Avança 3 casas!`);
                jogAlvo.casa = Math.min(jogAlvo.casa + 3, 100);
                if (jogAlvo.progressoSeções[regiaoAtual] < 4) jogAlvo.progressoSeções[regiaoAtual]++;
            } else {
                alert(`❌ Errou a segunda pergunta! Penalidade de -3 casas.`);
                jogAlvo.casa = Math.max(jogAlvo.casa - 3, 1);
            }
            document.getElementById('jogo-card-container').classList.add('hidden');
            avancarTurno();
            return;
        }
    }

    // RESOLUÇÃO DE RESPOSTA PADRÃO OU COM APOIO
    if (acertou) {
        if (jogAlvo.casa === 100) {
            alert(`👑 VITÓRIA! O ${jogAlvo.nome} alcançou a casa 100! 🎉`);
            reiniciarTotalJogo();
            return;
        }
        let passosParaAvancar = estadoEfeitos.apoioAtivo ? 2 : 3;
        jogAlvo.casa = Math.min(jogAlvo.casa + passosParaAvancar, 100);

        if (jogAlvo.progressoSeções[regiaoAtual] < 4) {
            jogAlvo.progressoSeções[regiaoAtual]++;
        }
    } else {
        let passosParaVoltar = estadoEfeitos.apoioAtivo ? 4 : 3;
        jogAlvo.casa = Math.max(jogAlvo.casa - passosParaVoltar, 1);
        
        // RESOLUÇÃO: PENALIDADE DUPLA (Dono da carta escolhe o alvo)
        if (maldadePenalidadeDupla) {
            const donoDaCarta = jogadores[maldadePenalidadeDupla.idDono];
            let listaVitimas = jogadores
                .filter(j => j.id !== jogAlvo.id)
                .map(j => `${j.id} - ${j.nome}`).join("\n");

            let escolhaVitima = prompt(`💥 PENALIDADE DUPLA!\n${donoDaCarta.nome}, escolha o ID de quem vai perder 3 casas junto com o ${jogAlvo.nome}:\n${listaVitimas}`);
            
            if (escolhaVitima !== null && escolhaVitima !== "") {
                let vitimaId = parseInt(escolhaVitima);
                jogadores[vitimaId].casa = Math.max(jogadores[vitimaId].casa - 3, 1);
                alert(`🔻 Punição aplicada! Ambos (${jogAlvo.nome} e ${jogadores[vitimaId].nome}) retrocederam 3 casas.`);
            }
        }
    }

    document.getElementById('jogo-card-container').classList.add('hidden');
    avancarTurno();
}

function avancarTurno() {
    indexJogadorAtual = (indexJogadorAtual + 1) % totalJogadores;
    resetarVariaveisTurno();
    document.getElementById('resultado-dados').innerText = "--";
    distribuirCartasTaticasRodada();
    atualizarInterfaceGeral();
}

function reiniciarTotalJogo() {
    document.getElementById('modal-inicio').classList.remove('hidden');
    document.getElementById('jogo-card-container').classList.add('hidden');
    document.getElementById('deck-tatico-container').classList.add('hidden');
    jogoIniciadoPelaPrimeiraVez = false;
}

function alternarTela(tela) {
    document.getElementById('tela-busca').classList.add('hidden');
    document.getElementById('tela-jogo').classList.add('hidden');
    document.getElementById('btn-tela-busca').className = "bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-6 py-2.5 rounded-lg transition border-b-4 border-slate-900";
    document.getElementById('btn-tela-jogo').className = "bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-6 py-2.5 rounded-lg transition border-b-4 border-slate-900";

    if (tela === 'tela-busca') {
        document.getElementById('tela-busca').classList.remove('hidden');
        document.getElementById('btn-tela-busca').className = "bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-lg transition border-b-4 border-indigo-800";
    } else {
        document.getElementById('tela-jogo').classList.remove('hidden');
        document.getElementById('btn-tela-jogo').className = "bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-lg transition border-b-4 border-indigo-800";
        if (!jogoIniciadoPelaPrimeiraVez) {
            document.getElementById('modal-inicio').classList.remove('hidden');
        }
    }
}

function girarCarta(innerId) {
    document.getElementById(innerId).classList.toggle('flipped');
}

function revelarSecaoDoCard(btn, isGabarito = false) {
    const containerPai = btn.parentElement.parentElement;
    const textoOculto = containerPai.querySelector('.conteudo-oculto, .conteudo-visivel') || containerPai.nextElementSibling?.querySelector('span') || containerPai.nextElementSibling;
    
    textoOculto.classList.toggle('conteudo-oculto');
    textoOculto.classList.toggle('conteudo-visivel');

    if(textoOculto.classList.contains('conteudo-visivel')) {
        btn.innerText = "Ocultar";
        btn.className = "text-xxs bg-slate-700 text-white py-0.5 px-2 rounded font-bold";
    } else {
        btn.innerText = isGabarito ? "Revelar Resposta" : "Revelar";
        btn.className = isGabarito 
            ? "text-xxs bg-emerald-700 text-white py-0.5 px-2 rounded font-bold shadow-md"
            : "text-xxs bg-indigo-800 text-white py-0.5 px-2 rounded font-bold";
    }
}

function buscarCartaManual() {
    const idBuscado = document.getElementById('busca-id').value.trim();
    const ordemBuscada = document.getElementById('busca-ordem').value.trim();

    if (!dadosCartas.length || !dadosRespostas.length) return;

    const perguntaEncontrada = dadosCartas.find(item => String(item.id) === idBuscado && String(item.ordem) === ordemBuscada);
    const respostaEncontrada = dadosRespostas.find(item => String(item.id) === idBuscado && String(item.ordem) === ordemBuscada);

    if (perguntaEncontrada && respostaEncontrada) {
        const container = document.getElementById('busca-card-container');
        container.innerHTML = `
            <div id="busca-card-inner" class="card-inner w-full h-full relative">
                <div onclick="girarCarta('busca-card-inner')" class="card-front absolute w-full h-full bg-slate-800 rounded-2xl p-5 flex flex-col justify-between border-2 border-indigo-500 shadow-2xl cursor-pointer">
                    <div class="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-indigo-400">
                        <span>ID Carta: ${perguntaEncontrada.id}</span>
                        <span>Ordem: ${perguntaEncontrada.ordem}</span>
                    </div>
                    <div class="my-auto text-center">
                        <p class="text-xs text-slate-500 mb-1 font-mono tracking-widest">PERGUNTA CONSULTADA</p>
                        <p class="text-sm font-semibold text-slate-100 bg-slate-900/40 p-4 rounded-xl border border-slate-700/50">${perguntaEncontrada.pergunta}</p>
                    </div>
                    <div class="text-xs text-indigo-400 font-semibold text-center bg-slate-900/30 py-2 rounded-lg">
                        Ver gabarito e dicas 🔄
                    </div>
                </div>
                
                <div class="card-back absolute w-full h-full bg-indigo-950 rounded-2xl p-4 flex flex-col justify-between border-2 border-emerald-500 shadow-2xl text-left text-xs">
                    <div class="space-y-2 overflow-y-auto pr-1">
                        <div class="border-b border-indigo-900/40 pb-1.5">
                            <div class="flex justify-between items-center mb-0.5">
                                <h3 class="font-bold text-emerald-400 uppercase tracking-wider">Definição:</h3>
                                <button onclick="revelarSecaoDoCard(this)" class="text-xxs bg-indigo-800 text-white py-0.5 px-2 rounded font-bold">Revelar</button>
                            </div>
                            <p class="text-slate-200 conteudo-oculto leading-relaxed">${respostaEncontrada.dica_definicao}</p>
                        </div>
                        <div class="border-b border-indigo-900/40 pb-1.5">
                            <div class="flex justify-between items-center mb-0.5">
                                <h3 class="font-bold text-amber-400 uppercase tracking-wider">Exemplo:</h3>
                                <button onclick="revelarSecaoDoCard(this)" class="text-xxs bg-indigo-800 text-white py-0.5 px-2 rounded font-bold">Revelar</button>
                            </div>
                            <p class="text-slate-300 font-mono bg-slate-900/50 p-1.5 rounded mt-0.5 conteudo-oculto">${respostaEncontrada.exemplo}</p>
                        </div>
                    </div>
                    <div class="bg-slate-900/50 p-1.5 rounded-xl border border-indigo-900/40 my-1">
                        <div class="flex justify-between items-center mb-1 px-1">
                            <span class="text-xxs uppercase font-bold text-slate-400 tracking-wider">Gabarito:</span>
                            <button onclick="revelarSecaoDoCard(this, true)" class="text-xxs bg-emerald-700 text-white py-0.5 px-2 rounded font-bold shadow-md">Revelar Resposta</button>
                        </div>
                        <div class="bg-emerald-500 text-slate-950 font-bold rounded-lg p-1.5 text-center min-h-[35px] flex items-center justify-center shadow-inner">
                            <span class="text-xs conteudo-oculto">${respostaEncontrada.resposta}</span>
                        </div>
                    </div>
                    <button onclick="girarCarta('busca-card-inner')" class="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg transition uppercase tracking-wider text-center border border-slate-600 cursor-pointer">
                        Voltar para a Frente 🔄
                    </button>
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        alert('Combinação de ID e Ordem não encontrada.');
    }
}