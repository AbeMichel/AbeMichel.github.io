/**
 * Shared Utilities & Codec for Business Card
 * Handles URL hash compression, vCard 3.0 generation, image normalization, and DOM card inspection.
 */
const CardCodec = {
    // Compress data object to URL-safe base64 string
    async compress(data) {
        try {
            const json = JSON.stringify(data);
            const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
            const buffer = await new Response(stream).arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (err) {
            console.error('Compression error:', err);
            return '';
        }
    },

    // Decompress URL-safe base64 string back to data object
    async decompress(hash) {
        if (!hash) return null;
        try {
            const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
            if (!cleanHash) return null;

            let b64 = cleanHash.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            const text = await new Response(stream).text();
            return JSON.parse(text);
        } catch (err) {
            console.warn('Decompression error or invalid hash:', err);
            return null;
        }
    },

    // Auto-convert GitHub blob web page URLs into direct raw image URLs
    normalizeImageUrl(url) {
        if (!url) return '';
        url = url.trim();
        const ghBlobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
        return ghBlobMatch
            ? `https://raw.githubusercontent.com/${ghBlobMatch[1]}/${ghBlobMatch[2]}/${ghBlobMatch[3]}`
            : url;
    },

    // Extracts currently visible content from card DOM
    getCardInfo(container = document) {
        const nameEl = container.querySelector('.name');
        const subEl = container.querySelector('.name-subcontent');
        const imgEl = container.querySelector('.profile-img');
        const imgContainer = container.querySelector('.profile-img-container');

        function getBtnText(btnId) {
            const btn = container.querySelector(`#${btnId}`);
            if (!btn || btn.style.display === 'none') return '';
            return btn.querySelector('.btn-text')?.textContent?.trim() || '';
        }

        return {
            name: (nameEl && nameEl.style.display !== 'none') ? nameEl.textContent.trim() : '',
            title: (subEl && subEl.style.display !== 'none') ? subEl.textContent.trim() : '',
            photo: (imgContainer && imgContainer.style.display !== 'none' && imgEl?.src) ? imgEl.src : '',
            phone: getBtnText('phone'),
            email: getBtnText('email'),
            website: getBtnText('website'),
            address: getBtnText('address')
        };
    },

    // Toggles separator line visibility based on whether both photo and info/buttons are visible
    updateSeparator(container = document) {
        const imgContainer = container.querySelector('.profile-img-container');
        const titleInfoEl = container.querySelector('.title-info');
        const btnContainer = container.querySelector('.buttons');
        const separatorEl = container.querySelector('.separator');

        if (!separatorEl) return;

        const photoVisible = imgContainer && imgContainer.style.display !== 'none';
        const infoVisible = titleInfoEl && titleInfoEl.style.display !== 'none';
        const hasVisibleButtons = btnContainer
            ? [...btnContainer.children].some(btn => btn.style.display !== 'none')
            : false;
        const rightSideVisible = infoVisible || hasVisibleButtons;

        separatorEl.style.display = (photoVisible && rightSideVisible) ? '' : 'none';
    },

    // Generates standard vCard 3.0 (.vcf) formatted string
    generateVCard(info) {
        const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

        if (info.name && info.name.trim()) {
            lines.push(`FN:${info.name.trim()}`);
            const parts = info.name.trim().split(/\s+/);
            if (parts.length > 1) {
                const last = parts.pop();
                const first = parts.join(' ');
                lines.push(`N:${last};${first};;;`);
            } else {
                lines.push(`N:${info.name.trim()};;;;`);
            }
        }

        if (info.title && info.title.trim()) {
            if (info.title.includes(',')) {
                const [t, o] = info.title.split(',').map(s => s.trim());
                if (t) lines.push(`TITLE:${t}`);
                if (o) lines.push(`ORG:${o}`);
            } else {
                lines.push(`TITLE:${info.title.trim()}`);
            }
        }

        if (info.phone && info.phone.trim()) {
            lines.push(`TEL;TYPE=CELL,VOICE:${info.phone.trim()}`);
        }

        if (info.email && info.email.trim()) {
            lines.push(`EMAIL;TYPE=INTERNET,PREF:${info.email.trim()}`);
        }

        if (info.website && info.website.trim()) {
            const url = info.website.trim();
            const fullUrl = url.includes('://') ? url : `https://${url}`;
            lines.push(`URL:${fullUrl}`);
        }

        if (info.address && info.address.trim()) {
            lines.push(`ADR;TYPE=WORK:;;${info.address.trim()};;;;`);
        }

        if (info.photo && info.photo.trim()) {
            const p = info.photo.trim();
            if (p.startsWith('data:image/')) {
                const match = p.match(/^data:image\/(\w+);base64,(.+)$/);
                if (match) {
                    lines.push(`PHOTO;ENCODING=b;TYPE=${match[1].toUpperCase()}:${match[2]}`);
                }
            } else if (p.startsWith('http')) {
                lines.push(`PHOTO;VALUE=URI:${p}`);
            }
        }

        lines.push('END:VCARD');
        return lines.join('\r\n');
    },

    // Downloads the generated .vcf file
    downloadVCard(info) {
        const vcf = this.generateVCard(info);
        const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (info.name || 'contact').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${filename}.vcf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
};

if (typeof window !== 'undefined') {
    window.CardCodec = CardCodec;
}
if (typeof globalThis !== 'undefined') {
    globalThis.CardCodec = CardCodec;
}
