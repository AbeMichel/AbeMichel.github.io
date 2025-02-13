const COLLAPSIBLE_CLASS = ".collapsible-section";
const BUTTON_CLASS = ".collapsible-button";
const CONTENT_CLASS = ".collapsible-content";

function setupCollapsible(el) {
    if (!el) return;
    const button = el.querySelector(BUTTON_CLASS);
    const content = button.nextElementSibling;
    if (!button || !content) return;
    button.addEventListener('click', (_) => {
        content.style.display = (content.style.display === "block") ? "none" : "block";
    });

}

document.addEventListener('DOMContentLoaded', () => {
    const collapsibles = document.querySelectorAll(COLLAPSIBLE_CLASS);
    collapsibles.forEach(el => {
        setupCollapsible(el);
    });
});
