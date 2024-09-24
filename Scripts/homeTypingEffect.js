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

window.onload = async function() {
    const typingTargets = document.getElementsByClassName('typed');
    const aboutObject = document.getElementById('about-object');
    const projectsObject = document.getElementById('project-object');
    const workObject = document.getElementById('work-object');

    for (const target of typingTargets) {
        target.classList.add('hidden');
    }
    projectsObject.classList.add('hidden');
    workObject.classList.add('hidden');
    aboutObject.classList.add('hidden');

    var i = 0;
    for (const target of typingTargets) {
        await typeText(target, 75); // Wait for each target to finish typing
    }


    const timeBeforeStarting = 100;
    const timeBetweenOptions = 800;

    setTimeout(() => aboutObject.classList.remove('hidden'), timeBeforeStarting);
    setTimeout(() => projectsObject.classList.remove('hidden'), timeBeforeStarting + timeBetweenOptions);
    setTimeout(() => workObject.classList.remove('hidden'), timeBeforeStarting + (timeBetweenOptions * 2));
};
