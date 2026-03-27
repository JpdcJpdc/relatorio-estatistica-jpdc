const categoryWall = 0x0001;
const categoryLight = 0x0002;
const categoryUI = 0x0004;

const { Engine, Render, Runner, Bodies, Composite, Events, Body, Mouse, MouseConstraint } = Matter;

const engine = Engine.create();
engine.world.gravity.y = 0; 
engine.world.gravity.x = 0;

const container = document.getElementById('canvas-container');
const render = Render.create({
    element: container,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent'
    }
});

const lights = [];
const hardwareCores = navigator.hardwareConcurrency || 4;
const numLights = hardwareCores <= 4 ? 6 : 16;
const centerX = window.innerWidth / 2;
const centerY = window.innerHeight / 2;

for (let i = 0; i < numLights; i++) {
    const radius = 5 + Math.pow(Math.random(), 3) * 150;
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 400;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;

    const light = Bodies.circle(x, y, radius, {
        mass: radius,
        frictionAir: 0.002, 
        restitution: 0.9, 
        isLight: true, 
        collisionFilter: {
            category: categoryLight,
            mask: categoryWall
        },
        render: {
            fillStyle: '#ffffff',
            opacity: (0.2 + Math.random() * 0.4) / (radius / 50)
        }
    });

    Body.setVelocity(light, { x: 0, y: 0 });
    lights.push(light);
}
Composite.add(engine.world, lights);

let isHoveringButton = false;
document.querySelectorAll('.dynamic-button').forEach(btn => {
    btn.addEventListener('mouseenter', () => isHoveringButton = true);
    btn.addEventListener('mouseleave', () => isHoveringButton = false);
});

Events.on(engine, 'beforeUpdate', () => {
    const G = 0.01; 
    const MIN_DISTANCE_SQ = 1; 
    const REPEL_FORCE_MULTIPLIER = 0.005;
    const MAX_FORCE = 0.05; 

    for (let i = 0; i < lights.length; i++) {
        for (let j = i + 1; j < lights.length; j++) {
            const bodyA = lights[i];
            const bodyB = lights[j];
            const dx = bodyB.position.x - bodyA.position.x;
            const dy = bodyB.position.y - bodyA.position.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq > 0.1) {
                const distance = Math.sqrt(distanceSq);
                let forceMag = ((G * bodyA.mass * bodyB.mass) / (distanceSq + MIN_DISTANCE_SQ)) * Math.log(distance * REPEL_FORCE_MULTIPLIER) + Math.random() * 0.001;
                
                forceMag = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forceMag));
                
                const forceX = (dx / distance) * forceMag;
                const forceY = (dy / distance) * forceMag;

                Body.applyForce(bodyA, bodyA.position, { x: forceX, y: forceY });
                Body.applyForce(bodyB, bodyB.position, { x: -forceX, y: -forceY });
            }
        }
    }

    const MOUSE_MASS = isHoveringButton ? 1000 : 100; 
    const MOUSE_REPEL_MULT = isHoveringButton ? 1.0 : 0.001; 
    const MAX_MOUSE_FORCE = 0.1; 

    for (let i = 0; i < lights.length; i++) {
        const bodyA = lights[i];
        
        if (bodyA.isButton) continue; 

        const dx = mouseX - bodyA.position.x;
        const dy = mouseY - bodyA.position.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > 0.1) {
            const distance = Math.sqrt(distanceSq);
            let forceMag = ((G * bodyA.mass * MOUSE_MASS) / (distanceSq + MIN_DISTANCE_SQ)) * Math.log(distance * MOUSE_REPEL_MULT) + Math.random() * 0.001;
            
            forceMag = Math.max(-MAX_MOUSE_FORCE, Math.min(MAX_MOUSE_FORCE, forceMag));
            
            const forceX = (dx / distance) * forceMag;
            const forceY = (dy / distance) * forceMag;

            Body.applyForce(bodyA, bodyA.position, { x: forceX, y: forceY });
        }
    }
});

const wallOptions = { 
    isStatic: true, 
    collisionFilter: {
        category: categoryWall,
        mask: categoryLight | categoryUI 
    },
    render: { visible: false } 
};

