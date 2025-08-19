// --- INPUT HANDLING ---
class InputHandler {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.analog = { active: false, angle: 0 };
        this.aimStick = { active: false, startX: 0, startY: 0, angle: 0 };
        this.isFiring = false;

        if (isTouchDevice) {
            this.setupMobileControls();
        } else {
            this.setupDesktopControls();
        }
    }
    
    setupDesktopControls() {
        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        canvas.addEventListener('mousedown', () => { this.isFiring = true; });
        canvas.addEventListener('mouseup', () => { this.isFiring = false; });
    }

    setupMobileControls() {
        // Analog Stick for Movement
        let stickCenterX, stickCenterY, stickRadius;
        const stickStart = (e) => {
            e.preventDefault();
            const rect = analogStick.getBoundingClientRect();
            stickCenterX = rect.left + rect.width / 2;
            stickCenterY = rect.top + rect.height / 2;
            stickRadius = rect.width / 2;
            this.analog.active = true;
            stickMove(e);
        };
        const stickMove = (e) => {
            e.preventDefault();
            if (!this.analog.active) return;
            const touch = e.touches[0];
            let dx = touch.clientX - stickCenterX;
            let dy = touch.clientY - stickCenterY;
            const distance = Math.hypot(dx, dy);
            if (distance > stickRadius) {
                dx = (dx / distance) * stickRadius;
                dy = (dy / distance) * stickRadius;
            }
            analogKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
            this.analog.angle = Math.atan2(dy, dx);
        };
        const stickEnd = (e) => {
            e.preventDefault();
            this.analog.active = false;
            analogKnob.style.transform = `translate(-50%, -50%)`;
        };
        analogStick.addEventListener('touchstart', stickStart, { passive: false });
        analogStick.addEventListener('touchmove', stickMove, { passive: false });
        analogStick.addEventListener('touchend', stickEnd, { passive: false });

        // Fire Button for Aiming and Firing
        const fireStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.isFiring = true;
            this.aimStick.active = true;
            this.aimStick.startX = touch.clientX;
            this.aimStick.startY = touch.clientY;
        };
        const fireMove = (e) => {
            if (!this.aimStick.active) return;
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - this.aimStick.startX;
            const dy = touch.clientY - this.aimStick.startY;
            if (Math.hypot(dx, dy) > 10) {
                 this.aimStick.angle = Math.atan2(dy, dx);
            }
        };
        const fireEnd = (e) => {
            if (this.aimStick.active) {
                this.isFiring = false;
                this.aimStick.active = false;
            }
        };
        mobileFireBtn.addEventListener('touchstart', fireStart, { passive: false });
        window.addEventListener('touchmove', fireMove, { passive: false });
        window.addEventListener('touchend', fireEnd, { passive: false });
    }
}