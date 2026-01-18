// DOM Elements
const gameView = document.getElementById('gameView');
const proposalView = document.getElementById('proposalView');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const backgroundMusic = document.getElementById('backgroundMusic');
const gameCanvas = document.getElementById('gameCanvas');
const particlesContainer = document.getElementById('particlesContainer');
const animatedHearts = document.getElementById('animatedHearts');
const fallingPetals = document.getElementById('fallingPetals');
const sparkles = document.getElementById('sparkles');
const proposalText = document.getElementById('proposalText');
const typingLines = document.querySelectorAll('.typing-line');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('finalScore');
const attemptCountDisplay = document.getElementById('attemptCount');
const attemptsLeftDisplay = document.getElementById('attemptsLeft');
const confirmationDialog = document.getElementById('confirmationDialog');
const confirmationMessage = document.getElementById('confirmationMessage');
const confirmYesButton = document.getElementById('confirmYes');
const confirmNoButton = document.getElementById('confirmNo');

// Game State
let gameOverCount = 0;
let gameStarted = false;
let gameRunning = false;
let ctx;
let bird;
let pipes = [];
let score = 0;
let animationId = null;
let followHearts = [];
let confirmationStep = 0;
let typingIntervals = []; // Track typing intervals to prevent duplicates
let isTyping = false; // Prevent multiple typing sessions

// Game Constants (easier settings)
const GRAVITY = 0.2;
const JUMP_STRENGTH = -10;
const PIPE_SPEED = 1.5;
const PIPE_SPACING = 250;
const PIPE_GAP = 220;

// Initialize Canvas
function initCanvas() {
    ctx = gameCanvas.getContext('2d');
    // Set a fixed resolution for consistent gameplay
    const targetWidth = 800;
    const targetHeight = 600;
    
    // Calculate scale to fit screen while maintaining aspect ratio
    const scaleX = (window.innerWidth - 40) / targetWidth;
    const scaleY = (window.innerHeight - 40) / targetHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
    
    gameCanvas.width = targetWidth;
    gameCanvas.height = targetHeight;
    gameCanvas.style.width = (targetWidth * scale) + 'px';
    gameCanvas.style.height = (targetHeight * scale) + 'px';
}

// Bird Object
class Bird {
    constructor() {
        this.x = gameCanvas.width / 4;
        this.y = gameCanvas.height / 2;
        this.velocity = 0;
        this.radius = 20;
        this.rotation = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw bird body (circle)
        ctx.fillStyle = '#ff6b9d';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw bird eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(5, -5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(7, -5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw heart on bird
        ctx.font = '16px Arial';
        ctx.fillText('💖', -8, 5);
        
        ctx.restore();
    }

    update() {
        this.velocity += GRAVITY;
        
        // Cap maximum fall speed to make it easier
        const MAX_FALL_SPEED = 6;
        if (this.velocity > MAX_FALL_SPEED) {
            this.velocity = MAX_FALL_SPEED;
        }
        
        this.y += this.velocity;
        
        // Rotate based on velocity
        this.rotation = Math.min(Math.max(this.velocity * 0.1, -0.5), 0.5);
        
        // Keep bird on screen (but still allow collision detection)
        if (this.y < this.radius) {
            this.y = this.radius;
        }
        if (this.y > gameCanvas.height - this.radius) {
            this.y = gameCanvas.height - this.radius;
        }
    }

    jump() {
        this.velocity = JUMP_STRENGTH;
    }

    getBounds() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }
}

// Pipe Object
class Pipe {
    constructor(x) {
        this.x = x;
        this.width = 60;
        this.gap = PIPE_GAP;
        this.topHeight = Math.random() * (gameCanvas.height - this.gap - 100) + 50;
        this.bottomHeight = gameCanvas.height - this.topHeight - this.gap;
        this.passed = false;
    }

