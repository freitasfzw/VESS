export const state = {
    produtos: [],
    caixa: [],
    vendas: [],
    fechamentos: [],
    cfg: {},
    caixaStatus: {}
};

export function mostrarPopup(msg) {
    const popup = document.createElement("div");
    popup.className = "popup-alert";
    popup.textContent = msg;

    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 2500);
}
