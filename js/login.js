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
const lembrar = document.getElementById("lembrar");
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
togglePass.addEventListener('click', () => {
    const isPwd = senha.type === 'password';
    senha.type = isPwd ? 'text' : 'password';
    togglePass.textContent = isPwd ? '🙈' : '👁️';
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
        await login(email.value.trim(), senha.value.trim(), lembrar.checked);
        showMsg("Login bem-sucedido!");
    } catch (err) {
        console.error(err);
        showMsg(err.code.replace("auth/", ""), false);
    } finally {
        setLoading(false);
    }
});
