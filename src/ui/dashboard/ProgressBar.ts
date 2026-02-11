/**
 * ProgressBar Component
 * Animated progress bar with Sakura theme styling
 */

export interface ProgressBarConfig {
  value: number;
  max?: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'striped' | 'animated';
  label?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  animated?: boolean;
}

export class ProgressBar {
  private container: HTMLElement;
  private progressElement: HTMLElement;
  private labelElement: HTMLElement | null = null;
  private percentageElement: HTMLElement | null = null;
  private config: Required<ProgressBarConfig>;

  constructor(config: ProgressBarConfig) {
    this.config = {
      max: 100,
      showPercentage: true,
      size: 'md',
      variant: 'gradient',
      label: '',
      color: 'primary',
      animated: true,
      ...config
    };

    this.container = this.createContainer();
    this.progressElement = this.createProgressElement();
    this.assemble();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'mia-progress-container';
    container.style.cssText = `
      width: 100%;
      margin-bottom: var(--mia-space-md);
    `;
    return container;
  }

  private createProgressElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'mia-progress-wrapper';
    wrapper.style.cssText = `
      position: relative;
      background: var(--mia-bg-tertiary);
      border-radius: var(--mia-radius-full);
      overflow: hidden;
      ${this.getSizeStyles()}
    `;

    const progress = document.createElement('div');
    progress.className = `mia-progress-fill ${this.config.variant}`;
    progress.style.cssText = `
      height: 100%;
      border-radius: var(--mia-radius-full);
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      ${this.getVariantStyles()}
      ${this.getColorStyles()}
    `;

    // Set initial width
    const percentage = this.calculatePercentage();
    progress.style.width = `${percentage}%`;

    // Add shimmer effect for animated variant
    if (this.config.variant === 'animated' || this.config.animated) {
      const shimmer = document.createElement('div');
      shimmer.className = 'mia-progress-shimmer';
      shimmer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.3) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: mia-progress-shimmer 2s infinite;
      `;
      progress.appendChild(shimmer);
    }

    // Add glow effect at high percentages
    if (percentage >= 90) {
      progress.classList.add('mia-progress-glow');
    }

    wrapper.appendChild(progress);

    return wrapper;
  }

  private getSizeStyles(): string {
    const sizes = {
      sm: 'height: 6px;',
      md: 'height: 10px;',
      lg: 'height: 16px;'
    };
    return sizes[this.config.size];
  }

  private getVariantStyles(): string {
    const variants = {
      default: 'background: var(--mia-primary);',
      gradient: `background: linear-gradient(90deg, 
        var(--mia-primary) 0%, 
        var(--mia-secondary) 50%, 
        var(--mia-accent) 100%);`,
      striped: `
        background: repeating-linear-gradient(
          45deg,
          var(--mia-primary),
          var(--mia-primary) 10px,
          var(--mia-accent) 10px,
          var(--mia-accent) 20px
        );
      `,
      animated: `
        background: linear-gradient(90deg, 
          var(--mia-primary) 0%, 
          var(--mia-secondary) 50%, 
          var(--mia-accent) 100%);
        position: relative;
      `
    };
    return variants[this.config.variant];
  }

  private getColorStyles(): string {
    const colors = {
      primary: '', // Uses default gradient
      success: 'background: linear-gradient(90deg, #86efac 0%, #22c55e 100%) !important;',
      warning: 'background: linear-gradient(90deg, #fcd34d 0%, #f59e0b 100%) !important;',
      error: 'background: linear-gradient(90deg, #fca5a5 0%, #ef4444 100%) !important;'
    };
    return colors[this.config.color];
  }

  private createLabel(): HTMLElement {
    const labelContainer = document.createElement('div');
    labelContainer.className = 'mia-progress-label';
    labelContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--mia-space-sm);
      font-size: 0.875rem;
      color: var(--mia-text-secondary);
    `;

    const labelText = document.createElement('span');
    labelText.textContent = this.config.label;
    labelText.style.fontWeight = '500';
    labelContainer.appendChild(labelText);

    if (this.config.showPercentage) {
      this.percentageElement = document.createElement('span');
      this.percentageElement.className = 'mia-progress-percentage';
      this.percentageElement.textContent = `${this.calculatePercentage()}%`;
      this.percentageElement.style.cssText = `
        font-weight: 600;
        color: var(--mia-accent);
      `;
      labelContainer.appendChild(this.percentageElement);
    }

