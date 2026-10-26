document.addEventListener('DOMContentLoaded', async () => {
    const hash = window.location.hash;
    const nameEl = document.querySelector('.name');
    const subEl = document.querySelector('.name-subcontent');
    const titleInfoEl = document.querySelector('.title-info');
    const imgEl = document.querySelector('.profile-img');
    const imgContainer = document.querySelector('.profile-img-container');
    const btnContainer = document.querySelector('.buttons');

    // 1. Populate from URL Hash if provided
    if (hash && hash.length > 1 && window.CardCodec) {
        const data = await CardCodec.decompress(hash);
        if (data) {
            // Text Info
            nameEl.textContent = data.n?.trim() || '';
            nameEl.style.display = data.n?.trim() ? '' : 'none';

            subEl.textContent = data.t?.trim() || '';
            subEl.style.display = data.t?.trim() ? '' : 'none';

            titleInfoEl.style.display = (data.n?.trim() || data.t?.trim()) ? '' : 'none';

            // Photo
            if (data.i && data.i.trim()) {
                imgEl.src = CardCodec.normalizeImageUrl(data.i);
                imgContainer.style.display = '';
            } else {
                imgContainer.style.display = 'none';
            }

            // Theme Colors
            if (data.c) {
                const varMap = {
                    bg: '--bg-color',
                    cd: '--card-bg',
                    pr: '--primary-color',
                    bt: '--btn-text',
                    tp: '--text-primary',
                    ts: '--text-secondary'
                };
                for (const [key, varName] of Object.entries(varMap)) {
                    if (data.c[key]) {
                        document.documentElement.style.setProperty(varName, data.c[key]);
                    }
                }
            }

            // Buttons (hide all first, reveal and reorder active buttons)
            btnContainer.querySelectorAll('.card-btn').forEach(btn => (btn.style.display = 'none'));

            if (Array.isArray(data.b)) {
                data.b.forEach(([id, text]) => {
                    const btn = btnContainer.querySelector(`#${id}`);
                    if (btn) {
                        const btnText = btn.querySelector('.btn-text');
                        const label = (id === 'contact') ? 'Add Contact' : text;
                        if (btnText) btnText.textContent = label;
                        btn.style.display = '';
                        btnContainer.appendChild(btn);
                    }
                });
            }

            CardCodec.updateSeparator(document);
        }
    }

    // 2. Interactive Click Actions
    btnContainer.addEventListener('click', e => {
        const btn = e.target.closest('.card-btn');
        if (!btn) return;
        const text = btn.querySelector('.btn-text')?.textContent?.trim() || '';

        switch (btn.id) {
            case 'contact':
                if (window.CardCodec) {
                    CardCodec.downloadVCard(CardCodec.getCardInfo(document));
                }
                break;
            case 'phone':
                if (text) window.location.href = `tel:${text.replace(/[^0-9+]/g, '')}`;
                break;
            case 'email':
                if (text) window.location.href = `mailto:${text}`;
                break;
            case 'website':
                if (text) window.open(text.includes('://') ? text : `https://${text}`, '_blank');
                break;
            case 'address':
                if (text) window.open(`https://maps.google.com/?q=${encodeURIComponent(text)}`, '_blank');
                break;
        }
    });
});
