document.addEventListener('DOMContentLoaded', function(){
    const menuBtn = document.getElementById('nav-menu-btn');
    const menu = document.getElementById('nav-links');

    menuBtn.addEventListener('click', function(){
        menu.classList.toggle('active');
        menuBtn.classList.toggle('active');
    });
});