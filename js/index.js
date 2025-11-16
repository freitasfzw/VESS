import { db } from "./auth.js";
import { auth } from "./auth.js";
import { loadFromFirebase, syncFirebase } from "./firebase-index.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) {
        init();
    }
});

// ===================================================
//  ATUALIZAÇÃO DE GRÁFICOS
// ===================================================

export function atualizarGraficos() {
    gerarRelatorio(); // ✅ só redireciona para o relatório
}

async function init() {
    await loadFromFirebase();   // vem do firebase-index.js
    renderTabs();

    listarProdutos();
    listarCaixa();
    listarFechamentos();
    atualizarGraficos();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F2') { e.preventDefault(); editarProduto() }
        if (e.key === 'F9') { e.preventDefault(); $('#pos-finalizar').click() }
    });
}
// ===================================================
//  FUNÇÕES UTILITÁRIAS
// ===================================================
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const $ = (sel, root = document) => root.querySelector(sel);
const fmtBRL = (v = 0) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = () => Math.random().toString(36).slice(2, 9);
function mostrarPopup(msg) { const p = $('#popup'); p.textContent = msg; p.classList.add('show'); setTimeout(() => p.classList.remove('show'), 1800) }
const sameDay = (iso, base = new Date()) => { const d = new Date(iso), b = new Date(base); return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate(); };
const dayBounds = (base = new Date()) => {
    const d0 = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const d1 = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999); return [d0, d1];
};
const clamp2 = n => Math.round((+n || 0) * 100) / 100;
const toBRL = n => fmtBRL(clamp2(n));

// ===================================================
//  STORAGE LOCAL (DB Wrapper)
// ===================================================
const DB = {
    get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def } catch { return def } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)) }
}

// ===================================================
//  ESTADO GLOBAL (STATE)
// ===================================================
const state = {
    produtos: DB.get('produtos', []),
    caixa: DB.get('caixa', []),
    vendas: DB.get('vendas', []),
    cfg: DB.get('cfg', { nome: 'Minha Loja', cnpj: '', ie: '', endereco: '', icms: 0, iss: 0, controlaEstoque: true }),
    fechamentos: DB.get('fechamentos', []), // histórico de fechamentos
    caixaStatus: DB.get('caixaStatus', { aberto: true, trocoProximoDia: 0, abertoEm: null, fechadoEm: null })
};

// ===================================================
//  NAVEGAÇÃO / ABAS
// ===================================================
const abas = [
    { id: 'sec-pos', label: 'PDV' },
    { id: 'sec-estoque', label: 'Estoque' },
    { id: 'sec-caixa', label: 'Fluxo de Caixa' },
    { id: 'sec-relatorios', label: 'Relatórios' },
    { id: 'sec-fechamentos', label: 'Fechamentos' },
];
export function renderTabs() { const nav = $('#tabs'); nav.innerHTML = ''; abas.forEach(a => { const b = document.createElement('button'); b.className = 'tab-btn'; b.textContent = a.label; b.dataset.target = a.id; b.onclick = () => selecionarAba(a.id); nav.appendChild(b) }); selecionarAba('sec-pos') }
export function selecionarAba(id) {
    $$('.section').forEach(s => s.style.display = 'none'); // esconde todas
    const sec = $('#' + id);
    if (!sec) return;

    sec.style.display = 'block'; // mostra apenas a ativa
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === id));

    if (id === 'sec-relatorios') atualizarGraficos();
    if (id === 'sec-fechamentos') listarFechamentos();
    if (id === 'sec-caixa') listarCaixa();
    if (id === 'sec-estoque') listarProdutos();
}

