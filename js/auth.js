// ✅ auth.js — Revisado e seguro para SaaS com verificação de assinatura

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import Swal from "https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm";
import { verificarAssinatura, monitorarAssinatura, redirecionarFinanceiro } from "./plano.js";

// 🚀 Firebase Configuração
const firebaseConfig = {
    apiKey: "AIzaSyAx8gOqPVeCztlMTWUsh048ejiNaFGnmAY",
    authDomain: "fluxo-de-caixa---base.firebaseapp.com",
    projectId: "fluxo-de-caixa---base",
    storageBucket: "fluxo-de-caixa---base.firebasestorage.app",
    messagingSenderId: "525078400423",
    appId: "1:525078400423:web:812c21c317312354123a82",
    measurementId: "G-LN7JHSJB86"
};

// 🔹 Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ===================================================
// 🔐 AUTENTICAÇÃO BÁSICA
// ===================================================
export async function login(email, senha, lembrar = false) {
    await setPersistence(auth, lembrar ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email, senha);
}

export function logout() {
    return signOut(auth).then(() => {
        window.location.href = "login.html";
    });
}

export function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
}

// ===================================================
// 🛡️ PROTEÇÃO DE PÁGINAS
// ===================================================
export function protectPage(redirectLogin = "login.html") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = redirectLogin;
            return;
        }

        // 🟢 Usuário logado — verificar assinatura
        const planoOk = await verificarAssinatura(user.uid);

        if (!planoOk) {
            document.body.classList.add("bloqueado");

            // Evita erro se DOM ainda não estiver pronto
            setTimeout(() => {
                redirecionarFinanceiro();
            }, 300);

            Swal.fire({
                title: "Plano Inativo",
                text: "Sua assinatura expirou. Efetue o pagamento para continuar.",
                icon: "warning",
                confirmButtonText: "Ir para Financeiro",
                confirmButtonColor: "#3a86ff"
            });
        }

        // Sempre inicia o monitoramento (ativa/desativa em tempo real)
        monitorarAssinatura(user.uid);
    });
}

export function redirectIfLoggedIn(redirectTo = "index.html") {
    onAuthStateChanged(auth, (user) => {
        if (user) window.location.href = redirectTo;
    });
}

// ===================================================
// 👤 DADOS DO USUÁRIO
// ===================================================
export async function getUserRole() {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não logado");

    try {
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().role || "Desconhecido";
        } else {
            return "Desconhecido";
        }
    } catch (err) {
        console.error("Erro ao buscar role:", err);
        return "Desconhecido";
    }
}

export const permissions = {
    Administrador: ["sec-pos", "sec-estoque", "sec-caixa", "sec-relatorios", "sec-fechamentos", "sec-config", "sec-ajuda"],
    Gerente: ["sec-pos", "sec-caixa", "sec-relatorios"],
    Caixa: ["sec-pos"]
};

export async function getUserName() {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não logado");

    try {
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().name || user.email;
        } else {
            return user.email;
        }
    } catch (err) {
        console.error("Erro ao buscar nome:", err);
        return user.email;
    }
}

