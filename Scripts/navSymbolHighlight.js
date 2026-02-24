document.addEventListener("DOMContentLoaded", () => {
    const navHighlightedClass = "highlighted";
    const navNotHighlightedClass = "not-highlighted";
    const navOptions = document.querySelectorAll(".nav-btn");

    navOptions.forEach((btn) => {
        btn.addEventListener("mouseenter", () => {
            navOptions.forEach((otherBtn) => {
                const isActive = otherBtn === btn;
                if (isActive){
                    otherBtn.classList.add(navHighlightedClass);
                    otherBtn.classList.remove(navNotHighlightedClass);
                } else {
                    otherBtn.classList.remove(navHighlightedClass);
                    otherBtn.classList.add(navNotHighlightedClass);
                }
            });
        });
        btn.addEventListener("mouseleave", () => {
            navOptions.forEach((otherBtn) => {
                otherBtn.classList.remove(navHighlightedClass);
                otherBtn.classList.remove(navNotHighlightedClass);
            });
        });
    });
});
