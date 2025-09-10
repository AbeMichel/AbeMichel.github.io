function buttonSounds() {
    const hoverSound = document.getElementById('hover-sound');
    hoverSound.volume = 0.3;
    const clickSound = document.getElementById('click-sound');


    // We need to ensure the user has interacted with the page before we can play sounds
    let hasInteracted = false;
    const unlockAudio = () => {
        if (hasInteracted) return;
        hasInteracted = true;

        if (clickSound != undefined){
            clickSound.currentTime = 0;
            clickSound.play();
        }
        
        document.removeEventListener('click', unlockAudio);
    }
    document.addEventListener('click', unlockAudio);

    const buttons = document.querySelectorAll('.btn-sounds');
    if (buttons === undefined || buttons.length === 0) return;

    buttons.forEach(btn => {
        if (hoverSound != undefined){
            btn.addEventListener('mouseenter', () => {
                if (!hasInteracted) return;
                hoverSound.currentTime = 0;
                hoverSound.play();
            });
            btn.addEventListener('mouseleave', () => {
                if (!hasInteracted) return;
                hoverSound.pause();
                hoverSound.currentTime = 0;
            });
        }

        if (clickSound != undefined){
            btn.addEventListener('click', () => {
                if (!hasInteracted) return;
                clickSound.currentTime = 0;
                clickSound.play();
            });
        }
    });
}

buttonSounds();