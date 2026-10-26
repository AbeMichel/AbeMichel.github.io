document.addEventListener('DOMContentLoaded', () => {
    let debounceTimer = null;
    let currentShareUrl = '';
    const touchedFields = new Set();

    const preview = document.getElementById('preview-area');
    const nameEl = preview.querySelector('.name');
    const subEl = preview.querySelector('.name-subcontent');
    const titleInfoEl = preview.querySelector('.title-info');
    const imgEl = preview.querySelector('.profile-img');
    const imgContainer = preview.querySelector('.profile-img-container');
    const btnContainer = preview.querySelector('.buttons');
    const reorderList = document.getElementById('reorder-list');

    const copyBtn = document.getElementById('copy-btn');
    const previewLink = document.getElementById('preview-link');

    // Default sample values for initial preview
    const defaults = {
        name: 'John Doe',
        title: 'title, company',
        photo: '../../Assets/MeteoraPic.jpg',
        buttons: {
            contact: 'Add Contact',
            phone: '+1 (555) 555-5555',
            email: 'johndoe@example.com',
            website: 'www.example.com',
            address: '1234 Example Ave, EX, 12345'
        }
    };

    const defaultColors = {
        bg: '#f3f4f6',
        cd: '#ffffff',
        pr: '#007aff',
        bt: '#ffffff',
        tp: '#111827',
        ts: '#6b7280'
    };

    const varMap = {
        '--bg-color': 'bg',
        '--card-bg': 'cd',
        '--primary-color': 'pr',
        '--btn-text': 'bt',
        '--text-primary': 'tp',
        '--text-secondary': 'ts'
    };

    // Resolves link to BusinessCard/index.html#hash from any /Create path
    function getCardPageUrl(hash) {
        const url = new URL(window.location.href);
        const match = url.pathname.match(/^(.*)\/create(?:\/.*)?$/i);
        let basePath = match ? match[1] : url.pathname;
        if (!basePath.endsWith('/')) basePath += '/';
        url.pathname = basePath + 'index.html';
        url.hash = hash || '';
        return url.href;
    }

    // URL Validation Helper
    function isValidUrl(str) {
        if (!str || !str.trim()) return true;
        str = str.trim();
        if (str.startsWith('./') || str.startsWith('../') || str.startsWith('/')) {
            return true;
        }
        try {
            const withProtocol = str.includes('://') ? str : `https://${str}`;
            const url = new URL(withProtocol);
            return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
        } catch {
            return false;
        }
    }

    // Image Compression: resizes to max 120px and compresses as JPEG
    function compressImageFile(file, maxSize = 120, quality = 0.5) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round((height * maxSize) / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round((width * maxSize) / height);
                            height = maxSize;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 1. Details Section (Name & Subtitle)
    const toggleDetails = document.getElementById('toggle-details');
    const nameInput = document.getElementById('input-name');
    const titleInput = document.getElementById('input-title');

    function updateDetails() {
        const enabled = toggleDetails.checked;
        const nameVal = nameInput.value.trim();
        const titleVal = titleInput.value.trim();

        nameInput.disabled = !enabled;
        titleInput.disabled = !enabled;

        if (!enabled) {
            titleInfoEl.style.display = 'none';
            CardCodec.updateSeparator(preview);
            scheduleHashUpdate();
            return;
        }

        if (touchedFields.has('name')) {
            nameEl.textContent = nameVal ? nameInput.value : '';
            nameEl.style.display = nameVal ? '' : 'none';
        } else {
            nameEl.textContent = defaults.name;
            nameEl.style.display = '';
        }

        if (touchedFields.has('title')) {
            subEl.textContent = titleVal ? titleInput.value : '';
            subEl.style.display = titleVal ? '' : 'none';
        } else {
            subEl.textContent = defaults.title;
            subEl.style.display = '';
        }

        titleInfoEl.style.display = (nameEl.style.display !== 'none' || subEl.style.display !== 'none') ? '' : 'none';

        CardCodec.updateSeparator(preview);
        scheduleHashUpdate();
    }

    toggleDetails.addEventListener('change', () => {
        touchedFields.add('detailsToggle');
        updateDetails();
    });

    nameInput.addEventListener('input', () => {
        touchedFields.add('name');
        updateDetails();
    });

    titleInput.addEventListener('input', () => {
        touchedFields.add('title');
        updateDetails();
    });

    // 2. Photo Section
    const togglePhoto = document.getElementById('toggle-photo');
    const fileInput = document.getElementById('img-file');
    const urlInput = document.getElementById('img-url');
    const urlError = document.getElementById('img-url-error');
    let uploadedCompressedDataUrl = null;

    function updatePhoto() {
        const enabled = togglePhoto.checked;
        const urlVal = urlInput.value.trim();
        fileInput.disabled = !enabled;
        urlInput.disabled = !enabled;

        if (!enabled) {
            imgContainer.style.display = 'none';
            CardCodec.updateSeparator(preview);
            scheduleHashUpdate();
            return;
        }

        if (uploadedCompressedDataUrl) {
            urlInput.classList.remove('invalid');
            urlError.classList.remove('visible');
            imgEl.src = uploadedCompressedDataUrl;
            imgContainer.style.display = '';
        } else if (touchedFields.has('photo')) {
            if (urlVal) {
                if (isValidUrl(urlVal)) {
                    urlInput.classList.remove('invalid');
                    urlError.classList.remove('visible');
                    const normalized = CardCodec.normalizeImageUrl(
                        (urlVal.startsWith('.') || urlVal.startsWith('/') || urlVal.includes('://'))
                            ? urlVal
                            : `https://${urlVal}`
                    );
                    imgEl.src = normalized;
                    imgContainer.style.display = '';
                } else {
                    urlInput.classList.add('invalid');
                    urlError.textContent = 'Please enter a valid URL (e.g. https://example.com/pic.jpg)';
                    urlError.classList.add('visible');
                    imgContainer.style.display = 'none';
                }
            } else {
                urlInput.classList.remove('invalid');
                urlError.classList.remove('visible');
                imgContainer.style.display = 'none';
            }
        } else {
            imgEl.src = defaults.photo;
            imgContainer.style.display = '';
        }

        CardCodec.updateSeparator(preview);
        scheduleHashUpdate();
    }

    imgEl.onerror = () => {
        if (imgEl.src && imgContainer.style.display !== 'none' && touchedFields.has('photo')) {
            urlInput.classList.add('invalid');
            urlError.textContent = 'Image failed to load. Make sure the URL points directly to an image.';
            urlError.classList.add('visible');
        }
    };

    imgEl.onload = () => {
        if (imgContainer.style.display !== 'none') {
            urlInput.classList.remove('invalid');
            urlError.classList.remove('visible');
        }
    };

    togglePhoto.addEventListener('change', () => {
        touchedFields.add('photo');
        updatePhoto();
    });

    fileInput.addEventListener('change', async e => {
        touchedFields.add('photo');
        const file = e.target.files[0];
        uploadedCompressedDataUrl = file ? await compressImageFile(file, 120, 0.5) : null;
        if (uploadedCompressedDataUrl) urlInput.value = '';
        updatePhoto();
    });

    urlInput.addEventListener('input', () => {
        touchedFields.add('photo');
        if (uploadedCompressedDataUrl) {
            uploadedCompressedDataUrl = null;
            fileInput.value = '';
        }
        updatePhoto();
    });

    // 3. Theme Colors
    function toHex(colorStr) {
        if (!colorStr) return '#000000';
        colorStr = colorStr.trim();
        if (colorStr.startsWith('#')) {
            return colorStr.length === 4
                ? '#' + colorStr[1] + colorStr[1] + colorStr[2] + colorStr[2] + colorStr[3] + colorStr[3]
                : colorStr;
        }
        const rgb = colorStr.match(/\d+/g);
        return rgb && rgb.length >= 3
            ? '#' + rgb.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('')
            : '#000000';
    }

    const computedStyles = getComputedStyle(preview);

    document.querySelectorAll('input[data-var]').forEach(picker => {
        const varName = picker.dataset.var;
        const initialVal = computedStyles.getPropertyValue(varName);
        if (initialVal) picker.value = toHex(initialVal);

        picker.addEventListener('input', e => {
            preview.style.setProperty(varName, e.target.value);
            scheduleHashUpdate();
        });
    });

    // 4. Buttons Reordering & Content
    document.querySelectorAll('.reorder-item').forEach(item => {
        const id = item.dataset.id;
        const cardBtn = btnContainer.querySelector(`#${id}`);
        const toggle = item.querySelector('.btn-toggle');
        const textInput = item.querySelector('.btn-val-input');
        const errorMsg = item.querySelector('.error-msg');
        const btnText = cardBtn ? cardBtn.querySelector('.btn-text') : null;

        function updateButton() {
            if (!cardBtn) return;
            const enabled = toggle.checked;
            item.classList.toggle('disabled', !enabled);

            if (id === 'contact') {
                cardBtn.style.display = enabled ? '' : 'none';
                if (btnText) btnText.textContent = 'Add Contact';
                CardCodec.updateSeparator(preview);
                scheduleHashUpdate();
                return;
            }

            if (!textInput) return;
            const val = textInput.value.trim();
            textInput.disabled = !enabled;

            if (!enabled) {
                cardBtn.style.display = 'none';
                CardCodec.updateSeparator(preview);
                scheduleHashUpdate();
                return;
            }

            if (touchedFields.has(id)) {
                if (id === 'website') {
                    if (val && !isValidUrl(val)) {
                        textInput.classList.add('invalid');
                        if (errorMsg) {
                            errorMsg.textContent = 'Please enter a valid URL (e.g. https://example.com)';
                            errorMsg.classList.add('visible');
                        }
                        cardBtn.style.display = 'none';
                        CardCodec.updateSeparator(preview);
                        scheduleHashUpdate();
                        return;
                    } else {
                        textInput.classList.remove('invalid');
                        if (errorMsg) errorMsg.classList.remove('visible');
                    }
                }

                if (!val) {
                    cardBtn.style.display = 'none';
                } else {
                    cardBtn.style.display = '';
                    if (btnText) btnText.textContent = textInput.value;
                }
            } else {
                cardBtn.style.display = '';
                if (btnText) btnText.textContent = defaults.buttons[id] || '';
            }

            CardCodec.updateSeparator(preview);
            scheduleHashUpdate();
        }

        toggle.addEventListener('change', () => {
            touchedFields.add(id);
            updateButton();
        });

        if (textInput) {
            textInput.addEventListener('input', () => {
                touchedFields.add(id);
                updateButton();
            });
        }

        updateButton();
    });

    // Drag and Drop (reorder)
    let dragged = null;

    reorderList.addEventListener('dragstart', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
            e.preventDefault();
            return;
        }
        dragged = e.target.closest('li');
        e.dataTransfer.effectAllowed = 'move';
    });

    reorderList.addEventListener('dragover', e => {
        e.preventDefault();
        const target = e.target.closest('li');
        if (target && target !== dragged) {
            const rect = target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            reorderList.insertBefore(dragged, next ? target.nextSibling : target);
            syncButtons();
        }
    });

    function syncButtons() {
        [...reorderList.children].forEach(li => {
            const btn = btnContainer.querySelector(`#${li.dataset.id}`);
            if (btn) btnContainer.appendChild(btn);
        });
        CardCodec.updateSeparator(preview);
        scheduleHashUpdate();
    }

    // 5. Payload Generation & Hash Compression
    function buildPayload() {
        const payload = {};

        // Name & Title
        if (toggleDetails.checked) {
            const nameVal = nameInput.value.trim();
            const titleVal = titleInput.value.trim();

            payload.n = touchedFields.has('name') ? (nameVal || undefined) : defaults.name;
            payload.t = touchedFields.has('title') ? (titleVal || undefined) : defaults.title;
            if (!payload.n) delete payload.n;
            if (!payload.t) delete payload.t;
        }

        // Photo
        if (togglePhoto.checked) {
            if (uploadedCompressedDataUrl) {
                payload.i = uploadedCompressedDataUrl;
            } else if (touchedFields.has('photo')) {
                const u = urlInput.value.trim();
                if (u && isValidUrl(u)) payload.i = CardCodec.normalizeImageUrl(u);
            } else {
                payload.i = defaults.photo;
            }
        }

        // Theme Colors (only customized non-defaults)
        const customColors = {};
        document.querySelectorAll('input[data-var]').forEach(picker => {
            const key = varMap[picker.dataset.var];
            const hex = picker.value.toLowerCase();
            if (key && hex !== defaultColors[key]) customColors[key] = hex;
        });
        if (Object.keys(customColors).length > 0) payload.c = customColors;

        // Active Buttons
        const buttons = [];
        [...reorderList.children].forEach(li => {
            const id = li.dataset.id;
            const toggle = li.querySelector('.btn-toggle');
            if (!toggle || !toggle.checked) return;

            if (id === 'contact') {
                buttons.push(['contact', 'Add Contact']);
                return;
            }

            const input = li.querySelector('.btn-val-input');
            const val = input ? input.value.trim() : '';

            if (touchedFields.has(id)) {
                if (val) {
                    if (id === 'website' && !isValidUrl(val)) return;
                    buttons.push([id, input.value]);
                }
            } else {
                buttons.push([id, defaults.buttons[id]]);
            }
        });

        if (buttons.length > 0) payload.b = buttons;
        return payload;
    }

    function scheduleHashUpdate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateShareHash, 100);
    }

    async function updateShareHash() {
        if (!window.CardCodec) return;
        const payload = buildPayload();
        const hash = await CardCodec.compress(payload);

        currentShareUrl = getCardPageUrl(hash);
        if (previewLink) previewLink.href = currentShareUrl;
    }

    // Copy Button Interaction
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (!currentShareUrl) await updateShareHash();
            try {
                await navigator.clipboard.writeText(currentShareUrl);
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '✓ Copied Link!';
                setTimeout(() => (copyBtn.innerHTML = originalText), 2000);
            } catch (err) {
                const tempInput = document.createElement('input');
                tempInput.value = currentShareUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                copyBtn.innerHTML = '✓ Copied Link!';
                setTimeout(() => (copyBtn.innerHTML = '📋 Copy Shareable Link'), 2000);
            }
        });
    }

    // 6. Interactive "Add Contact" Click in Preview
    const previewContactBtn = preview.querySelector('#contact');
    if (previewContactBtn) {
        previewContactBtn.addEventListener('click', () => {
            if (window.CardCodec) {
                CardCodec.downloadVCard(CardCodec.getCardInfo(preview));
            }
        });
    }

    // 7. Initialize clean state (ensure inputs are empty, no stale hash in URL)
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }
    nameInput.value = '';
    titleInput.value = '';
    urlInput.value = '';
    document.querySelectorAll('.btn-val-input').forEach(input => (input.value = ''));

    updateDetails();
    updatePhoto();
});
