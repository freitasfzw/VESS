// ===================================================
// 🔥 FIREBASE INDEX.JS — Controle principal do painel
// ===================================================

import { protectPage, logout, getUserName, getUserRole, auth, db } from "./js/auth.js";
protectPage();

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const userInfoEl = document.getElementById("userInfo");
const btnLogout = document.getElementById("btnLogout");


// ===================================================
// 🔐 VERIFICAÇÃO DE LOGIN / GUARDA DE PÁGINA
// ===================================================
const user = await protectPage();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const name = await getUserName();
            const role = await getUserRole();

            userInfoEl.textContent = `${name} - ${role}`;
            applyPermissions(role);

        } catch (err) {
            console.error(err);
            userInfoEl.textContent = "Erro ao carregar usuário";
        }
    } else {
        userInfoEl.textContent = "Carregando...";
    }
});


// ===================================================
// 🚪 LOGOUT
// ===================================================
btnLogout.addEventListener("click", () => {
    localStorage.clear();   // limpa sessão local
    logout();               // executa logout do Firebase
});


// ===================================================
// 🛡️ PERMISSÕES / VISIBILIDADE DE ABAS
// ===================================================
function applyPermissions(role) {
    const permissions = {
        Administrador: ["sec-pos", "sec-estoque", "sec-caixa", "sec-relatorios", "sec-fechamentos", "sec-config", "sec-ajuda"],
        Gerente: ["sec-pos", "sec-estoque", "sec-caixa", "sec-relatorios"],
        Caixa: ["sec-pos"]
    };

    const allowed = permissions[role] || [];

    // Mostra apenas as abas permitidas
    $$('.tab-btn').forEach(btn => {
        btn.style.display = allowed.includes(btn.dataset.target) ? 'inline-block' : 'none';
    });

    // Abre automaticamente a primeira aba permitida
    const primeiraVisivel = allowed[0];
    if (primeiraVisivel) selecionarAba(primeiraVisivel);
}


// ===================================================
// 🔄 SINCRONIZAÇÃO COMPLETA (LOCAL → FIREBASE)
// ===================================================
async function syncFirebase() {
    try {
        // Produtos
        const colProdRef = collection(db, "produtos");
        const prodSnap = await getDocs(colProdRef);
        const prodIds = state.produtos.map(p => p.id);

        for (const docF of prodSnap.docs) {
            if (!prodIds.includes(docF.id)) await deleteDoc(doc(db, "produtos", docF.id));
        }
        for (const p of state.produtos) await setDoc(doc(db, "produtos", p.id), p);


        // Caixa
        const colCxRef = collection(db, "caixa");
        const cxSnap = await getDocs(colCxRef);
        const cxIds = state.caixa.map(c => c.id);

        for (const docF of cxSnap.docs) {
            if (!cxIds.includes(docF.id)) await deleteDoc(doc(db, "caixa", docF.id));
        }
        for (const c of state.caixa) await setDoc(doc(db, "caixa", c.id), c);


        // Vendas
        const colVendasRef = collection(db, "vendas");
        const vendasSnap = await getDocs(colVendasRef);
        const vendasIds = state.vendas.map(v => v.id);

        for (const docF of vendasSnap.docs) {
            if (!vendasIds.includes(docF.id)) await deleteDoc(doc(db, "vendas", docF.id));
        }


        // Fechamentos
        const colFechRef = collection(db, "fechamentos");
        const fechSnap = await getDocs(colFechRef);
        const fechIds = state.fechamentos.map(f => f.id);

        for (const docF of fechSnap.docs) {
            if (!fechIds.includes(docF.id)) await deleteDoc(doc(db, "fechamentos", docF.id));
        }
        for (const f of state.fechamentos) await setDoc(doc(db, "fechamentos", f.id), f);


        // Status do Caixa (documento único)
        await setDoc(doc(db, "cfg", "caixaStatus"), state.caixaStatus);

        // Vendas (cria/update)
        for (const v of state.vendas) await setDoc(doc(db, "vendas", v.id), v);

        // Configurações gerais
        await setDoc(doc(db, "cfg", "config"), state.cfg);

        mostrarPopup("Dados sincronizados com Firebase!");

    } catch (err) {
        console.error("Erro ao sincronizar Firebase:", err);
        mostrarPopup("Erro ao enviar dados para Firebase");
    }
}


// ===================================================
// 📥 CARREGAR DADOS DO FIREBASE (CLOUD → LOCAL)
// ===================================================
async function loadFromFirebase() {
    try {
        const collections = ["produtos", "caixa", "vendas", "cfg", "fechamentos"];

        for (const col of collections) {
            const colRef = collection(db, col);
            const snapshot = await getDocs(colRef);

            if (col === "cfg") {
                const docCfg = snapshot.docs.find(d => d.id === "config");
                if (docCfg) {
                    state.cfg = docCfg.data();
                    DB.set("cfg", state.cfg);
                }
            } else {
                state[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                DB.set(col, state[col]);
            }
        }

        mostrarPopup("Dados carregados do Firebase!");

    } catch (err) {
        console.error("Erro ao carregar dados do Firebase:", err);
        mostrarPopup("Não foi possível carregar dados do Firebase");
    }
}


// ===================================================
// 🚀 INICIALIZAÇÃO GERAL DO SISTEMA
// ===================================================
async function init() {
    renderTabs();          // Renderiza abas
    await loadFromFirebase(); // Carrega dados antes do render

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const name = await getUserName();
                const role = await getUserRole();

                userInfoEl.textContent = `${name} - ${role}`;
                applyPermissions(role);

            } catch (err) {
                console.error(err);
                userInfoEl.textContent = "Erro ao carregar usuário";
            }
        } else {
            userInfoEl.textContent = "Carregando...";
        }
    });

    listarProdutos();
    renderCfg();
    listarCaixa();
    atualizarGraficos();

    // Atalhos do sistema
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F2') { e.preventDefault(); editarProduto() }
        if (e.key === 'F9') { e.preventDefault(); $('#pos-finalizar').click() }
    });
}
init();


// ===================================================
// 🔄 EXPORTA FUNÇÕES PARA GLOBAL
// ===================================================
window.syncFirebase = syncFirebase;
