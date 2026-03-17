export function initPetals(canvas, count = 14) {
  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width = canvas.offsetWidth || 700;
    canvas.height = canvas.offsetHeight || 700;
  }
  resize();
  window.addEventListener('resize', resize);
  const petals = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - 80,
    length: 20 + Math.random() * 16,
    width: 6 + Math.random() * 5,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.007,
    vx: (Math.random() - 0.5) * 0.3,
    vy: 0.2 + Math.random() * 0.25,
    opacity: 0.15 + Math.random() * 0.18,
    hue: 345 + Math.random() * 15,
    sat: 40 + Math.random() * 20,
    light: 75 + Math.random() * 10,
  }));
  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.moveTo(0, -p.length * 0.5);
    ctx.bezierCurveTo(p.width * 0.85, -p.length * 0.18, p.width, p.length * 0.28, 0, p.length * 0.5);
    ctx.bezierCurveTo(-p.width, p.length * 0.28, -p.width * 0.85, -p.length * 0.18, 0, -p.length * 0.5);
    ctx.closePath();
    ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`;
    ctx.fill();
    ctx.restore();
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    petals.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.angle += p.spin;
      p.vx += (Math.random() - 0.5) * 0.018; p.vx *= 0.96;
      if (p.y > canvas.height + 40) { p.y = -40; p.x = Math.random() * canvas.width; }
      if (p.x < -40) p.x = canvas.width + 40;
      if (p.x > canvas.width + 40) p.x = -40;
      drawPetal(p);
    });
    requestAnimationFrame(animate);
  }
  animate();
}