// ===================================================
//  ESTOQUE — CRUD COMPLETO
// ===================================================
export function listarProdutos() {
    const tbody = $('#tblProdutos tbody');
    const q = ($('#buscaProduto')?.value || "").toLowerCase();
    const cat = ($('#filtroCategoria')?.value || "").toLowerCase();

    tbody.innerHTML = '';

    state.produtos
        // 🔥 FILTRO À PROVA DE PRODUTOS CORROMPIDOS
        .filter(p => p && typeof p === "object")
        .filter(p => {
            const nome = (p.nome || "").toLowerCase();
            const codigo = (p.codigo || "").toLowerCase();
            const categoria = (p.categoria || "").toLowerCase();

            const matchBusca = (
                nome.includes(q) ||
                codigo.includes(q) ||
                categoria.includes(q)
            );

            const matchCat = cat ? categoria.includes(cat) : true;

            return matchBusca && matchCat;
        })
        .forEach(p => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${p.codigo || '-'}</td>
                <td>${p.nome || '-'}</td>
                <td>${p.categoria || '-'}</td>
                <td class='right'>${fmtBRL(+p.custo || 0)}</td>
                <td class='right'>${fmtBRL(+p.preco || 0)}</td>
                <td class='right'>${p.estoque ?? 0}</td>
                <td class='right'>
                    <button class='ghost' onclick="editarProduto('${p.id}')">Editar</button>
                    <button class='danger' onclick="excluirProduto('${p.id}')">Excluir</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
}

function editarProduto(id) {
    const p = state.produtos.find(x => x.id === id) || {
        id: uid(),
        codigo: '',
        nome: '',
        categoria: '',
        estoque: 0,
        custo: 0,
        preco: 0
    };

    $('#p-cod').value = p.codigo;
    $('#p-nome').value = p.nome;
    $('#p-cat').value = p.categoria;
    $('#p-estoque').value = p.estoque;
    $('#p-custo').value = p.custo;
    $('#p-preco').value = p.preco;

    $('#p-salvar').onclick = async (e) => {
        e.preventDefault();

        // Atualiza objeto com valores do formulário
        p.codigo = $('#p-cod').value.trim();
        p.nome = $('#p-nome').value.trim();
        p.categoria = $('#p-cat').value.trim();
        p.estoque = +$('#p-estoque').value || 0;
        p.custo = +$('#p-custo').value || 0;
        p.preco = +$('#p-preco').value || 0;

        // Atualiza estado local
        const i = state.produtos.findIndex(x => x.id === p.id);
        if (i >= 0) state.produtos[i] = p;
        else state.produtos.push(p);

        // --- 1) SALVA NO localStorage (DB.set) COM LOG ---
        try {
            DB.set('produtos', state.produtos);
            // Verifica se gravou lendo imediatamente
            const check = JSON.parse(localStorage.getItem('produtos'));
        } catch (err) {
            mostrarPopup('Erro ao salvar localmente (veja console).');
            return;
        }

        // --- 2) TENTA SALVAR APENAS ESSE PRODUTO NO FIRESTORE (com checks) ---
        try {
            // Confere usuário autenticado
            const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;

            if (!user) {
                console.warn('[WARN] Usuário não autenticado no momento. Salvamento no Firestore será tentado quando fizer login.');
                mostrarPopup('Produto salvo localmente. Faça login para sincronizar com o servidor.');
            } else {
                // IMPORTANTE: usa setDoc direto para essa coleção 'produtos' (salva apenas este documento)
               await setDoc(doc(db, "produtos", p.id), p);
                mostrarPopup('Produto salvo e sincronizado!');
            }
        } catch (err) {
            console.error('[ERRO] Falha ao salvar produto no Firestore:', err);
            mostrarPopup('Produto salvo localmente, mas falhou sincronizar com o servidor (veja console).');
            // não retorna; deixamos a UI seguir para não interromper fluxo
        }

        // Atualiza UI e finaliza modal
        $('#dlgProduto').close();
        listarProdutos();
    };

    $('#dlgProduto').showModal();
}

async function excluirProduto(id) {
    if (!confirm('Excluir produto?')) return;

    // 1 — Apaga no estado local
    state.produtos = state.produtos.filter(p => p.id !== id);
    DB.set('produtos', state.produtos);

    // 2 — Apaga no Firebase
    try {
        await deleteDoc(doc(db, "produtos", id));
        mostrarPopup('Produto excluído!');
    } catch (err) {
        console.error("ERRO ao excluir do Firestore:", err);
        mostrarPopup("Erro ao excluir no Firebase!");
    }

    // 3 — Atualiza UI
    listarProdutos();
}

window.excluirProduto = excluirProduto;

// ===================================================
//  IMPORTAÇÃO / EXPORTAÇÃO JSON
// ===================================================
$('#btnExportar')?.addEventListener('click', () => { const data = { produtos: state.produtos, caixa: state.caixa, vendas: state.vendas, cfg: state.cfg }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'loja-dados.json'; a.click(); URL.revokeObjectURL(a.href) });
$('#btnImportar')?.addEventListener('click', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json'; inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const data = JSON.parse(r.result); state.produtos = data.produtos || []; state.caixa = data.caixa || []; state.vendas = data.vendas || []; state.cfg = data.cfg || state.cfg; DB.set('produtos', state.produtos); DB.set('caixa', state.caixa); DB.set('vendas', state.vendas); DB.set('cfg', state.cfg); syncFirebase(); listarProdutos(); listarCaixa(); mostrarPopup('Dados importados!') } catch (e) { alert('Arquivo inválido') } }; r.readAsText(f) }; inp.click() });
$('#btnNovoProduto')?.addEventListener('click', () => editarProduto());
$('#buscaProduto')?.addEventListener('input', listarProdutos);
$('#filtroCategoria')?.addEventListener('input', listarProdutos);

// ===================================================
//  PDV / CARRINHO
// ===================================================
const carrinho = [];
function addCarrinho(codigo, qtd) { const p = state.produtos.find(x => x.codigo === codigo); if (!p) { mostrarPopup('Produto não encontrado'); return } const item = carrinho.find(i => i.codigo === codigo); if (item) item.qtd += qtd; else carrinho.push({ codigo, nome: p.nome, preco: +p.preco || 0, qtd }); renderCarrinho() }
function renderCarrinho() { const tb = $('#pos-cart tbody'); tb.innerHTML = ''; let total = 0; carrinho.forEach((i, idx) => { const sub = i.preco * i.qtd; total += sub; const tr = document.createElement('tr'); tr.innerHTML = `<td>${i.nome}</td><td class='right'>${fmtBRL(i.preco)}</td><td class='right'><input type='number' min='1' value='${i.qtd}' style='width:70px' data-idx='${idx}' class='qtd'></td><td class='right'>${fmtBRL(sub)}</td><td class='right'><button class='danger' data-del='${idx}'>Remover</button></td>`; tb.appendChild(tr) }); const desc = +$('#pos-desconto').value || 0; $('#pos-total').textContent = fmtBRL(Math.max(0, total - desc)); tb.querySelectorAll('input.qtd').forEach(inp => inp.oninput = (e) => { const i = +e.target.dataset.idx; carrinho[i].qtd = Math.max(1, +e.target.value || 1); renderCarrinho() }); tb.querySelectorAll('button[data-del]').forEach(b => b.onclick = (e) => { const i = +e.target.dataset.del; carrinho.splice(i, 1); renderCarrinho() }) }
$('#pos-add')?.addEventListener('click', () => { const cod = $('#pos-barcode').value.trim(); const qtd = Math.max(1, +$('#pos-qtd').value || 1); if (!cod) return mostrarPopup('Informe o código'); addCarrinho(cod, qtd); $('#pos-barcode').value = ''; $('#pos-qtd').value = 1; $('#pos-barcode').focus() });
$('#pos-desconto')?.addEventListener('input', renderCarrinho);
$('#btnNovaVenda')?.addEventListener('click', () => { carrinho.length = 0; renderCarrinho(); $('#pos-cliente').value = ''; $('#pos-desconto').value = 0; mostrarPopup('Carrinho limpo') })

// ===================================================
//  FINALIZAÇÃO DE VENDA
// ===================================================
$('#pos-finalizar')?.addEventListener('click', () => {
    if (carrinho.length === 0) return mostrarPopup('Carrinho vazio');

    const totalTxt = $('#pos-total').textContent.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.');
    const total = +totalTxt || 0;

    const itensEnriquecidos = carrinho.map(i => {
        const pRef = state.produtos.find(x => x.codigo === i.codigo);
        return {
            ...i,
            custo: pRef ? (+pRef.custo || 0) : 0,
            categoria: pRef ? (pRef.categoria || '—') : '—'
        };
    });

    const venda = {
        id: uid(),
        data: new Date().toISOString(),
        itens: itensEnriquecidos,
        total,
        pagto: $('#pos-pagto').value,
        cliente: $('#pos-cliente').value.trim()
    };

    // ===================================================
    //  DESCONTAR ESTOQUE (CORRETO)
    // ===================================================
    if (state.cfg.controlaEstoque) {
        for (const it of venda.itens) {
            const produto = state.produtos.find(p => p.codigo === it.codigo);
            if (produto) {
                produto.estoque = Math.max(0, (+produto.estoque || 0) - it.qtd);
            }
        }

        DB.set("produtos", state.produtos);
    }

    (async () => {
        await syncFirebase();
    })();


    state.caixa.push({ id: uid(), data: venda.data, desc: `Venda PDV ${venda.id}`, cat: 'Vendas', entrada: venda.total, saida: 0 });
    DB.set('caixa', state.caixa);

    state.vendas.push(venda);
    DB.set("vendas", state.vendas);


    (async () => {
        try {
            await setDoc(doc(db, "vendas", venda.id), venda);
        } catch (e) {
        }
    })();


    if ($('#pos-nf').checked) gerarDanfeSimulada(venda);

    carrinho.length = 0; syncFirebase(); renderCarrinho(); listarProdutos(); listarCaixa(); mostrarPopup('Venda concluída!')
})

// ===================================================
//  SCANNER (QuaggaJS)
// ===================================================
let scanning = false;


function startScanner() {
    if (!window.Quagga) {
        alert('QuaggaJS não carregado');
        return;
    }

    const el = document.getElementById('scanner');
    el.style.display = 'block';

    Quagga.init({
        inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: el,
            constraints: {
                facingMode: 'environment'
            }
        },
        decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader']
        }
    }, (err) => {
        if (err) {
            console.error(err);
            alert('Erro ao iniciar câmera');
            return;
        }
        Quagga.start();
        scanning = true;
        mostrarPopup('Scanner ativo');
    });

    Quagga.onDetected(handleDetection);
}


