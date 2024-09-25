document.addEventListener('DOMContentLoaded', () => {
    // Perform our checks
    const tagFilterSelect = document.getElementById('tags');
    const affiliationFilterSelect = document.getElementById('affiliations');
    
    tagFilterSelect.addEventListener('change', (_) =>{
        CheckMatches();
    });

    affiliationFilterSelect.addEventListener('change', (_) =>{
        CheckMatches();
    });
    
    CheckMatches();
});

function CheckMatches() {
    const tagFilterSelect = document.getElementById('tags');
    const affiliationFilterSelect = document.getElementById('affiliations');
    const projectCards = document.querySelectorAll('.project-card');

    const selectedTag = tagFilterSelect.value.toLowerCase();
    const selectedAffiliation = affiliationFilterSelect.value.toLowerCase();
    projectCards.forEach(card => {
        const tagObject = card.getElementsByClassName('project-tags');
        const affilObject = card.getElementsByClassName('project-affiliation');
        var match = false;
        // Check tag
        if (selectedTag != '' && tagObject.length > 0){
            const tags = tagObject[0].querySelectorAll('p');
            tags.forEach(tag => {
                if (tag.innerHTML.toLowerCase() == selectedTag){
                    match = true;
                }
            });
        }else {match = true;}

        // Check Affiliation. Match must be true otherwise who cares
        if (match){
            var color = "#F7FFF7"
            if (affilObject.length > 0){
                const affiliation = affilObject[0].innerHTML.toLowerCase();
                match = selectedAffiliation == '' || affiliation == selectedAffiliation;
                
                switch (affiliation){
                    case "jd":
                        color = "#2d6a1f";
                        break;
                    case "personal":
                        color = "#2a4d77";
                        break;
                    case "loras":
                        color = "#4b1f6e";
                        break;
                    default:
                        break;
                }
            }
            card.style.borderColor = color;
            affilObject[0].style.backgroundColor = color;
        }
        
        

        card.style.display = match ? "inline" : "none";
        
    });
}