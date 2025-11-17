// ===================================================
// 🔄 IMPORTS
// ===================================================

import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { abrirCheckout } from "./mercadopago.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    auth,
    db,
    protectPage,
    logout,
    getUserName,
    getUserRole
} from "./auth.js";
import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    updateEmail,
    updatePassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import * as echarts from "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.esm.min.js";
import { mostrarPopup } from "./global.js";


// 🔒 Protege a página (redireciona se não estiver logado)
protectPage();

// 🎯 Elementos da interface
const userInfoEl = document.getElementById("userInfo");
const btnLogout = document.getElementById("btnLogout");

// Campos do perfil de usuário
const inputNome = document.querySelector('.card input[type="text"]');
const inputEmail = document.querySelector('.card input[type="email"]');
const inputSenha = document.querySelector('.card input[type="password"]');
const btnSalvarPerfil = document.querySelectorAll('.save')[0]; // primeiro botão "Salvar alterações"

// Campos da loja
const lojaInputs = document.querySelectorAll('.card:nth-of-type(2) input'); // 🆕 segunda card
const btnSalvarLoja = document.querySelectorAll('.save')[1]; // 🆕 botão "Atualizar dados"

// 🔹 Atualiza informações do usuário logado
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const name = await getUserName();
            const role = await getUserRole();
            const uid = user.uid;
            const email = user.email;

            if (userInfoEl) userInfoEl.textContent = `${name} - ${role}`;

            // 🔹 Puxa dados completos do Firestore
            const ref = doc(db, "usuarios", uid);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const dados = snap.data();
                inputNome.value = dados.name || name || "";
                inputEmail.value = dados.email || email || "";
            } else {
                inputNome.value = name || "";
                inputEmail.value = email || "";
            }
        } catch (err) {
            console.error("Erro ao carregar usuário:", err);
            if (userInfoEl) userInfoEl.textContent = "Erro ao carregar usuário";
        }
    } else {
        if (userInfoEl) userInfoEl.textContent = "Carregando...";
    }
});

onSnapshot(collection(db, "vendas"), (snap) => {
    const vendas = snap.docs.map(d => d.data());
    gerarDashboard(vendas); // AGORA ATUALIZA EM TEMPO REAL
    gerarRelatorio(); // se quiser atualizar os gráficos junto
});
// =====================================================
// 🧑‍💼 Atualizar perfil do usuário (com atualização visual automática)
// =====================================================
if (btnSalvarPerfil) {
    btnSalvarPerfil.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return alert("Usuário não autenticado.");

        const novoNome = inputNome.value.trim();
        const novoEmail = inputEmail.value.trim();
        const novaSenha = inputSenha.value.trim();

        try {
            // Atualiza no Auth
            if (novoNome && novoNome !== user.displayName) {
                await updateProfile(user, { displayName: novoNome });
            }

            if (novoEmail && novoEmail !== user.email) {
                await updateEmail(user, novoEmail);
            }

            if (novaSenha && novaSenha.length >= 6) {
                await updatePassword(user, novaSenha);
            }

            // Atualiza no Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                name: novoNome,
                email: novoEmail,
                atualizadoEm: new Date()
            }, { merge: true });

            // 🆕 Recarrega o usuário para refletir mudanças no painel
            await user.reload();
            const atualizado = auth.currentUser;
            const role = await getUserRole();

            if (userInfoEl) {
                userInfoEl.textContent = `${atualizado.displayName || atualizado.email} - ${role}`;
            }

            mostrarPopup("Perfil atualizado com sucesso!");
            inputSenha.value = "";
        } catch (err) {
            console.error("Erro ao atualizar perfil:", err);
            if (err.code === "auth/requires-recent-login") {
                alert("⚠️ Faça login novamente para alterar email ou senha.");
            } else {
                alert("Erro ao atualizar. Verifique o console.");
            }
        }
    });
}

// ==========================================================
// ⚙️ CONFIGURAÇÕES DA LOJA
// ==========================================================
async function carregarConfiguracoes() {
    try {
        const ref = doc(db, "cfg", "config");
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const dados = snap.data();

            // Atualiza os inputs
            lojaInputs[0].value = dados.nome || "";
            lojaInputs[1].value = dados.cnpj || "";
            lojaInputs[2].value = dados.endereco || "";

            // 🆕 Atualiza o nome da loja na navbar (brand)
            const brandTitle = document.querySelector(".brand h2");
            if (brandTitle) {
                brandTitle.textContent = dados.nome || "Minha Loja";
            }
        } else {
            console.warn("Nenhum documento encontrado em cfg/config");
        }
    } catch (err) {
        console.error("Erro ao carregar configurações:", err);
    }
}

// 🆕 Atualizar configurações da loja
if (btnSalvarLoja) {
    // PROFILE.JS — salva configs da loja
    btnSalvarLoja.addEventListener("click", async () => {
        try {
            const dados = {
                nome: lojaInputs[0].value || "",
                cnpj: lojaInputs[1].value || "",
                endereco: lojaInputs[2].value || "",
                atualizadoEm: new Date()
            };

            await setDoc(doc(db, "cfg", "config"), dados, { merge: true });

            // Atualiza localStorage também
            localStorage.setItem("nomeLoja", dados.nome);

            mostrarPopup("Configurações da loja atualizadas!");
        } catch (err) {
            console.error("Erro:", err);
            alert("Erro ao salvar.");
        }
    });
}

