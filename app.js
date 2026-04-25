import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const canvas = document.getElementById('cricketCanvas');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const hitBtn = document.getElementById('hitBtn');
const difficultySelect = document.getElementById('difficulty');
const matchState = document.getElementById('matchState');
const hitIndicator = document.getElementById('hitIndicator');

const runsEl = document.getElementById('runs');
const wicketsEl = document.getElementById('wickets');
const ballsEl = document.getElementById('balls');
const runRateEl = document.getElementById('runRate');

const MAX_BALLS = 12;
const MAX_WICKETS = 3;

const score = {
  runs: 0,
  wickets: 0,
  balls: 0,
};

const game = {
  running: false,
  paused: false,
  ballActive: false,
  awaitingNextBall: false,
  batSwinging: false,
  contactHandled: false,
  ballVelocity: new THREE.Vector3(0, 0, 0),
  gravity: -18,
  bounceDamping: 0.56,
  difficulty: 'medium',
};

const difficultyMap = {
  easy: { speed: 13, variation: 0.6, timing: 0.55 },
  medium: { speed: 16, variation: 1.0, timing: 0.43 },
  hard: { speed: 20, variation: 1.4, timing: 0.34 },
};

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060f24, 25, 95);
scene.background = new THREE.Color(0x08132c);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
camera.position.set(0, 7.6, 18);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemiLight = new THREE.HemisphereLight(0x95bbff, 0x173524, 0.88);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(18, 22, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x76a8ff, 0.35);
fillLight.position.set(-12, 8, -5);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(42, 80),
  new THREE.MeshStandardMaterial({ color: 0x2f7d45, roughness: 0.95, metalness: 0.03 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const pitch = new THREE.Mesh(
  new THREE.BoxGeometry(4, 0.06, 22),
  new THREE.MeshStandardMaterial({ color: 0xd9c697, roughness: 0.8 })
);
pitch.position.y = 0.03;
pitch.receiveShadow = true;
scene.add(pitch);

const creaseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const battingCrease = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.03, 0.16), creaseMat);
battingCrease.position.set(0, 0.05, 7.3);
scene.add(battingCrease);
const bowlingCrease = battingCrease.clone();
bowlingCrease.position.z = -7.3;
scene.add(bowlingCrease);

const stumpMaterial = new THREE.MeshStandardMaterial({ color: 0xf2e4c7, roughness: 0.5 });
function createStumps(zPos) {
  const group = new THREE.Group();
  for (let i = -1; i <= 1; i += 1) {
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.25, 12), stumpMaterial);
    stump.position.set(i * 0.22, 0.62, zPos);
    stump.castShadow = true;
    group.add(stump);
  }
  scene.add(group);
}
createStumps(7.8);
createStumps(-7.8);

const batPivot = new THREE.Group();
batPivot.position.set(1.0, 1.1, 7.1);
scene.add(batPivot);

const bat = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 2.1, 0.55),
  new THREE.MeshStandardMaterial({ color: 0xc9974e, roughness: 0.45 })
);
bat.position.y = -0.92;
bat.castShadow = true;
bat.rotation.z = -0.12;
batPivot.add(bat);

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.48, 1.45, 6, 14),
  new THREE.MeshStandardMaterial({ color: 0x2e4cff, roughness: 0.6 })
);
player.position.set(0, 1.3, 7.6);
player.castShadow = true;
scene.add(player);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0xc31e2d, roughness: 0.35, metalness: 0.12 })
);
ball.castShadow = true;
scene.add(ball);

const boundary = new THREE.Mesh(
  new THREE.TorusGeometry(30, 0.2, 12, 100),
  new THREE.MeshStandardMaterial({ color: 0x76d7ff, emissive: 0x0d2f5c, roughness: 0.35 })
);
boundary.rotation.x = Math.PI / 2;
boundary.position.y = 0.12;
scene.add(boundary);

const clock = new THREE.Clock();

function resizeRenderer() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width && height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resizeRenderer);

function updateHUD() {
  runsEl.textContent = score.runs;
  wicketsEl.textContent = score.wickets;
  ballsEl.textContent = `${score.balls} / ${MAX_BALLS}`;
  const overs = score.balls / 6 || 0.1;
  runRateEl.textContent = (score.runs / overs).toFixed(2);
}

function showHitIndicator(text, isGood = true) {
  hitIndicator.textContent = text;
  hitIndicator.style.borderColor = isGood ? 'rgba(76, 255, 143, 0.6)' : 'rgba(255, 95, 122, 0.7)';
  hitIndicator.style.background = isGood ? 'rgba(76, 255, 143, 0.2)' : 'rgba(255, 95, 122, 0.22)';
  hitIndicator.classList.add('visible');
  clearTimeout(showHitIndicator.timer);
  showHitIndicator.timer = setTimeout(() => hitIndicator.classList.remove('visible'), 750);
}

function resetBall() {
  const settings = difficultyMap[game.difficulty];
  ball.position.set((Math.random() - 0.5) * settings.variation * 0.6, 1.4, -10);
  game.ballVelocity.set((Math.random() - 0.5) * settings.variation, -0.3, settings.speed);
  game.ballActive = true;
  game.contactHandled = false;
  game.awaitingNextBall = false;
  batPivot.rotation.x = 0;
}

function bowlNextBall(delay = 900) {
  if (!game.running || game.paused || score.balls >= MAX_BALLS || score.wickets >= MAX_WICKETS) return;
  game.awaitingNextBall = true;
  setTimeout(() => {
    if (!game.running || game.paused) return;
    resetBall();
    matchState.textContent = 'Ball in play — watch the seam and time the shot!';
  }, delay);
}