function stopScanner() {
    if (window.Quagga && scanning) {
        Quagga.stop();
        scanning = false;
        document.getElementById('scanner').style.display = 'none';
        mostrarPopup('Scanner parado');
        Quagga.offDetected(handleDetection);
    }
}


function handleDetection(data) {
    if (!scanning) return;

    const code = data.codeResult.code;
    document.getElementById('pos-barcode').value = code;

    const quantidade = Math.max(1, +document.getElementById('pos-qtd').value || 1);
    addCarrinho(code, quantidade);
}

document.getElementById('btnStartScan')?.addEventListener('click', startScanner);
document.getElementById('btnStopScan')?.addEventListener('click', stopScanner);

// ===================================================
//  CAIXA (LISTAGEM + CRUD + STATUS)
// ===================================================
export function listarCaixa() { const tbody = $('#tblCaixa tbody'); tbody.innerHTML = ''; const ini = $('#cx-inicio').value ? new Date($('#cx-inicio').value) : null; const fim = $('#cx-fim').value ? new Date($('#cx-fim').value + 'T23:59:59') : null; let saldo = 0; state.caixa.filter(l => { const d = new Date(l.data); return (!ini || d >= ini) && (!fim || d <= fim) }).sort((a, b) => new Date(a.data) - new Date(b.data)).forEach(l => { saldo += (+l.entrada || 0) - (+l.saida || 0); const tr = document.createElement('tr'); tr.innerHTML = `<td>${new Date(l.data).toLocaleDateString()}</td><td>${l.desc}</td><td>${l.cat}</td><td class='right'>${l.entrada ? fmtBRL(+l.entrada) : ''}</td><td class='right'>${l.saida ? fmtBRL(+l.saida) : ''}</td><td class='right'><button class='danger' onclick="excluirLancamento('${l.id}')">Excluir</button></td>`; tbody.appendChild(tr) }); const elSaldo = $('#cx-saldo'); elSaldo.textContent = `Saldo: ${fmtBRL(saldo)}`; elSaldo.className = 'pill ' + (saldo > 0 ? 'status-ok' : (saldo < 0 ? 'status-danger' : 'status-warn')) }
function excluirLancamento(id) {
    if (!confirm('Excluir lançamento?')) return;

    const lanc = state.caixa.find(x => x.id === id);

    if (lanc) {
        state.caixa = state.caixa.filter(x => x.id !== id);
        DB.set('caixa', state.caixa);

        const match = lanc.desc.match(/Venda PDV (\w+)/);
        if (match) {
            const vendaId = match[1];
            state.vendas = state.vendas.filter(v => v.id !== vendaId);
            DB.set('vendas', state.vendas);
        }

        syncFirebase();
        listarCaixa();
        mostrarPopup('Lançamento removido!');
    }
}
$('#btnLancamento')?.addEventListener('click', () => { $('#l-data').valueAsDate = new Date(); $('#l-cat').value = ''; $('#l-desc').value = ''; $('#l-valor').value = ''; $('#l-tipo').value = 'E'; $('#l-salvar').onclick = (e) => { e.preventDefault(); const tipo = $('#l-tipo').value; const val = +$('#l-valor').value || 0; const obj = { id: uid(), data: ($('#l-data').value ? new Date($('#l-data').value) : new Date()).toISOString(), desc: $('#l-desc').value.trim(), cat: $('#l-cat').value.trim(), entrada: tipo === 'E' ? val : 0, saida: tipo === 'S' ? val : 0 }; state.caixa.push(obj); DB.set('caixa', state.caixa); $('#dlgLancamento').close(); listarCaixa(); mostrarPopup('Lançamento salvo') }; $('#dlgLancamento').showModal() })

