const KarouselRegistry = {
    instances: [],
    dragMaster: null,
        
    // Register a new instance
    register: function(instance) {
      this.instances.push(instance);
      return this.instances.length - 1; // Return the index as ID
    },
    
    // Pause all instances
    pauseAll: function() {
      this.instances.forEach(instance => instance.pause());
    },
    
    // Resume all instances
    resumeAll: function() {
      this.instances.forEach(instance => instance.resume());
    },

    syncDrag: function (delta, originId) {
        this.instances.forEach((instance, id) => {
            if (id !== originId && instance.isDragging) {
            instance.externalDrag(delta);
            }
        });
    },

    syncToPosition: function(position, originId) {
        this.instances.forEach((instance, id) => {
          if (id !== originId && instance.isDragging) {
            instance.setExternalPosition(position);
          }
        });
    },

    syncMomentum: function({ position, momentum }, originId) {
        this.instances.forEach((instance, id) => {
          if (id !== originId) {
            instance.applySyncedMomentum(position, momentum);
          }
        });
      }
  };

  class KarouselTicker {
    constructor(container) {
        this.container = container;
        this.track = container.querySelector('.karousel-track');
        this.originalItems = Array.from(this.track.children);

        // Read configuration from data attributes
        this.direction = container.dataset.direction || 'right-to-left';
        this.speed = parseFloat(container.dataset.speed) || 1;
        this.pauseOnHover = container.dataset.pauseOnHover === 'true';
        this.syncPause = container.dataset.syncPause !== 'false'; // Default to true
        this.draggable = container.dataset.draggable !== 'false'; // Default to true

        this.position = 0;
        this.isAnimating = false;
        this.animationFrameId = null;
        this.resetPoint = null; // Track the exact pixel position for reset
        
        // Drag state variables
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.startPosition = 0;
        this.momentum = 0;
        this.lastDragTime = 0;
        this.lastDragX = 0;
        
        // Register this instance in the registry
        this.instanceId = KarouselRegistry.register(this);
        
        // Ensure container is visible and has overflow hidden
        this.container.style.visibility = 'visible';
        this.container.style.overflow = 'hidden';
        
        // Initial track styling
        this.track.style.display = 'flex';
        this.track.style.position = 'relative';
        this.track.style.willChange = 'transform';
        this.track.style.transition = 'none'; // Disable transition for initial setup
        
        // Load images then initialize
        this.preloadImages().then(() => {
            this.init();
        });
    }
    
    preloadImages() {
        const imageLoadPromises = [];
        const images = this.container.querySelectorAll('img');
        
        images.forEach(img => {
            if (!img.complete) {
                const promise = new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
                imageLoadPromises.push(promise);
            }
        });
        
        return Promise.all(imageLoadPromises).catch(() => {
            console.warn('Some images failed to load in KarouselTicker');
        });
    }

    init() {
        // Measure originals first
        this.track.innerHTML = '';
        this.originalItems.forEach(item => {
            this.track.appendChild(item.cloneNode(true));
        });
        
        // Perform measurements
        this.items = Array.from(this.track.children);
        this.calculateDimensions();
        
        // Now create the full track with duplicates
        this.setupCarouselItems();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start animation
        this.isAnimating = true;
        this.animate();
    }
    
    calculateDimensions() {
        this.itemMeasurements = [];
        let totalWidth = 0;
        
        this.items.forEach(item => {
            const rect = item.getBoundingClientRect();
            const styles = window.getComputedStyle(item);
            
            const marginLeft = parseFloat(styles.marginLeft) || 0;
            const marginRight = parseFloat(styles.marginRight) || 0;
            const fullWidth = rect.width + marginLeft + marginRight;
            
            this.itemMeasurements.push({
                width: rect.width,
                marginLeft: marginLeft,
                marginRight: marginRight,
                fullWidth: fullWidth
            });
            
            totalWidth += fullWidth;
        });
        
        // This is critical for pixel-perfect looping
        this.totalItemsWidth = totalWidth;
        
        // Log this to confirm exact measurement
        console.log("Total set width:", this.totalItemsWidth);
    }
    
    setupCarouselItems() {
        const containerWidth = this.container.offsetWidth;
        const sets = Math.max(5, Math.ceil((containerWidth * 5) / this.totalItemsWidth));
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create multiple complete sets
        for (let i = 0; i < sets; i++) {
            this.originalItems.forEach((item, j) => {
                const clone = item.cloneNode(true);
                clone.style.boxSizing = 'border-box';
                
                // Set the exact width 
                const itemWidth = this.itemMeasurements[j].width;
                clone.style.width = `${itemWidth}px`;
                
                // Add margins explicitly to prevent rounding issues
                clone.style.marginLeft = `${this.itemMeasurements[j].marginLeft}px`;
                clone.style.marginRight = `${this.itemMeasurements[j].marginRight}px`;
                
                // Mark item for debugging
                clone.setAttribute('data-karousel-set', i);
                clone.setAttribute('data-karousel-index', j);
                
                fragment.appendChild(clone);
            });
        }
        
        // Clear and append all at once for better performance
        this.track.innerHTML = '';
        this.track.appendChild(fragment);
        
        // Calculate the reset point - exact pixel where we need to reset
        // This is critical for smooth looping
        this.resetPoint = -this.totalItemsWidth;
        
        // Set initial position
        this.position = 0;
        if (this.direction === 'left-to-right') {
            this.position = this.resetPoint;
        }
        
        this.track.style.transform = `translateX(${this.position}px)`;
    }
    
    setupEventListeners() {
        if (this.pauseOnHover) {
            if (this.syncPause) {
                this.container.addEventListener('mouseenter', () => KarouselRegistry.pauseAll());
                this.container.addEventListener('mouseleave', () => KarouselRegistry.resumeAll());
            } else {
                this.container.addEventListener('mouseenter', () => this.pause());
                this.container.addEventListener('mouseleave', () => this.resume());
            }
        }
        
        if (this.draggable) {
            this.setupDragListeners();
        }
        
        window.addEventListener('resize', this.debounce(() => this.init(), 250));
    }
    
    setupDragListeners() {
        this.container.style.cursor = 'grab';
        
        this.container.addEventListener('mousedown', this.onDragStart.bind(this));
        window.addEventListener('mousemove', this.onDragMove.bind(this));
        window.addEventListener('mouseup', this.onDragEnd.bind(this));
        
        this.container.addEventListener('touchstart', this.onDragStart.bind(this), { passive: true });
        window.addEventListener('touchmove', this.onDragMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onDragEnd.bind(this));
        
        this.container.addEventListener('click', this.preventClickDuringDrag.bind(this), true);
    }
    
    onDragStart(e) {
        if (!this.draggable) return;
        
        this.isDragging = true;
        this.startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        this.currentX = this.startX;
        this.startPosition = this.position;
        this.lastDragTime = Date.now();
        this.lastDragX = this.startX;
        KarouselRegistry.dragMaster = this; // <--- Set master
      
        this.container.style.cursor = 'grabbing';
        this.container.style.userSelect = 'none';
      
        // Notify others to enter drag mode too
        KarouselRegistry.instances.forEach((instance, id) => {
          if (instance !== this) {
            instance.isDragging = true;
            instance.startPosition = instance.position;
          }
        });
      
        KarouselRegistry.pauseAll();
    }
      
    onDragMove(e) {
        if (!this.isDragging) return;
        if (e.cancelable) e.preventDefault();
      
        this.currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const dragDistance = this.currentX - this.startX;
      
        this.position = this.startPosition + dragDistance;
        this.updatePosition();
      
        // Sync to absolute position
        KarouselRegistry.syncToPosition(this.position, this.instanceId);

        KarouselRegistry.broadcastDrag(deltaX, this.instanceId); // <- Sync others
      
        const now = Date.now();
        const elapsed = now - this.lastDragTime;
      
        if (elapsed > 5) {
          this.momentum = (this.currentX - this.lastDragX) / elapsed;
          this.lastDragTime = now;
          this.lastDragX = this.currentX;
        }
    }
      
      
    
    onDragEnd(e) {
        if (!this.isDragging) return;
      
        this.isDragging = false;
        KarouselRegistry.dragMaster = null;
      
        // Calculate momentum only once
        const now = Date.now();
        const elapsed = now - this.lastDragTime;
        const finalMomentum = (this.currentX - this.lastDragX) / (elapsed || 1);
      
        this.momentum = finalMomentum;
      
        // Start momentum animation
        this.startMomentum();
      
        // Sync all other carousels with this final state
        KarouselRegistry.syncMomentum({
          position: this.position,
          momentum: this.momentum,
        }, this.instanceId);
    }
      
      
    
    applyMomentum(momentumDistance) {
        const targetPosition = this.position + momentumDistance;
        
        let startTime = null;
        const duration = 500;
        const startPosition = this.position;
        const distance = targetPosition - startPosition;
        
        const momentumAnimation = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeProgress = 1 - Math.pow(1 - progress, 2);
            
            this.position = startPosition + (distance * easeProgress);
            this.updatePosition();
            
            if (progress < 1) {
                requestAnimationFrame(momentumAnimation);
            } else {
                this.checkAndRepositionIfNeeded();
                KarouselRegistry.resumeAll();
            }
        };
        
        requestAnimationFrame(momentumAnimation);
    }
    
    preventClickDuringDrag(e) {
        if (Math.abs(this.currentX - this.startX) > 5) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    externalDrag(delta) {
        this.position = this.startPosition + delta;
        this.updatePosition();
    }

    setExternalPosition(position) {
        this.position = position;
        this.updatePosition();
    }
      
    applySyncedMomentum(position, momentum) {
        this.position = position;
        this.momentum = momentum;
        this.updatePosition();
        this.startMomentum();
    }

    applyExternalDrag(deltaX) {
        this.position += deltaX;
        this.updatePosition();
      }
      
    
    updatePosition() {
        //this.track.style.transform = `translateX(${this.position}px)`;
        this.track.style.transform = `translate3d(${this.position}px, 0, 0)`;
    }
    
    checkAndRepositionIfNeeded() {
        // Critical function for seamless looping
        if (this.direction === 'right-to-left') {
            // Get the precise remainder of how far we've moved beyond one set
            const absPosition = Math.abs(this.position);
            //const remainder = absPosition % this.totalItemsWidth;
            const remainder = Math.round(absPosition % this.totalItemsWidth);

            
            // Only reposition if we've moved beyond a complete set
            if (absPosition >= this.totalItemsWidth) {
                // Reposition to show the same visual point but from the next set
                this.position = -remainder;
                this.updatePosition();
                // console.log("Loop reset at:", absPosition, "to", this.position);
            }
        } else if (this.direction === 'left-to-right') {
            if (this.position > 0) {
                // We've moved into positive territory, jump back
                const remainder = this.position % this.totalItemsWidth;
                this.position = -this.totalItemsWidth + remainder;
                this.updatePosition();
            } else if (Math.abs(this.position) >= this.totalItemsWidth * 2) {
                // We've moved too far in the negative direction
                const absPosition = Math.abs(this.position);
                const remainder = absPosition % this.totalItemsWidth;
                this.position = -this.totalItemsWidth - remainder;
                this.updatePosition();
            }
        }
    }
    
    animate() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (!this.isAnimating || this.isDragging) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        if (this.direction === 'right-to-left') {
            this.position -= this.speed;
            
            // Get the precise remainder to prevent 1px errors
            const absPosition = Math.abs(this.position);
            
            // Only reposition if we've moved beyond a complete set width
            if (absPosition >= this.totalItemsWidth) {
                // Calculate the exact remainder
                //const remainder = absPosition % this.totalItemsWidth;
                const remainder = Math.round(absPosition % this.totalItemsWidth);

                // Reposition to show the same visual point but from the next set
                this.position = -remainder;
                this.updatePosition();
                
                // For debugging
                // console.log("Animation loop reset at:", absPosition, "to", this.position);
            }
        } else if (this.direction === 'left-to-right') {
            this.position += this.speed;
            
            if (this.position > 0) {
                this.position -= this.totalItemsWidth;
            }
        }
        
        this.updatePosition();
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    pause() {
        this.isAnimating = false;
    }
    
    resume() {
        if (!this.isDragging && !this.isAnimating) {
            this.isAnimating = true;
        }
    }
    
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}