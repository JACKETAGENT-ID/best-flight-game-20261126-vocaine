// Night Mail Run — keyboard and mouse input.
// One clear job: turn raw device events into one clean pilot-input object
// the flight model reads every frame. No game logic lives here.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    left: false,
    right: false,
    pitchUp: false,
    pitchDown: false,
    throttleUp: false,
    throttleDown: false,
    // Mouse steering: while the button is held, the pointer's offset from
    // the screen centre banks and pitches the plane.
    mouseHeld: false,
    mouseX: 0,
    mouseY: 0,
    // One-shot actions, consumed by the game loop.
    pressedKeys: [],
    clicked: null, // { x, y } in canvas pixels, consumed by the menu
  };

  const KEYMAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'pitchUp',
    KeyW: 'throttleUp',
    ArrowDown: 'pitchDown',
    KeyS: 'throttleDown',
    ShiftLeft: 'throttleUp',
    ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown',
    ControlRight: 'throttleDown',
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    const field = KEYMAP[event.code];
    if (field) input[field] = true;
    input.pressedKeys.push(event.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    const field = KEYMAP[event.code];
    if (field) input[field] = false;
  });

  window.addEventListener('blur', () => {
    keys.clear();
    input.left = input.right = false;
    input.pitchUp = input.pitchDown = false;
    input.throttleUp = input.throttleDown = false;
    input.mouseHeld = false;
  });

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('mousedown', (event) => {
    input.mouseHeld = true;
    const p = pointerPosition(event);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.clicked = p;
  });

  canvas.addEventListener('mousemove', (event) => {
    const p = pointerPosition(event);
    input.mouseX = p.x;
    input.mouseY = p.y;
  });

  window.addEventListener('mouseup', () => {
    input.mouseHeld = false;
  });

  // Synthetic input for the screenshot demo mode: the autopilot writes
  // here and the flight model cannot tell it from a human pilot.
  input.inject = (patch) => {
    Object.assign(input, patch);
  };

  input.consumePressed = () => {
    const pressed = input.pressedKeys;
    input.pressedKeys = [];
    return pressed;
  };

  input.consumeClick = () => {
    const click = input.clicked;
    input.clicked = null;
    return click;
  };

  return input;
}
