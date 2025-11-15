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
