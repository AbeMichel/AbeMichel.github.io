document.addEventListener('DOMContentLoaded', function() {
    // Grab each slideshow on the page
    const slideShows = Array.from(document.getElementsByClassName('slider'));

    slideShows.forEach(function(slideshow) {
        const slides = Array.from(slideshow.getElementsByClassName('slide'));
        const numSlides = slides.length;
        let currentIndex = 0;

        // Enable the first slide
        slides.forEach(function(slide) {
            slide.classList.remove('active');
        });
        slides[currentIndex].classList.add('active');

        // Set up the next button
        const nextButton = slideshow.querySelector('.next');
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                slides[currentIndex].classList.remove('active');  // Disable current slide
                // Move to the next one
                currentIndex = (currentIndex + 1) % numSlides;
                // Enable the new slide
                slides[currentIndex].classList.add('active');
            });
        }

        // Set up the prev button
        const prevButton = slideshow.querySelector('.prev');
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                slides[currentIndex].classList.remove('active');  // Disable current slide
                // Move to the previous one
                currentIndex = (currentIndex - 1 + numSlides) % numSlides;
                // Enable the new slide
                slides[currentIndex].classList.add('active');
            });
        }
    });
});
