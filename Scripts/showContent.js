const contentContainer = document.querySelector('.content-container');
const content = document.querySelector('.content');
const logo = document.querySelector('.logo');
const overlay = document.querySelector('.background-overlay');
const buttons = document.querySelectorAll('.menu-container button');

let lastButton = null;
let isContentOpen = false;
let isTransitioning = false;
const contentPath = '../Content/';

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
    
    const filePath = contentPath + section + '.html';
    
    if (!filePath) {
        content.innerHTML = '<p>Content not found.</p>';
        return;
    }
    
    try {
        // Show loading state
        content.innerHTML = '<p>Loading...</p>';
        
        // Fetch the HTML file
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

buttons.forEach(button => {
    // Use both click and touch events for better mobile support
    const handleInteraction = () => {
        if (isTransitioning) return;
        
        const same = lastButton === button;

        if (same) {
            button.classList.remove("selected");
            contentContainer.classList.remove("shown");
            overlay.classList.remove("active");
            logo.classList.remove("hidden");
            lastButton = null;
            isContentOpen = false;
        } else {
            if (isContentOpen) {
                blurFadeTransition(button);
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
    };
    
    button.addEventListener('click', handleInteraction);
});

// Handle viewport resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // Adjust content container if it's open
        if (isContentOpen) {
            // Force a reflow to ensure proper sizing
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