    draw() {
        // Top pipe
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        
        // Pipe cap
        ctx.fillStyle = '#45a049';
        ctx.fillRect(this.x - 5, this.topHeight - 20, this.width + 10, 20);
        
        // Bottom pipe
        ctx.fillRect(this.x, gameCanvas.height - this.bottomHeight, this.width, this.bottomHeight);
        
        // Bottom pipe cap
        ctx.fillRect(this.x - 5, gameCanvas.height - this.bottomHeight, this.width + 10, 20);
    }

    update() {
        this.x -= PIPE_SPEED;
    }

    getBounds() {
        return [
            { x: this.x, y: 0, width: this.width, height: this.topHeight },
            { x: this.x, y: gameCanvas.height - this.bottomHeight, width: this.width, height: this.bottomHeight }
        ];
    }
}

// Collision Detection (improved for stability)
function checkCollision(bird, pipes) {
    const birdX = bird.x;
    const birdY = bird.y;
    const birdRadius = bird.radius;
    
    // Check ground/ceiling collision
    if (birdY - birdRadius <= 0 || birdY + birdRadius >= gameCanvas.height) {
        return true;
    }
    
    // Check pipe collisions with more accurate circle-rectangle collision
    for (let pipe of pipes) {
        const pipeBounds = pipe.getBounds();
        for (let rect of pipeBounds) {
            // Find closest point on rectangle to circle center
            const closestX = Math.max(rect.x, Math.min(birdX, rect.x + rect.width));
            const closestY = Math.max(rect.y, Math.min(birdY, rect.y + rect.height));
            
            // Calculate distance from circle center to closest point
            const distanceX = birdX - closestX;
            const distanceY = birdY - closestY;
            const distanceSquared = distanceX * distanceX + distanceY * distanceY;
            
            // Check if distance is less than radius
            if (distanceSquared < birdRadius * birdRadius) {
                return true;
            }
        }
    }
    
    return false;
}

// Game Loop (improved for stability)
function gameLoop() {
    if (!gameRunning) {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, gameCanvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98D8C8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Update and draw pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].update();
        pipes[i].draw();
        
        // Check if bird passed pipe
        if (!pipes[i].passed && pipes[i].x + pipes[i].width < bird.x) {
            pipes[i].passed = true;
            score++;
            scoreDisplay.textContent = score;
        }
        
        // Remove pipes off screen
        if (pipes[i].x + pipes[i].width < 0) {
            pipes.splice(i, 1);
        }
    }
    
