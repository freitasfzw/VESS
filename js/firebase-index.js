// ===================================================
// 🔥 firebase-index.js — Controle principal do painel (corrigido)
// ===================================================

// ------------------------ IMPORTS (sempre no topo) ------------------------
import { DB } from "./db.js";
import { protectPage, logout, getUserName, getUserRole, auth, db, permissions as authPermissions } from "./auth.js";
import { state, mostrarPopup } from "./global.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// ------------------------ HELPERS ------------------------
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const $ = (sel) => document.querySelector(sel);

// Elementos do DOM
const userInfoEl = document.getElementById("userInfo");
const btnPerfil = document.getElementById("userPanel");

// ------------------------ GUARDA DE PÁGINA ------------------------
// Chama o protectPage para redirecionar caso necessário.
// protectPage usa onAuthStateChanged internamente (definido em auth.js).
// Não usamos `await` aqui pois protectPage não retorna Promise útil.
protectPage();

// ------------------------ AUTENTICAÇÃO: onAuthStateChanged ------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        userInfoEl.textContent = "Carregando...";
        return;
    }

    try {
        const name = await getUserName();
        const role = await getUserRole();
        userInfoEl.textContent = `${name} - ${role}`;
        applyPermissions(role);

        // 1) Carrega dados do Firebase
        await loadFromFirebase();

        // 2) Monta UI depois dos dados prontos
        if (typeof init === "function") init();

    } catch (err) {
        console.error(err);
        userInfoEl.textContent = "Erro ao carregar usuário";
    }
});

// ------------------------ NAV / PERFIL / LOGOUT ------------------------
btnPerfil?.addEventListener("click", () => {
    // abrir página de perfil ao clicar no painel do usuário
    window.location.href = "profile.html";
});

// ------------------------ PERMISSÕES / VISIBILIDADE DE ABAS ------------------------
function applyPermissions(role) {
    // Preferir permissions vindas do módulo de auth se existir, senão usar fallback local
    const permissions = authPermissions || {
        Administrador: ["sec-pos", "sec-estoque", "sec-caixa", "sec-relatorios", "sec-fechamentos", "sec-config", "sec-ajuda"],
        Caixa: ["sec-pos"]
    };

    const allowed = permissions[role] || [];

    // Mostra/oculta botões de aba (assumindo que cada botão tem .tab-btn e data-target)
    $$('.tab-btn').forEach(btn => {
        const target = btn.dataset.target;
        btn.style.display = allowed.includes(target) ? 'inline-block' : 'none';
    });

    // Abre automaticamente a primeira aba permitida (se existir)
    const primeiraVisivel = allowed[0];
    if (primeiraVisivel) {
        // simula clique no botão correspondente
        const botao = $(`.tab-btn[data-target="${primeiraVisivel}"]`);
        if (botao) botao.click();
    }
}

// ------------------------ SINCRONIZAÇÃO: Local -> Firebase ------------------------
async function syncFirebase() {
    try {
        // Produtos
        for (const p of state.produtos || [])
            await setDoc(doc(db, "produtos", p.id), p);

        // Caixa
        for (const c of state.caixa || [])
            await setDoc(doc(db, "caixa", c.id), c);

        // Vendas
        for (const v of state.vendas || [])
            await setDoc(doc(db, "vendas", v.id), v);

        // Fechamentos
        for (const f of state.fechamentos || [])
            await setDoc(doc(db, "fechamentos", f.id), f);

        // Configurações (documentos únicos)
        if (state.cfg) await setDoc(doc(db, "cfg", "config"), state.cfg);
        if (state.caixaStatus) await setDoc(doc(db, "cfg", "caixaStatus"), state.caixaStatus);

        mostrarPopup("Dados enviados ao Firebase!");
    } catch (err) {
        console.error("Erro no syncFirebase:", err);
        mostrarPopup("Erro ao sincronizar com Firebase");
    }
}

// ------------------------ CARREGAR: Firebase -> Local ------------------------
async function loadFromFirebase() {
    try {
        const collections = ["produtos", "caixa", "vendas", "cfg", "fechamentos"];

        for (const col of collections) {
            const colRef = collection(db, col);
            const snapshot = await getDocs(colRef);

            if (col === "cfg") {
                // Esperamos que config esteja como doc id "config"
                const docCfg = snapshot.docs.find(d => d.id === "config");
                if (docCfg) {
                    state.cfg = docCfg.data();
                    DB.set("cfg", state.cfg);
                }
            } else {
                // normalizar formato local: [{ id, ...data }]
                state[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                DB.set(col, state[col]);
            }
        }

        mostrarPopup("Dados carregados do Firebase!");
    } catch (err) {
        console.error("Erro ao carregar dados do Firebase:", err);
        mostrarPopup("Não foi possível carregar dados do Firebase");
    }
}

// ------------------------ EXPORTS ------------------------
export { syncFirebase, loadFromFirebase, db };

// ------------------------ FIM DO ARQUIVO ------------------------
