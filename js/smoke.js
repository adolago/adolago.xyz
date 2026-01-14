/**
 * Ethereal Nebula Effect for adolago.xyz
 * Inspired by x.ai's cosmic fog aesthetic
 * Interactive flowing wisps rising from bottom with cool blue tones
 */

(function() {
    'use strict';

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'smoke-canvas';
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -2;
        pointer-events: none;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    
    // Configuration - ethereal nebula style
    const config = {
        wispCount: 15,
        riseSpeed: 1.2,              // Faster, more visible rise
        driftSpeed: 0.3,
        wispSize: { min: 150, max: 400 },
        wispLife: { min: 400, max: 700 },
        cursorRadius: 200,           // Larger interaction area
        cursorForce: 8,              // Stronger cursor push
        // Cool blue/teal palette
        colors: [
            { r: 30, g: 80, b: 140 },
            { r: 20, g: 120, b: 160 },
            { r: 60, g: 100, b: 180 },
            { r: 40, g: 70, b: 130 },
            { r: 50, g: 140, b: 180 },
        ],
        baseOpacity: 0.28
    };

    // State
    let wisps = [];
    let cursor = { x: -1000, y: -1000, vx: 0, vy: 0, lastX: -1000, lastY: -1000 };
    let width, height;
    let time = 0;

    // Ethereal Wisp class
    class Wisp {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * config.driftSpeed;
            this.vy = -config.riseSpeed * (0.8 + Math.random() * 0.4); // Always rising
            this.baseVy = this.vy; // Remember base rise speed
            this.size = config.wispSize.min + Math.random() * (config.wispSize.max - config.wispSize.min);
            this.life = config.wispLife.min + Math.random() * (config.wispLife.max - config.wispLife.min);
            this.maxLife = this.life;
            this.color = config.colors[Math.floor(Math.random() * config.colors.length)];
            this.phase = Math.random() * Math.PI * 2;
            this.frequency = 0.8 + Math.random() * 0.6;
            this.stretchX = 1.0 + Math.random() * 0.5;
            this.stretchY = 0.7 + Math.random() * 0.3;
        }

        update() {
            // Organic wave movement
            const wave = Math.sin(time * 0.003 * this.frequency + this.phase);
            this.vx += wave * 0.05;
            
            // Keep rising - don't let drag stop the upward motion
            if (this.vy > this.baseVy * 0.5) {
                this.vy = this.baseVy * 0.5 + (this.vy - this.baseVy * 0.5) * 0.98;
            }
            
            // Gentle horizontal drag
            this.vx *= 0.98;

            // Interactive cursor - push wisps away
            const dx = this.x - cursor.x;
            const dy = this.y - cursor.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < config.cursorRadius && dist > 0) {
                // Strong push away from cursor
                const force = Math.pow(1 - dist / config.cursorRadius, 2) * config.cursorForce;
                const nx = dx / dist;
                const ny = dy / dist;
                this.vx += nx * force;
                this.vy += ny * force;
                
                // Also react to cursor movement direction
                this.vx += cursor.vx * 0.1 * (1 - dist / config.cursorRadius);
                this.vy += cursor.vy * 0.1 * (1 - dist / config.cursorRadius);
            }

            // Update position
            this.x += this.vx;
            this.y += this.vy;

            // Decay life
            this.life--;

            return this.life > 0 && this.y > -this.size;
        }

        draw() {
            const lifeRatio = this.life / this.maxLife;
            
            // Smooth fade in/out
            let alpha;
            if (lifeRatio > 0.85) {
                alpha = (1 - lifeRatio) / 0.15 * config.baseOpacity;
            } else if (lifeRatio < 0.25) {
                alpha = (lifeRatio / 0.25) * config.baseOpacity;
            } else {
                alpha = config.baseOpacity;
            }
            
            const size = this.size * (1 + (1 - lifeRatio) * 0.4);
            const sizeX = size * this.stretchX;
            const sizeY = size * this.stretchY;

            // Ethereal gradient
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, Math.max(sizeX, sizeY)
            );
            
            const { r, g, b } = this.color;
            
            gradient.addColorStop(0, `rgba(${r + 50}, ${g + 50}, ${b + 50}, ${alpha * 0.8})`);
            gradient.addColorStop(0.25, `rgba(${r + 25}, ${g + 25}, ${b + 25}, ${alpha * 0.5})`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
            gradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, ${alpha * 0.1})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.save();
            ctx.translate(this.x, this.y);
            
            // Subtle wobble
            const wobble = Math.sin(time * 0.004 + this.phase) * 0.08;
            ctx.scale(this.stretchX + wobble, this.stretchY - wobble * 0.5);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Emit new wisps from bottom
    function emitWisps() {
        while (wisps.length < config.wispCount) {
            const margin = width * 0.05;
            const x = margin + Math.random() * (width - margin * 2);
            const y = height + 50 + Math.random() * 100;
            wisps.push(new Wisp(x, y));
        }
    }

    // Animation loop
    function animate() {
        time++;
        
        // Clear with very subtle trail
        ctx.fillStyle = 'rgba(5, 5, 12, 0.04)';
        ctx.fillRect(0, 0, width, height);

        // Emit new wisps
        emitWisps();

        // Screen blend for ethereal glow
        ctx.globalCompositeOperation = 'screen';
        
        wisps = wisps.filter(wisp => {
            const alive = wisp.update();
            if (alive) {
                wisp.draw();
            }
            return alive;
        });

        // Extra glow layer
        ctx.globalCompositeOperation = 'lighter';
        wisps.forEach(wisp => {
            const lifeRatio = wisp.life / wisp.maxLife;
            if (lifeRatio > 0.15 && lifeRatio < 0.85) {
                const alpha = config.baseOpacity * 0.12;
                const size = wisp.size * 1.3;
                
                const gradient = ctx.createRadialGradient(
                    wisp.x, wisp.y, 0,
                    wisp.x, wisp.y, size
                );
                
                gradient.addColorStop(0, `rgba(80, 160, 200, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(50, 100, 150, ${alpha * 0.3})`);
                gradient.addColorStop(1, 'rgba(30, 70, 120, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(wisp.x, wisp.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.globalCompositeOperation = 'source-over';

        requestAnimationFrame(animate);
    }

    // Resize handler
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        
        ctx.fillStyle = 'rgb(5, 5, 12)';
        ctx.fillRect(0, 0, width, height);
    }

    // Track cursor position AND velocity for reactive interaction
    window.addEventListener('mousemove', e => {
        cursor.vx = e.clientX - cursor.lastX;
        cursor.vy = e.clientY - cursor.lastY;
        cursor.lastX = cursor.x;
        cursor.lastY = cursor.y;
        cursor.x = e.clientX;
        cursor.y = e.clientY;
    });

    window.addEventListener('touchmove', e => {
        e.preventDefault();
        const touch = e.touches[0];
        cursor.vx = touch.clientX - cursor.lastX;
        cursor.vy = touch.clientY - cursor.lastY;
        cursor.lastX = cursor.x;
        cursor.lastY = cursor.y;
        cursor.x = touch.clientX;
        cursor.y = touch.clientY;
    }, { passive: false });

    window.addEventListener('resize', resize);

    // Initialize
    resize();
    
    // Pre-populate wisps across the screen
    for (let i = 0; i < config.wispCount; i++) {
        const margin = width * 0.05;
        const x = margin + Math.random() * (width - margin * 2);
        const y = height * 0.2 + Math.random() * height * 0.7;
        const wisp = new Wisp(x, y);
        wisp.life = Math.random() * wisp.maxLife * 0.6 + wisp.maxLife * 0.4;
        wisps.push(wisp);
    }

    animate();

    console.log('Interactive nebula effect initialized');
})();