    // Add new pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < gameCanvas.width - PIPE_SPACING) {
        pipes.push(new Pipe(gameCanvas.width));
    }
    
    // Update and draw bird
    if (bird) {
        bird.update();
        bird.draw();
        
        // Check collision
        if (checkCollision(bird, pipes)) {
            gameOver();
            return;
        }
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Start Game (improved for stability)
function startGame() {
    // Cancel any existing animation frame
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    gameStarted = true;
    gameRunning = true;
    score = 0;
    scoreDisplay.textContent = score;
    
    // Hide start screen, show game screen
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    confirmationDialog.classList.add('hidden');
    
    // Reset game objects
    bird = new Bird();
    pipes = [];
    pipes.push(new Pipe(gameCanvas.width));
    
    // Reset confirmation step
    confirmationStep = 0;
    
    // Start game loop
    if (!animationId) {
        gameLoop();
    }
}

// Game Over (improved for stability)
function gameOver() {
    gameRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    gameOverCount++;
    attemptCountDisplay.textContent = gameOverCount;
    
    finalScoreDisplay.textContent = score;
    
    // Show game over screen
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    
    // Check if 3 attempts reached
    if (gameOverCount >= 3) {
        attemptsLeftDisplay.textContent = '0';
        restartButton.textContent = 'Continue...';
    } else {
        attemptsLeftDisplay.textContent = 3 - gameOverCount;
        restartButton.textContent = 'Try Again';
    }
}

// Show Confirmation Dialog (3 steps) - only after 3 game overs
function showConfirmationDialog() {
    confirmationStep = 0;
    askConfirmation();
}

function askConfirmation() {
    const messages = [
        "Are you sure?",
        "Khushi, are you really sure about this?",
        "Do you really wanna play the game again?"
    ];
    
    if (confirmationStep >= messages.length) {
        // All confirmations passed, reveal proposal
        confirmationDialog.classList.add('hidden');
        revealProposal();
        return;
    }
    
    confirmationMessage.textContent = messages[confirmationStep];
    confirmationMessage.className = `confirmation-message step-${confirmationStep + 1}`;
    confirmationDialog.classList.remove('hidden');
}

// Confirmation button handlers
confirmYesButton.addEventListener('click', () => {
    confirmationStep++;
    if (confirmationStep < 3) {
        // Ask next question
        setTimeout(() => {
            askConfirmation();
        }, 300);
    } else {
        // All confirmed, reveal proposal
        confirmationDialog.classList.add('hidden');
        revealProposal();
    }
});

confirmNoButton.addEventListener('click', () => {
    // Reset and hide dialog, go back to game over screen
    confirmationStep = 0;
    confirmationDialog.classList.add('hidden');
});

// Reveal Proposal
function revealProposal() {
    // Play music
    backgroundMusic.play().catch(error => {
        console.log('Audio file not found. Please add a file named "romantic-music.mp3" for background music.');
    });
    
    // Fade out game view
    gameView.classList.add('fade-out');
    
    setTimeout(() => {
        gameView.style.display = 'none';
        proposalView.classList.remove('hidden');
        proposalView.classList.add('visible');
        
        // Start animations
        createAnimatedHearts();
        createFallingPetals();
        createSparkles();
        
        // Show proposal text
        showProposalText();
    }, 800);
}

// Initialize particles for start screen
function createParticles() {
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (10 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Create animated hearts
function createAnimatedHearts() {
    const heartEmojis = ['💖', '💕', '💗', '💝', '💓', '💞'];
    
    setInterval(() => {
        const heart = document.createElement('div');
        heart.className = 'heart-particle';
        heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.animationDuration = (5 + Math.random() * 5) + 's';
        heart.style.animationDelay = Math.random() * 2 + 's';
        animatedHearts.appendChild(heart);
        
        setTimeout(() => {
            heart.remove();
        }, 10000);
    }, 800);
}

// Create falling petals
function createFallingPetals() {
    setInterval(() => {
        const petal = document.createElement('div');
        petal.className = 'petal';
        petal.style.left = Math.random() * 100 + '%';
        petal.style.animationDuration = (8 + Math.random() * 6) + 's';
        petal.style.animationDelay = Math.random() * 2 + 's';
        petal.style.transform = `rotate(${Math.random() * 360}deg)`;
        fallingPetals.appendChild(petal);
        
        setTimeout(() => {
            petal.remove();
        }, 15000);
    }, 500);
}

// Create sparkles
function createSparkles() {
    setInterval(() => {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.animationDelay = Math.random() * 2 + 's';
        sparkle.style.animationDuration = (2 + Math.random() * 2) + 's';
        sparkles.appendChild(sparkle);
        
        setTimeout(() => {
            sparkle.remove();
        }, 5000);
    }, 300);
}

// Typing effect for proposal text (fixed to prevent duplicates)
function typeText(element, text, callback) {
    // Clear any existing content and intervals for this element
    element.textContent = '';
    element.classList.add('typing');
    let index = 0;
    
    // Clear any existing interval for this element
    const existingInterval = element.dataset.intervalId;
    if (existingInterval) {
        clearInterval(parseInt(existingInterval));
    }
    
    const typeInterval = setInterval(() => {
        if (index < text.length) {
            element.textContent += text[index];
            index++;
        } else {
            clearInterval(typeInterval);
            element.classList.remove('typing');
            element.dataset.intervalId = '';
            if (callback) callback();
        }
    }, 30);
    
    // Store interval ID to prevent duplicates
    element.dataset.intervalId = typeInterval.toString();
    typingIntervals.push(typeInterval);
}

// Show proposal text with typing effect (fixed to prevent multiple calls)
function showProposalText() {
    // Prevent multiple typing sessions
    if (isTyping) {
        return;
    }
    isTyping = true;
    
    // Clear all existing typing intervals
    typingIntervals.forEach(interval => clearInterval(interval));
    typingIntervals = [];
    
    // Reset all lines
    typingLines.forEach(line => {
        line.textContent = '';
        line.classList.remove('visible', 'typing');
        line.dataset.intervalId = '';
    });
    
    let currentIndex = 0;
    
    function showNextLine() {
        if (currentIndex < typingLines.length) {
            const line = typingLines[currentIndex];
            line.classList.add('visible');
            
            const text = line.getAttribute('data-text');
            typeText(line, text, () => {
                currentIndex++;
                setTimeout(showNextLine, 500);
            });
        }
    }
    
    setTimeout(showNextLine, 1000);
}

// Event Listeners
startButton.addEventListener('click', () => {
    initCanvas();
    startGame();
});

// Restart button handler - handles both restart and continue after 3 game overs
restartButton.addEventListener('click', function() {
    if (gameOverCount >= 3) {
        // After 3 game overs, show confirmation dialog asking if they want to play again
        showConfirmationDialog();
    } else {
        // Before 3 game overs, just restart immediately
        startGame();
    }
});

// Click or spacebar to make bird jump
gameCanvas.addEventListener('click', () => {
    if (gameRunning && bird) {
        bird.jump();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (!gameStarted) {
            initCanvas();
            startGame();
        } else if (gameRunning && bird) {
            bird.jump();
        }
    }
});

// Mouse move handler for interactive hearts (on proposal view)
let lastHeartTime = 0;
document.addEventListener('mousemove', (e) => {
    if (!proposalView.classList.contains('hidden')) {
        const now = Date.now();
        if (now - lastHeartTime > 200) {
            createFollowHeart(e.clientX, e.clientY);
            lastHeartTime = now;
        }
    }
});

function createFollowHeart(x, y) {
    const heart = document.createElement('div');
    heart.className = 'follow-heart';
    heart.textContent = ['💖', '💕', '💗'][Math.floor(Math.random() * 3)];
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    document.body.appendChild(heart);
    followHearts.push(heart);
    
    setTimeout(() => {
        heart.style.opacity = '0';
        heart.style.transform = 'scale(2) translateY(-20px)';
        setTimeout(() => {
            heart.remove();
            followHearts = followHearts.filter(h => h !== heart);
        }, 500);
    }, 1000);
}

// Click handler for interactive hearts on proposal view
proposalView.addEventListener('click', (e) => {
    const heart = document.createElement('div');
    heart.className = 'heart-particle';
    heart.textContent = ['💖', '💕', '💗', '💝'][Math.floor(Math.random() * 4)];
    heart.style.left = e.clientX + 'px';
    heart.style.top = e.clientY + 'px';
    heart.style.animationDuration = '3s';
    animatedHearts.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
    }, 3000);
});

// Initialize on page load
window.addEventListener('load', () => {
    initCanvas();
    createParticles();
});

// Handle window resize (improved for stability)
window.addEventListener('resize', () => {
    if (gameRunning && ctx) {
        const wasRunning = gameRunning;
        gameRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        initCanvas();
        // Recreate bird at new position
        if (bird) {
            bird.x = gameCanvas.width / 4;
            bird.y = Math.min(bird.y, gameCanvas.height - bird.radius);
        }
        if (wasRunning) {
            gameRunning = true;
            gameLoop();
        }
    } else {
        initCanvas();
    }
});

// Parallax effect on scroll (for proposal view)
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const stars = document.querySelector('.stars-background');
    if (stars) {
        stars.style.transform = `translateY(${scrollY * 0.5}px)`;
    }
});

document.documentElement.style.scrollBehavior = 'smooth';
