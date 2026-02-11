/**
 * StatsCard Component
 * Beautiful statistic cards with Sakura theme
 */

export interface StatsCardConfig {
  title: string;
  value: string | number;
  icon?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
  onClick?: () => void;
}

export class StatsCard {
  private element: HTMLElement;
  private valueElement: HTMLElement;
  private config: StatsCardConfig;

  constructor(config: StatsCardConfig) {
    this.config = config;
    this.element = this.createCard();
    this.valueElement = this.element.querySelector('.mia-stat-value') as HTMLElement;
  }

  private createCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mia-card mia-stat-card';
    card.style.cssText = `
      background: var(--mia-bg-card);
      border: 1px solid var(--mia-border);
      border-radius: var(--mia-radius-lg);
      padding: var(--mia-space-lg);
      transition: all var(--mia-transition-base);
      position: relative;
      overflow: hidden;
      cursor: ${this.config.clickable ? 'pointer' : 'default'};
    `;

    // Add top accent border
    const accentBorder = document.createElement('div');
    accentBorder.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: ${this.getColorGradient()};
      opacity: 0;
      transition: opacity var(--mia-transition-base);
    `;
    card.appendChild(accentBorder);

    // Header with icon and title
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--mia-space-md);
    `;

    // Icon
    if (this.config.icon) {
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'mia-stat-icon';
      iconWrapper.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: var(--mia-radius-md);
        background: ${this.getColorBackground()};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        transition: all var(--mia-transition-base);
      `;
      iconWrapper.textContent = this.config.icon;
      header.appendChild(iconWrapper);
    }

    // Trend indicator
    if (this.config.trend && this.config.trendValue) {
      const trendBadge = this.createTrendBadge();
      header.appendChild(trendBadge);
    }

    card.appendChild(header);

    // Value
    const valueEl = document.createElement('div');
    valueEl.className = 'mia-stat-value';
    valueEl.style.cssText = `
      font-size: ${this.getValueSize()};
      font-weight: 700;
      color: var(--mia-text-primary);
      line-height: 1.2;
      margin-bottom: var(--mia-space-xs);
      background: ${this.getColorGradient()};
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;
    valueEl.textContent = String(this.config.value);
    card.appendChild(valueEl);

    // Title
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--mia-text-secondary);
    `;
    titleEl.textContent = this.config.title;
    card.appendChild(titleEl);

    // Subtitle
    if (this.config.subtitle) {
      const subtitleEl = document.createElement('div');
      subtitleEl.style.cssText = `
        font-size: 0.75rem;
        color: var(--mia-text-muted);
        margin-top: var(--mia-space-xs);
      `;
      subtitleEl.textContent = this.config.subtitle;
      card.appendChild(subtitleEl);
    }

    // Hover effects
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 12px 32px var(--mia-shadow)';
      accentBorder.style.opacity = '1';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      accentBorder.style.opacity = '0';
    });

    // Click handler
    if (this.config.clickable && this.config.onClick) {
      card.addEventListener('click', this.config.onClick);
    }

    // Add entrance animation
    card.classList.add('mia-stat-pop');
    card.style.animationDelay = `${Math.random() * 0.3}s`;

    return card;
  }

  private createTrendBadge(): HTMLElement {
    const trendColors = {
      up: 'rgba(34, 197, 94, 0.15)',
      down: 'rgba(239, 68, 68, 0.15)',
      neutral: 'rgba(156, 163, 175, 0.15)'
    };

    const trendIcons = {
      up: '↗',
      down: '↘',
      neutral: '→'
    };

    const trendTextColors = {
      up: '#22c55e',
      down: '#ef4444',
      neutral: '#9ca3af'
    };

    const badge = document.createElement('span');
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: ${trendColors[this.config.trend!]};
      color: ${trendTextColors[this.config.trend!]};
      border-radius: var(--mia-radius-full);
      font-size: 0.75rem;
      font-weight: 600;
    `;
    badge.textContent = `${trendIcons[this.config.trend!]} ${this.config.trendValue}`;

