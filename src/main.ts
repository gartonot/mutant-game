// Создаём канвас
const canvas = document.getElementById('game') as HTMLCanvasElement;
// Получаем контекст
const ctx = canvas.getContext('2d')!;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Цикл игры
const gameLoop = () => {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

const update = () => {
  // 
}

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Тестовая отрисовка
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.fillText('Mutant game', 20, 30);
}

gameLoop();
