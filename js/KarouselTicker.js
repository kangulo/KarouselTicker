const KarouselRegistry = {
    instances: [],

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

    // Instances "entangled" with this one: same non-empty group, anywhere on the page.
    // Ungrouped instances (group === null) are never entangled with anything.
    entangledWith: function(instance) {
      if (!instance.group) return [];
      return this.instances.filter(other => other !== instance && other.group === instance.group);
    }
  };

  class KarouselTicker {
    constructor(container) {
        this.container = container;
        this.track = container.querySelector('.karousel-track');
        this.originalItems = Array.from(this.track.children);

        // Item styling required for the slider mechanism to lay items out correctly. Applied to
        // the originals (not per-clone) so cloneNode(true) — used both for measurement and for
        // building the final looped track — carries it to every copy automatically. Guarded with
        // `|| ...` so an item's own inline style (set in your markup) is never clobbered.
        this.originalItems.forEach(item => {
            item.style.flexShrink = item.style.flexShrink || '0';
            item.style.boxSizing = item.style.boxSizing || 'border-box';
            item.style.listStyle = item.style.listStyle || 'none'; // in case items are <li>s
            item.style.marginLeft = item.style.marginLeft || '10px';
        });

        // Read configuration from data attributes
        this.direction = container.dataset.direction || 'right-to-left';
        this.speed = parseFloat(container.dataset.speed) || 1;
        this.pauseOnHover = container.dataset.pauseOnHover === 'true';
        this.syncPause = container.dataset.syncPause !== 'false'; // Default to true
        this.draggable = container.dataset.draggable !== 'false'; // Default to true
        this.group = container.dataset.karouselGroup || null; // Carousels sharing a group are "entangled" for dragging

        this.position = 0;
        this.isAnimating = false;
        this.animationFrameId = null;

        // Drag state variables
        this.isDragging = false;
        this.isDragOrigin = false; // true only for the instance the user is actually pointing at
        this.isMomentumActive = false;
        this.startX = 0;
        this.currentX = 0;
        this.startPosition = 0;
        this.momentum = 0;
        this.lastDragTime = 0;
        this.lastDragX = 0;
        
        // Register this instance in the registry
        this.instanceId = KarouselRegistry.register(this);
        
        // Container styling required for the slider mechanism to work at all — kept here
        // rather than in an external stylesheet so the component is self-contained.
        this.container.style.visibility = 'visible';
        this.container.style.overflow = 'hidden'; // clip everything outside the visible window
        this.container.style.touchAction = 'pan-y'; // allow vertical page scroll, capture horizontal drag
        this.container.style.marginBottom = '10px';

        // Make the container behave like Bootstrap's .container-fluid, without relying on Bootstrap being loaded.
        // Break out of any constrained parent (e.g. a .container with a max-width) so it still spans the full viewport.
        this.container.style.position = 'relative';
        this.container.style.width = '100vw';
        this.container.style.left = '50%';
        this.container.style.right = '50%';
        this.container.style.marginLeft = '-50vw';
        this.container.style.marginRight = '-50vw';
        this.container.style.paddingRight = '0.75rem';
        this.container.style.paddingLeft = '0.75rem';

        // Track styling required for the slider mechanism to work at all
        this.track.style.display = 'flex';
        this.track.style.position = 'relative';
        this.track.style.willChange = 'transform';

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
        this.setsCount = sets;

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

        // Start from the middle set rather than the very first one. Every set holds identical,
        // repeated content, so this looks no different on screen — but it leaves a full buffer
        // of rendered items on both sides, so dragging in either direction (independent of the
        // configured/current `direction`) always has real content to reveal instead of a gap.
        this.position = -this.totalItemsWidth * Math.floor(this.setsCount / 2);

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

        // Anchors/images are natively draggable in the browser. If a link covers the whole item,
        // every mousedown lands on it, and the browser's own drag-and-drop hijacks the gesture
        // instead of dispatching mousemove events to us — so our drag never registers, the click
        // is never suppressed, and the link navigates even though the user was clearly dragging.
        // Cancelling dragstart keeps our mousedown/mousemove logic the only thing driving a drag.
        this.container.addEventListener('dragstart', e => e.preventDefault());
    }
    
    onDragStart(e) {
        if (!this.draggable) return;

        this.isDragging = true;
        this.isDragOrigin = true;
        this.isMomentumActive = false;
        this.startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        this.currentX = this.startX;
        this.startPosition = this.position;
        this.lastDragTime = Date.now();
        this.lastDragX = this.startX;

        this.container.style.cursor = 'grabbing';
        this.container.style.userSelect = 'none';

        // Entangled carousels (same data-karousel-group) start dragging in lockstep.
        // isDragOrigin stays false on these — their own mousemove/mouseup listeners must
        // no-op, since they never received their own mousedown and have no real startX.
        KarouselRegistry.entangledWith(this).forEach(instance => {
            instance.isDragging = true;
            instance.isDragOrigin = false;
            instance.isMomentumActive = false;
            instance.startPosition = instance.position;
            instance.startX = this.startX;
            instance.currentX = this.currentX;
            instance.container.style.cursor = 'grabbing';
            instance.container.style.userSelect = 'none';
        });
    }

    onDragMove(e) {
        if (!this.isDragging || !this.isDragOrigin) return;
        if (e.cancelable) e.preventDefault();

        this.currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const dragDistance = this.currentX - this.startX;

        this.position = this.startPosition + dragDistance;
        this.checkAndRepositionIfNeeded();
        this.updatePosition();

        // Entangled carousels move by the same pixel delta, regardless of their own item widths
        KarouselRegistry.entangledWith(this).forEach(instance => {
            instance.position = instance.startPosition + dragDistance;
            instance.checkAndRepositionIfNeeded();
            instance.updatePosition();
            instance.currentX = this.currentX;
        });

        const now = Date.now();
        const elapsed = now - this.lastDragTime;

        if (elapsed > 5) {
          this.momentum = (this.currentX - this.lastDragX) / elapsed;
          this.lastDragTime = now;
          this.lastDragX = this.currentX;
        }
    }



    onDragEnd(e) {
        if (!this.isDragging || !this.isDragOrigin) return;

        this.isDragging = false;
        this.isDragOrigin = false;

        this.container.style.cursor = 'grab';
        this.container.style.userSelect = '';

        // Calculate momentum only once
        const now = Date.now();
        const elapsed = now - this.lastDragTime;
        const finalMomentum = (this.currentX - this.lastDragX) / (elapsed || 1);

        this.momentum = finalMomentum;

        const dragDistance = this.currentX - this.startX;

        // Start momentum animation, then resume ticking in whichever direction was just dragged
        this.startMomentum(dragDistance);

        // Entangled carousels release, and continue, in unison with this one
        KarouselRegistry.entangledWith(this).forEach(instance => {
            instance.isDragging = false;
            instance.container.style.cursor = 'grab';
            instance.container.style.userSelect = '';
            instance.momentum = this.momentum;
            instance.startMomentum(dragDistance);
        });
    }



    startMomentum(dragDistance) {
        // Continue the idle ticker in the direction the user just dragged, instead of
        // snapping back to whatever direction the carousel started with.
        if (dragDistance) {
            this.direction = dragDistance > 0 ? 'left-to-right' : 'right-to-left';
        }

        if (!this.momentum) {
            this.checkAndRepositionIfNeeded();
            return;
        }

        this.isMomentumActive = true;
        this.applyMomentum(this.momentum * 200);
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
                this.isMomentumActive = false;
                this.checkAndRepositionIfNeeded();
                this.resume();
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

    updatePosition() {
        //this.track.style.transform = `translateX(${this.position}px)`;
        this.track.style.transform = `translate3d(${this.position}px, 0, 0)`;
    }
    
    checkAndRepositionIfNeeded() {
        // Content repeats every totalItemsWidth px, so keep `position` within a band that
        // always has a full rendered set of buffer on both sides. This has to be independent
        // of `this.direction` — during a drag, the user can move either way regardless of
        // which way the carousel happens to be configured to auto-scroll.
        const period = this.totalItemsWidth;
        const minPosition = -period * (this.setsCount - 1); // one set of buffer at the far end
        const maxPosition = -period; // one set of buffer at the start

        let shifted = 0;
        while (this.position > maxPosition) {
            this.position -= period;
            shifted -= period;
        }
        while (this.position < minPosition) {
            this.position += period;
            shifted += period;
        }

        if (shifted !== 0) {
            // Keep drag math anchored correctly across the wrap
            this.startPosition += shifted;
            this.updatePosition();
        }
    }

    animate() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (!this.isAnimating || this.isDragging || this.isMomentumActive) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
            return;
        }

        if (this.direction === 'right-to-left') {
            this.position -= this.speed;
        } else if (this.direction === 'left-to-right') {
            this.position += this.speed;
        }

        this.checkAndRepositionIfNeeded();
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