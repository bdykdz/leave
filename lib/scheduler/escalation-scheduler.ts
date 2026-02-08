import { EscalationService } from '@/lib/services/escalation-service';

class EscalationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRun: Date | null = null;
  private runCount = 0;
  
  // Run every 6 hours by default
  private intervalMs = 6 * 60 * 60 * 1000; 

  /**
   * Start the escalation scheduler
   */
  start(intervalMs?: number) {
    if (this.isRunning) {
      console.log('Escalation scheduler is already running');
      return;
    }

    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    console.log(`Starting escalation scheduler with interval: ${this.intervalMs}ms`);
    
    // Run immediately on start
    this.runEscalationCheck();
    
    // Then set up interval
    this.intervalId = setInterval(() => {
      this.runEscalationCheck();
    }, this.intervalMs);
    
    this.isRunning = true;
  }

  /**
   * Stop the escalation scheduler
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      console.log('Escalation scheduler is not running');
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    
    console.log('Escalation scheduler stopped');
  }

  /**
   * Run escalation check
   */
  private async runEscalationCheck() {
    try {
      console.log(`[Escalation Scheduler] Running check #${++this.runCount} at ${new Date().toISOString()}`);
      
      const escalationService = new EscalationService();
      
      // Initialize settings if needed
      await escalationService.initializeDefaultSettings();
      
      // Check and escalate pending approvals
      await escalationService.checkAndEscalatePendingApprovals();
      
      this.lastRun = new Date();
      
      console.log(`[Escalation Scheduler] Check completed successfully`);
    } catch (error) {
      console.error('[Escalation Scheduler] Error during escalation check:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      lastRun: this.lastRun,
      runCount: this.runCount,
      nextRun: this.isRunning && this.lastRun 
        ? new Date(this.lastRun.getTime() + this.intervalMs)
        : null
    };
  }

  /**
   * Manually trigger an escalation check
   */
  async triggerManual() {
    console.log('[Escalation Scheduler] Manual trigger requested');
    await this.runEscalationCheck();
  }
}

// Create singleton instance
const escalationScheduler = new EscalationScheduler();

// Auto-start in production
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_INTERNAL_SCHEDULER === 'true') {
  // Start with default 6-hour interval
  escalationScheduler.start();
}

export { escalationScheduler };