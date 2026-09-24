const greetings = [
    'Hi!',
    'Hello!',
    'Hey!',
    'To whom it may concern,',
];

let greetingsIndex = 0;

document.addEventListener('click', (e) => {
    const hello = e.target.closest('.intro-hello');
    if (!hello) return;

    hello.classList.add('text-swap');

    setTimeout(() => {
        greetingsIndex = (greetingsIndex + 1) % greetings.length;
        hello.textContent = greetings[greetingsIndex];
    }, 120);

    setTimeout(() => {
        hello.classList.remove('text-swap');
    }, 240);
});