(() => {
  const container = document.getElementById('lanyard-container');
  const canvas = document.getElementById('lanyard-canvas');
  const card = document.getElementById('lanyard-card');
  const flip = card.querySelector('.lanyard-flip');
  const ctx = canvas.getContext('2d');

  const MAX_DRAG_Y = 220;   // how far down the badge can be pulled before it "resists"
  const MAX_TILT_DEG = 35;  // max swing angle while dragging

  let anchorX = 0;                // x position of the fixed lanyard clip at the top
  let offsetX = 0, offsetY = 0;   // current displacement of the card from its resting spot
  let velX = 0, velY = 0;         // velocity used by the spring-back animation
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let pointerStartX = 0, pointerStartY = 0;
  let moved = false;
  let flipped = false;
  let springAnim = null;

  function layout() {
    anchorX = container.clientWidth / 2;
    card.style.left = anchorX + 'px'; // pairs with the CSS margin-left:-110px to center it
    resizeCanvas();
    render();
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight + MAX_DRAG_Y + 40;
    canvas.style.height = height + 'px';
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cardTopX = anchorX + offsetX;
    const cardTopY = Math.max(0, offsetY);

    // ribbon
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(anchorX, 0);
    ctx.lineTo(cardTopX, cardTopY);
    ctx.stroke();

    // clip at the top where the ribbon attaches
    ctx.fillStyle = '#6ee7a8';
    ctx.beginPath();
    ctx.arc(anchorX, 6, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function applyCardTransform() {
    const tilt = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, offsetX / 4));
    card.style.transform = `translate(${offsetX}px, ${Math.max(0, offsetY)}px) rotateZ(${tilt}deg)`;
  }

  function onPointerDown(e) {
    dragging = true;
    moved = false;
    cancelSpring();
    card.setPointerCapture(e.pointerId);
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    dragStartX = offsetX;
    dragStartY = offsetY;
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

    offsetX = dragStartX + dx;
    offsetY = Math.max(0, dragStartY + dy);
    if (offsetY > MAX_DRAG_Y) offsetY = MAX_DRAG_Y + (offsetY - MAX_DRAG_Y) * 0.15;

    applyCardTransform();
    render();
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (!moved) toggleFlip();
    springBack();
  }

  function toggleFlip() {
    flipped = !flipped;
    flip.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
  }

  function cancelSpring() {
    if (springAnim) cancelAnimationFrame(springAnim);
    springAnim = null;
  }

  function springBack() {
    const stiffness = 0.12;
    const damping = 0.78;

    function step() {
      velX = (velX - offsetX * stiffness) * damping;
      velY = (velY - offsetY * stiffness) * damping;
      offsetX += velX;
      offsetY += velY;

      applyCardTransform();
      render();

      if (Math.abs(offsetX) > 0.5 || Math.abs(offsetY) > 0.5 || Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
        springAnim = requestAnimationFrame(step);
      } else {
        offsetX = offsetY = velX = velY = 0;
        applyCardTransform();
        render();
        springAnim = null;
      }
    }
    springAnim = requestAnimationFrame(step);
  }

  card.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', layout);

  layout();
})();
