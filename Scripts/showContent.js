const contentContainer = document.querySelector('.content-container');
const content = document.querySelector('.content');
const logo = document.querySelector('.logo');
const overlay = document.querySelector('.background-overlay');
const buttons = document.querySelectorAll('.menu-container button');

let lastButton = null;
let isContentOpen = false;
let isTransitioning = false;
const contentPath = 'Content/';

// Detect if user is on mobile
const isMobile = window.matchMedia("(max-width: 768px)").matches;

function blurFadeTransition(button) {
    if (isTransitioning) return;
    contentContainer.classList.add('faded');
    isTransitioning = true;
    
    // Shorter transition on mobile for better performance
    const transitionTime = isMobile ? 300 : 400;
    
    setTimeout(() => {
        loadContent(button.dataset.section);
        contentContainer.classList.remove('faded');
        isTransitioning = false;
    }, transitionTime);
}

async function loadContent(section) {
    content.scrollTop = 0;
    const filePath = `${contentPath}${section}.html`;
    try {
        content.innerHTML = '<p>Loading...</p>';
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading content:', error);
        content.innerHTML = `
            <h2>Error Loading Content</h2>
            <p>Sorry, we couldn't load the ${section} content. Please try again later.</p>
        `;
    }
}

function openSection(button) {
    if (isTransitioning) return;

    if (isContentOpen) {
        if (lastButton !== button) {
            blurFadeTransition(button);
        }
    } else {
        loadContent(button.dataset.section);
        contentContainer.classList.add("shown");
        overlay.classList.add("active");
        logo.classList.add("hidden");
        isContentOpen = true;
    }
    
    lastButton?.classList.remove("selected");
    button.classList.add("selected");
    lastButton = button;
}

function closeContent() {
    if (isTransitioning || !isContentOpen) return;
    
    if (lastButton) {
        lastButton.classList.remove("selected");
    }
    contentContainer.classList.remove("shown");
    overlay.classList.remove("active");
    logo.classList.remove("hidden");
    lastButton = null;
    isContentOpen = false;
}

function handleHashChange() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const button = Array.from(buttons).find(b => b.dataset.section === hash);
        if (button) {
            openSection(button);
        } else {
            closeContent();
        }
    } else {
        closeContent();
    }
}

buttons.forEach(button => {
    button.addEventListener('click', () => {
        if (isTransitioning) return;
        
        const section = button.dataset.section;
        if (window.location.hash === '#' + section) {
            // Remove hash and add to history
            history.pushState("", document.title, window.location.pathname + window.location.search);
            handleHashChange();
        } else {
            window.location.hash = section;
        }
    });
});

// Close content when clicking outside
document.addEventListener('click', (event) => {
    if (isContentOpen && !isTransitioning) {
        const isClickInsideContent = contentContainer.contains(event.target);
        const isClickOnButton = Array.from(buttons).some(button => button.contains(event.target));
        const sidebar = document.querySelector('.sidebar');
        const isClickOnSidebar = sidebar && sidebar.contains(event.target);
        
        if (!isClickInsideContent && !isClickOnButton && !isClickOnSidebar) {
            // Remove hash and add to history
            history.pushState("", document.title, window.location.pathname + window.location.search);
            handleHashChange();
        }
    }
});

// Initialize and listen for changes
window.addEventListener('hashchange', handleHashChange);
window.addEventListener('popstate', handleHashChange);
window.addEventListener('load', handleHashChange);

// Handle viewport resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (isContentOpen) {
            contentContainer.style.display = 'none';
            contentContainer.offsetHeight; // Trigger reflow
            contentContainer.style.display = '';
        }
    }, 250);
});

// Prevent zoom on double-tap for iOS devices
if (isMobile) {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}
