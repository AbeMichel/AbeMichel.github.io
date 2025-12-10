document.addEventListener('DOMContentLoaded', function() {
    const themeSwitcher = document.querySelector('.day-time-mode-switcher');
    const body = document.body;
    
    const currentTheme = localStorage.getItem('theme') || 'day';
    if (currentTheme === 'night') {
        body.classList.add('night-mode');
    }
    
    themeSwitcher.addEventListener('click', function() {
        body.classList.toggle('night-mode');
        const theme = body.classList.contains('night-mode') ? 'night' : 'day';
        localStorage.setItem('theme', theme);
    });
});