// ===================================================
//  ESTADO DO CAIXA (ABERTO/FECHADO)
// ===================================================
function aplicarEstadoCaixa() {
    const bloqueado = !state.caixaStatus.aberto;
    ['pos-add', 'pos-finalizar', 'btnStartScan', 'btnNovaVenda'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = bloqueado;
    });
    const posSec = document.getElementById('sec-pos');
    if (posSec) posSec.style.opacity = bloqueado ? .6 : 1;

    const btnFech = document.getElementById('btnFechamento');
    const btnAbrir = document.getElementById('btnAbrirCaixa');
    if (btnFech) btnFech.style.display = bloqueado ? 'none' : 'inline-block';
    if (btnAbrir) btnAbrir.style.display = bloqueado ? 'inline-block' : 'none';
}

// ===================================================
//  CÁLCULO DO FECHAMENTO DO DIA
// ===================================================
function calcularResumoDia(base = new Date()) {
    const [ini, fim] = dayBounds(base);

    const vendasDia = state.vendas.filter(v => {
        const d = new Date(v.data);
        return d >= ini && d <= fim;
    });

    const totalVendas = clamp2(vendasDia.reduce((a, v) => a + (+v.total || 0), 0));

    const formas = {};
    vendasDia.forEach(v => {
        formas[v.pagto] = clamp2((formas[v.pagto] || 0) + (+v.total || 0));
    });

    const mapa = {};
    let lucroLiquido = 0;
    vendasDia.forEach(v => v.itens.forEach(it => {
        const k = it.codigo;
        if (!mapa[k]) mapa[k] = { codigo: k, nome: it.nome, categoria: it.categoria || '—', qtd: 0, custoTotal: 0, vendaTotal: 0, lucroTotal: 0 };
        mapa[k].qtd += it.qtd;
        mapa[k].custoTotal = clamp2(mapa[k].custoTotal + (it.custo || 0) * it.qtd);
        mapa[k].vendaTotal = clamp2(mapa[k].vendaTotal + (it.preco || 0) * it.qtd);
        const lucroItem = ((it.preco || 0) - (it.custo || 0)) * it.qtd;
        mapa[k].lucroTotal = clamp2(mapa[k].lucroTotal + lucroItem);
        lucroLiquido = clamp2(lucroLiquido + lucroItem);
    }));
    const itensAgr = Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome));

    const movDia = state.caixa.filter(l => {
        const d = new Date(l.data);
        return d >= ini && d <= fim;
    });
    const totalEntradas = clamp2(movDia.reduce((a, l) => a + (+l.entrada || 0), 0));
    const totalSaidas = clamp2(movDia.reduce((a, l) => a + (+l.saida || 0), 0));
    const saldoDia = clamp2(totalEntradas - totalSaidas);

    const saidasDetalhe = movDia.filter(l => +l.saida > 0);

    return {
        dataRef: ini.toISOString().slice(0, 10),
        vendasDia,
        totalVendas,
        formas,
        itensAgr,
        totalEntradas,
        totalSaidas,
        saldoDia,
        lucroLiquido,
        saidasDetalhe
    };
}