// 🔹 Logout
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        localStorage.clear();
        logout();
    });
}

// 🔄 Atualização automática das configurações da loja (tempo real)
onSnapshot(doc(db, "cfg", "config"), (snap) => {
    if (snap.exists()) {
        const dados = snap.data();

        // Atualiza inputs visíveis
        lojaInputs[0].value = dados.nome || "";
        lojaInputs[1].value = dados.cnpj || "";
        lojaInputs[2].value = dados.endereco || "";

        // Atualiza título da loja no header
        const brandTitle = document.querySelector(".brand h2");
        if (brandTitle) {
            brandTitle.textContent = dados.nome || "Minha Loja";
        }
    }
});

// =====================================================
// 🧭 NAVEGAÇÃO SPA SEGURA
// =====================================================
const navLinks = document.querySelectorAll("nav a");
const sections = document.querySelectorAll(".section");
const pageTitle = document.getElementById("pageTitle");

navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();

        // Atualiza ativo no menu
        navLinks.forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        // Troca de seção
        const target = link.getAttribute("data-section");
        sections.forEach(sec => sec.classList.remove("active"));
        document.getElementById(target).classList.add("active");

        // Atualiza título do cabeçalho
        pageTitle.textContent = link.textContent.trim();

        // Armazena seção atual (opcional)
        localStorage.setItem("currentSection", target);

        // Se o usuário abriu o Dashboard, gerar relatório automaticamente
        // Se o usuário abriu o Dashboard, gera relatório automático
        // Se o usuário abriu o Dashboard, aguarda autenticação antes de gerar relatório
        if (target === "dashboard") {
            const tentarGerar = () => {
                if (auth.currentUser) gerarRelatorio();
                else setTimeout(tentarGerar, 500);
            };
            tentarGerar();
        }
    });
});



// Mantém a última seção aberta (persistência)
window.addEventListener("DOMContentLoaded", () => {
    const last = localStorage.getItem("currentSection");
    if (last && document.getElementById(last)) {
        document.querySelector(`nav a[data-section="${last}"]`)?.click();
    }
});


// Função auxiliar pra formatar valores em reais
function toBRL(v) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function atualizarIndicadores(kpis) {
    const container = document.getElementById("smart-indicators");
    if (!container) return;

    container.innerHTML = `
        <div class="smart-indicator ${kpis.lucro.diff >= 0 ? 'positive' : 'negative'}">
            <div class="icon">
                <img src="${kpis.lucro.diff >= 0 ? 'img/positivo.png' : 'img/negativo.png'}" 
                     alt="${kpis.lucro.diff >= 0 ? 'positivo' : 'negativo'}" 
                     style="width:32px; height:32px;">
            </div>
            <span>
                <span class="value">${kpis.lucro.diff >= 0 ? '+ ' : '- '}${Math.abs(kpis.lucro.diff).toFixed(1)}%</span>
                <span class="label">de Lucro comparado a semana anterior</span>
            </span>
        </div>

        <div class="smart-indicator ${kpis.faturamento.diff >= 0 ? 'positive' : 'negative'}">
            <div class="icon">
                <img src="${kpis.faturamento.diff >= 0 ? 'img/positivo.png' : 'img/negativo.png'}" 
                     alt="${kpis.faturamento.diff >= 0 ? 'positivo' : 'negativo'}" 
                     style="width:32px; height:32px;">
            </div>
            <span>
                <span class="value">${kpis.faturamento.diff >= 0 ? '+ ' : '- '}${Math.abs(kpis.faturamento.diff).toFixed(1)}%</span>
                <span class="label">de Faturamento comparado ao mês anterior</span>
            </span>
        </div>
    `;
}


