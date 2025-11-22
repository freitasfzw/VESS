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
    popup.className = "popup-alert popup-show";
    popup.textContent = msg;

    document.body.appendChild(popup);

    // Remove suavemente
    setTimeout(() => {
        popup.classList.remove("popup-show");
        popup.classList.add("popup-hide");
        setTimeout(() => popup.remove(), 400);
    }, 2200);
}
