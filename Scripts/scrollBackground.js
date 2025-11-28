const mainBackground = document.getElementById('main-background');

let isLookingAtSky = false;

function toggleLook() {
    isLookingAtSky = !isLookingAtSky;
    mainBackground.classList.toggle('view-sky');
}