// ===================================================
// 🧭 FUNÇÃO CORRIGIDA: gerarRelatorio()
// ===================================================
async function gerarRelatorio() {
    const container = document.getElementById("relatorio-container");
    if (!container) return;

    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = "<p>Usuário não autenticado. Faça login novamente.</p>";
        return;
    }

    container.innerHTML = "<p style='color: var(--muted)'>⏳ Carregando dados do relatório...</p>";

    try {
        // Busca as vendas do Firestore de forma síncrona aqui (sem onSnapshot dentro do relatório)
        const querySnap = await getDocs(collection(db, "vendas"));
        const vendas = querySnap.docs.map(d => d.data() || {});

        // Atualiza o dashboard com as vendas carregadas (gerarDashboard aceita parâmetro)
        gerarDashboard(vendas);

        // Filtros de período
        const inicio = document.getElementById("rel-inicio").value
            ? new Date(document.getElementById("rel-inicio").value)
            : null;
        const fim = document.getElementById("rel-fim").value
            ? new Date(document.getElementById("rel-fim").value + 'T23:59:59')
            : null;

        const filtradas = vendas.filter(v => {
            const d = new Date(v.data);
            return (!inicio || d >= inicio) && (!fim || d <= fim);
        });

        if (!filtradas.length) {
            container.innerHTML = "<p>Nenhuma venda neste período.</p>";
            return;
        }

        // Totais e KPIs
        const totalVendas = filtradas.reduce((a, v) => a + (+v.total || 0), 0);
        const qtdVendas = filtradas.length;
        const lucro = filtradas.reduce((a, v) =>
            a + (v.itens?.reduce((s, it) => s + ((it.preco - it.custo) * it.qtd), 0) || 0), 0);
        const clientes = [...new Set(filtradas.map(v => v.cliente).filter(c => c))].length;
        const ticketMedio = totalVendas / qtdVendas;
        const lucroMedio = lucro / qtdVendas;
        const margemLucro = totalVendas ? (lucro / totalVendas) * 100 : 0;

        const produtos = {};
        filtradas.forEach(v => v.itens?.forEach(it => {
            produtos[it.nome] = (produtos[it.nome] || 0) + it.qtd;
        }));
        const topProduto = Object.entries(produtos).sort((a, b) => b[1] - a[1])[0] || null;

        const formas = {};
        filtradas.forEach(v => { formas[v.pagto] = (formas[v.pagto] || 0) + 1; });
        const topForma = Object.entries(formas).sort((a, b) => b[1] - a[1])[0] || null;

        const porCliente = {};
        filtradas.forEach(v => { porCliente[v.cliente] = (porCliente[v.cliente] || 0) + (+v.total || 0); });
        const topClientes = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const porDia = {};
        filtradas.forEach(v => {
            const d = new Date(v.data).toLocaleDateString('pt-BR');
            porDia[d] = (porDia[d] || 0) + (+v.total || 0);
        });
        const topDias = Object.entries(porDia).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // Render do HTML do relatório (mantive sua estrutura)
        container.innerHTML = `
<div class="rel-grid">
    <div class="rel-card"><h4>Faturamento</h4><p>${toBRL(totalVendas)}</p></div>
    <div class="rel-card"><h4>Lucro líquido</h4><p>${toBRL(lucro)}</p></div>
    <div class="rel-card"><h4>Ticket médio</h4><p>${toBRL(ticketMedio)}</p></div>
    <div class="rel-card"><h4>Vendas</h4><p>${qtdVendas}</p></div>
    <div class="rel-card"><h4>Clientes únicos</h4><p>${clientes}</p></div>
    <div class="rel-card"><h4>Lucro/venda</h4><p>${toBRL(lucroMedio)}</p></div>
    <div class="rel-card"><h4>Margem</h4><p>${margemLucro.toFixed(1)}%</p></div>
</div>
`;

        async function gerarGraficosMetas() {
            const snap = await getDoc(doc(db, "cfg", "metaVendas"));
            if (!snap.exists()) return;
            const m = snap.data();

            const querySnap = await getDocs(collection(db, "vendas"));
            const vendas = querySnap.docs.map(doc => doc.data());
            if (!vendas.length) return;

            // 🔹 Funções auxiliares
            const hoje = new Date();
            const mesmoDia = (d1, d2) => (
                d1.getDate() === d2.getDate() &&
                d1.getMonth() === d2.getMonth() &&
                d1.getFullYear() === d2.getFullYear()
            );

            const mesmoMes = (d1, d2) => (
                d1.getMonth() === d2.getMonth() &&
                d1.getFullYear() === d2.getFullYear()
            );

            const mesmoAno = (d1, d2) => d1.getFullYear() === d2.getFullYear();

            const getInicioDaSemana = (data) => {
                const d = new Date(data);
                const dia = d.getDay();
                const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
                return new Date(d.setDate(diff));
            };

            const inicioSemana = getInicioDaSemana(hoje);

            // 🔸 Filtros automáticos
            const vendasDia = vendas.filter(v => mesmoDia(new Date(v.data), hoje));
            const vendasSemana = vendas.filter(v => new Date(v.data) >= inicioSemana);
            const vendasMes = vendas.filter(v => mesmoMes(new Date(v.data), hoje));
            const vendasAno = vendas.filter(v => mesmoAno(new Date(v.data), hoje));

            // 🔸 Totais por período
            const totalDia = vendasDia.reduce((a, v) => a + (+v.total || 0), 0);
            const totalSemana = vendasSemana.reduce((a, v) => a + (+v.total || 0), 0);
            const totalMes = vendasMes.reduce((a, v) => a + (+v.total || 0), 0);
            const totalAno = vendasAno.reduce((a, v) => a + (+v.total || 0), 0);

            // 🔹 Renderizador do gráfico (mantém seu estilo)
            function renderChart(id, label, meta, total) {
                const el = document.getElementById(id);
                if (!el) return;

                const atingido = Math.min(total, meta || 0);
                const restante = Math.max((meta || 0) - total, 0);

                const chart = echarts.init(el);
                chart.setOption({
                    title: {
                        text: label,
                        left: "center",
                        top: 5,
                        textStyle: {
                            color: "#333",
                            fontWeight: "600",
                            fontSize: 14
                        }
                    },
                    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
                    series: [{
                        type: "pie",
                        radius: "65%",
                        center: ["50%", "58%"],
                        data: [
                            {
                                value: atingido,
                                name: "Atingido",
                                itemStyle: {
                                    color: {
                                        type: "linear",
                                        x: 0, y: 0, x2: 1, y2: 1,
                                        colorStops: [
                                            { offset: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() },
                                            { offset: 1, color: getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() }
                                        ]
                                    }
                                }
                            },
                            {
                                value: restante,
                                name: "Restante",
                                itemStyle: {
                                    color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()
                                }
                            }
                        ],
                        label: { formatter: "{d}%", fontSize: 13 }
                    }]
                });

                window.addEventListener("resize", () => chart.resize());
            }

            // 🧭 Renderiza cada meta com seu próprio total
            renderChart("chart-meta-diaria", "Meta Diária", m.diaria, totalDia);
            renderChart("chart-meta-semanal", "Meta Semanal", m.semanal, totalSemana);
            renderChart("chart-meta-mensal", "Meta Mensal", m.mensal, totalMes);
            renderChart("chart-meta-anual", "Meta Anual", m.anual, totalAno);
        }

        // 🔄 Chamada
        gerarGraficosMetas();



        // Exemplo simples de cálculo de diferença (adaptar conforme seus dados históricos)
        function calcularDifSemanaPassada(valorAtual) {
            // Aqui você busca dados da semana anterior do Firestore
            // Exemplo dummy:
            const valorSemanaPassada = valorAtual * 0.88; // só para teste
            return ((valorAtual - valorSemanaPassada) / valorSemanaPassada) * 100;
        }

        function calcularDifMesAnterior(valorAtual) {
            // Aqui você busca dados do mês anterior do Firestore
            // Exemplo dummy:
            const valorMesAnterior = valorAtual * 1.08; // só para teste
            return ((valorAtual - valorMesAnterior) / valorMesAnterior) * 100;
        }

        // Chamada após calcular KPIs
        const kpis = {
            lucro: { value: lucro, diff: calcularDifSemanaPassada(lucro) },
            faturamento: { value: totalVendas, diff: calcularDifMesAnterior(totalVendas) }
        };

        atualizarIndicadores(kpis);


        // === GRÁFICOS PROFISSIONAIS (ECharts) ===

        // 📅 1. Gráfico de Vendas por Dia (linha com degradê diagonal)
        const vendasChart = echarts.init(document.getElementById('chart-vendas'));
        vendasChart.setOption({
            title: {
                text: '{icon|}   Vendas por Dia',
                left: 'center',
                textStyle: {
                    rich: {
                        icon: {
                            height: 24,
                            backgroundColor: {
                                image: 'img/profit-up.png' // caminho da sua imagem
                            }
                        }
                    },
                    color: '#333',
                    fontWeight: '600'
                }
            },
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
            xAxis: {
                type: 'category',
                data: topDias.map(d => d[0]),
                axisLabel: { rotate: 45, color: '#555' },
                axisLine: { lineStyle: { color: '#ccc' } }
            },
            yAxis: {
                type: 'value',
                name: 'R$',
                axisLine: { lineStyle: { color: '#ccc' } },
                splitLine: { lineStyle: { color: '#eee' } }
            },
            series: [{
                data: topDias.map(d => d[1]),
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: { width: 3, color: '#3a86ff' },
                itemStyle: { color: '#3a86ff' },
                areaStyle: {
                    // 🔹 Degradê linear no ângulo 135°
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                        { offset: 0, color: 'rgba(58, 134, 255, 0.8)' }, // topo - azul forte
                        { offset: 1, color: 'rgba(0, 180, 216, 0.2)' }   // base - azul claro transparente
                    ])
                }
            }]
        });

        // 💳 2. Formas de Pagamento (pizza)
        const pagtoChart = echarts.init(document.getElementById('chart-pagamentos'));
        pagtoChart.setOption({
            title: {
                text: '{icon|} Formas de Pagamento',
                left: 'center',
                textStyle: {
                    rich: {
                        icon: {
                            height: 24,
                            backgroundColor: {
                                image: 'img/pie-chart.png' // caminho da sua imagem
                            }
                        }
                    },
                    color: '#333',
                    fontWeight: '900'
                }
            },
            tooltip: { trigger: 'item' },
            legend: { bottom: 0 },
            series: [{
                name: 'Pagamentos',
                type: 'pie',
                radius: '60%',
                data: Object.entries(formas).map(([k, v]) => ({ name: k, value: v })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        });

        // 💰 3. Lucro x Faturamento (barras com degradê profissional)
        const lucroChart = echarts.init(document.getElementById('chart-lucro'));
        lucroChart.setOption({
            title: {
                text: '{icon|} Lucro x Faturamento',
                left: 'center',
                textStyle: {
                    rich: {
                        icon: {
                            height: 24,
                            backgroundColor: {
                                image: 'img/bar-chart.png' // caminho da sua imagem
                            }
                        }
                    },
                    color: '#333',
                    fontWeight: '600'
                }
            },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
            xAxis: {
                type: 'category',
                data: ['Faturamento', 'Lucro'],
                axisLabel: { color: '#555' },
                axisLine: { lineStyle: { color: '#ccc' } }
            },
            yAxis: {
                type: 'value',
                name: 'R$',
                axisLine: { lineStyle: { color: '#ccc' } },
                splitLine: { lineStyle: { color: '#eee' } }
            },
            series: [{
                data: [totalVendas, lucro],
                type: 'bar',
                barWidth: '45%',
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                        { offset: 0, color: '#3a86ff' },  // azul forte
                        { offset: 1, color: '#00b4d8' }   // azul claro
                    ])
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 20,
                        shadowColor: 'rgba(0, 180, 216, 0.4)',
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                            { offset: 0, color: '#4895ef' },
                            { offset: 1, color: '#00b4d8' }
                        ])
                    }
                }
            }]

        });


        // 🔄 Responsividade
        window.addEventListener('resize', () => {
            vendasChart.resize();
            pagtoChart.resize();
            lucroChart.resize();
        });


        document.querySelectorAll(".rel-toggle").forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.target;
                const section = document.getElementById("rel-" + target);
                btn.classList.toggle("active");
                section.style.display = section.style.display === "none" ? "block" : "none";
            });
        });
    } catch (err) {
        console.error("🔥 ERRO REAL NO RELATÓRIO:", err);
        container.innerHTML = "<p>Erro ao carregar dados do Firestore.</p>";
    }

}