function awardRuns(distance) {
  if (distance > 30) return 6;
  if (distance > 25) return 4;
  if (distance > 19) return 3;
  if (distance > 13) return 2;
  return 1;
}

function registerBallOutcome(outcome, runValue = 0) {
  score.balls += 1;
  if (outcome === 'runs') {
    score.runs += runValue;
    matchState.textContent = `Great shot! +${runValue} run${runValue > 1 ? 's' : ''}.`;
  } else {
    score.wickets += 1;
    matchState.textContent = `Wicket! ${MAX_WICKETS - score.wickets} wicket(s) left.`;
  }

  updateHUD();
  game.ballActive = false;

  if (score.balls >= MAX_BALLS || score.wickets >= MAX_WICKETS) {
    game.running = false;
    pauseBtn.disabled = true;
    startBtn.disabled = false;
    const result = score.wickets >= MAX_WICKETS ? 'All out' : 'Innings complete';
    matchState.textContent = `${result}: ${score.runs}/${score.wickets} in ${score.balls} balls.`;
    showHitIndicator(result, score.wickets < MAX_WICKETS);
    return;
  }

  bowlNextBall(1050);
}

function triggerSwing() {
  if (!game.running || game.paused || !game.ballActive) return;
  if (game.batSwinging) return;

  game.batSwinging = true;
  const swingDuration = 170;
  const startTime = performance.now();

  const animateSwing = (now) => {
    const t = Math.min((now - startTime) / swingDuration, 1);
    batPivot.rotation.x = -Math.sin(t * Math.PI) * 1.3;
    if (t < 1) {
      requestAnimationFrame(animateSwing);
    } else {
      game.batSwinging = false;
      batPivot.rotation.x = 0;
    }
  };

  requestAnimationFrame(animateSwing);

  const zGap = Math.abs(ball.position.z - 7.1);
  const xGap = Math.abs(ball.position.x - 0.65);
  const timingWindow = difficultyMap[game.difficulty].timing;

  if (zGap < timingWindow && xGap < 1.05 && !game.contactHandled) {
    game.contactHandled = true;
    const loft = 7 + Math.random() * 4.5;
    const direction = new THREE.Vector3((Math.random() - 0.5) * 4, loft, -15 - Math.random() * 6);
    game.ballVelocity.copy(direction);
    showHitIndicator('Sweet connection!');
    matchState.textContent = 'Ball launched — keep watching the field!';
  } else {
    showHitIndicator('Missed timing!', false);
  }
}

function resetMatch() {
  score.runs = 0;
  score.wickets = 0;
  score.balls = 0;

  game.running = false;
  game.paused = false;
  game.ballActive = false;
  game.awaitingNextBall = false;
  game.contactHandled = false;
  game.batSwinging = false;
  batPivot.rotation.x = 0;

  ball.position.set(0, 1.4, -10);
  game.ballVelocity.set(0, 0, 0);

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  matchState.textContent = 'Ready to begin.';
  updateHUD();
}

function startMatch() {
  if (game.running && game.paused) {
    game.paused = false;
    pauseBtn.textContent = 'Pause';
    matchState.textContent = 'Match resumed.';
    if (!game.ballActive && !game.awaitingNextBall) bowlNextBall(300);
    return;
  }

  if (game.running) return;

  game.difficulty = difficultySelect.value;
  game.running = true;
  game.paused = false;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  matchState.textContent = 'Match started — get set for the first delivery!';
  bowlNextBall(450);
}

function togglePause() {
  if (!game.running) return;
  game.paused = !game.paused;
  pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
  matchState.textContent = game.paused ? 'Game paused.' : 'Game resumed.';
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);

  if (game.running && !game.paused && game.ballActive) {
    game.ballVelocity.y += game.gravity * dt;
    ball.position.addScaledVector(game.ballVelocity, dt);

    if (ball.position.y < 0.16) {
      ball.position.y = 0.16;
      game.ballVelocity.y = Math.abs(game.ballVelocity.y) * game.bounceDamping;
      game.ballVelocity.x *= 0.85;
      game.ballVelocity.z *= 0.95;
    }

    if (!game.contactHandled && ball.position.z > 8.2) {
      showHitIndicator('Bowled!', false);
      registerBallOutcome('wicket');
    }

    const radialDist = Math.hypot(ball.position.x, ball.position.z);
    if (game.contactHandled && radialDist > 18 && ball.position.y <= 0.22) {
      const runs = awardRuns(radialDist);
      showHitIndicator(`+${runs} run${runs > 1 ? 's' : ''}`);
      registerBallOutcome('runs', runs);
    }

    if (game.contactHandled && (ball.position.z < -35 || Math.abs(ball.position.x) > 35 || ball.position.y < -5)) {
      const runs = awardRuns(Math.hypot(ball.position.x, ball.position.z));
      registerBallOutcome('runs', runs);
    }

    if (!game.contactHandled && ball.position.z < -20) {
      registerBallOutcome('wicket');
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    triggerSwing();
  }
});

startBtn.addEventListener('click', startMatch);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetMatch);
hitBtn.addEventListener('click', triggerSwing);
difficultySelect.addEventListener('change', () => {
  game.difficulty = difficultySelect.value;
  if (!game.running) {
    matchState.textContent = `Difficulty set to ${game.difficulty}. Ready when you are.`;
  }
});

resizeRenderer();
resetMatch();
animate();
