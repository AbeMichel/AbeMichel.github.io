document.addEventListener('DOMContentLoaded', function() {
    const quickLinks = document.getElementById('quick-links');
    const linksBtn = quickLinks.getElementsByTagName('button')[0];

    linksBtn.addEventListener('click', (e) =>{
        quickLinks.classList.toggle('active')
    });
});