let slideIndex = 0;

function showSlides() {
    const slides = document.querySelectorAll('.slide');
    slides.forEach((slide, index) => {
        slide.style.transform = `translateX(-${slideIndex * 100}%)`;
    });
}

document.querySelector('.next').addEventListener('click', () => {
    slideIndex = (slideIndex + 1) % document.querySelectorAll('.slide').length;
    showSlides();
});

document.querySelector('.prev').addEventListener('click', () => {
    slideIndex = (slideIndex - 1 + document.querySelectorAll('.slide').length) % document.querySelectorAll('.slide').length;
    showSlides();
});

// Initial display
showSlides();