// =====================================================
// FUNÇÕES DE VARIAÇÃO (ESCAPADAS DO ESCOPO)
// =====================================================

// Semanal
function calcularDifSemanaPassada(valorAtual) {
    const valorSemanaPassada = valorAtual * 0.88; // seu placeholder
    return ((valorAtual - valorSemanaPassada) / valorSemanaPassada) * 100;
}

// Mensal
function calcularDifMesAnterior(valorAtual) {
    const valorMesAnterior = valorAtual * 1.08; // seu placeholder
    return ((valorAtual - valorMesAnterior) / valorMesAnterior) * 100;
}

function calcularVariacaoLucro(vendas) {
    if (!vendas.length) return 0;

    const hoje = new Date();
    const inicioSemanaAtual = new Date(hoje);
    inicioSemanaAtual.setDate(hoje.getDate() - hoje.getDay() + 1);

    const inicioSemanaPassada = new Date(inicioSemanaAtual);
    inicioSemanaPassada.setDate(inicioSemanaAtual.getDate() - 7);

    const fimSemanaPassada = new Date(inicioSemanaAtual);
    fimSemanaPassada.setDate(inicioSemanaAtual.getDate() - 1);

    const lucroSemanaAtual = vendas
        .filter(v => new Date(v.data) >= inicioSemanaAtual)
        .reduce((a, v) => a + (v.lucro || 0), 0);

    const lucroSemanaPassada = vendas
        .filter(v => new Date(v.data) >= inicioSemanaPassada && new Date(v.data) <= fimSemanaPassada)
        .reduce((a, v) => a + (v.lucro || 0), 0);

    if (lucroSemanaPassada === 0) return 100;

    return ((lucroSemanaAtual - lucroSemanaPassada) / lucroSemanaPassada) * 100;
}