// ===================================================
//  FECHAMENTO — MODAL & CONFIRMAR
// ===================================================
function abrirModalFechamento(res) {
    const dlg = document.getElementById('dlgFechamentoDia');
    const box = document.getElementById('fech-resumo');

    const formasRows = Object.keys(res.formas).map(fp =>
        `<tr><td>${fp}</td><td class="right">${toBRL(res.formas[fp])}</td></tr>`
    ).join('') || `<tr><td>—</td><td class="right">${toBRL(0)}</td></tr>`;

    const saidasRows = res.saidasDetalhe.map(s =>
        `<tr><td>${new Date(s.data).toLocaleTimeString('pt-BR')}</td><td>${s.desc}</td><td class="right">${toBRL(s.saida)}</td></tr>`
    ).join('') || `<tr><td colspan="3" class="muted">Sem saídas</td></tr>`;

    const itensRows = res.itensAgr.map(it =>
        `<tr>
      <td>${it.nome}</td>
      <td class="right">${it.qtd}</td>
      <td class="right">${toBRL(it.custoTotal)}</td>
      <td class="right">${toBRL(it.vendaTotal)}</td>
      <td class="right">${toBRL(it.lucroTotal)}</td>
    </tr>`
    ).join('') || `<tr><td colspan="5" class="muted">Sem vendas</td></tr>`;

    box.innerHTML = `
    <div class="row">
      <div class="pill status-ok">Vendas: ${toBRL(res.totalVendas)}</div>
      <div class="pill ${res.totalSaidas > 0 ? 'status-warn' : 'status-ok'}">Saídas: ${toBRL(res.totalSaidas)}</div>
      <div class="pill ${res.lucroLiquido >= 0 ? 'status-ok' : 'status-danger'}">Lucro Líquido: ${toBRL(res.lucroLiquido)}</div>
      <div class="pill ${res.saldoDia >= 0 ? 'status-ok' : 'status-danger'}">Saldo do Dia: ${toBRL(res.saldoDia)}</div>
    </div>

    <h4 style="margin-top:12px">Vendas por Forma de Pagamento</h4>
    <table><thead><tr><th>Forma</th><th class="right">Total</th></tr></thead><tbody>${formasRows}</tbody></table>

    <h4 style="margin-top:12px">Saídas do Dia</h4>
    <table><thead><tr><th>Hora</th><th>Descrição</th><th class="right">Valor</th></tr></thead><tbody>${saidasRows}</tbody></table>

    <h4 style="margin-top:12px">Produtos Vendidos (Agregado)</h4>
    <table>
      <thead><tr>
        <th>Produto</th><th class="right">Qtd</th><th class="right">Custo</th>
        <th class="right">Venda</th><th class="right">Lucro</th>
      </tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
  `;

    const inpRet = document.getElementById('fech-retirar');
    const inpTrc = document.getElementById('fech-troco');
    const sugeridoTroco = clamp2(state.caixaStatus.trocoProximoDia || 0); // mantém o último como default
    const sugeridoRetirada = Math.max(0, clamp2(res.saldoDia - sugeridoTroco));
    inpRet.value = sugeridoRetirada.toFixed(2);
    inpTrc.value = sugeridoTroco.toFixed(2);

    dlg.addEventListener('cancel', (e) => e.preventDefault(), { once: true });
    dlg.addEventListener('click', (e) => {
        if (e.target === dlg) e.preventDefault();
    });

    document.getElementById('fech-confirmar').onclick = (e) => {
        e.preventDefault();
        confirmarFechamento(res);
    };

    dlg.showModal();
}

