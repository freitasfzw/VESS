// ===================================================
// 🔄 IMPORTS
// ===================================================
import { login, resetPassword, redirectIfLoggedIn } from "./auth.js";


// ===================================================
// 📌 ELEMENTOS DO DOM
// ===================================================
const form = document.getElementById("formLogin");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const msg = document.getElementById("msg");
const togglePass = document.getElementById("togglePass");
const linkReset = document.getElementById("linkReset");
const btn = document.getElementById("btnEntrar");

document.getElementById('year').textContent = new Date().getFullYear();


// ===================================================
// 🔐 REDIRECIONA SE JÁ ESTIVER LOGADO
// ===================================================
redirectIfLoggedIn();


// ===================================================
// 👁️ MOSTRAR / ESCONDER SENHA
// ===================================================
togglePass.addEventListener("click", () => {
    const iconShow = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
  <path d="M12 5C7 5 2.73 8.11 1 12C2.73 15.89 7 19 12 19C17 19 21.27 15.89 23 12C21.27 8.11 17 5 12 5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
</svg>
`;

    const iconHide = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
  <path d="M17.94 17.94C16.19 19.22 14.17 20 12 20C7 20 2.73 16.89 1 13C1.64 11.6 2.53 10.34 3.59 9.32M6.06 6.06C7.81 4.78 9.83 4 12 4C17 4 21.27 7.11 23 11C22.36 12.4 21.47 13.66 20.41 14.68M9.17 9.17C8.45 9.9 8 10.9 8 12C8 14.21 9.79 16 12 16C13.1 16 14.1 15.55 14.83 14.83M1 1L23 23" 
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

    const isPwd = senha.type === "password";
    senha.type = isPwd ? "text" : "password";

    // troca o SVG
    togglePass.innerHTML = isPwd ? iconHide : iconShow;
    senha.focus();
});


// ===================================================
// 🔄 LOADING DO BOTÃO
// ===================================================
function setLoading(on) {
    if (on) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span>Entrando...`;
    } else {
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}


// ===================================================
// ⚠️ MENSAGENS DE ALERTA
// ===================================================
function showMsg(text, ok = true) {
    msg.textContent = text;
    msg.className = ok ? 'alert ok' : 'alert error';
}


// ===================================================
// 🔑 LOGIN
// ===================================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        await login(email.value.trim(), senha.value.trim());
        showMsg("Login bem-sucedido!");
    } catch (err) {
        console.error(err);
        showMsg(err.code.replace("auth/", ""), false);
    } finally {
        setLoading(false);
    }
});
