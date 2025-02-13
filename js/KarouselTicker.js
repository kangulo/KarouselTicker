class KarouselTicker {
    constructor(container) {
      this.container = container;
      this.track = container.querySelector('.karousel-track');
      this.items = Array.from(this.track.children);
      
      // Read configuration from data attributes
      this.direction = container.dataset.direction || 'right-to-left';
      this.speed = parseFloat(container.dataset.speed) || 1;
      this.pauseOnHover = container.dataset.pauseOnHover === 'true';
      
      this.position = 0;
      this.isAnimating = true;
      
      this.init();
    }
  
    init() {
      // Calculate container and content dimensions
      const containerWidth = this.track.parentElement.offsetWidth;
      const itemWidth = this.items[0].offsetWidth + 
                        parseInt(getComputedStyle(this.items[0]).marginRight);
      const totalWidth = itemWidth * this.items.length;
      
      // Calculate how many complete sets we need
      const setsNeeded = Math.ceil((containerWidth * 2) / totalWidth) + 1;
  
      // Clone items to fill the space
      for (let i = 0; i < setsNeeded; i++) {
        this.items.forEach(item => {
          const clone = item.cloneNode(true);
          this.track.appendChild(clone);
        });
      }
  
      // Set initial position and dimensions
      this.position = 0;
      this.itemWidth = itemWidth;
      this.totalWidth = totalWidth;
  
      // Add pause on hover functionality if enabled
      if (this.pauseOnHover) {
        this.container.addEventListener('mouseenter', () => this.pause());
        this.container.addEventListener('mouseleave', () => this.resume());
      }
  
      // Start animation
      this.animate();
    }
  
    animate() {
      if (!this.isAnimating) return;
  
      // Move based on direction
      if (this.direction === 'right-to-left') {
        this.position -= this.speed;
        this.track.style.transform = `translateX(${this.position}px)`;
  
        // When first set moves out, reset to create seamless loop
        if (Math.abs(this.position) >= this.totalWidth) {
          this.position = 0;
        }
      } else if (this.direction === 'left-to-right') {
        this.position += this.speed;
        this.track.style.transform = `translateX(${this.position}px)`;
  
        // When first set moves out from the other side, reset
        if (this.position >= 0) {
          this.position = -this.totalWidth;
        }
      }
  
      requestAnimationFrame(() => this.animate());
    }
  
    pause() {
      this.isAnimating = false;
    }
  
    resume() {
      this.isAnimating = true;
      this.animate();
    }
  }
