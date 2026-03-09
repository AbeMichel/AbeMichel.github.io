document.addEventListener("DOMContentLoaded", () => {
    const setupHighlightGroup = (selector) => {
        const highlightedClass = "highlighted";
        const notHighlightedClass = "not-highlighted";
        const options = document.querySelectorAll(selector);

        options.forEach((el) => {
            el.addEventListener("mouseenter", () => {
                options.forEach((otherEl) => {
                    if (otherEl === el) {
                        otherEl.classList.add(highlightedClass);
                        otherEl.classList.remove(notHighlightedClass);
                    } else {
                        otherEl.classList.remove(highlightedClass);
                        otherEl.classList.add(notHighlightedClass);
                    }
                });
            });
            el.addEventListener("mouseleave", () => {
                options.forEach((otherEl) => {
                    otherEl.classList.remove(highlightedClass);
                    otherEl.classList.remove(notHighlightedClass);
                });
            });
        });
    };

    setupHighlightGroup(".nav-btn");
    setupHighlightGroup(".sidebar .icon");
});