    return badge;
  }

  private getColorGradient(): string {
    const gradients: Record<string, string> = {
      primary: 'linear-gradient(135deg, #ffb7c5 0%, #ff69b4 100%)',
      secondary: 'linear-gradient(135deg, #ffd1dc 0%, #ffb7c5 100%)',
      accent: 'linear-gradient(135deg, #ff69b4 0%, #ff1493 100%)',
      success: 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)',
      warning: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
      error: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)'
    };
    return gradients[this.config.color || 'primary'];
  }

  private getColorBackground(): string {
    const backgrounds: Record<string, string> = {
      primary: 'rgba(255, 183, 197, 0.15)',
      secondary: 'rgba(255, 209, 220, 0.15)',
      accent: 'rgba(255, 105, 180, 0.15)',
      success: 'rgba(34, 197, 94, 0.15)',
      warning: 'rgba(245, 158, 11, 0.15)',
      error: 'rgba(239, 68, 68, 0.15)'
    };
    return backgrounds[this.config.color || 'primary'];
  }

  private getValueSize(): string {
    const sizes = {
      sm: '1.5rem',
      md: '2rem',
      lg: '2.5rem'
    };
    return sizes[this.config.size || 'md'];
  }

  /**
   * Update the card value with animation
   */
  setValue(newValue: string | number): void {
    const oldValue = this.valueElement.textContent || '';
    
    // Animate the change
    this.valueElement.style.animation = 'none';
    this.valueElement.offsetHeight; // Trigger reflow
    this.valueElement.classList.add('mia-stat-increment');
    this.valueElement.textContent = String(newValue);

    // Update config
    this.config.value = newValue;

    // Remove animation class after it completes
    setTimeout(() => {
      this.valueElement.classList.remove('mia-stat-increment');
    }, 300);
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Create a streak card with fire emoji
   */
  static createStreakCard(streak: number, record: number): StatsCard {
    const isRecord = streak >= record;
    const isHot = streak >= 7;

    return new StatsCard({
      title: 'Day Streak',
      value: `${streak} 🔥`,
      icon: isHot ? '🔥' : '⭐',
      subtitle: isRecord ? 'New record! 🎉' : `Record: ${record} days`,
      color: isHot ? 'accent' : 'primary',
      size: 'lg',
      trend: streak > 0 ? 'up' : 'neutral',
      trendValue: streak > 0 ? 'On fire!' : 'Start today'
    });
  }

  /**
   * Create a word count card
   */
  static createWordCountCard(count: number, goal: number): StatsCard {
    const percentage = Math.round((count / goal) * 100);
    const isGoalMet = count >= goal;

    return new StatsCard({
      title: 'Words Written',
      value: count.toLocaleString(),
      icon: '✍️',
      subtitle: isGoalMet 
        ? `Goal reached! ${percentage}% 🎉`
        : `${percentage}% of ${goal.toLocaleString()} goal`,
      color: isGoalMet ? 'success' : 'primary',
      size: 'lg',
      trend: count > goal * 0.5 ? 'up' : 'neutral',
      trendValue: isGoalMet ? 'Completed!' : `${(goal - count).toLocaleString()} to go`
    });
  }

  /**
   * Create a notes count card
   */
  static createNotesCard(count: number, createdToday: number): StatsCard {
    return new StatsCard({
      title: 'Notes Created',
      value: count.toLocaleString(),
      icon: '📝',
      subtitle: createdToday > 0 ? `+${createdToday} today` : 'No new notes today',
      color: createdToday > 0 ? 'success' : 'secondary',
      size: 'md',
      trend: createdToday > 0 ? 'up' : 'neutral',
      trendValue: createdToday > 0 ? `+${createdToday}` : '0'
    });
  }

  /**
   * Create a tasks card
   */
  static createTasksCard(completed: number, total: number): StatsCard {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isAllDone = completed === total && total > 0;

    return new StatsCard({
      title: 'Tasks Completed',
      value: `${completed}/${total}`,
      icon: isAllDone ? '✅' : '📋',
      subtitle: isAllDone ? 'All caught up! 🎊' : `${percentage}% complete`,
      color: isAllDone ? 'success' : percentage > 50 ? 'primary' : 'warning',
      size: 'md',
      trend: percentage > 50 ? 'up' : 'neutral',
      trendValue: `${percentage}%`
    });
  }
}

/**
 * Stats Grid Component - Container for multiple stat cards
 */
export class StatsGrid {
  private element: HTMLElement;
  private cards: StatsCard[] = [];

  constructor(columns: number = 4) {
    this.element = document.createElement('div');
    this.element.className = 'mia-stats-grid';
    this.element.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: var(--mia-space-lg);
      margin-bottom: var(--mia-space-xl);
    `;

    // Responsive adjustments
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 1024px) {
        .mia-stats-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }
      }
      @media (max-width: 640px) {
        .mia-stats-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  addCard(card: StatsCard): void {
    this.cards.push(card);
    this.element.appendChild(card.getElement());
  }

  removeCard(index: number): void {
    if (index >= 0 && index < this.cards.length) {
      const card = this.cards[index];
      card.getElement().remove();
      this.cards.splice(index, 1);
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Create a default dashboard stats grid
   */
  static createDefaultGrid(data: {
    streak: number;
    record: number;
    words: number;
    wordGoal: number;
    notes: number;
    notesToday: number;
    tasksCompleted: number;
    tasksTotal: number;
  }): StatsGrid {
    const grid = new StatsGrid(4);
    
    grid.addCard(StatsCard.createStreakCard(data.streak, data.record));
    grid.addCard(StatsCard.createWordCountCard(data.words, data.wordGoal));
    grid.addCard(StatsCard.createNotesCard(data.notes, data.notesToday));
    grid.addCard(StatsCard.createTasksCard(data.tasksCompleted, data.tasksTotal));

    return grid;
  }
}
