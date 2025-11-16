// ===================================================
// 🔥 FIREBASE INDEX.JS — Controle principal do painel
// ===================================================
import { DB } from "./db.js";
import { protectPage, logout, getUserName, getUserRole, auth, db } from "./auth.js";
protectPage();
import { state, mostrarPopup } from "./global.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Alias para seleção de múltiplos elementos, igual ao Cash.js / UmbrellaJS
const $$ = (selector) => document.querySelectorAll(selector);

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
// 🚪 onAuthStateChanged
// ===================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        userInfoEl.textContent = "Carregando...";
        return;
    }

    try {
        const name = await getUserName();
        const role = await getUserRole();

        userInfoEl.textContent = `${name} - ${role}`;
        applyPermissions(role); // aqui chamamos selecionarAba()

    } catch (err) {
        console.error(err);
        userInfoEl.textContent = "Erro ao carregar usuário";
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
        Caixa: ["sec-pos"]
    };

    const allowed = permissions[role] || [];

    // Mostra apenas as abas permitidas
    $$('.tab-btn').forEach(btn => {
        btn.style.display = allowed.includes(btn.dataset.target) ? 'inline-block' : 'none';
    });

    // Abre automaticamente a primeira aba permitida
    const primeiraVisivel = allowed[0];
}


// ===================================================
// 🔄 SINCRONIZAÇÃO COMPLETA (LOCAL → FIREBASE)
// ===================================================
async function syncFirebase() {

    try {
        // Produtos
        for (const p of state.produtos)
            await setDoc(doc(db, "produtos", p.id), p);

        // Caixa
        for (const c of state.caixa)
            await setDoc(doc(db, "caixa", c.id), c);

        // Vendas
        for (const v of state.vendas)
            await setDoc(doc(db, "vendas", v.id), v);

        // Fechamentos
        for (const f of state.fechamentos)
            await setDoc(doc(db, "fechamentos", f.id), f);

        // Configurações
        await setDoc(doc(db, "cfg", "config"), state.cfg);
        await setDoc(doc(db, "cfg", "caixaStatus"), state.caixaStatus);

        mostrarPopup("Dados enviados ao Firebase!");

    } catch (err) {
        console.error("Erro no syncFirebase:", err);
        mostrarPopup("Erro ao sincronizar com Firebase");
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

// 🔄 EXPORTA FUNÇÕES PARA GLOBAL E MÓDULO
// ===================================================
export { syncFirebase, loadFromFirebase, db };