function calcularVariacaoFaturamento(vendas) {
    if (!vendas.length) return 0;

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const mesPassado = mesAtual === 0 ? 11 : mesAtual - 1;

    const faturamentoAtual = vendas
        .filter(v => new Date(v.data).getMonth() === mesAtual)
        .reduce((a, v) => a + (+v.total || 0), 0);

    const faturamentoPassado = vendas
        .filter(v => new Date(v.data).getMonth() === mesPassado)
        .reduce((a, v) => a + (+v.total || 0), 0);

    if (faturamentoPassado === 0) return 100;

    return ((faturamentoAtual - faturamentoPassado) / faturamentoPassado) * 100;
}

// ===================================================
// 📊 FUNÇÃO CORRIGIDA: gerarDashboard(vendasOptional)
//      - aceita um array de vendas (para evitar reconsultas duplicadas)
// ===================================================
async function gerarDashboard(vendasPreCarregadas = null) {

    try {
        const vendas = vendasPreCarregadas ||
            (await getDocs(collection(db, "vendas"))).docs.map(d => d.data() || {});

        if (!vendas.length) {
            console.warn("Nenhuma venda encontrada.");
            return;
        }

        // Totais rápidos (se você usa em outro lugar)
        const hojeStr = new Date().toISOString().split("T")[0];
        const vendasHoje = vendas.filter(v => (v.data || "").startsWith(hojeStr));
        const totalHoje = vendasHoje.reduce((a, v) => a + (+v.total || 0), 0);

        const mes = new Date().getMonth();
        const vendasMes = vendas.filter(v => new Date(v.data).getMonth() === mes);
        const totalMes = vendasMes.reduce((a, v) => a + (+v.total || 0), 0);

        const totalGeral = vendas.reduce((a, v) => a + (+v.total || 0), 0);

        // Atualiza indicadores (usa as funções de variação que devem estar no escopo global)
        atualizarIndicadores({
            lucro: { diff: calcularVariacaoLucro(vendas) },
            faturamento: { diff: calcularVariacaoFaturamento(vendas) }
        });

    } catch (err) {
        console.error("❌ Erro ao gerar dashboard:", err);
    }
}


// ==========================================================
// 📡 LISTENER EM TEMPO REAL PARA AS VENDAS
// ==========================================================
function iniciarListenerVendas() {
    const ref = collection(db, "vendas");

    // Escuta em tempo real
    onSnapshot(ref, async () => {
        await gerarRelatorio();  // atualiza tudo automaticamente
    });
}

function gerarRelatorioComVendas(vendas) {
    //  Aqui vamos copiar a lógica do seu relatório
    // mas removendo o getDocs e usando as vendas recebidas

    const container = document.getElementById("relatorio-container");
    if (!container) return;

    const inicio = document.getElementById("rel-inicio").value
        ? new Date(document.getElementById("rel-inicio").value)
        : null;
    const fim = document.getElementById("rel-fim").value
        ? new Date(document.getElementById("rel-fim").value + "T23:59:59")
        : null;

    const filtradas = vendas.filter(v => {
        const d = new Date(v.data);
        return (!inicio || d >= inicio) && (!fim || d <= fim);
    });

    //  Aqui você reutiliza TODA a lógica atual:
    // totais, top produtos, top dias, gráficos, KPIs...
    //
    // Apenas substitua o array 'vendas' pelo array 'filtradas'
}


