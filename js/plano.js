<<<<<<< HEAD
// ===================================================
// 🔄 IMPORTS
// ===================================================
import { auth, db } from "./auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import Swal from "https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm";


// ===================================================
// 🔍 VERIFICAÇÃO DE ASSINATURA (1x)
// ===================================================
export async function verificarAssinatura(uid) {
    try {
        const ref = doc(db, "assinaturas", uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) return false;

        const dados = snap.data();
        const hoje = new Date();
        const vencimento = new Date(dados.vencimento);

        return dados.status === "ativo" && hoje <= vencimento;
    } catch (err) {
        console.error("Erro ao verificar assinatura:", err);
        return false;
    }
}


// ===================================================
// 🔁 MONITORAMENTO EM TEMPO REAL (listener)
// ===================================================
export function monitorarAssinatura(uid) {
    const ref = doc(db, "assinaturas", uid);

    onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            console.warn("Nenhum documento de assinatura encontrado.");
            redirecionarFinanceiro();
            return;
        }

        const dados = snap.data();
        const ativo = dados?.status === "ativo";
        const vencimento = new Date(dados?.vencimento);
        const hoje = new Date();

        // 🔒 Plano inválido
        if (!ativo || hoje > vencimento) {
            document.body.classList.add("bloqueado");
            redirecionarFinanceiro();

            Swal.fire({
                title: "Plano Inativo",
                text: "Seu plano expirou. Efetue o pagamento para continuar.",
                icon: "warning",
                confirmButtonText: "Ir para Financeiro",
                confirmButtonColor: "#3a86ff"
            });

            return;
        }

        // 🔓 Plano válido
        document.body.classList.remove("bloqueado");
    });
}


// ===================================================
// 💳 REDIRECIONAR PARA FINANCEIRO
// ===================================================
export function redirecionarFinanceiro() {
    document.querySelectorAll(".section").forEach(sec =>
        sec.classList.remove("active")
    );

    const financeiro = document.getElementById("financeiro");
    if (financeiro) {
        financeiro.classList.add("active");
        financeiro.scrollIntoView({ behavior: "smooth" });
    }

    // Atualiza menu
    document.querySelectorAll("nav a").forEach(a =>
        a.classList.remove("active")
    );
    document.querySelector(`nav a[data-section='financeiro']`)?.classList.add("active");

    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = "Financeiro";

    setTimeout(() => {
        document.body.classList.add("bloqueado");
    }, 200);
}


// ===================================================
// ⚙️ ATUALIZAR PLANO NO FIRESTORE
// ===================================================
export async function atualizarPlano(uid, status, meses = 1) {
    const venc = new Date();
    venc.setMonth(venc.getMonth() + meses);

    return setDoc(doc(db, "assinaturas", uid), {
        status,
        vencimento: venc.toISOString(),
        ultimaAtualizacao: new Date().toISOString()
    }, { merge: true });
}


// ===================================================
// 🟢 APÓS PAGAMENTO CONFIRMADO (usado via mercadopago.js)
// ===================================================
export async function pagamentoConfirmado() {
    const user = auth.currentUser;
    if (!user) return;

    const uid = user.uid;
    const venc = new Date();
    venc.setMonth(venc.getMonth() + 1);

    try {
        await setDoc(
            doc(db, "assinaturas", uid),
            {
                plano: "premium",
                valor: 49.9,
                status: "ativo",
                metodoPagamento: "mercado_pago",
                vencimento: venc.toISOString(),
                ultimaAtualizacao: new Date().toISOString()
            },
            { merge: true }
        );

        document.body.classList.remove("bloqueado");

        Swal.fire({
            title: "Pagamento confirmado!",
            text: "Seu plano foi renovado por 30 dias.",
            icon: "success",
            confirmButtonColor: "#3a86ff",
        });

        console.log("✅ Plano atualizado no Firestore");
    } catch (err) {
        console.error("❌ Erro ao atualizar plano:", err);

        Swal.fire({
            title: "Erro ao atualizar",
            text: "Falha ao registrar a renovação do plano.",
            icon: "error",
            confirmButtonColor: "#3a86ff",
        });
    }
}
=======
// ✅ js/plano.js — Revisado para integração com mercadopago.js e auth.js

