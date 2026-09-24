document.addEventListener('click', (e) => {
    const el = e.target.closest('.spin-on-click');
    if (!el) return;

    el.classList.remove('coin-spin');

    void el.offsetWidth;

    el.classList.add('coin-spin');
});