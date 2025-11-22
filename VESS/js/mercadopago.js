// ===================================================
// 🔄 IMPORTS
// ===================================================
import { auth, db } from "./auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import Swal from "https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm";
import { pagamentoConfirmado } from "./plano.js";


// ===================================================
// 🔑 CHAVES MERCADO PAGO (DEV / TESTE)
// ===================================================
const MP_PUBLIC_KEY = "TEST-c48cd16b-954a-4676-96df-2c6d910e50b2";
const MP_ACCESS_TOKEN = "TEST-1978446511430339-110709-511e58d36fc5c111b39292b33f25ca39-2713451330";


// ===================================================
// 🚀 SDK MERCADO PAGO
// ===================================================
const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });


// ===================================================
// 💰 CRIAR PREFERÊNCIA DE PAGAMENTO
// ===================================================
export async function criarPagamento({ valor, titulo }) {
    try {
        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: [
                    {
                        title: titulo || "Assinatura SaaS Premium",
                        quantity: 1,
                        currency_id: "BRL",
                        unit_price: Number(valor) || 49.99
                    }
                ],
                back_urls: {
                    success: "https://127.0.0.1:5500/profile.html?status=approved",
                    failure: "https://127.0.0.1:5500/profile.html?status=failure",
                    pending: "https://127.0.0.1:5500/profile.html?status=pending"
                },
                auto_return: "approved"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Erro Mercado Pago:", data);
            throw new Error(data.message || "Erro na criação da preferência");
        }

        return data.init_point;
    } catch (err) {
        console.error("Erro na criação do link:", err);
        return null;
    }
}


// ===================================================
// 🧾 ABRIR CHECKOUT (DEV + PRODUÇÃO)
// ===================================================
export async function abrirCheckout(valor, titulo) {
    const link = await criarPagamento({ valor, titulo });

    if (link) {
        window.open(link, "_blank");

        // 🧪 Ambiente local — simula pagamento
        if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
           setTimeout(async () => {
                await pagamentoConfirmado();
            }, 10000);
        }

        return;
    }

    Swal.fire({
        title: "Erro ao gerar link",
        text: "Não foi possível iniciar o pagamento. Verifique suas chaves.",
        icon: "error",
        confirmButtonColor: "#3a86ff"
    });
}
