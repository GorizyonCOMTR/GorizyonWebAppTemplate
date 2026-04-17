/**
 * Block Puzzle Game
 * GORIZYON AdMobPlugin entegrasyonu ile
 */

class BlockPuzzleGame {
    constructor() {
        // Constants
        this.GRID_SIZE = 8;
        this.COLORS = [
            '#e94560', '#ff6b6b', '#feca57', '#48dbfb', 
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3'
        ];

        this.BLOCK_SHAPES = [
            [[1]],
            [[1,1]],
            [[1],[1]],
            [[1,1,1]],
            [[1],[1],[1]],
            [[1,1],[1,1]],
            [[1,1,1],[1,0,0]],
            [[1,1,1],[0,0,1]],
            [[0,1,1],[1,1,0]],
            [[1,1,0],[0,1,1]],
            [[1,1,1],[0,1,0]],
            [[1,1,1,1]],
            [[1],[1],[1],[1]],
            [[1,1,1],[1,1,1],[1,1,1]],
        ];

        // State
        this.canvas = null;
        this.ctx = null;
        this.grid = [];
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.poolBlocks = [];
        this.cellSize = 0;

        // Drag state
        this.draggedBlock = null;
        this.dragClone = null;
        this.originalElement = null;
        this.touchOffsetX = 0;
        this.touchOffsetY = 0;

        // Audio context
        this.audioContext = null;
        this.initAudio();

        // AdMob callback setup
        this.setupAdMobCallbacks();
    }