Composite.add(engine.world, [
    Bodies.rectangle(centerX, -50, window.innerWidth, 100, wallOptions),
    Bodies.rectangle(centerX, window.innerHeight + 50, window.innerWidth, 100, wallOptions),
    Bodies.rectangle(-50, centerY, 100, window.innerHeight, wallOptions),
    Bodies.rectangle(window.innerWidth + 50, centerY, 100, window.innerHeight, wallOptions)
]);

let currentHue = 210;
function animateHue() {
    currentHue = (currentHue + 0.2) % 360;
    document.documentElement.style.setProperty('--primary-hue', currentHue);
    const hslColor = `hsl(${currentHue}, 80%, 60%)`;
    lights.forEach(light => {
        if(light.isLight) light.render.fillStyle = hslColor;
    });
    requestAnimationFrame(animateHue);
}
animateHue();

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, { mouse: mouse, collisionFilter: { mask: categoryWall | categoryUI | categoryLight } });
Composite.add(engine.world, mouseConstraint);

let physicsActive = false;
let hasTokenized = false;
const domBodiesMap = [];

function tokenizeTextElements(selector) {
    const elements = document.querySelectorAll(selector);
    const targets = [];
    
    elements.forEach(el => {
        const words = el.innerText.split(' ');
        el.innerHTML = ''; 
        
        words.forEach((word, index) => {
            if (word.trim() === '') return;
            const span = document.createElement('span');
            span.innerText = word;
            span.style.display = 'inline-block';
            
            if (index < words.length - 1) {
                span.style.marginRight = '0.25em'; 
            }
            
            const computed = window.getComputedStyle(el);
            span.style.fontSize = computed.fontSize;
            span.style.fontWeight = computed.fontWeight;
            span.style.color = computed.color;

            el.appendChild(span);
            targets.push(span);
        });
    });
    return targets;
}

function syncDOMToPhysics() {
    domBodiesMap.forEach(map => {
        const x = map.body.position.x - map.width / 2;
        const y = map.body.position.y - map.height / 2;
        const angle = map.body.angle;
        map.domElement.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    });
    requestAnimationFrame(syncDOMToPhysics);
}

window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    cacheRectangles();
});

let cachedUIRects = {};

function cacheRectangles() {
    const ids = ['profile-logo', 'physics-toggle', 'ui-card'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) cachedUIRects[id] = el.getBoundingClientRect();
    });
}
cacheRectangles();

document.getElementById('physics-toggle').addEventListener('click', () => {
    if (physicsActive) {
        location.reload();
        return; 
    }

    physicsActive = true;

    const parentContainers = [
        document.getElementById('ui-card'),
        document.getElementById('name-tag'),
        document.getElementById('description'),
        document.getElementById('links-box')
    ];
    
    parentContainers.forEach(container => {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        container.style.boxSizing = 'border-box';
        container.style.width = `${rect.width}px`;
        container.style.height = `${rect.height}px`;
    });
    
    const buttons = Array.from(document.querySelectorAll('.links-container .dynamic-button'));
    let textWords = [];
    
    if (!hasTokenized) {
        textWords = tokenizeTextElements('#name-tag, #description');
        hasTokenized = true;
    } else {
        textWords = Array.from(document.querySelectorAll('#name-tag span, #description span'));
    }
    
    const elementsToFall = [...buttons, ...textWords];

    const elementData = elementsToFall.map(el => {
        return { el: el, rect: el.getBoundingClientRect() };
    });

    elementData.forEach(data => {
        const { el, rect } = data;
        if (rect.width === 0 || rect.height === 0) return;

        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        el.style.boxSizing = 'border-box';

        const physWidth = Math.max(1, rect.width * 0.98);
        const physHeight = Math.max(1, rect.height * 0.98);

        const isInteractiveBtn = el.tagName === 'A' || el.tagName === 'BUTTON';

        const body = Bodies.rectangle(
            rect.left + rect.width / 2, 
            rect.top + rect.height / 2, 
            physWidth, 
            physHeight, 
            { 
                restitution: 0.8,
                frictionAir: 0.002, 
                friction: 0.1,
                mass: 100,
                isUI: true,
                isButton: isInteractiveBtn,
                collisionFilter: { category: categoryUI, mask: categoryWall | categoryUI | categoryLight },
                render: { visible: false } 
            }
        );

        el.classList.add('physics-enabled');
        document.body.appendChild(el); 

        domBodiesMap.push({ domElement: el, body: body, width: rect.width, height: rect.height });
        Composite.add(engine.world, body);
        lights.push(body);
    });

    syncDOMToPhysics();
});

