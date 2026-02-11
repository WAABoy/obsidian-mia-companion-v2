/**
 * CalendarHeader.ts - Month navigation header component
 * 
 * Features:
 * - Month/Year display
 * - Navigation arrows (← →)
 * - "Today" button
 * - Smooth animations
 * - Mobile-responsive layout
 */

export interface CalendarHeaderOptions {
    currentDate: Date;
    onPrevMonth?: () => void;
    onNextMonth?: () => void;
    onToday?: () => void;
    onMonthSelect?: (month: number) => void;
    onYearSelect?: (year: number) => void;
    minDate?: Date;
    maxDate?: Date;
}

export class CalendarHeader {
    private element: HTMLElement;
    private options: CalendarHeaderOptions;
    private monthLabel: HTMLElement;
    private prevButton: HTMLButtonElement;
    private nextButton: HTMLButtonElement;
    private todayButton: HTMLButtonElement;

    constructor(options: CalendarHeaderOptions) {
        this.options = options;
        this.element = this.createElement();
        this.monthLabel = this.element.querySelector('.mia-calendar-month-label') as HTMLElement;
        this.prevButton = this.element.querySelector('.mia-calendar-nav-prev') as HTMLButtonElement;
        this.nextButton = this.element.querySelector('.mia-calendar-nav-next') as HTMLButtonElement;
        this.todayButton = this.element.querySelector('.mia-calendar-nav-today') as HTMLButtonElement;
    }

    private createElement(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'mia-calendar-header';

        // Navigation section
        const navSection = document.createElement('div');
        navSection.className = 'mia-calendar-nav';

        // Previous month button
        this.prevButton = this.createNavButton(
            'chevron-left',
            'Previous month',
            () => this.handlePrevMonth()
        );
        this.prevButton.classList.add('mia-calendar-nav-prev');
        navSection.appendChild(this.prevButton);

        // Month/Year label (clickable for quick selection)
        this.monthLabel = document.createElement('button');
        this.monthLabel.className = 'mia-calendar-month-label';
        this.monthLabel.setAttribute('aria-live', 'polite');
        this.updateMonthLabel();
        navSection.appendChild(this.monthLabel);

        // Next month button
        this.nextButton = this.createNavButton(
            'chevron-right',
            'Next month',
            () => this.handleNextMonth()
        );
        this.nextButton.classList.add('mia-calendar-nav-next');
        navSection.appendChild(this.nextButton);

        header.appendChild(navSection);

        // Today button
        const todaySection = document.createElement('div');
        todaySection.className = 'mia-calendar-today-section';

        this.todayButton = document.createElement('button');
        this.todayButton.className = 'mia-calendar-nav-today';
        this.todayButton.textContent = 'Today';
        this.todayButton.setAttribute('aria-label', 'Go to today');
        this.todayButton.addEventListener('click', () => this.handleToday());
        todaySection.appendChild(this.todayButton);

        header.appendChild(todaySection);

        return header;
    }

    private createNavButton(
        iconName: string,
        ariaLabel: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'mia-calendar-nav-button';
        button.setAttribute('aria-label', ariaLabel);
        button.innerHTML = this.getIconSvg(iconName);
        button.addEventListener('click', onClick);
        return button;
    }

    private getIconSvg(name: string): string {
        // Lucide-style icons
        const icons: Record<string, string> = {
            'chevron-left': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
            'chevron-right': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
            'calendar': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
        };

        return icons[name] || '';
    }

    private updateMonthLabel(): void {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const month = monthNames[this.options.currentDate.getMonth()];
        const year = this.options.currentDate.getFullYear();

        this.monthLabel.innerHTML = `
            <span class="mia-calendar-month">${month}</span>
            <span class="mia-calendar-year">${year}</span>
        `;
        this.monthLabel.setAttribute('aria-label', `Current month: ${month} ${year}`);
    }

    private handlePrevMonth(): void {
        this.animateButton(this.prevButton);
        
        if (this.options.onPrevMonth) {
            this.options.onPrevMonth();
        }

        this.element.dispatchEvent(new CustomEvent('calendar:prevMonth', {
            bubbles: true,
        }));
    }

    private handleNextMonth(): void {
        this.animateButton(this.nextButton);
        
        if (this.options.onNextMonth) {
            this.options.onNextMonth();
        }

        this.element.dispatchEvent(new CustomEvent('calendar:nextMonth', {
            bubbles: true,
        }));
    }

    private handleToday(): void {
        this.animateButton(this.todayButton);
        
        if (this.options.onToday) {
            this.options.onToday();
        }

        this.element.dispatchEvent(new CustomEvent('calendar:today', {
            bubbles: true,
        }));
    }

    private animateButton(button: HTMLButtonElement): void {
        button.classList.add('mia-calendar-nav-animating');
        setTimeout(() => {
            button.classList.remove('mia-calendar-nav-animating');
        }, 200);
    }

    // Public API
    public getElement(): HTMLElement {
        return this.element;
    }

    public setDate(date: Date): void {
        this.options.currentDate = date;
        this.updateMonthLabel();
        this.updateButtonStates();
    }

    public updateButtonStates(): void {
        // Check min/max date constraints
        if (this.options.minDate) {
            const prevMonth = new Date(this.options.currentDate);
            prevMonth.setMonth(prevMonth.getMonth() - 1);
            this.prevButton.disabled = prevMonth < this.options.minDate;
        }

        if (this.options.maxDate) {
            const nextMonth = new Date(this.options.currentDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            this.nextButton.disabled = nextMonth > this.options.maxDate;
        }
    }

    public setMinDate(date: Date | undefined): void {
        this.options.minDate = date;
        this.updateButtonStates();
    }

    public setMaxDate(date: Date | undefined): void {
        this.options.maxDate = date;
        this.updateButtonStates();
    }

    public disableNavigation(disable: boolean): void {
        this.prevButton.disabled = disable;
        this.nextButton.disabled = disable;
        this.todayButton.disabled = disable;
    }

    public showTodayButton(show: boolean): void {
        this.todayButton.style.display = show ? '' : 'none';
    }

    public focus(): void {
        this.monthLabel.focus();
    }

    public destroy(): void {
        this.element.remove();
    }
}
