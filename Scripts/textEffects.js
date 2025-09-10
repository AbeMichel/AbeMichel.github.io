/**
 * An array of CSS classes that should be passed from the parent element
 * to the individual character <span> tags.
 */
const classesToPropagate = [
    'text-shadow',
    // You can add other classes here in the future, e.g., 'highlight'
];

/**
 * A generic function that splits the text content of elements matching a selector
 * into individual <span> tags for each character.
 *
 * @param {string} selector - The CSS selector for the elements to process.
 * @param {object} options - An object to configure the behavior.
 * @param {boolean} options.animate - If true, adds a staggered animation delay.
 * @param {number} options.delayIncrement - The delay increase for each character.
 */
function splitText(selector, options = {}) {
    const textElements = document.querySelectorAll(selector);

    textElements.forEach(element => {
        splitTextDirect(element, options);
    });
}

function splitTextDirect(element, options = {}){
    // Get the list of classes from the original element that we want to pass down.
        const elementClasses = Array.from(element.classList);
        const propagatedClasses = classesToPropagate
            .filter(propClass => elementClasses.includes(propClass))
            .join(' ');
        
        const text = element.textContent;
        let newHTML = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i] === ' ' ? '&nbsp;' : text[i];
            
            // Start building the new <span> tag
            let spanTag = '<span';

            // 1. Add the propagated classes, if any exist.
            if (propagatedClasses) {
                spanTag += ` class="${propagatedClasses}"`;
            }

            // 2. Add animation delay style, if requested.
            if (options.animate && options.delayIncrement) {
                spanTag += ` style="animation-delay: ${i * options.delayIncrement}s"`;
            }

            // 3. Close the tag and add the character.
            spanTag += `>${char}</span>`;
            newHTML += spanTag;
        }
        element.innerHTML = newHTML;
}


// --- Script Execution ---
// Ensure the script runs after the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    // Apply the bouncy effect with animation.
    splitText('.bouncy-text', {
        animate: true,
        delayIncrement: 0.1
    });

    // Apply a simple split to other elements if needed (no animation).
    splitText('.split-text');
});


let isTransitioning = false;
async function coverAndChange(filepath, pageTitle){
    if (isTransitioning) return;
    isTransitioning = true;

    const targetContainer = document.getElementById('content-target');
    const cover = document.getElementById('content-header');

    // Extract html from filepath

    // Cover the box
    cover.classList.add('cover');
    
    // Wait for 1s
    await new Promise(resolve => setTimeout(resolve, 1000));
    cover.innerHTML = "";
    cover.textContent = pageTitle;

    // Replace html content of targetContainer
    try {
        const response = await fetch(filepath);
        if (!response.ok){
            throw new Error(`Failed to fetch content: ${response.statusText}`);
        }
        const newHtmlContent = await response.text();
        targetContainer.innerHTML = newHtmlContent;

    } catch (error) {
        console.error("Error loading content:", error);
        targetContainer.innerHTML = `<p style="text-align: center;">Sorry, there was an error loading the content.</p>`;
    }

    // Wait for .1s
    // await new Promise(resolve => setTimeout(resolve, 100))
    splitTextDirect(cover, {
        animate: true,
        delayIncrement: 0.05
    });
    
    // Uncover the box
    cover.classList.remove('cover');
    isTransitioning = false;
}

function updateBanner(newWords, iconDefault){
    const banner = document.querySelector('.banner');
    const words = document.querySelector('.hidden-logo .text');
    if (iconDefault){
        banner.classList.add('show-icon');
    }else{
        banner.classList.remove('show-icon');
    }

    words.textContent = newWords;
}

document.addEventListener('DOMContentLoaded', () => {
    coverAndChange('Content/home.html', 'Abraham Michel');
    
    const banner = document.querySelector('.banner');
    banner.addEventListener('mouseenter', () => {
        banner.classList.toggle('show-icon');
    });
    banner.addEventListener('mouseleave', () => {
        banner.classList.toggle('show-icon');
    });

    updateBanner('Welcome!', false);
});