const labelPeriodo = document.getElementById("periodo-label");

// Botão principal
document.getElementById("rel-aplicar").addEventListener("click", async () => {
    labelPeriodo.textContent = `Exibindo: ${formatarPeriodo()}`;
    await gerarRelatorio();
});

// Botões rápidos
document.querySelectorAll(".filter-shortcuts button").forEach(btn => {
    btn.addEventListener("click", async () => {
        const hoje = new Date();
        let inicio, fim = hoje;

        if (btn.dataset.range === "hoje") {
            inicio = new Date();
        } else if (btn.dataset.range === "semana") {
            inicio = new Date();
            inicio.setDate(hoje.getDate() - 6);
        } else if (btn.dataset.range === "mes") {
            inicio = new Date();
            inicio.setDate(hoje.getDate() - 29);
        } else if (btn.dataset.range === "ano") {
            inicio = new Date(hoje.getFullYear(), 0, 1);
        } else if (btn.dataset.range === "personalizado") {
            document.getElementById("rel-inicio").focus();
            return;
        }

        document.getElementById("rel-inicio").value = toDateInput(inicio);
        document.getElementById("rel-fim").value = toDateInput(fim);

        document.querySelectorAll(".filter-shortcuts button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        labelPeriodo.textContent = `Exibindo: ${formatarPeriodo()}`;
        await gerarRelatorio();
    });
});

// Botão limpar
document.getElementById("limpar-filtro").addEventListener("click", async () => {
    document.getElementById("rel-inicio").value = "";
    document.getElementById("rel-fim").value = "";
    document.querySelectorAll(".filter-shortcuts button").forEach(b => b.classList.remove("active"));
    labelPeriodo.textContent = "Exibindo: Todos os dados";
    await gerarRelatorio();
});

// Helpers
const toDateInput = d => d.toISOString().split("T")[0];
const formatarPeriodo = () => {
    const inicio = document.getElementById("rel-inicio").value;
    const fim = document.getElementById("rel-fim").value;
    if (!inicio && !fim) return "Todos os dados";
    const i = inicio ? new Date(inicio).toLocaleDateString("pt-BR") : "—";
    const f = fim ? new Date(fim).toLocaleDateString("pt-BR") : "—";
    return `${i} até ${f}`;
};
// 🎯 Atualiza relatório ao clicar no botão "Aplicar Filtro"
document.getElementById("rel-aplicar").addEventListener("click", async () => {
    await gerarRelatorio(); // Reexecuta o relatório com base nas novas datas
});

// Salvar metas no Profile
// 🔹 Salvar metas no Firestore
document.getElementById("salvar-metas")?.addEventListener("click", async () => {
    const diaria = Number(document.getElementById("meta-diaria").value) || 0;
    const semanal = Number(document.getElementById("meta-semanal").value) || 0;
    const mensal = Number(document.getElementById("meta-mensal").value) || 0;
    const anual = Number(document.getElementById("meta-anual").value) || 0;

    // Validação rápida
    if ([diaria, semanal, mensal, anual].every(v => v === 0)) {
        mostrarPopup("Preencha pelo menos uma meta antes de salvar.");
        return;
    }

    const metas = {
        diaria,
        semanal,
        mensal,
        anual,
        atualizadoEm: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "cfg", "metaVendas"), metas, { merge: true });
        mostrarPopup("Metas salvas com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar metas:", err);
        mostrarPopup("Erro ao salvar metas. Verifique o console.");
    }
});


// 🔹 Carregar metas ao abrir a aba Profile
async function carregarMetasProfile() {
    try {
        const snap = await getDoc(doc(db, "cfg", "metaVendas"));
        if (!snap.exists()) {
            console.warn("Nenhuma meta encontrada no Firestore.");
            return;
        }

        const m = snap.data();
        document.getElementById("meta-diaria").value = m.diaria || "";
        document.getElementById("meta-semanal").value = m.semanal || "";
        document.getElementById("meta-mensal").value = m.mensal || "";
        document.getElementById("meta-anual").value = m.anual || "";

        // Mostra quando foi atualizado pela última vez
        const atualizadoEl = document.getElementById("metas-atualizadas-em");
        if (atualizadoEl && m.atualizadoEm) {
            const data = new Date(m.atualizadoEm).toLocaleString("pt-BR");
            atualizadoEl.textContent = `Última atualização: ${data}`;
        }
    } catch (err) {
        console.error("Erro ao carregar metas:", err);
    }
}

// 🔹 Carrega automaticamente ao entrar na aba Profile
document
    .querySelector('[data-section="profile"]')
    ?.addEventListener("click", carregarMetasProfile);

document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('btnHome');
    if (btn) {
        btn.addEventListener('click', function () {
            window.location.href = 'index.html';
        });
    }
});




document.getElementById("btnPagar")?.addEventListener("click", () => {
    Swal.fire({
        title: "Confirmar pagamento?",
        text: "Você está prestes a renovar sua assinatura por R$ 49,90",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sim, pagar agora",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#3a86ff",
        cancelButtonColor: "#aaa"
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: "Aguarde...",
                text: "Estamos redirecionando para o pagamento seguro do Mercado Pago",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // 🔹 Chama a função centralizada do Mercado Pago
            await abrirCheckout(49.90, "Assinatura SaaS Premium");

            Swal.close(); // Fecha o loading se o redirecionamento não ocorrer
        }
    });
});