function confirmarFechamento(res) {
    const dlg = document.getElementById('dlgFechamentoDia');
    const retirar = clamp2($('#fech-retirar').value);
    const troco = clamp2($('#fech-troco').value);
    if (retirar < 0 || troco < 0) return alert('Valores inválidos.');
    if (retirar + troco > res.saldoDia + 0.0001) return alert('A soma de Retirada + Troco excede o saldo do dia.');

    const agora = new Date().toISOString();

    const fechamento = {
        id: uid(),
        dataRef: res.dataRef,
        fechadoEm: agora,
        totalVendas: res.totalVendas,
        formasPagamento: res.formas,
        totalEntradas: res.totalEntradas,
        totalSaidas: clamp2(res.totalSaidas + retirar),
        saldoDia: clamp2(res.saldoDia - retirar),
        lucroLiquido: res.lucroLiquido,
        retirado: retirar,
        mantidoTroco: troco,
        itensVendidos: res.itensAgr,
        vendasIds: res.vendasDia.map(v => v.id)
    };

    state.fechamentos.push(fechamento);
    DB.set('fechamentos', state.fechamentos);

    state.caixa = [];

    state.caixaStatus = { aberto: false, trocoProximoDia: troco, abertoEm: null, fechadoEm: agora };
    DB.set('caixaStatus', state.caixaStatus);
    DB.set('caixa', state.caixa);

    if (typeof syncFirebase === 'function') syncFirebase();
    listarCaixa();
    listarFechamentos();
    aplicarEstadoCaixa();
    dlg.close();
    mostrarPopup('Caixa fechado e registrado.');
}

// ===================================================
//  HISTÓRICO DE FECHAMENTOS
// ===================================================
document.getElementById('btnFechamento')?.addEventListener('click', () => {
    if (!state.caixaStatus.aberto) return mostrarPopup('Caixa já está fechado.');
    const resumo = calcularResumoDia(new Date());
    abrirModalFechamento(resumo);
});

document.getElementById('btnAbrirCaixa')?.addEventListener('click', () => {
    if (state.caixaStatus.aberto) return mostrarPopup('Caixa já está aberto.');

    const valorTroco = clamp2(state.caixaStatus.trocoProximoDia || 0);
    if (valorTroco > 0) {
        state.caixa.push({
            id: uid(),
            data: new Date().toISOString(),
            desc: 'Abertura — Valor de Troco',
            cat: 'Abertura',
            entrada: valorTroco,
            saida: 0
        });
        state.caixaStatus.trocoProximoDia = 0;
    }

    state.caixaStatus.aberto = true;
    state.caixaStatus.abertoEm = new Date().toISOString();
    state.caixaStatus.fechadoEm = null;

    DB.set('caixa', state.caixa);
    DB.set('caixaStatus', state.caixaStatus);
    if (typeof syncFirebase === 'function') syncFirebase();
    aplicarEstadoCaixa();
    listarCaixa();
    mostrarPopup('Caixa aberto para o novo dia.');
});

aplicarEstadoCaixa();

$('#cx-aplicar')?.addEventListener('click', listarCaixa);