import { auth, db } from "./auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import Swal from "https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm";

/**
 * 🔎 Verifica se o usuário tem um plano ativo e dentro da validade.
 * Retorna true se estiver ativo, false se precisar pagar.
 */
export async function verificarAssinatura(uid) {
    try {
        const ref = doc(db, "assinaturas", uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) return false;

        const dados = snap.data();
        const hoje = new Date();
        const vencimento = new Date(dados.vencimento);

        if (dados.status !== "ativo" || hoje > vencimento) {
            return false;
        }

        return true;
    } catch (err) {
        console.error("Erro ao verificar assinatura:", err);
        return false;
    }
}

/**
 * 🔁 Monitora a assinatura em tempo real (listener)
 * Bloqueia painel automaticamente se o plano vencer
 */
export function monitorarAssinatura(uid) {
    const ref = doc(db, "assinaturas", uid);

    onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            console.warn("Nenhum documento de assinatura encontrado.");
            redirecionarFinanceiro();
            return;
        }

        const dados = snap.data();
        const ativo = dados?.status === "ativo";
        const vencimento = new Date(dados?.vencimento);
        const hoje = new Date();

        if (!ativo || hoje > vencimento) {
            document.body.classList.add("bloqueado");
            redirecionarFinanceiro();
            Swal.fire({
                title: "Plano Inativo",
                text: "Seu plano expirou. Efetue o pagamento para continuar.",
                icon: "warning",
                confirmButtonText: "Ir para Financeiro",
                confirmButtonColor: "#3a86ff"
            });
        } else {
            document.body.classList.remove("bloqueado");
        }
    });
}

/**
 * 💳 Redireciona visualmente o usuário para a aba Financeiro
 */
export function redirecionarFinanceiro() {
    // Remove qualquer seção ativa
    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));

    // Ativa o financeiro
    const financeiro = document.getElementById("financeiro");
    if (financeiro) {
        financeiro.classList.add("active");
        financeiro.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Atualiza menu e título
    document.querySelectorAll("nav a").forEach(a => a.classList.remove("active"));
    document.querySelector(`nav a[data-section='financeiro']`)?.classList.add("active");

    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = "Financeiro";

    // 🔹 Garante que o blur seja removido só do financeiro
    setTimeout(() => {
        document.body.classList.add("bloqueado");
    }, 200);
}


/**
 * ⚙️ Atualiza o status do plano no Firestore
 */
export async function atualizarPlano(uid, status, meses = 1) {
    const novoVencimento = new Date();
    novoVencimento.setMonth(novoVencimento.getMonth() + meses);

    await setDoc(doc(db, "assinaturas", uid), {
        status,
        vencimento: novoVencimento.toISOString(),
        ultimaAtualizacao: new Date().toISOString()
    }, { merge: true });
}

/**
 * 🟢 Função auxiliar: usada pelo mercadopago.js após pagamento
 */
export async function pagamentoConfirmado() {
    const user = auth.currentUser;
    if (!user) return;

    const uid = user.uid;
    const novoVencimento = new Date();
    novoVencimento.setMonth(novoVencimento.getMonth() + 1);

    try {
        await setDoc(
            doc(db, "assinaturas", uid),
            {
                plano: "premium",
                valor: 49.9,
                status: "ativo",
                metodoPagamento: "mercado_pago",
                vencimento: novoVencimento.toISOString(),
                ultimaAtualizacao: new Date().toISOString(),
            },
            { merge: true }
        );

        document.body.classList.remove("bloqueado");

        Swal.fire({
            title: "Pagamento confirmado!",
            text: "Seu plano foi renovado com sucesso por 30 dias.",
            icon: "success",
            confirmButtonColor: "#3a86ff",
        });

        console.log("✅ Plano atualizado no Firestore com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao atualizar plano:", err);
        Swal.fire({
            title: "Erro ao atualizar plano",
            text: "Não foi possível atualizar sua assinatura. Verifique o console.",
            icon: "error",
            confirmButtonColor: "#3a86ff",
        });
    }
}


>>>>>>> b946784e8a78f522c8f93f3abd24e8a546e57888
