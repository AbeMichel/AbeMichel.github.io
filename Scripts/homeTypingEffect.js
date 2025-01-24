function typeText(element, delay) {
    return new Promise((resolve) => {
        if (element == null) return resolve();

        const text = element.textContent;
        element.textContent = "\u00A0";
        element.classList.remove('hidden');

        if (!text) return;

        let index = 0;

        const typingInterval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
            } else {
                clearInterval(typingInterval);
                resolve();
            }
        }, delay);
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.onload = async function() {
    const typingTargets = document.getElementsByClassName('typed');

    for (const target of typingTargets) {
        target.classList.add('hidden');
    }
    await delay(1700);
    var i = 0;
    for (const target of typingTargets) {
        await typeText(target, 75); // Wait for each target to finish typing
    }
};
