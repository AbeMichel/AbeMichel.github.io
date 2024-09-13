document.addEventListener("DOMContentLoaded", function() {
    // Check if the page URL has a hash (i.e., #highlighted-text)
    const lessonsList = document.getElementById('lessons-list');
    const quickLinks = document.getElementById('quick-links');
    addHighlightToIDHyperlinks(lessonsList);
    addHighlightToIDHyperlinks(quickLinks);
});

function addHighlightToIDHyperlinks(parent){
    if (parent == null){
        return;
    }
    const hyperlinks = parent.getElementsByTagName('a');
        
    if (hyperlinks != null && hyperlinks.length > 0) {
        // Convert the lessons HTMLCollection to an array
        Array.from(hyperlinks).forEach(function(element) {
            element.addEventListener('click', function(event) {
                // Get the target element's ID by removing the leading '#'
                const targetID = element.hash.substring(1);
                const target = document.getElementById(targetID);
                console.log(targetID);
                if (target != null) {
                    // Remove and re-add the highlight class to trigger the effect
                    target.classList.remove('highlight');
                    target.classList.add('highlight');
                    
                    // Remove the highlight after 2 seconds
                    setTimeout(function() {
                        target.classList.remove('highlight');
                    }, 800);
                } else {
                    console.error("No target element with ID: " + targetID);
                }
            });
        });
    }
}