// ==========================================================
// 💰 FINANCEIRO — Listener dinâmico e seguro (com debug)
// ==========================================================

onAuthStateChanged(auth, (user) => {
    if (!user) return;

    const navFinanceiro = document.querySelector('[data-section="financeiro"]');

    // 🔹 Quando o usuário abrir a aba "Financeiro"
    navFinanceiro?.addEventListener("click", () => {
        carregarFinanceiro(user);
    });

    // 🔹 E também se já estiver ativa ao carregar
    const sec = document.getElementById("financeiro");
    if (sec && sec.classList.contains("active")) {
        carregarFinanceiro(user);
    }
});

function carregarFinanceiro(user) {

    const ref = doc(db, "assinaturas", user.uid);
    const planoVencimentoEl = document.querySelector(".financeiro-status p");
    const planoStatusEl = document.querySelector(".financeiro-status .status-pill");
    const planoValorEl = document.querySelector(".financeiro-status .valor");

    planoVencimentoEl.textContent = "Carregando informações...";
    planoStatusEl.textContent = "—";
    planoValorEl.textContent = "R$ — / mês";

    onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            planoVencimentoEl.textContent = "Nenhuma assinatura ativa.";
            planoStatusEl.textContent = "Inativo";
            planoStatusEl.className = "status-pill inativo";
            planoValorEl.textContent = "R$ — / mês";
            // Limpa o resumo
            atualizarResumoFinanceiro({});
            return;
        }

        const data = snap.data();
        const venc = new Date(data.vencimento);
        const hoje = new Date();
        const ativo = data.status === "ativo" && venc > hoje;
        const vencFmt = venc.toLocaleDateString("pt-BR");

        planoVencimentoEl.innerHTML = ativo
            ? `Seu plano está ativo até <strong>${vencFmt}</strong>`
            : `Seu plano expirou em <strong>${vencFmt}</strong>`;

        planoStatusEl.textContent = ativo ? "Ativo" : "Vencido";
        planoStatusEl.className = `status-pill ${ativo ? "ativo" : "inativo"}`;
        planoValorEl.textContent = `R$ ${data.valor?.toFixed(2) || "—"} / mês`;

        // 🧩 Atualiza também o resumo detalhado automaticamente
        atualizarResumoFinanceiro(data);
        carregarHistoricoPagamentos(user);
    }, (err) => {
        console.error("❌ Erro ao ler assinatura:", err);
        planoVencimentoEl.textContent = "Erro ao carregar assinatura.";
    });

    // ==========================================================
    // 💳 ATUALIZAÇÃO AUTOMÁTICA — Card "Resumo Financeiro"
    // ==========================================================
    function atualizarResumoFinanceiro(data) {
        // Seletores dos elementos dentro do card
        const ultPagEl = document.querySelector(".financeiro-detalhes .detalhes-grid .detalhe:nth-child(1) strong");
        const proxCobEl = document.querySelector(".financeiro-detalhes .detalhes-grid .detalhe:nth-child(2) strong");
        const statusEl = document.querySelector(".financeiro-detalhes .detalhes-grid .detalhe:nth-child(3) strong");
        const metodoEl = document.querySelector(".financeiro-detalhes .detalhes-grid .detalhe:nth-child(4) strong");

        // Converte datas em formato legível
        const ultPag = data.ultimaAtualizacao ? new Date(data.ultimaAtualizacao).toLocaleDateString("pt-BR") : "—";
        const proxCob = data.vencimento ? new Date(data.vencimento).toLocaleDateString("pt-BR") : "—";

        // Atualiza os elementos do DOM
        if (ultPagEl) ultPagEl.textContent = ultPag;
        if (proxCobEl) proxCobEl.textContent = proxCob;
        if (statusEl) {
            statusEl.textContent = data.status === "ativo" ? "Ativa" : "Inativa";
            statusEl.style.color = data.status === "ativo" ? "var(--ok)" : "var(--danger)";
        }
        if (metodoEl) metodoEl.textContent = data.metodoPagamento || "—";
    }
}

// ==========================================================
// 📜 HISTÓRICO DE PAGAMENTOS — Firestore em tempo real
// ==========================================================
function carregarHistoricoPagamentos(user) {
    const ref = doc(db, "assinaturas", user.uid);
    const tabelaBody = document.getElementById("financeiro-historico-body");

    if (!tabelaBody) return;

    tabelaBody.innerHTML = `
    <tr><td colspan="5" style="text-align:center; color:var(--muted)">⏳ Carregando histórico...</td></tr>
  `;

    onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            tabelaBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color:var(--muted)">Nenhum pagamento encontrado.</td></tr>
      `;
            return;
        }

        const d = snap.data();
        const venc = new Date(d.vencimento).toLocaleDateString("pt-BR");
        const ult = d.ultimaAtualizacao
            ? new Date(d.ultimaAtualizacao).toLocaleDateString("pt-BR")
            : "—";

        tabelaBody.innerHTML = `
      <tr>
        <td>${ult}</td>
        <td>R$ ${d.valor?.toFixed(2) || "—"}</td>
        <td><span class="status-pill ${d.status === "ativo" ? "ativo" : "inativo"}">${d.status}</span></td>
        <td>${d.metodoPagamento || "—"}</td>
        <td><button class="btn-comprovante" disabled>Indisponível</button></td>
      </tr>
    `;
        tabelaBody.innerHTML = `
  <tr>
    <td>${ult}</td>
    <td>R$ ${d.valor?.toFixed(2) || "—"}</td>
    <td><span class="status-pill ${d.status === "ativo" ? "ativo" : "inativo"}">${d.status}</span></td>
    <td>${d.metodoPagamento || "—"}</td>
    <td><button class="btn-comprovante">Baixar</button></td>
  </tr>
`;

        // 🔹 Ao clicar no botão, gera o PDF
        tabelaBody.querySelector(".btn-comprovante")?.addEventListener("click", async () => {
            const user = auth.currentUser;
            const dados = {
                id: user.uid,
                nome: user.displayName || "Usuário",
                email: user.email,
                data: d.ultimaAtualizacao,
                valor: d.valor,
                metodoPagamento: d.metodoPagamento,
                status: d.status,
            };
            gerarComprovantePDF(dados);
        });
    }, (err) => {
        console.error("❌ Erro ao carregar histórico:", err);
        tabelaBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center; color:var(--danger)">Erro ao carregar histórico.</td></tr>
    `;
    });
}