    /**
     * AdMob callback'lerini ayarla
     * Plugin: window.AdMob.onUserEarnedReward çağırır
     */
    setupAdMobCallbacks() {
        // Global AdMob objesi yoksa oluştur
        if (!window.AdMob) {
            window.AdMob = {};
        }

        // Ödül callback'i
        window.AdMob.onUserEarnedReward = (rewardData) => {
            console.log('AdMob reward earned:', rewardData);
            this.onAdReward();
        };

        // Reklam hazır değilse veya hata olursa
        window.AdMob.onAdError = (error) => {
            console.log('AdMob error:', error);
            // Fallback: Simülasyon moduna geç
            this.showSimulatedAd();
        };
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio not supported');
        }
    }

    playSound(type) {
        if (!this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            const sounds = {
                place: { freq: 400, duration: 0.1 },
                clear: { freq: 600, duration: 0.3 },
                gameover: { freq: 200, duration: 0.5 },
                reward: { freq: 800, duration: 0.5 }
            };

            const sound = sounds[type] || sounds.place;
            oscillator.frequency.value = sound.freq;
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);
        } catch (e) {
            console.warn('Sound error:', e);
        }
    }

    loadHighScore() {
        try {
            return parseInt(localStorage.getItem('blockPuzzleHighScore')) || 0;
        } catch (e) {
            return 0;
        }
    }

    saveHighScore() {
        try {
            localStorage.setItem('blockPuzzleHighScore', this.highScore);
        } catch (e) {
            console.warn('Storage error:', e);
        }
    }

    init() {
        this.canvas = document.getElementById('gridCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.setupCanvas();
        this.setupEvents();
        this.resetGame();

        // Update UI
        document.getElementById('highScore').textContent = this.highScore;

        // Setup buttons
        document.getElementById('watchAdBtn').addEventListener('click', () => this.watchAd());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
    }

    setupCanvas() {
        const containerWidth = window.innerWidth - 20;
        const containerHeight = window.innerHeight - 200;
        const size = Math.min(containerWidth, containerHeight, 350);

        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / this.GRID_SIZE;
    }

    resetGame() {
        this.grid = Array(this.GRID_SIZE).fill(null).map(() => Array(this.GRID_SIZE).fill(0));
        this.fillPool();
        this.drawGrid();
    }

    fillPool() {
        this.poolBlocks = [];
        for (let i = 0; i < 3; i++) {
            const shape = this.BLOCK_SHAPES[Math.floor(Math.random() * this.BLOCK_SHAPES.length)];
            const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
            this.poolBlocks.push({ shape, color, id: i });
            this.createPoolElement(i, shape, color);
        }
    }

    createPoolElement(index, shape, color) {
        const slot = document.getElementById(`slot${index}`);
        slot.innerHTML = '';
        slot.classList.add('filled');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const blockWidth = shape[0].length;
        const blockHeight = shape.length;
        const poolCellSize = 22;

        canvas.width = blockWidth * poolCellSize + 4;
        canvas.height = blockHeight * poolCellSize + 4;
        canvas.className = 'block-piece';
        canvas.dataset.index = index;

        this.drawBlockShape(ctx, shape, color, poolCellSize);
        slot.appendChild(canvas);
    }

    drawBlockShape(ctx, shape, color, cellSize) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * cellSize + 2, y * cellSize + 2, cellSize - 2, cellSize - 2);

                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(x * cellSize + 2, y * cellSize + 2, cellSize - 2, 4);

                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * cellSize + 2, y * cellSize + 2, cellSize - 2, cellSize - 2);
                }
            }
        }
    }

    drawGrid() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.lineWidth = 1;

        for (let i = 0; i <= this.GRID_SIZE; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.cellSize, 0);
            this.ctx.lineTo(i * this.cellSize, this.canvas.height);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.cellSize);
            this.ctx.lineTo(this.canvas.width, i * this.cellSize);
            this.ctx.stroke();
        }

        // Filled cells
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (this.grid[y][x]) {
                    this.ctx.fillStyle = this.grid[y][x];
                    this.ctx.fillRect(x * this.cellSize + 2, y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4);

                    this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    this.ctx.fillRect(x * this.cellSize + 2, y * this.cellSize + 2, this.cellSize - 4, 4);
                }
            }
        }
    }

    setupEvents() {
        // Touch events
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Mouse events
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.drawGrid();
        });
    }

    getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    handleTouchStart(e) {
        const target = e.target;
        if (target.classList.contains('block-piece')) {
            e.preventDefault();
            const pos = this.getEventPos(e);
            this.startDrag(target, pos.x, pos.y);
        }
    }

    handleMouseDown(e) {
        const target = e.target;
        if (target.classList.contains('block-piece')) {
            const pos = this.getEventPos(e);
            this.startDrag(target, pos.x, pos.y);
        }
    }

    startDrag(target, clientX, clientY) {
        const index = parseInt(target.dataset.index);
        if (!this.poolBlocks[index]) return;

        const rect = target.getBoundingClientRect();
        this.touchOffsetX = clientX - rect.left;
        this.touchOffsetY = clientY - rect.top;

        this.draggedBlock = this.poolBlocks[index];
        this.originalElement = target;

        // Create clone
        this.dragClone = document.createElement('canvas');
        this.dragClone.className = 'dragging-clone';

        const shape = this.draggedBlock.shape;
        const color = this.draggedBlock.color;
        const poolCellSize = 22;

        this.dragClone.width = target.width;
        this.dragClone.height = target.height;

        const ctx = this.dragClone.getContext('2d');
        this.drawBlockShape(ctx, shape, color, poolCellSize);

        this.dragClone.style.left = (clientX - this.touchOffsetX) + 'px';
        this.dragClone.style.top = (clientY - this.touchOffsetY) + 'px';

        document.body.appendChild(this.dragClone);
        this.originalElement.style.visibility = 'hidden';
    }

    handleTouchMove(e) {
        if (!this.dragClone) return;
        e.preventDefault();
        const pos = this.getEventPos(e);
        this.moveDrag(pos.x, pos.y);
    }

    handleMouseMove(e) {
        if (!this.dragClone) return;
        const pos = this.getEventPos(e);
        this.moveDrag(pos.x, pos.y);
    }

    moveDrag(clientX, clientY) {
        if (!this.dragClone) return;

        this.dragClone.style.left = (clientX - this.touchOffsetX) + 'px';
        this.dragClone.style.top = (clientY - this.touchOffsetY) + 'px';

        const gridRect = this.canvas.getBoundingClientRect();
        if (clientX >= gridRect.left && clientX <= gridRect.right &&
            clientY >= gridRect.top && clientY <= gridRect.bottom) {
            this.canvas.style.boxShadow = '0 0 40px rgba(233, 69, 96, 0.8)';
        } else {
            this.canvas.style.boxShadow = '0 0 30px rgba(233, 69, 96, 0.3)';
        }
    }

    handleTouchEnd(e) {
        if (!this.dragClone) return;
        const pos = this.getEventPos(e);
        this.endDrag(pos.x, pos.y);
    }

    handleMouseUp(e) {
        if (!this.dragClone) return;
        const pos = this.getEventPos(e);
        this.endDrag(pos.x, pos.y);
    }

    endDrag(clientX, clientY) {
        if (!this.dragClone || !this.draggedBlock) {
            this.cleanupDrag();
            return;
        }

        const gridRect = this.canvas.getBoundingClientRect();

        if (clientX >= gridRect.left && clientX <= gridRect.right &&
            clientY >= gridRect.top && clientY <= gridRect.bottom) {

            const cloneRect = this.dragClone.getBoundingClientRect();
            const blockCenterX = cloneRect.left + cloneRect.width / 2;
            const blockCenterY = cloneRect.top + cloneRect.height / 2;

            const shape = this.draggedBlock.shape;
            const blockWidthPx = shape[0].length * this.cellSize;
            const blockHeightPx = shape.length * this.cellSize;

            const blockLeft = blockCenterX - blockWidthPx / 2;
            const blockTop = blockCenterY - blockHeightPx / 2;

            const gridX = Math.round((blockLeft - gridRect.left) / this.cellSize);
            const gridY = Math.round((blockTop - gridRect.top) / this.cellSize);

            if (this.canPlaceBlock(shape, gridX, gridY)) {
                this.placeBlock(shape, gridX, gridY, this.draggedBlock.color);

                const index = this.draggedBlock.id;
                this.poolBlocks[index] = null;
                const slot = document.getElementById(`slot${index}`);
                slot.innerHTML = '';
                slot.classList.remove('filled');

                this.playSound('place');

                const remainingBlocks = this.poolBlocks.filter(b => b !== null).length;

                if (remainingBlocks === 0) {
                    setTimeout(() => {
                        this.fillPool();
                        setTimeout(() => {
                            if (!this.canAnyBlockFit()) {
                                this.gameOver();
                            }
                        }, 100);
                    }, 300);
                } else {
                    setTimeout(() => {
                        if (!this.canAnyBlockFit()) {
                            this.gameOver();
                        }
                    }, 100);
                }
            }
        }

        this.cleanupDrag();
        this.drawGrid();
    }

    cleanupDrag() {
        if (this.dragClone) {
            this.dragClone.remove();
            this.dragClone = null;
        }

        if (this.originalElement) {
            this.originalElement.style.visibility = 'visible';
            this.originalElement = null;
        }

        this.canvas.style.boxShadow = '0 0 30px rgba(233, 69, 96, 0.3)';
        this.draggedBlock = null;
    }

    canPlaceBlock(shape, startX, startY) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const gridX = startX + x;
                    const gridY = startY + y;

                    if (gridX < 0 || gridX >= this.GRID_SIZE || gridY < 0 || gridY >= this.GRID_SIZE) {
                        return false;
                    }

                    if (this.grid[gridY][gridX]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    placeBlock(shape, startX, startY, color) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    this.grid[startY + y][startX + x] = color;
                }
            }
        }

        this.checkLines();

        let blockCells = 0;
        for (let row of shape) {
            for (let cell of row) {
                if (cell) blockCells++;
            }
        }
        this.score += blockCells * 10;
        this.updateScore();
    }

    checkLines() {
        let linesCleared = 0;
        const clearedCells = [];

        // Horizontal
        for (let y = 0; y < this.GRID_SIZE; y++) {
            if (this.grid[y].every(cell => cell !== 0)) {
                for (let x = 0; x < this.GRID_SIZE; x++) {
                    clearedCells.push({x, y, color: this.grid[y][x]});
                }
                this.grid[y] = Array(this.GRID_SIZE).fill(0);
                linesCleared++;
            }
        }

        // Vertical
        for (let x = 0; x < this.GRID_SIZE; x++) {
            let full = true;
            for (let y = 0; y < this.GRID_SIZE; y++) {
                if (!this.grid[y][x]) {
                    full = false;
                    break;
                }
            }

            if (full) {
                for (let y = 0; y < this.GRID_SIZE; y++) {
                    if (this.grid[y][x]) {
                        clearedCells.push({x, y, color: this.grid[y][x]});
                    }
                    this.grid[y][x] = 0;
                }
                linesCleared++;
            }
        }

        if (linesCleared > 0) {
            this.playSound('clear');
            clearedCells.forEach(cell => this.createParticles(cell.x, cell.y, cell.color));
            this.showComboText(linesCleared);
            this.score += linesCleared * 100 * linesCleared;
            this.updateScore();
        }
    }

    createParticles(gridX, gridY, color) {
        const rect = this.canvas.getBoundingClientRect();
        const x = rect.left + gridX * this.cellSize + this.cellSize / 2;
        const y = rect.top + gridY * this.cellSize + this.cellSize / 2;

        for (let i = 0; i < 6; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.backgroundColor = color;
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--tx', (Math.random() - 0.5) * 80 + 'px');
            particle.style.setProperty('--ty', (Math.random() - 0.5) * 80 + 'px');
            document.body.appendChild(particle);

            setTimeout(() => particle.remove(), 600);
        }
    }

    showComboText(lines) {
        const texts = ['Güzel!', 'Süper!', 'Harika!', 'Muhteşem!', 'Efsane!'];
        const text = texts[Math.min(lines - 1, texts.length - 1)];

        const combo = document.createElement('div');
        combo.className = 'combo-text';
        combo.textContent = text + ' +' + (lines * 100 * lines);
        combo.style.left = '50%';
        combo.style.top = '35%';
        combo.style.transform = 'translateX(-50%)';
        document.body.appendChild(combo);

        setTimeout(() => combo.remove(), 1000);
    }

    canAnyBlockFit() {
        for (let block of this.poolBlocks) {
            if (!block) continue;

            for (let y = 0; y < this.GRID_SIZE; y++) {
                for (let x = 0; x < this.GRID_SIZE; x++) {
                    if (this.canPlaceBlock(block.shape, x, y)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
    }

    gameOver() {
        this.playSound('gameover');

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
            document.getElementById('highScore').textContent = this.highScore;
        }

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverModal').style.display = 'flex';
    }

    /**
     * Reklam izle butonu
     */
    watchAd() {
        // Loading modal göster
        document.getElementById('adLoadingModal').style.display = 'flex';

        // AdMobInterface kontrol et
        if (typeof AdMobInterface !== 'undefined' && AdMobInterface.showRewardedAd) {
            // Native AdMob çağır
            const result = AdMobInterface.showRewardedAd();

            if (!result) {
                // Reklam hazır değil, simülasyona geç
                console.log('Ad not ready, using simulation');
                setTimeout(() => {
                    document.getElementById('adLoadingModal').style.display = 'none';
                    this.showSimulatedAd();
                }, 1000);
            }
            // Reklam hazırsa, onUserEarnedReward callback'i çalışacak
        } else {
            // AdMob yok, simülasyon
            console.log('AdMobInterface not found, using simulation');
            setTimeout(() => {
                this.showSimulatedAd();
            }, 2000);
        }
    }

    /**
     * Simülasyon modu (test/offline için)
     */
    showSimulatedAd() {
        document.getElementById('adLoadingModal').style.display = 'flex';

        // 3 saniye fake loading
        let progress = 0;
        const interval = setInterval(() => {
            progress += 33;
            if (progress >= 100) {
                clearInterval(interval);
                document.getElementById('adLoadingModal').style.display = 'none';
                this.onAdReward();
            }
        }, 1000);
    }

    /**
     * Ödül verildiğinde çağrılır
     * AdMobPlugin: window.AdMob.onUserEarnedReward çağırır
     */
    onAdReward() {
        document.getElementById('adLoadingModal').style.display = 'none';
        document.getElementById('gameOverModal').style.display = 'none';

        this.playSound('reward');

        // Izgara temizleme animasyonu
        this.canvas.style.transform = 'scale(0.9)';

        setTimeout(() => {
            // Grid temizle
            this.grid = Array(this.GRID_SIZE).fill(null).map(() => Array(this.GRID_SIZE).fill(0));

            // Yeni havuz
            this.fillPool();

            // Skor AYNI kalıyor
            this.drawGrid();
            this.canvas.style.transform = 'scale(1)';

            // Mesaj göster
            this.showRewardMessage();
        }, 300);
    }

    showRewardMessage() {
        const msg = document.createElement('div');
        msg.className = 'combo-text';
        msg.textContent = '✨ Izgara Temizlendi!';
        msg.style.color = '#feca57';
        msg.style.fontSize = '32px';
        msg.style.left = '50%';
        msg.style.top = '40%';
        msg.style.transform = 'translateX(-50%)';
        document.body.appendChild(msg);

        setTimeout(() => msg.remove(), 1500);
    }

    restartGame() {
        this.score = 0;
        this.updateScore();
        document.getElementById('gameOverModal').style.display = 'none';

        this.grid = Array(this.GRID_SIZE).fill(null).map(() => Array(this.GRID_SIZE).fill(0));
        this.fillPool();
        this.drawGrid();
    }
}

// Initialize game when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new BlockPuzzleGame();
    window.game.init();
});