const gridCanvas = document.getElementById('grid-canvas');
const gCtx = gridCanvas.getContext('2d');
const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d');

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    const scales = document.querySelector('.scales-svg');
    if (scales) {
        const rect = scales.getBoundingClientRect();
        const relX = mouseX - rect.left;
        const relY = mouseY - rect.top;
        scales.style.setProperty('--mouse-x', `${relX}px`);
        scales.style.setProperty('--mouse-y', `${relY}px`);
    }
});

function buildStaticGrid() {
    gridCanvas.width = window.innerWidth;
    gridCanvas.height = window.innerHeight;
    offscreenCanvas.width = window.innerWidth;
    offscreenCanvas.height = window.innerHeight;

    offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    offCtx.strokeStyle = '#ffffff'; 
    offCtx.lineWidth = 1; 
    let lineSpacing = 8;
    
    offCtx.beginPath();
    for(let x = 0; x < offscreenCanvas.width; x += lineSpacing) {
        offCtx.moveTo(x, 0); offCtx.lineTo(x, offscreenCanvas.height);
    }
    for(let y = 0; y < offscreenCanvas.height; y += lineSpacing) {
        offCtx.moveTo(0, y); offCtx.lineTo(offscreenCanvas.width, y);
    }
    offCtx.stroke();
}

window.addEventListener('resize', buildStaticGrid);
buildStaticGrid();

function renderInteractiveGrid() {
    gCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gCtx.globalCompositeOperation = 'source-over';
    
    function drawLens(x, y, radius, intensity) {
        const grad = gCtx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `hsla(${currentHue}, 0%, 60%, ${intensity})`);
        grad.addColorStop(1, `hsla(${currentHue}, 0%, 60%, 0)`);
        gCtx.fillStyle = grad;
        gCtx.beginPath();
        gCtx.arc(x, y, radius, 0, Math.PI * 2);
        gCtx.fill();
    }

    if (cachedUIRects['profile-logo']) {
        const rect = cachedUIRects['profile-logo'];
        drawLens(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width * 0.5, 0.8);
    }

    
    drawLens(mouseX, mouseY, 64, 0.4);
    
    const toggleBtn = document.getElementById('physics-toggle');
    if (toggleBtn) {
        const tRect = toggleBtn.getBoundingClientRect();
        gCtx.beginPath();
        gCtx.roundRect(tRect.left - 10, tRect.top - 10, tRect.width + 20, tRect.height + 20, 16);
        gCtx.filter = 'blur(15px)';
        gCtx.fillStyle = `hsla(${currentHue}, 0%, 40%, 0.5)`;
        gCtx.fill();
        gCtx.filter = 'none';
    }

    if (!physicsActive) {
        const uiCard = document.getElementById('ui-card');
        if (uiCard) {
            const rect = uiCard.getBoundingClientRect();
            gCtx.beginPath();
            gCtx.roundRect(rect.left + 32, rect.top + 64, rect.width - 64, rect.height - 96, 64);
            gCtx.filter = 'blur(32px)'; 
            gCtx.fillStyle = `hsla(${currentHue}, 0%, 40%, 0.4)`;
            gCtx.fill();
            gCtx.filter = 'none'; 
        }
    } else {
        if (typeof domBodiesMap !== 'undefined') {
            domBodiesMap.forEach(map => {
                gCtx.save();
                gCtx.translate(map.body.position.x, map.body.position.y);
                gCtx.rotate(map.body.angle);
                gCtx.beginPath();
                
                const isButton = map.domElement.tagName === 'A' || map.domElement.tagName === 'BUTTON';
                const pad = isButton ? 10 : 4;
                const radius = isButton ? 16 : 6;
                
                gCtx.roundRect(-map.width / 2 - pad, -map.height / 2 - pad, map.width + pad * 2, map.height + pad * 2, radius);
                
                gCtx.filter = isButton ? 'blur(15px)' : 'blur(8px)';
                gCtx.fillStyle = `hsla(${currentHue}, 0%, 40%, 0.5)`;
                gCtx.fill();
                
                gCtx.restore(); 
            });
        }
    }

    gCtx.globalCompositeOperation = 'destination-in';
    gCtx.drawImage(offscreenCanvas, 0, 0);
    requestAnimationFrame(renderInteractiveGrid);
}

renderInteractiveGrid();