// ==========================================================
// 📄 GERADOR DE COMPROVANTE EMPRESARIAL (PDF PROFISSIONAL)
// ==========================================================
async function gerarComprovantePDF(dados) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    // 🎨 Paleta de cores
    const azul = "#3a86ff";
    const cinza = "#555";
    const linhaY = (y) => doc.line(20, y, 190, y);

    // ========================================================
    // 🧾 CABEÇALHO
    // ========================================================


    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(azul);
    doc.text("COMPROVANTE DE PAGAMENTO", 105, 25, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(cinza);
    doc.text("Emitido automaticamente pelo Sistema SaaS de Gestão", 105, 32, { align: "center" });

    linhaY(37);

    // ========================================================
    // 💳 INFORMAÇÕES DO PAGAMENTO
    // ========================================================
    doc.setFontSize(14);
    doc.setTextColor(azul);
    doc.text("Informações do Pagamento", 20, 50);

    doc.setDrawColor(58, 134, 255);
    doc.roundedRect(18, 54, 174, 70, 4, 4);

    doc.setFontSize(12);
    doc.setTextColor("#000");

    const info = [
        ["Cliente:", dados.nome || "—"],
        ["E-mail:", dados.email || "—"],
        ["Data do Pagamento:", new Date(dados.data).toLocaleDateString("pt-BR")],
        ["Valor:", `R$ ${dados.valor?.toFixed(2) || "—"}`],
        ["Método de Pagamento:", dados.metodoPagamento || "—"],
        ["Status:", dados.status?.toUpperCase() || "—"],
        ["Código da Transação:", dados.id || "—"]
    ];

    let y = 64;
    info.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 25, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, 90, y);
        y += 10;
    });

    // ========================================================
    // 🟢 STATUS VISUAL (SEM EMOJIS)
    // ========================================================
    const pago = dados.status?.toLowerCase() === "ativo" || dados.status?.toLowerCase() === "pago";
    const statusTexto = pago ? "PAGO" : "PENDENTE";
    const statusColor = pago ? "#00b894" : "#e74c3c";

    // Fundo do selo
    doc.setFillColor(statusColor);
    doc.roundedRect(140, 122, 50, 12, 3, 3, "F");

    // Texto centralizado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor("#ffffff");
    doc.text(statusTexto, 165, 130, { align: "center" });

    // ========================================================
    // 📱 QR CODE (Verificação)
    // ========================================================
    try {
        const qrData = `https://seusite.com/comprovante/${dados.id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;
        const qrImg = await fetch(qrUrl)
            .then(r => r.blob())
            .then(b => URL.createObjectURL(b));

        doc.addImage(qrImg, "PNG", 30, 135, 40, 40);
        doc.setTextColor(cinza);
        doc.setFontSize(10);
        doc.text("Verifique o comprovante online", 50, 182, { align: "center" });
    } catch {
        console.warn("⚠️ Falha ao gerar QR Code.");
    }

    // ========================================================
    // 🧠 HASH DE AUTENTICAÇÃO
    // ========================================================
    const autenticidade = btoa(`${dados.id}-${dados.data}`).substring(0, 10);
    doc.setFontSize(9);
    doc.setTextColor("#666");
    doc.text(`Código de autenticação: ${autenticidade}`, 105, 188, { align: "center" });

    // ========================================================
    // 🧾 RODAPÉ
    // ========================================================
    linhaY(260);
    doc.setFontSize(10);
    doc.setTextColor(cinza);
    doc.text("Emitido por: Sistema SaaS de Gestão Empresarial", 105, 267, { align: "center" });
    doc.text(`Data de emissão: ${new Date().toLocaleString("pt-BR")}`, 105, 273, { align: "center" });
    doc.setTextColor(azul);
    doc.text("www.sistemasaas.com.br", 105, 279, { align: "center" });

    // ========================================================
    // 💾 SALVAR PDF
    // ========================================================
    const nomeArquivo = `Comprovante-${dados.id || "Pagamento"}.pdf`;
    doc.save(nomeArquivo);
}

// Quando a página carregar → ativa listener em tempo real
window.addEventListener("DOMContentLoaded", () => {
    iniciarListenerVendas();
});

window.addEventListener("DOMContentLoaded", gerarDashboard);