export function listarFechamentos() {
    const tb = document.querySelector('#tblFechamentos tbody');
    if (!tb) return;
    tb.innerHTML = '';
    const arr = [...state.fechamentos].sort((a, b) => new Date(b.fechadoEm) - new Date(a.fechadoEm));
    arr.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${new Date(f.dataRef + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
      <td class="right">${toBRL(f.totalVendas)}</td>
      <td class="right">${toBRL(f.totalSaidas)}</td>
      <td class="right">${toBRL(f.lucroLiquido)}</td>
      <td class="right">${toBRL(f.retirado)}</td>
      <td class="right">${toBRL(f.mantidoTroco)}</td>
      <td class="right"><button class="ghost" data-det="${f.id}">Detalhes</button></td>
    `;
        tb.appendChild(tr);
    });
    tb.querySelectorAll('button[data-det]').forEach(btn => {
        btn.onclick = () => abrirDetalheFechamento(btn.dataset.det);
    });
}

function abrirDetalheFechamento(id) {
    const f = state.fechamentos.find(x => x.id === id);
    if (!f) return;
    const dlg = document.getElementById('dlgFechDet');
    const titulo = document.getElementById('fechDet-titulo');
    const box = document.getElementById('fechDet-conteudo');

    const formasRows = Object.keys(f.formasPagamento || {}).map(fp =>
        `<tr><td>${fp}</td><td class="right">${toBRL(f.formasPagamento[fp])}</td></tr>`
    ).join('') || `<tr><td>—</td><td class="right">${toBRL(0)}</td></tr>`;

    const itensRows = (f.itensVendidos || []).map(it =>
        `<tr>
      <td>${it.nome}</td><td class="right">${it.qtd}</td>
      <td class="right">${toBRL(it.custoTotal)}</td>
      <td class="right">${toBRL(it.vendaTotal)}</td>
      <td class="right">${toBRL(it.lucroTotal)}</td>
    </tr>`
    ).join('') || `<tr><td colspan="5" class="muted">Sem itens</td></tr>`;

    titulo.textContent = `Fechamento — ${new Date(f.dataRef + 'T00:00:00').toLocaleDateString('pt-BR')}`;
    box.innerHTML = `
    <div class="row">
      <div class="pill status-ok">Vendas: ${toBRL(f.totalVendas)}</div>
      <div class="pill ${f.totalSaidas > 0 ? 'status-warn' : 'status-ok'}">Saídas: ${toBRL(f.totalSaidas)}</div>
      <div class="pill ${f.lucroLiquido >= 0 ? 'status-ok' : 'status-danger'}">Lucro Líquido: ${toBRL(f.lucroLiquido)}</div>
      <div class="pill ${f.saldoDia >= 0 ? 'status-ok' : 'status-danger'}">Saldo do Dia: ${toBRL(f.saldoDia)}</div>
      <div class="pill">Retirado: ${toBRL(f.retirado)}</div>
      <div class="pill">Troco p/ Próx. Dia: ${toBRL(f.mantidoTroco)}</div>
    </div>

    <h4 style="margin-top:12px">Vendas por Forma de Pagamento</h4>
    <table><thead><tr><th>Forma</th><th class="right">Total</th></tr></thead><tbody>${formasRows}</tbody></table>

    <h4 style="margin-top:12px">Produtos Vendidos</h4>
    <table>
      <thead><tr>
        <th>Produto</th><th class="right">Qtd</th><th class="right">Custo</th>
        <th class="right">Venda</th><th class="right">Lucro</th>
      </tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
  `;
    dlg.showModal();
}

// ===================================================
//  RELATÓRIOS AVANÇADOS
// ===================================================
function gerarRelatorio() {
    const inicio = $('#rel-inicio').value ? new Date($('#rel-inicio').value) : null;
    const fim = $('#rel-fim').value ? new Date($('#rel-fim').value + "T23:59:59") : null;

    const vendas = state.vendas.filter(v => {
        const d = new Date(v.data);
        return (!inicio || d >= inicio) && (!fim || d <= fim);
    });

    if (vendas.length === 0) {
        $('#relatorio-container').innerHTML = "<p>Nenhuma venda neste período.</p>";
        return;
    }


    const totalVendas = vendas.reduce((a, v) => a + (+v.total || 0), 0);
    const qtdVendas = vendas.length;
    const lucro = vendas.reduce((a, v) =>
        a + v.itens.reduce((s, it) => s + ((it.preco - it.custo) * it.qtd), 0)
        , 0);

    const clientes = [...new Set(vendas.map(v => v.cliente))].length;
    const ticketMedio = totalVendas / qtdVendas;
    const lucroMedio = lucro / qtdVendas;
    const margemLucro = (lucro / totalVendas) * 100;

    const produtos = {};
    vendas.forEach(v => v.itens.forEach(it => {
        produtos[it.nome] = (produtos[it.nome] || 0) + it.qtd;
    }));
    const topProduto = Object.entries(produtos).sort((a, b) => b[1] - a[1])[0];

    const formas = {};
    vendas.forEach(v => { formas[v.pagto] = (formas[v.pagto] || 0) + 1; });
    const topForma = Object.entries(formas).sort((a, b) => b[1] - a[1])[0];

    const porCliente = {};
    vendas.forEach(v => { porCliente[v.cliente] = (porCliente[v.cliente] || 0) + v.total; });
    const topClientes = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const porDia = {};
    vendas.forEach(v => {
        const d = new Date(v.data).toLocaleDateString('pt-BR');
        porDia[d] = (porDia[d] || 0) + v.total;
    });
    const topDias = Object.entries(porDia).sort((a, b) => b[1] - a[1]).slice(0, 5);

    $('#relatorio-container').innerHTML = `
      <div class="rel-grid">
        <div class="rel-card"><h4>Faturamento</h4><p>${toBRL(totalVendas)}</p></div>
        <div class="rel-card"><h4>Lucro líquido</h4><p>${toBRL(lucro)}</p></div>
        <div class="rel-card"><h4>Ticket médio</h4><p>${toBRL(ticketMedio)}</p></div>
        <div class="rel-card"><h4>Vendas</h4><p>${qtdVendas}</p></div>
        <div class="rel-card"><h4>Clientes únicos</h4><p>${clientes}</p></div>
        <div class="rel-card"><h4>Lucro/venda</h4><p>${toBRL(lucroMedio)}</p></div>
        <div class="rel-card"><h4>Margem</h4><p>${margemLucro.toFixed(1)}%</p></div>
      </div>

      <div>
        <button class="rel-toggle active" data-target="destaques">Destaques</button>
        <button class="rel-toggle active" data-target="clientes">Top Clientes</button>
        <button class="rel-toggle active" data-target="dias">Top Dias</button>
      </div>

      <div id="rel-destaques" class="rel-list">
        <h3>📌 Destaques</h3>
        <ul>
          <li>Produto mais vendido: <b>${topProduto ? topProduto[0] + " (" + topProduto[1] + " un)" : "—"}</b></li>
          <li>Forma de pagamento mais usada: <b>${topForma ? topForma[0] + " (" + topForma[1] + ")" : "—"}</b></li>
        </ul>
      </div>

      <div id="rel-clientes" class="rel-list">
        <h3>🏆 Top 5 Clientes</h3>
        <ol>${topClientes.map(c => `<li>${c[0]} - ${toBRL(c[1])}</li>`).join("")}</ol>
      </div>

      <div id="rel-dias" class="rel-list">
        <h3>📅 Top 5 Dias</h3>
        <ol>${topDias.map(d => `<li>${d[0]} - ${toBRL(d[1])}</li>`).join("")}</ol>
      </div>
    `;

    document.querySelectorAll(".rel-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.target;
            const section = document.getElementById("rel-" + target);
            btn.classList.toggle("active");
            section.style.display = section.style.display === "none" ? "block" : "none";
        });
    });
}

$('#rel-aplicar')?.addEventListener('click', gerarRelatorio);

// ===================================================
//  SALVAR CONFIGURAÇÕES
// ===================================================
const btnSalvarCfg = document.getElementById("btnSalvarCfg");

if (btnSalvarCfg) {
    btnSalvarCfg.addEventListener("click", () => {

        const nome = document.getElementById("cfg-nome")?.value.trim() || '';
        const cnpj = document.getElementById("cfg-cnpj")?.value.trim() || '';
        const ie = document.getElementById("cfg-ie")?.value.trim() || '';
        const endereco = document.getElementById("cfg-endereco")?.value.trim() || '';
        const icms = +document.getElementById("cfg-icms")?.value || 0;
        const iss = +document.getElementById("cfg-iss")?.value || 0;
        const controla = document.getElementById("cfg-controlaEstoque")?.checked || false;

        state.cfg = {
            nome,
            cnpj,
            ie,
            endereco,
            icms,
            iss,
            controlaEstoque: controla
        };

        DB.set("cfg", state.cfg);
        syncFirebase();
        mostrarPopup("Configurações salvas!");
    });
}

// ===================================================
//  DANFE (SIMULADA)
// ===================================================
async function gerarDanfeSimulada(venda) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); const cfg = state.cfg; doc.setFontSize(14); doc.text(cfg.nome || 'Minha Loja', 14, 16); doc.setFontSize(10); doc.text(`CNPJ: ${cfg.cnpj || '-'}  IE: ${cfg.ie || '-'}`, 14, 22); doc.text(cfg.endereco || '', 14, 28); doc.setFontSize(12); doc.text('DANFE (Simulado) — Documento Auxiliar da NF-e', 14, 38);
    doc.setFontSize(10); doc.text(`Data: ${new Date(venda.data).toLocaleString('pt-BR')}`, 14, 46); doc.text(`Cliente: ${venda.cliente || '-'}`, 14, 52); doc.text(`Pagamento: ${venda.pagto}`, 14, 58);
    const body = venda.itens.map((it, i) => { return [(i + 1).toString(), it.codigo, it.nome, it.qtd.toString(), it.preco.toFixed(2), (it.qtd * it.preco).toFixed(2)] });
    doc.autoTable({ startY: 64, head: [['#', 'Cód.', 'Produto', 'Qtd', 'Preço', 'Subtotal']], body });
    const total = venda.total; const base = total; const icms = base * ((+cfg.icms || 0) / 100); const iss = base * ((+cfg.iss || 0) / 100);
    const y = doc.autoTable.previous.finalY + 8; doc.text(`Base de Cálculo: R$ ${base.toFixed(2)}`, 14, y); doc.text(`ICMS (${(+cfg.icms || 0).toFixed(2)}%): R$ ${icms.toFixed(2)}`, 14, y + 6); doc.text(`ISS (${(+cfg.iss || 0).toFixed(2)}%): R$ ${iss.toFixed(2)}`, 14, y + 12); doc.setFontSize(12); doc.text(`TOTAL: R$ ${total.toFixed(2)}`, 150, y + 12);
    doc.save(`DANFE_${venda.id}.pdf`)
}