    return labelContainer;
  }

  private calculatePercentage(): number {
    const percentage = (this.config.value / this.config.max) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  }

  private assemble(): void {
    if (this.config.label || this.config.showPercentage) {
      this.labelElement = this.createLabel();
      this.container.appendChild(this.labelElement);
    }

    this.container.appendChild(this.progressElement);
  }

  /**
   * Update the progress value with animation
   */
  setValue(value: number, animate: boolean = true): void {
    this.config.value = Math.min(Math.max(value, 0), this.config.max);
    const percentage = this.calculatePercentage();

    const progressBar = this.progressElement.querySelector('.mia-progress-fill') as HTMLElement;
    if (progressBar) {
      if (animate) {
        progressBar.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      } else {
        progressBar.style.transition = 'none';
      }
      progressBar.style.width = `${percentage}%`;

      // Add/remove glow based on percentage
      if (percentage >= 90) {
        progressBar.classList.add('mia-progress-glow');
      } else {
        progressBar.classList.remove('mia-progress-glow');
      }
    }

    if (this.percentageElement) {
      this.animateNumber(percentage);
    }
  }

  /**
   * Animate the number counting up/down
   */
  private animateNumber(targetPercentage: number): void {
    if (!this.percentageElement) return;

    const startValue = parseInt(this.percentageElement.textContent || '0', 10);
    const duration = 600;
    const startTime = performance.now();

    const updateNumber = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(startValue + (targetPercentage - startValue) * easeOutCubic);
      this.percentageElement!.textContent = `${currentValue}%`;

      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      }
    };

    requestAnimationFrame(updateNumber);
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Create a goal progress bar (convenience method)
   */
  static createGoalProgress(
    current: number,
    goal: number,
    label: string = 'Daily Goal'
  ): ProgressBar {
    return new ProgressBar({
      value: current,
      max: goal,
      label,
      variant: 'gradient',
      size: 'lg',
      animated: true
    });
  }

  /**
   * Create a streak progress bar
   */
  static createStreakProgress(streak: number, maxStreak: number = 30): ProgressBar {
    return new ProgressBar({
      value: streak,
      max: maxStreak,
      label: `Streak Progress (${streak} days)`,
      variant: 'animated',
      size: 'md',
      color: streak >= 7 ? 'success' : 'primary',
      showPercentage: true
    });
  }
}

/**
 * Circular Progress Bar variant
 */
export class CircularProgressBar {
  private svg: SVGSVGElement;
  private circle: SVGCircleElement;
  private config: { value: number; max: number; size: number; strokeWidth: number };

  constructor(config: { value: number; max?: number; size?: number; strokeWidth?: number }) {
    this.config = {
      max: 100,
      size: 120,
      strokeWidth: 8,
      ...config
    };

    this.svg = this.createSVG();
    this.circle = this.createCircle();
    this.assemble();
  }

  private createSVG(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(this.config.size));
    svg.setAttribute('height', String(this.config.size));
    svg.setAttribute('viewBox', `0 0 ${this.config.size} ${this.config.size}`);
    svg.style.transform = 'rotate(-90deg)';
    return svg;
  }

  private createCircle(): SVGCircleElement {
    const radius = (this.config.size - this.config.strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Background circle
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', String(this.config.size / 2));
    bgCircle.setAttribute('cy', String(this.config.size / 2));
    bgCircle.setAttribute('r', String(radius));
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--mia-border)');
    bgCircle.setAttribute('stroke-width', String(this.config.strokeWidth));
    this.svg.appendChild(bgCircle);

    // Progress circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(this.config.size / 2));
    circle.setAttribute('cy', String(this.config.size / 2));
    circle.setAttribute('r', String(radius));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'url(#mia-gradient)');
    circle.setAttribute('stroke-width', String(this.config.strokeWidth));
    circle.setAttribute('stroke-linecap', 'round');
    circle.setAttribute('stroke-dasharray', String(circumference));
    circle.setAttribute('stroke-dashoffset', String(circumference));
    circle.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)';

    // Add gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'mia-gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#ffb7c5');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#ff69b4');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    this.svg.appendChild(defs);

    return circle;
  }

  private assemble(): void {
    this.svg.appendChild(this.circle);
    this.updateProgress(this.config.value);
  }

  setValue(value: number): void {
    this.config.value = value;
    this.updateProgress(value);
  }

  private updateProgress(value: number): void {
    const radius = (this.config.size - this.config.strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(Math.max(value / this.config.max, 0), 1);
    const offset = circumference - (percentage * circumference);
    
    this.circle.setAttribute('stroke-dashoffset', String(offset));
  }

  getElement(): SVGSVGElement {
    return this.svg;
  }
}
