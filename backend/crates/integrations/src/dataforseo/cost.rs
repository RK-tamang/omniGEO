//! DataForSEO cost tracking and budget enforcement.

use std::sync::atomic::{AtomicI64, Ordering};

/// Tracks DataForSEO spending against configured budgets.
#[derive(Clone, Debug)]
pub struct DataForSeoCostTracker {
    monthly_budget_usd: f64,
    daily_budget_usd: f64,
    daily_spent_microusd: AtomicI64,
    monthly_spent_microusd: AtomicI64,
}

impl DataForSeoCostTracker {
    pub fn new(monthly_budget_usd: f64, daily_budget_usd: f64) -> Self {
        Self {
            monthly_budget_usd,
            daily_budget_usd,
            daily_spent_microusd: AtomicI64::new(0),
            monthly_spent_microusd: AtomicI64::new(0),
        }
    }

    pub fn monthly_budget_usd(&self) -> f64 {
        self.monthly_budget_usd
    }

    pub fn daily_budget_usd(&self) -> f64 {
        self.daily_budget_usd
    }

    pub fn check_budget(&self, estimated_microusd: i64) -> Result<(), String> {
        let monthly_spent = self.monthly_spent_microusd.load(Ordering::Relaxed);
        let daily_spent = self.daily_spent_microusd.load(Ordering::Relaxed);

        let monthly_microusd = (self.monthly_budget_usd * 1_000_000.0) as i64;
        let daily_microusd = (self.daily_budget_usd * 1_000_000.0) as i64;

        if monthly_spent + estimated_microusd > monthly_microusd {
            return format!(
                "Monthly DataForSEO budget of ${:.2} would be exceeded (spent ${:.2}, request ${:.2})",
                self.monthly_budget_usd,
                monthly_spent as f64 / 1_000_000.0,
                estimated_microusd as f64 / 1_000_000.0
            )
            .into();
        }
        if daily_spent + estimated_microusd > daily_microusd {
            return format!(
                "Daily DataForSEO budget of ${:.2} would be exceeded (spent ${:.2}, request ${:.2})",
                self.daily_budget_usd,
                daily_spent as f64 / 1_000_000.0,
                estimated_microusd as f64 / 1_000_000.0
            )
            .into();
        }
        Ok(())
    }

    pub fn record_cost(&self, cost_microusd: i64) {
        self.daily_spent_microusd.fetch_add(cost_microusd, Ordering::Relaxed);
        self.monthly_spent_microusd.fetch_add(cost_microusd, Ordering::Relaxed);
    }

    pub fn daily_spent_usd(&self) -> f64 {
        self.daily_spent_microusd.load(Ordering::Relaxed) as f64 / 1_000_000.0
    }

    pub fn monthly_spent_usd(&self) -> f64 {
        self.monthly_spent_microusd.load(Ordering::Relaxed) as f64 / 1_000_000.0
    }
}

impl Default for DataForSeoCostTracker {
    fn default() -> Self {
        Self::new(100.0, 10.0)
    }
}
